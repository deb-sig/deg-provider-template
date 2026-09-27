export function selectRelease(provider, revision) {
  const key = revision === undefined || revision === 'latest' ? provider.latest : revision;
  if (!Object.hasOwn(provider.releases, key)) throw new Error('unknownRevision');
  return provider.releases[key];
}
export function knownIssueForRelease(release, records = []) {
  const record=records.find(r=>r.id===release.id);
  if(!record || !Object.keys(record.hashes || {}).length)return null;
  const a=release.artifacts;
  const assets=[a.template,a.rules,...a.bills,a.expected].filter(Boolean);
  return Object.entries(record.hashes).every(([filename,hash])=>assets.some(a=>a.path.endsWith('/'+filename)&&a.sha256===hash))?record:null;
}
export function parseRoute(hash) {
  try {
    const parts = (hash || '#/').slice(2).split('/').map(decodeURIComponent);
    if (parts[0] === '' && parts.length === 1) return { page: 'market' };
    if (parts[0] === 'contribute' && parts.length === 1) return { page: 'contribute' };
    if (parts[0] === 'template' && parts[1] && parts.length <= 3) return { page: 'detail', id: parts[1], revision: parts[2] };
  } catch {}
  return { page: 'error', error: 'notFound' };
}
