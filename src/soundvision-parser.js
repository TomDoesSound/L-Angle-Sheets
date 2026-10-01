const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const num = (s) => {
  const m = String(s ?? '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const cleanDegrees = (s) => {
  const value = norm(s);
  return value ? value.replace(/\s*°\s*$/, '') : null;
};

function groupNameFromLine(text) {
  const m = norm(text).match(/^\d+\.\s+Group:\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function sourceNameFromLine(text) {
  const m = norm(text).match(/^\d+\.\s+Source:\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function fieldValue(lines, prefix) {
  const line = lines.find((l) => norm(l.text).toLowerCase().startsWith(prefix.toLowerCase()));
  if (!line) return null;
  return norm(line.text).slice(prefix.length).trim();
}

function fieldValueByLabel(lines, label) {
  const lower = label.toLowerCase();
  const line = lines.find((l) => {
    const t = norm(l.text);
    const colon = t.indexOf(':');
    if (colon < 0) return false;
    return t.slice(0, colon).trim().toLowerCase().startsWith(lower);
  });
  if (!line) return null;
  const t = norm(line.text);
  return t.slice(t.indexOf(':') + 1).trim();
}

function firstTokenAfterColon(value) {
  if (!value) return null;
  const m = value.match(/^\s*([^\s(]+)/);
  return m ? m[1] : value;
}

function meaningfulPickupToken(value) {
  const token = firstTokenAfterColon(value);
  if (!token) return null;
  // Pickup identifiers are not always numeric. A-series frames legitimately use
  // symbolic identifiers such as F/R, while KS28 can use EXT. Preserve the
  // Soundvision token exactly instead of assuming every pickup is a hole number.
  return token.replace(/[;,]+$/, '');
}

function parseMechanicalWarnings(lines) {
  const start = lines.findIndex((line) => /^Mechanical warnings\s*:/i.test(norm(line.text)));
  if (start < 0) return [];

  const warnings = [];
  let current = null;
  const flush = () => {
    if (!current) return;
    current.messages = current.messages.map(norm).filter(Boolean);
    if (current.messages.length || current.severity) warnings.push(current);
    current = null;
  };

  for (let i = start + 1; i < lines.length; i += 1) {
    const text = norm(lines[i].text);
    if (!text || /^Page\s+\d+\s+of\s+\d+/i.test(text)) continue;
    if (/^#\s+Type\b/i.test(text) || /^\d+\.\s*\d+\.\s*Acoustic configuration/i.test(text) || /^\d+\.\s+Source:/i.test(text) || /^\d+\.\s+Group:/i.test(text)) break;

    const severity = text.match(/^(DANGER|WARNING|CAUTION|NOTICE|NOTE|INFO)$/i);
    if (severity) {
      flush();
      current = { severity: severity[1].toUpperCase(), messages: [] };
      continue;
    }

    if (!current) current = { severity: 'WARNING', messages: [] };
    current.messages.push(text);
  }
  flush();
  return warnings;
}

function friendlyFieldLabel(rawLabel, suffix) {
  return norm(rawLabel)
    .replace(/\s*position.*$/i, '')
    .replace(new RegExp(`\\s*${suffix}.*$`, 'i'), '')
    .replace(/^#\s*/, '')
    .trim();
}

function labeledEntries(lines, matcher, valueCleaner = (v) => v) {
  const out = [];
  for (const line of lines) {
    const t = norm(line.text);
    const colon = t.indexOf(':');
    if (colon < 0) continue;
    const label = t.slice(0, colon).trim();
    if (!matcher.test(label)) continue;
    const rawValue = t.slice(colon + 1).trim();
    const value = valueCleaner(rawValue);
    if (!value) continue;
    out.push({ label, value, rawValue });
  }
  return out;
}

function buildColumns(headerRow) {
  const cells = headerRow.cells ?? [];
  const headers = [];
  for (const cell of cells) {
    const t = norm(cell.text).toLowerCase();
    if (t === '#') headers.push({ key: 'box', x: cell.x, label: cell.text });
    else if (t === 'type') headers.push({ key: 'type', x: cell.x, label: cell.text });
    else if (/^angles?\b/.test(t)) headers.push({ key: 'angle', x: cell.x, label: cell.text });
    else if (/^site\b/.test(t)) headers.push({ key: 'site', x: cell.x, label: cell.text });
    else if (/^top\b/.test(t)) headers.push({ key: 'topZ', x: cell.x, label: cell.text });
    else if (/^bottom\b/.test(t)) headers.push({ key: 'bottomZ', x: cell.x, label: cell.text });
    else if (/^panflex\b/.test(t)) headers.push({ key: 'panflex', x: cell.x, label: cell.text });
  }
  const dedup = [];
  for (const h of headers.sort((a, b) => a.x - b.x)) {
    if (!dedup.some((d) => d.key === h.key)) dedup.push(h);
  }
  return dedup;
}

function assignCellToColumn(cell, columns) {
  if (!columns.length) return null;
  const ordered = [...columns].sort((a, b) => a.x - b.x);
  for (let i = 0; i < ordered.length; i += 1) {
    const col = ordered[i];
    const prev = ordered[i - 1];
    const next = ordered[i + 1];
    const left = i === 0 ? -Infinity : (col.key === 'type' && prev?.key === 'box' ? (prev.x + col.x) / 2 : col.x);
    const right = !next ? Infinity : (col.key === 'box' && next.key === 'type' ? (col.x + next.x) / 2 : next.x);
    if (cell.x >= left && cell.x < right) return col.key;
  }
  return ordered[ordered.length - 1].key;
}

function splitPanflex(raw) {
  const value = norm(raw);
  if (!value) return [];
  // Newer L-series reports put one Panflex value per acoustic module, separated by pipes.
  return value.split(/\s*\|\s*/).map(norm).filter(Boolean);
}

function enclosureTypeFromRowText(text) {
  const value = norm(text);
  const lead = value.match(/^(?:C\d+\s+)?#\d+\s*(.*)$/i);
  if (!lead) return null;

  const tokens = norm(lead[1]).split(/\s+/).filter(Boolean);
  const typeTokens = [];
  for (const token of tokens) {
    // Soundvision enclosure names can contain digits (K2, A15, L2D) and
    // punctuation, but Site / Z values are emitted as standalone numeric tokens.
    // Stop before those scalar fields or before Panflex values. This makes the
    // type extraction resilient when PDF.js collapses several visual columns
    // into the Type text item (the ft.in L2 report does this in practice).
    if (/^-?\d+(?:\.\d+)?$/.test(token) || /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(token) || token === '|') break;
    typeTokens.push(token);
  }
  return typeTokens.length ? typeTokens.join(' ') : null;
}

function sanitizeEnclosureType(raw) {
  const value = norm(raw);
  if (!value) return null;
  const tokens = value.split(/\s+/).filter(Boolean);
  const clean = [];
  for (const token of tokens) {
    if (/^-?\d+(?:\.\d+)?$/.test(token) || /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(token) || token === '|') break;
    clean.push(token);
  }
  return clean.length ? clean.join(' ') : null;
}

function parseRowFromText(text, columns) {
  const value = norm(text);
  const lead = value.match(/^(C\d+\s+#\d+|#\d+)\s*(.*)$/i);
  if (!lead) return null;

  const scalarKeys = columns
    .filter((column) => !['box', 'type', 'panflex'].includes(column.key))
    .map((column) => column.key);

  const panflexModules = columns.some((column) => column.key === 'panflex')
    ? (value.match(/\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?/g) || []).map((token) => token.replace(/\s+/g, ''))
    : [];

  let remainder = lead[2] || '';
  if (panflexModules.length) {
    remainder = remainder
      .replace(/\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?/g, ' ')
      .replace(/\|/g, ' ');
  }

  const tokens = norm(remainder).split(/\s+/).filter(Boolean);
  const scalars = {};
  for (let index = scalarKeys.length - 1; index >= 0; index -= 1) {
    if (!tokens.length) break;
    const token = tokens[tokens.length - 1];
    if (!/^-?\d+(?:\.\d+)?$/.test(token)) break;
    scalars[scalarKeys[index]] = token;
    tokens.pop();
  }

  return {
    box: lead[1],
    type: columns.some((column) => column.key === 'type') ? norm(tokens.join(' ')) || null : null,
    angle: scalars.angle ?? null,
    site: scalars.site ?? null,
    topZ: scalars.topZ ?? null,
    bottomZ: scalars.bottomZ ?? null,
    panflexModules,
  };
}

function parseTableRows(sourceLines) {
  const rows = [];
  let columns = [];
  const columnsSeen = new Set();
  const rawHeaders = [];

  for (const line of sourceLines) {
    const text = norm(line.text);
    const hasHeader = /\bType\b/i.test(text) && (/\bSite\b/i.test(text) || /\bAngles?\b/i.test(text) || /\bPanflex\b/i.test(text));
    if (hasHeader) {
      columns = buildColumns(line);
      columns.forEach((col) => columnsSeen.add(col.key));
      rawHeaders.push(text);
      continue;
    }

    if (!columns.length || !line.cells?.length) continue;
    const firstText = norm(line.cells[0]?.text);
    // PDF.js can occasionally combine the box id and enclosure type into a single
    // text item (for example "#1 L2"). Accept any line that starts with a valid
    // Soundvision box identifier instead of requiring the first cell to contain
    // only the identifier. This is especially important for ft.in L2 reports.
    const rowLead = firstText.match(/^(C\d+\s+#\d+|#\d+)(?:\s+.+)?$/i)
      || text.match(/^(C\d+\s+#\d+|#\d+)\b/i);
    if (!rowLead) continue;

    const row = {
      box: null,
      type: null,
      angle: null,
      site: null,
      topZ: null,
      bottomZ: null,
      panflex: null,
      panflexModules: [],
      raw: { line: text, grouped: {} },
    };
    const grouped = {};
    for (const cell of line.cells) {
      const key = assignCellToColumn(cell, columns);
      if (!key) continue;
      grouped[key] = grouped[key] ? `${grouped[key]} ${norm(cell.text)}` : norm(cell.text);
    }

    row.box = grouped.box ?? rowLead[1] ?? firstText;
    row.type = grouped.type ?? null;
    // Some Soundvision tables place the first token of a multi-word enclosure type
    // left of the visual Type header. PDF text extraction can therefore attach it
    // to the box identifier (for example "#1 A10" + "FOCUS"). Keep the box
    // identifier clean and restore the full enclosure type.
    const boxWithType = String(row.box ?? '').match(/^(C\d+\s+#\d+|#\d+)(?:\s+(.+))?$/i);
    if (boxWithType) {
      row.box = boxWithType[1];
      if (boxWithType[2]) row.type = [boxWithType[2], row.type].filter(Boolean).join(' ');
    }
    row.angle = grouped.angle ?? null;
    row.site = grouped.site ?? null;
    row.topZ = grouped.topZ ?? null;
    row.bottomZ = grouped.bottomZ ?? null;

    // PDF.js sometimes collapses an entire Soundvision row into a single text
    // item. When that happens, coordinate grouping can make the enclosure type
    // absorb Site / Top Z / Bottom Z / Panflex values. Parse the normalized row
    // text from right-to-left as a schema-aware fallback so ft.in L2 tables keep
    // a clean Type and four independent Panflex modules.
    const textParsed = parseRowFromText(text, columns);
    if (textParsed) {
      row.box = textParsed.box || row.box;
      row.type = textParsed.type || row.type;
      row.angle = textParsed.angle ?? row.angle;
      row.site = textParsed.site ?? row.site;
      row.topZ = textParsed.topZ ?? row.topZ;
      row.bottomZ = textParsed.bottomZ ?? row.bottomZ;
    }

    // Do not trust coordinate grouping for the Type field when a Soundvision row
    // is visually dense. In the real ft.in L2 report, PDF.js can merge Site,
    // Top Z, Bottom Z and even Panflex text into the Type cell. Derive the
    // enclosure name from the start of the complete row, then fall back to a
    // sanitized grouped value. This is product-agnostic: it stops only when the
    // first standalone scalar / Panflex token is encountered.
    const typeFromText = enclosureTypeFromRowText(text);
    row.type = typeFromText || sanitizeEnclosureType(row.type);

    const panflexTokens = textParsed?.panflexModules?.length
      ? textParsed.panflexModules
      : (columns.some((col) => col.key === 'panflex')
        ? (text.match(/\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?/g) || []).map((v) => v.replace(/\s+/g, ''))
        : []);
    row.panflexModules = panflexTokens.length ? panflexTokens : splitPanflex(grouped.panflex ?? null);
    row.panflex = row.panflexModules.length ? row.panflexModules.join(' | ') : (grouped.panflex ?? null);
    row.raw.grouped = { ...grouped };
    rows.push(row);
  }

  return {
    rows,
    columnsSeen: [...columnsSeen],
    rawHeaders,
  };
}

function summarizeBoxes(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (!row.type) continue;
    counts.set(row.type, (counts.get(row.type) ?? 0) + 1);
  }
  return [...counts.entries()].map(([type, count]) => `${count} × ${type}`).join(' + ') || 'Source configuration';
}

function panflexProfile(rows) {
  const perType = new Map();
  let maxModules = 0;
  for (const row of rows) {
    const count = row.panflexModules?.length ?? 0;
    maxModules = Math.max(maxModules, count);
    if (!row.type || !count) continue;
    if (!perType.has(row.type)) perType.set(row.type, new Set());
    perType.get(row.type).add(count);
  }
  return {
    maxModules,
    perType: Object.fromEntries([...perType.entries()].map(([type, counts]) => [type, [...counts].sort((a, b) => a - b)])),
  };
}

function validateSource(source) {
  const issues = [];
  if (!source.configuration) issues.push('Missing configuration');
  if (!source.boxes.length) issues.push('No enclosure rows detected');
  if (source.isFlown && !source.bumper) issues.push('No bumper/rigging line detected');
  if (source.isFlown && source.motorCount == null) issues.push('No motor count detected');

  const panflex = source.panflexProfile;
  for (const [type, counts] of Object.entries(panflex.perType)) {
    if (counts.length > 1) issues.push(`${type} has inconsistent Panflex module counts (${counts.join('/')})`);
  }

  return { ok: issues.length === 0, issues };
}

export function parseSoundvisionReport(pages) {
  const allLines = pages.flatMap((p) => p.lines.map((line) => ({ ...line, page: p.page })));
  const meta = {
    version: null,
    date: null,
    fileName: null,
    distanceUnit: null,
    weightUnit: null,
    delayUnit: null,
  };

  for (const line of allLines.slice(0, 100)) {
    const t = norm(line.text);
    if (t.startsWith('Version:')) meta.version = t.slice('Version:'.length).trim();
    else if (t.startsWith('Date:')) meta.date = t.slice('Date:'.length).trim();
    else if (t.startsWith('File name:')) meta.fileName = t.slice('File name:'.length).trim();
    else if (t.startsWith('Distance unit:')) meta.distanceUnit = t.slice('Distance unit:'.length).trim();
    else if (t.startsWith('Weight unit:')) meta.weightUnit = t.slice('Weight unit:'.length).trim();
    else if (t.startsWith('Delay unit:')) meta.delayUnit = t.slice('Delay unit:'.length).trim();
  }

  const sources = [];
  let currentGroup = 'Ungrouped';
  let current = null;

  const flush = () => {
    if (!current) return;
    const lines = current.lines;
    current.configuration = fieldValue(lines, 'Configuration:');
    current.bumper = fieldValue(lines, 'Bumper:');
    current.motorCount = num(fieldValue(lines, '# motors:'));
    current.frontPickupRaw = fieldValueByLabel(lines, 'Front pickup position');
    current.rearPickupRaw = fieldValueByLabel(lines, 'Rear pickup position');
    current.frontPickupHole = meaningfulPickupToken(current.frontPickupRaw);
    current.rearPickupHole = meaningfulPickupToken(current.rearPickupRaw);
    current.pickupEntries = labeledEntries(lines, /pickup position/i, meaningfulPickupToken).map((entry) => ({
      ...entry,
      label: friendlyFieldLabel(entry.label, 'pickup'),
    }));
    current.site = cleanDegrees(fieldValue(lines, 'Site:'));
    current.azimuth = cleanDegrees(fieldValue(lines, 'Azimuth:'));
    current.bottomElevation = fieldValue(lines, 'Bottom elevation:');
    current.totalWeight = fieldValue(lines, 'Total weight (Enclosures + Frames):');
    current.frontMotorLoad = fieldValue(lines, 'Front motor load:');
    current.rearMotorLoad = fieldValue(lines, 'Rear motor load:');
    current.motorLoadEntries = labeledEntries(lines, /motor load/i).map((entry) => ({
      ...entry,
      label: friendlyFieldLabel(entry.label, 'motor'),
    }));

    const table = parseTableRows(lines);
    current.boxes = table.rows;
    current.tableColumns = table.columnsSeen;
    current.rawTableHeaders = table.rawHeaders;
    current.hasAngleColumn = table.columnsSeen.includes('angle');
    current.hasPanflexColumn = table.columnsSeen.includes('panflex');
    current.panflexProfile = panflexProfile(current.boxes);
    current.summary = summarizeBoxes(current.boxes);
    current.isFlown = /\bflown\b/i.test(current.configuration ?? '');
    current.mechanicalWarnings = parseMechanicalWarnings(lines);
    // Keep a flattened compatibility view for older UI/export code paths while
    // preserving structured severity + message groups for the current UI.
    current.warnings = current.mechanicalWarnings.flatMap((warning) => [warning.severity, ...warning.messages]);
    current.validation = validateSource(current);
    current.raw = {
      startPage: current.startPage,
      tableHeaders: [...current.rawTableHeaders],
      frontPickup: current.frontPickupRaw,
      rearPickup: current.rearPickupRaw,
    };
    delete current.lines;
    sources.push(current);
    current = null;
  };

  for (const line of allLines) {
    const text = norm(line.text);
    const group = groupNameFromLine(text);
    if (group) {
      currentGroup = group;
      continue;
    }

    const sourceName = sourceNameFromLine(text);
    if (sourceName) {
      flush();
      current = {
        id: `source-${sources.length + 1}`,
        name: sourceName,
        group: currentGroup,
        startPage: line.page,
        lines: [line],
      };
      continue;
    }

    if (current) current.lines.push(line);
  }
  flush();

  return { meta, sources };
}
