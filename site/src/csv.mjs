// Minimal RFC4180-ish delimited-text parser for previewing exported statements.
// Handles quoted fields, embedded delimiters/newlines/CRLF, and the "" escape.

function detectDelimiter(firstLine) {
  const candidates = [',', '\t', ';', '|'];
  let best = ',';
  let bestCount = 0;
  for (const d of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i += 1) {
      const c = firstLine[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (c === d && !inQuotes) count += 1;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Split parsed rows into the statement preamble, the header row and the body.
 * Bank exports put titles/account lines before the real header; pick the row with the
 * most non-empty cells (earliest wins on a tie) instead of blindly taking row 0.
 */
export function splitTable(rows, options = {}) {
  const scan = options.scanRows ?? 30;
  const minColumns = options.minColumns ?? 2;
  if (!rows.length) return { preamble: [], header: [], body: [] };
  let best = 0;
  let bestCount = 0;
  for (let i = 0; i < Math.min(rows.length, scan); i += 1) {
    const filled = rows[i].filter((v) => String(v ?? '').trim() !== '').length;
    if (filled > bestCount) {
      bestCount = filled;
      best = i;
    }
  }
  if (bestCount < minColumns) {
    return { preamble: [], header: rows[0], body: rows.slice(1) };
  }
  return { preamble: rows.slice(0, best), header: rows[best], body: rows.slice(best + 1) };
}

export function parseDelimited(text, options = {}) {
  const maxRows = options.maxRows ?? 400;
  const raw = String(text ?? '').replace(/^\uFEFF/, '');
  if (!raw.trim()) return { header: [], rows: [], delimiter: ',', truncated: false, totalRows: 0 };

  const firstBreak = raw.search(/\r?\n/);
  const delimiter = options.delimiter || detectDelimiter(firstBreak === -1 ? raw : raw.slice(0, firstBreak));

  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    // Skip the trailing empty line produced by a final newline.
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };

  while (i < raw.length) {
    const c = raw[i];
    if (inQuotes) {
      if (c === '"') {
        if (raw[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (c === '\r') {
      i += 1;
      continue;
    }
    if (c === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  pushRow();

  return {
    rows: rows.slice(0, maxRows),
    delimiter,
    truncated: rows.length > maxRows,
    totalRows: rows.length,
  };
}
