// Beancount syntax highlighting — dependency-free tokenizer.
// Output: array of lines; each line is an array of {k: tokenKind, v: rawText}.
// Callers render `v` as text nodes (never innerHTML), so no escaping is needed here.

const KINDS = [
  // Ordered: strings and comments first so ; / # inside them are not re-tokenized.
  ['string', /^"(?:[^"\\]|\\.)*"/],
  ['comment', /^;.*/],
  ['date', /^\d{4}-\d{2}-\d{2}/],
  ['tag', /^#[^\s]+/],
  ['link', /^\^[^\s]+/],
  ['account', /^(?:Assets|Liabilities|Equity|Income|Expenses)(?::[\p{L}\p{N}'_.-]+)+/u],
  ['directive', /^(?:open|close|balance|pad|note|document|price|event|query|commodity|plugin|option|include|pushtag|poptag|pushmeta|popmeta|txn)\b/],
  ['meta', /^[a-z][\w-]*:/],
  ['number', /^-?\d[\d,]*(?:\.\d+)?/],
  ['currency', /^[A-Z][A-Z0-9'._-]{1,11}/],
  ['flag', /^[*!]/],
  ['space', /^[ \t]+/],
];

function tokenizeLine(line) {
  const out = [];
  let rest = line;
  while (rest.length) {
    let matched = false;
    for (const [kind, re] of KINDS) {
      const m = rest.match(re);
      if (m) {
        out.push({ k: kind, v: m[0] });
        rest = rest.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      out.push({ k: 'punct', v: rest[0] });
      rest = rest.slice(1);
    }
  }
  return out;
}

export function highlightBeancount(text) {
  return String(text ?? '').split('\n').map(tokenizeLine);
}

/** Plain (unhighlighted) lines, used by the raw view of non-beancount text. */
export function plainLines(text) {
  return String(text ?? '').split('\n').map((v) => [{ k: 'punct', v }]);
}
