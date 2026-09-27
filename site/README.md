# Template Commons (Vue / Vite)

Single multilingual marketplace for the existing DEG registry. Original template data and registry v1 are unchanged.

## Build and test

Node 20+ and npm:

```sh
cd site
npm ci
npm test
npm run build
npm run preview -- --port 8917
```

`build` generates the supplemental catalog and every registered release manifest, then builds `dist/`. Serve `dist/` as static content. Relative asset URLs and hash routes work under a GitHub Pages project subdirectory. `.github/workflows/pages.yml` installs dependencies, runs tests, builds and publishes the artifact. It currently deploys from `dev-v3` (test line); move it back to `main` when the v3 templates ship.

NAS build without host Node (existing image, normal application UID):

```sh
docker run --rm --user 972:967 --entrypoint sh -e HOME=/tmp \
  -v /vol1/1000/Documents/self/programs/beancount/deg-provider-template:/repo \
  -w /repo/site gitea/runner-images:ubuntu-latest \
  -c 'npm ci && npm test && npm run build'
```

## Data and safety

- `scripts/build-site-index.mjs` uses the `yaml` parser, rejects unsafe path segments and symlink escapes, checks latest template/rules against the registered recommended revision, stages successful generation, replaces only generated `public/providers/`, `public/releases/`, `provider-index.json`, and copies the unchanged Apache-2.0 license.
- `#/template/<id>/<revision>` is strict: nonexistent revisions show an error, never another revision. Hash and byte lengths cover template, rules, each sample and expected output separately. Hashes do not authenticate a publisher. These generated manifests are not an immutable release hosting service.
- UI translations and provider presentation names live separately in `src/i18n.mjs` and `src/presentation.mjs`. Browser preference selects English or supported Chinese; explicit selection persists. No country or currency inference from UI language.
- `public/known-issues.json` contains only sanitized historical local validation summaries, binary hash and recorded resource hashes. No transactions, private filesystem paths or fabricated pass claims. Where recorded resource hashes match, known failures are shown. A report may lack a sample hash (notably older spreadsheet runs); it is explicitly historical rather than current full release certification. Other entries remain unverified; Mirato is always unverified.
- Downloads and previews select the same real revision. CSV decoding respects declared encoding. Previews are truncated whole-file examples, not row mapping. XLS/XLSX are download-only. Async loads are aborted and token-guarded; stale resources are cleared. Resource length and (on secure contexts) SHA-256 are checked when previewing.
- Expert YAML editor keeps imports, exports, local save, raw editing, card add/delete/edit. Mature YAML document operations preserve unedited keys/comments. Local drafts autosave, including unfinished syntax, per provider across revisions; existing storage key is retained. YAML validity does not imply DEG financial correctness. No private files are uploaded.

## Deliberately unavailable

Mirato install protocol/deep link and browser/WASM execution are not connected; controls explain this instead of pretending success. This build adds structural validation and tests, not a complete formal external JSON Schema or a new financial engine verification. Browser E2E acceptance is separate from `npm test`.

Original source: https://github.com/deb-sig/deg-provider-template — Apache-2.0 (`public/LICENSE` is copied without modification).
