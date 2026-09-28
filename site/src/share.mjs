// 「分享到 Mirato」的纯逻辑（不碰 DOM，可单测）。
//
// 为什么要绕一层：Web Share API 分享**文件**时，浏览器只接受一份白名单里的 MIME 类型
// （MDN "Shareable file types"：application/pdf、audio/*、image/*、text/css|csv|html|plain、video/*）。
// `.yaml` / `text/yaml` **不在**白名单里 —— 直接以 text/yaml 分享会被 Chrome 拒绝
// （canShare 返回 false，或 share 抛 TypeError）。
// 所以这里的文件一律以 text/plain 交付，身份靠**内容**辨认（Mirato 侧同样按内容解析，不看扩展名）。
export const SHARE_MIME = 'text/plain';

/** 分享给 Mirato 的文件名：`<id>-<revision>.template.yaml` / `<id>-<revision>.rules.yaml`。 */
export function shareFileName(id, revision, label) {
  const safeId = String(id || 'template').replace(/[^\w.-]+/g, '-');
  const safeRev = String(revision || '').replace(/[^\w.-]+/g, '-');
  return [safeId, safeRev, label].filter(Boolean).join('.') + '.yaml';
}

/**
 * 用页面已校验（sha256）的文本构造分享文件。
 * resources 来自 loadResources()：{ template, rules }，都是字符串时才可用。
 * 返回 [] 表示"还不具备分享条件"（页面仍在加载，或环境没有 File 构造器）。
 */
export function buildShareFiles(resources, { id, revision } = {}, makeFile = globalThis.File) {
  const template = resources?.template;
  const rules = resources?.rules;
  if (typeof template !== 'string' || typeof rules !== 'string') return [];
  if (typeof makeFile !== 'function') return [];
  return [
    new makeFile([template], shareFileName(id, revision, 'template'), { type: SHARE_MIME }),
    new makeFile([rules], shareFileName(id, revision, 'rules'), { type: SHARE_MIME }),
  ];
}

/** 浏览器能不能真的分享这些文件；没有 navigator.share/canShare 一律当不支持。 */
export function canShareFiles(nav, files) {
  if (!files || files.length === 0) return false;
  if (typeof nav?.share !== 'function') return false;
  if (typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files }) === true;
  } catch {
    return false;
  }
}

/** 分享内容里带的标记行，接收端据此认出这是 Mirato 模板包（而不是用户随手分享的文本）。 */
export const BUNDLE_MARKER = '# mirato-template-bundle v1';

/**
 * 把模板与规则拼成一份多文档 YAML 文本（`---` 分隔）。
 * 用途：某些设备**不允许分享文件**（实测 Pixel 10 / Chrome 153：canShare 为 true，
 * 但 share({files}) 抛 NotAllowedError: Permission denied），而分享**文本**是允许的。
 * 接收端（Mirato）从 EXTRA_TEXT 拿到这段文本，按 `---` 切开即得两份文档；
 * 头部注释带 id / revision，方便对齐版本。
 */
export function buildBundleText(resources, { id, revision } = {}) {
  const template = resources?.template;
  const rules = resources?.rules;
  if (typeof template !== 'string' || typeof rules !== 'string') return '';
  const head = [BUNDLE_MARKER, `# id: ${id || 'template'}`, `# revision: ${revision || ''}`];
  return [...head, '---', template.trimEnd(), '---', rules.trimEnd(), ''].join('\n');
}

/**
 * 执行分享，返回状态码（由调用方翻译成文案）：
 *   'shared' | 'cancelled' | 'blocked' | 'unsupported' | 'error'
 *
 * 策略：**优先按文件分享**（接收端拿到的是文件，语义更清楚）；
 * 若该设备拒绝文件分享（NotAllowedError / TypeError），立刻**回落到按文本分享** ——
 * 同一条系统面板，接收端改从 EXTRA_TEXT 取内容。用户取消（AbortError）不再重试。
 */
export async function shareToMirato(nav, payload, title) {
  const { files = [], text = '' } = payload || {};
  if (typeof nav?.share !== 'function') return 'unsupported';
  const lastError = async (fn) => {
    try {
      await fn();
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      if (error?.name === 'NotAllowedError') return 'blocked';
      return 'error';
    }
  };

  if (files.length && canShareFiles(nav, files)) {
    const first = await lastError(() => nav.share({ files, title }));
    if (first === 'shared' || first === 'cancelled') return first;
    // 文件被拒 → 回落文本
  }
  if (!text) return 'unsupported';
  return lastError(() => nav.share({ text, title }));
}
