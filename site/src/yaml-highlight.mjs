// YAML syntax highlighting for template/rule previews (dependency-free).
// Only key/value colouring is promised — enough to read rules at a glance.

const YKINDS = [
  ['comment', /^#.*/],
  ['string', /^"(?:[^"\\]|\\.)*"/],
  ['string', /^'(?:[^'\\]|\\.)*'/],
  ['meta', /^[A-Za-z_][\w.-]*(?=\s*:)/],
  ['bool', /^(?:true|false|null|~)(?=\s|$)/],
  ['number', /^-?\d[\d,]*(?:\.\d+)?/],
  ['punct', /^[:[\]{},|>&*!?@`#-]/],
  ['space', /^[ \t]+/],
];

function tokenizeLine(line) {
  const out = [];
  let rest = line;
  while (rest.length) {
    let matched = false;
    for (const [kind, re] of YKINDS) {
      const m = rest.match(re);
      if (m && m[0].length) {
        out.push({ k: kind, v: m[0] });
        rest = rest.slice(m[0].length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      out.push({ k: 'plain', v: rest[0] });
      rest = rest.slice(1);
    }
  }
  return out;
}

export function highlightYaml(text) {
  return String(text ?? '').split('\n').map(tokenizeLine);
}
