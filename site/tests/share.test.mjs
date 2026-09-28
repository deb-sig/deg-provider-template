import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHARE_MIME,
  shareFileName,
  buildShareFiles,
  canShareFiles,
  shareToMirato,
} from '../src/share.mjs';

// 浏览器分享文件的白名单（MDN "Shareable file types"）。.yaml / text/yaml **不在**里面，
// 所以这条测试是防回归用的：谁要是把 MIME 改回 text/yaml，分享会被 Chrome 直接拒。
const SHAREABLE_MIME = [
  'application/pdf',
  /^audio\//,
  /^image\//,
  'text/css',
  'text/csv',
  'text/html',
  'text/plain',
  /^video\//,
];
const isShareable = (mime) =>
  SHAREABLE_MIME.some((rule) => (typeof rule === 'string' ? rule === mime : rule.test(mime)));

const resources = { template: 'id: alipay\ntemplate:\n  fileFormat: csv\n', rules: 'templateRules:\n  - id: 基础交易\n' };

test('shareFileName keeps id/revision readable and sanitized', () => {
  assert.equal(shareFileName('alipay', '2026-05-23', 'template'), 'alipay.2026-05-23.template.yaml');
  assert.equal(shareFileName('cmb-credit', '2026-05-01', 'rules'), 'cmb-credit.2026-05-01.rules.yaml');
  // 空白/斜杠/中文都收敛成可读文件名，不留路径分隔符
  assert.equal(shareFileName('a/b c', '2026/05/23', 'template'), 'a-b-c.2026-05-23.template.yaml');
  assert.equal(shareFileName('', '', 'rules'), 'template.rules.yaml');
});

test('buildShareFiles hands over exactly the checked template and rules', async () => {
  const files = buildShareFiles(resources, { id: 'alipay', revision: '2026-05-23' });
  assert.equal(files.length, 2);
  assert.deepEqual(files.map((f) => f.name), [
    'alipay.2026-05-23.template.yaml',
    'alipay.2026-05-23.rules.yaml',
  ]);
  assert.equal(await files[0].text(), resources.template);
  assert.equal(await files[1].text(), resources.rules);
});

test('every shared file uses a MIME type the Web Share API allows', () => {
  const files = buildShareFiles(resources, { id: 'alipay', revision: '2026-05-23' });
  for (const file of files) {
    assert.equal(file.type, SHARE_MIME);
    assert.ok(isShareable(file.type), `${file.type} is not shareable — .yaml must be sent as text/plain`);
  }
});

test('buildShareFiles stays empty until both documents are loaded', () => {
  assert.deepEqual(buildShareFiles(null, { id: 'alipay' }), []);
  assert.deepEqual(buildShareFiles({ template: 'a' }, { id: 'alipay' }), []);
  assert.deepEqual(buildShareFiles({ rules: 'b' }, { id: 'alipay' }), []);
  // 环境没有 File 构造器（老浏览器/服务端渲染）时也不该抛。
  // 注意传 null 而不是 undefined：undefined 会触发默认参数（用 globalThis.File）。
  assert.deepEqual(buildShareFiles(resources, { id: 'alipay' }, null), []);
});

test('canShareFiles needs both navigator.share and a positive canShare', () => {
  const files = buildShareFiles(resources, { id: 'alipay', revision: '2026-05-23' });
  assert.equal(canShareFiles({ share() {} }, files), false);
  assert.equal(canShareFiles({ share() {}, canShare: () => false }, files), false);
  assert.equal(canShareFiles({ share() {}, canShare: () => { throw new Error('nope'); } }, files), false);
  assert.equal(canShareFiles({ share() {}, canShare: () => true }, files), true);
  assert.equal(canShareFiles({ share() {}, canShare: () => true }, []), false);
  assert.equal(canShareFiles(undefined, files), false);
});

test('shareToMirato maps every outcome to a status the UI can translate', async () => {
  const files = buildShareFiles(resources, { id: 'alipay', revision: '2026-05-23' });
  const ok = { share: async (data) => { ok.data = data; }, canShare: () => true };
  assert.equal(await shareToMirato(ok, files, 'alipay@2026-05-23'), 'shared');
  assert.equal(ok.data.files.length, 2, 'both files are handed over in one share');
  assert.equal(ok.data.title, 'alipay@2026-05-23');

  const aborted = { share: async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; }, canShare: () => true };
  assert.equal(await shareToMirato(aborted, files, 't'), 'cancelled');

  const blocked = { share: async () => { const e = new Error('x'); e.name = 'NotAllowedError'; throw e; }, canShare: () => true };
  assert.equal(await shareToMirato(blocked, files, 't'), 'blocked');

  const broken = { share: async () => { const e = new Error('x'); e.name = 'DataError'; throw e; }, canShare: () => true };
  assert.equal(await shareToMirato(broken, files, 't'), 'error');

  // 不支持时**不要**去调 share（避免抛异常/空面板）
  let called = false;
  const unsupported = { share: async () => { called = true; }, canShare: () => false };
  assert.equal(await shareToMirato(unsupported, files, 't'), 'unsupported');
  assert.equal(called, false);
});

test('every share status has a message in all three locales', async () => {
  const { translate, locales } = await import('../src/i18n.mjs');
  const keys = ['shareToMirato', 'shareShared', 'shareUnsupported', 'shareBlocked', 'shareError', 'installNote', 'shareUnavailableNote'];
  for (const locale of locales) {
    for (const key of keys) {
      const value = translate(locale, key);
      assert.notEqual(value, key, `${locale} is missing ${key}`);
      assert.ok(value.length > 0, `${locale}.${key} is empty`);
    }
  }
});
