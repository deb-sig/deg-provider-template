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

/**
 * 执行分享，返回状态码（由调用方翻译成文案）：
 *   'shared'      —— 用户已完成分享
 *   'cancelled'   —— 用户自己取消了（不提示，别打扰）
 *   'blocked'     —— 非用户手势触发（NotAllowedError）
 *   'unsupported' —— 浏览器/环境不支持分享文件
 *   'error'       —— 其它失败（DataError 等）
 */
export async function shareToMirato(nav, files, title) {
  if (!canShareFiles(nav, files)) return 'unsupported';
  try {
    await nav.share({ files, title });
    return 'shared';
  } catch (error) {
    if (error?.name === 'AbortError') return 'cancelled';
    if (error?.name === 'NotAllowedError') return 'blocked';
    return 'error';
  }
}
