import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHARE_MIME,
  BUNDLE_MARKER,
  shareFileName,
  buildShareFiles,
  buildBundleText,
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

test('buildBundleText packs template + rules into one multi-document YAML', () => {
  const text = buildBundleText(resources, { id: 'alipay', revision: '2026-05-23' });
  const parts = text.split(/^---$/m);
  assert.equal(parts.length, 3, '头部注释 + 两份文档（`---` 分隔两次）');
  const docs = parts.slice(1).map((d) => d.trim());
  assert.equal(docs.length, 2, '正好两份文档：模板 + 规则');
  assert.ok(text.startsWith(BUNDLE_MARKER), '带标记行，接收端据此认出是模板包');
  assert.ok(text.includes('# id: alipay') && text.includes('# revision: 2026-05-23'));
  assert.ok(docs[0].includes('id: alipay'), '第一份是模板');
  assert.ok(docs[1].includes('templateRules'), '第二份是规则');
  // 缺一份就不产文本（页面仍在加载）
  assert.equal(buildBundleText({ template: 'a' }, { id: 'x' }), '');
  assert.equal(buildBundleText(null, { id: 'x' }), '');
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

const named = (name) => { const e = new Error('x'); e.name = name; return e; };
const payload = () => ({
  files: buildShareFiles(resources, { id: 'alipay', revision: '2026-05-23' }),
  text: buildBundleText(resources, { id: 'alipay', revision: '2026-05-23' }),
});

test('shareToMirato prefers files and reports every outcome', async () => {
  const ok = { share: async (data) => { ok.data = data; }, canShare: () => true };
  assert.equal(await shareToMirato(ok, payload(), 'alipay@2026-05-23'), 'shared');
  assert.equal(ok.data.files.length, 2, 'both files are handed over in one share');
  assert.equal(ok.data.title, 'alipay@2026-05-23');
  assert.equal(ok.data.text, undefined, '文件可用时不额外带文本');

  const aborted = { share: async () => { throw named('AbortError'); }, canShare: () => true };
  assert.equal(await shareToMirato(aborted, payload(), 't'), 'cancelled');

  const broken = { share: async () => { throw named('DataError'); }, canShare: () => true };
  assert.equal(await shareToMirato(broken, payload(), 't'), 'error');
});

// 实测 Pixel 10 / Chrome 153：canShare({files}) 为真，但 share({files}) 抛
// NotAllowedError: Permission denied；而分享**文本**是允许的 → 必须自动回落。
test('files denied by the device → falls back to sharing the bundle text', async () => {
  const calls = [];
  const nav = {
    canShare: () => true,
    share: async (data) => {
      calls.push(data);
      if (data.files) throw named('NotAllowedError');
      nav.done = data;
    },
  };
  assert.equal(await shareToMirato(nav, payload(), 't'), 'shared');
  assert.equal(calls.length, 2, '先试文件，被拒后回落到文本');
  assert.ok(calls[0].files, '第一次尝试是文件');
  assert.ok(nav.done.text.startsWith('# mirato-template-bundle v1'), '第二次带的是模板包文本');
});

test('cancelled on files does not fall back (user said no)', async () => {
  const calls = [];
  const nav = { canShare: () => true, share: async (d) => { calls.push(d); throw named('AbortError'); } };
  assert.equal(await shareToMirato(nav, payload(), 't'), 'cancelled');
  assert.equal(calls.length, 1);
});

test('no share support, or nothing shareable → unsupported without calling share', async () => {
  let called = 0;
  // 设备说不能分享文件，但分享文本还是允许的 → 走文本
  const nav = { share: async () => { called += 1; }, canShare: () => false };
  assert.equal(await shareToMirato(nav, payload(), 't'), 'shared');
  assert.equal(called, 1);
  // 完全没有内容 → 不调 share
  assert.equal(await shareToMirato(nav, { files: [], text: '' }, 't'), 'unsupported');
  assert.equal(called, 1);
  // 浏览器没有 share API
  assert.equal(await shareToMirato(undefined, payload(), 't'), 'unsupported');
});

test('blocked on the text fallback is reported as blocked', async () => {
  const nav = { canShare: () => false, share: async () => { throw named('NotAllowedError'); } };
  assert.equal(await shareToMirato(nav, payload(), 't'), 'blocked');
});

test('every share status has a message in all three locales', async () => {
  const { translate, locales } = await import('../src/i18n.mjs');
  const keys = ['shareToMirato', 'shareError'];
  for (const locale of locales) {
    for (const key of keys) {
      const value = translate(locale, key);
      assert.notEqual(value, key, `${locale} is missing ${key}`);
      assert.ok(value.length > 0, `${locale}.${key} is empty`);
    }
  }
});
