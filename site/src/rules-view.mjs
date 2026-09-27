// Turn DEG rules into readable sentences for the card view.
// Design: simple conditions become prose; anything with grouping, method chains or
// raw[] falls back to "complex" and the caller shows the highlighted source instead.
// No rule semantics are invented here — unknown shapes stay raw.

const OP_KEYS = {
  '==': 'opIs',
  '!=': 'opIsNot',
  '~': 'opContains',
  '=~': 'opMatches',
  '^=': 'opStarts',
  '$=': 'opEnds',
  '>=': 'opAtLeast',
  '<=': 'opAtMost',
};

const FIELD_KEYS = {
  payee: 'fieldPayee',
  narration: 'fieldNarration',
  amount: 'fieldAmount',
  currency: 'fieldCurrency',
  date: 'fieldDate',
  type: 'fieldType',
  method: 'fieldMethod',
};

const SUFFIX_KEYS = { time: 'suffixTime', date: 'suffixDate', timestamp: 'suffixTimestamp' };

const CONDITION_RE =
  /^(<[^>]+>|raw\[[^\]]+\]|[A-Za-z_]\w*)((?:\.[A-Za-z_]\w*)*)\s*(==|!=|>=|<=|~|=~|\^=|\$=)\s*([\s\S]+)$/;

export function fieldLabel(field, t) {
  const column = field.match(/^<([^>]+)>$/);
  if (column) return column[1];
  const raw = field.match(/^raw\[([^\]]+)\]$/);
  if (raw) return raw[1];
  const base = field.split('.')[0];
  const key = FIELD_KEYS[base];
  return key ? t(key) : base;
}

/** @returns {{empty:boolean, complex:boolean, raw:string, join:'and'|'or', conds:Array}} */
export function parseWhen(when) {
  const text = String(when ?? '').trim();
  if (!text) return { empty: true, complex: false, raw: '', join: 'and', conds: [] };
  // Grouping or method chains cannot be rendered as a plain sentence.
  if (/[()[\]{}]/.test(text) || /\.\w+\s*\(/.test(text)) {
    return { empty: false, complex: true, raw: text, join: 'and', conds: [] };
  }
  const hasOr = /\s\|\|\s/.test(text);
  const hasAnd = /\s&&\s/.test(text);
  if (hasOr && hasAnd) {
    return { empty: false, complex: true, raw: text, join: 'and', conds: [] };
  }
  const join = hasOr ? 'or' : 'and';
  const parts = text.split(/\s+(?:&&|\|\|)\s+/).map((s) => s.trim()).filter(Boolean);
  const conds = [];
  for (const part of parts) {
    const m = part.match(CONDITION_RE);
    if (!m) return { empty: false, complex: true, raw: text, join, conds: [] };
    conds.push({
      field: m[1],
      label: fieldLabel(m[1], () => ''),
      suffix: (m[2] || '').replace(/^\./, ''),
      op: m[3],
      value: m[4].trim().replace(/^["']|["']$/g, ''),
    });
  }
  return { empty: false, complex: false, raw: text, join, conds };
}

function accountOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return value.account || JSON.stringify(value);
  return String(value);
}

/** One readable phrase per condition. */
export function conditionTexts(parsed, t) {
  return parsed.conds.map((c) => {
    const suffix = SUFFIX_KEYS[c.suffix] ? `（${t(SUFFIX_KEYS[c.suffix])}）` : '';
    const opKey = OP_KEYS[c.op];
    const op = opKey ? t(opKey) : c.op;
    const label = c.label || fieldLabel(c.field, t);
    return `${label}${suffix} ${op} ${c.value}`;
  });
}

/** Human summary lines for an action block. */
export function actionTexts(actions, t) {
  const out = [];
  if (!actions || typeof actions !== 'object') return out;
  if (actions.ignore === true) out.push(t('actIgnore'));
  if (actions.flag) out.push(`${t('actFlag')} ${actions.flag}`);
  if (actions.from) out.push(`${t('actFrom')} ${accountOf(actions.from)}`);
  if (actions.to) out.push(`${t('actTo')} ${accountOf(actions.to)}`);
  if (actions.payee) out.push(`${t('actPayee')} ${actions.payee}`);
  if (actions.narration) out.push(`${t('actNarration')} ${actions.narration}`);
  if (actions.amount) out.push(`${t('actAmount')} ${actions.amount}`);
  if (actions.currency) out.push(`${t('actCurrency')} ${actions.currency}`);
  if (Array.isArray(actions.postings)) {
    out.push(`${t('actPostings')} · ${actions.postings.length}`);
  }
  if (actions.metadata && typeof actions.metadata === 'object') {
    out.push(`${t('actMetadata')}: ${Object.keys(actions.metadata).join(', ')}`);
  }
  if (actions.vars && typeof actions.vars === 'object') {
    out.push(`${t('actVars')}: ${Object.keys(actions.vars).join(', ')}`);
  }
  if (actions.tags) {
    const tags = Array.isArray(actions.tags) ? actions.tags : [actions.tags];
    out.push(`${t('actTags')}: ${tags.join(', ')}`);
  }
  if (actions.link) out.push(`${t('actLink')} ${actions.link}`);
  return out;
}

/** Card model for one rule. `when` may be absent (template base rules). */
export function ruleCard(rule, t) {
  const when = parseWhen(rule?.when);
  const actions = rule?.actions || {};
  const summary = [];
  if (when.empty) {
    summary.push(t('whenAlways'));
  } else if (when.complex) {
    summary.push(t('whenComplex'));
  } else {
    const conds = conditionTexts(when, t);
    const glue = when.join === 'or' ? ` ${t('joinOr')} ` : ` ${t('joinAnd')} `;
    summary.push(`${t('whenPrefix')} ${conds.join(glue)}${t('whenSuffix')}`);
  }
  for (const line of actionTexts(actions, t)) summary.push(line);
  return {
    id: rule?.id || t('unnamedRule'),
    enabled: rule?.enabled !== false,
    summary,
    complex: when.complex,
    conditionCount: when.conds.length,
  };
}
