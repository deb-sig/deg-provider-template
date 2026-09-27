#!/usr/bin/env node
import { readFile, readdir, realpath, mkdir, writeFile, copyFile, mkdtemp, rm, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../site/package.json', import.meta.url));
const { parse } = require('yaml');
export function safeSegment(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value) || value.includes('..')) throw new Error('Invalid path segment: ' + value);
  return value;
}
export function releasePath(source, id, revision) {
  safeSegment(id); safeSegment(revision);
  const parts = String(source).split('/');
  if (parts.length !== 3 || parts[0] !== id || parts[1] !== 'latest') throw new Error('Invalid registry resource path: ' + source);
  parts.forEach(safeSegment);
  return `${id}/${revision}/${parts[2]}`;
}
async function generate(repoRoot, output) {
  const registry = parse(await readFile(path.join(repoRoot, 'registry.yaml'), 'utf8'));
  if (registry.version !== 1 || !Array.isArray(registry.templates)) throw new Error('Unsupported registry');
  const realRoot = await realpath(repoRoot);
  async function asset(relative) {
    relative.split('/').forEach(safeSegment);
    const source = await realpath(path.join(repoRoot, relative));
    if (!source.startsWith(realRoot + path.sep)) throw new Error('Resource escapes repository');
    const bytes = await readFile(source);
    const publicPath = 'providers/' + relative;
    const target = path.join(output, publicPath);
    await mkdir(path.dirname(target), {recursive:true}); await copyFile(source, target);
    return { path:relative, publicPath, sha256:createHash('sha256').update(bytes).digest('hex'), bytes:bytes.length };
  }
  const providers = [];
  for (const entry of registry.templates) {
    safeSegment(entry.id);
    if (providers.some(p=>p.id===entry.id) || !Array.isArray(entry.versions) || !entry.versions.length || !entry.versions.includes(entry.latest) || new Set(entry.versions).size!==entry.versions.length) throw new Error('Invalid releases: ' + entry.id);
    // 'latest' is a mutable alias, not another release. Require both registered resources to match.
    for (const source of [entry.path, entry.starterRules]) {
      const registered = releasePath(source, entry.id, entry.latest);
      const [a,b] = await Promise.all([realpath(path.join(repoRoot,source)),realpath(path.join(repoRoot,registered))]);
      if (![a,b].every(p=>p.startsWith(realRoot+path.sep))) throw new Error('Resource escapes repository');
      if (!(await readFile(a)).equals(await readFile(b))) throw new Error('Latest differs from registered revision: '+source);
    }
    const releases = {};
    for (const revision of entry.versions) {
      safeSegment(revision);
      const template = await asset(releasePath(entry.path,entry.id,revision));
      const rules = await asset(releasePath(entry.starterRules,entry.id,revision));
      const doc = parse(await readFile(path.join(repoRoot,template.path),'utf8'));
      const rulesDoc = parse(await readFile(path.join(repoRoot,rules.path),'utf8'));
      if (!doc || typeof doc.template !== 'object' || typeof doc.template.fileFormat !== 'string' || !rulesDoc || typeof rulesDoc !== 'object') throw new Error('Invalid YAML structure: ' + entry.id);
      const files = await readdir(path.join(repoRoot, entry.id, revision));
      const bills = await Promise.all(files.filter(f=>/^bill\.(csv|xlsx?|tsv)$/i.test(f)).sort().map(f=>asset(`${entry.id}/${revision}/${f}`)));
      const expected = files.includes('expected.beancount') ? await asset(`${entry.id}/${revision}/expected.beancount`) : null;
      const manifest = {schemaVersion:1,id:entry.id,revision,meta:{...doc.template,schema:doc.schema || ''},artifacts:{template,rules,bills,expected}};
      const manifestPath = `releases/${entry.id}/${revision}.json`;
      await mkdir(path.dirname(path.join(output,manifestPath)),{recursive:true});
      await writeFile(path.join(output,manifestPath),JSON.stringify(manifest,null,2)+'\n');
      releases[revision] = {...manifest,manifestPath};
    }
    providers.push({...entry,releases,formats:[...new Set(Object.values(releases).map(r=>r.meta.fileFormat.toUpperCase()))]});
  }
  const index = {schemaVersion:2,registryVersion:registry.version,providers};
  await mkdir(output,{recursive:true});
  await writeFile(path.join(output,'provider-index.json'),JSON.stringify(index,null,2)+'\n');
  console.log(`Generated ${providers.length} providers / ${providers.reduce((n,p)=>n+p.versions.length,0)} registered releases`);
  return index;
}
export async function buildIndex(repoRoot = root, output = path.join(repoRoot, 'site/public')) {
  await mkdir(path.dirname(output),{recursive:true});
  const staging = await mkdtemp(path.join(path.dirname(output),'.catalog-'));
  try {
    const index = await generate(repoRoot, staging);
    await mkdir(output,{recursive:true});
    // These namespaces are generated exclusively by this script; unrelated public files stay untouched.
    for(const entry of ['providers','releases','provider-index.json']) {
      await rm(path.join(output,entry),{recursive:true,force:true});
      await rename(path.join(staging,entry),path.join(output,entry));
    }
    await copyFile(path.join(repoRoot,'LICENSE'),path.join(output,'LICENSE'));
    return index;
  } finally {await rm(staging,{recursive:true,force:true});}
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) buildIndex().catch(e=>{console.error(e);process.exitCode=1;});
