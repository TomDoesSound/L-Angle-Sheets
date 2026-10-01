const A4 = [595.28, 841.89];
const A3_LANDSCAPE = [1190.55, 841.89];
const margin = 34;

const THEME_PALETTES = {
  'technical-cyan': {
    light: { bg: '#f7fafb', text: '#111820', muted: '#68727d', line: '#d6dde1', accent: '#1687a7', rowAlt: '#eef5f7', warning: '#a86205' },
    dark: { bg: '#0d1216', text: '#eef3f6', muted: '#8d99a2', line: '#29343c', accent: '#35b6d4', rowAlt: '#131b20', warning: '#f0bc67' },
  },
  'signal-orange': {
    light: { bg: '#f8f8f6', text: '#111315', muted: '#6f757b', line: '#d8dadd', accent: '#ef6b2e', rowAlt: '#f4efea', warning: '#9b5b0d' },
    dark: { bg: '#111315', text: '#f4f5f6', muted: '#93999f', line: '#30343a', accent: '#ff7a3d', rowAlt: '#19191a', warning: '#f0bc67' },
  },
  'production-lime': {
    light: { bg: '#fafaf8', text: '#161816', muted: '#6f766a', line: '#d9ddd3', accent: '#74a719', rowAlt: '#f1f4ea', warning: '#936112' },
    dark: { bg: '#101210', text: '#f1f3ef', muted: '#92998d', line: '#30362c', accent: '#a6d63c', rowAlt: '#171b15', warning: '#f0bc67' },
  },
  'electric-blue': {
    light: { bg: '#ffffff', text: '#111214', muted: '#74777c', line: '#dddddf', accent: '#4c6fff', rowAlt: '#f2f4ff', warning: '#9b5b0d' },
    dark: { bg: '#0c0c0d', text: '#f5f5f6', muted: '#8c8d92', line: '#2b2c31', accent: '#6d83ff', rowAlt: '#15161c', warning: '#f0bc67' },
  },
  'monochrome': {
    light: { bg: '#ffffff', text: '#111111', muted: '#666666', line: '#d2d2d2', accent: '#3f4346', rowAlt: '#f1f1f1', warning: '#8f620f' },
    dark: { bg: '#0d0e0f', text: '#f2f2f2', muted: '#9a9a9a', line: '#343638', accent: '#bfc2c4', rowAlt: '#181a1b', warning: '#f0bc67' },
  },
};

function safe(v, fallback = '—') {
  const s = String(v ?? '').trim();
  return s || fallback;
}

function hasValue(v) {
  return v != null && String(v).trim() !== '';
}

function hexTuple(hex) {
  const value = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return [parseInt(value.slice(0, 2), 16) / 255, parseInt(value.slice(2, 4), 16) / 255, parseInt(value.slice(4, 6), 16) / 255];
}

function hexRgb(hex) {
  return hexTuple(hex) || [0, 0, 0];
}

function palette(style, appearance, rgb) {
  const stylePalette = THEME_PALETTES[style] || THEME_PALETTES['technical-cyan'];
  const src = stylePalette[appearance] || stylePalette.light;
  const out = {};
  for (const [key, value] of Object.entries(src)) out[key] = rgb(...hexRgb(value));
  return out;
}

function rgbFromHex(hex, rgb) {
  const tuple = hexTuple(hex);
  return tuple ? rgb(...tuple) : null;
}

function contrastForHex(hex, rgb) {
  const tuple = hexTuple(hex);
  if (!tuple) return rgb(1, 1, 1);
  const [r, g, b] = tuple;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.62 ? rgb(0.06, 0.07, 0.08) : rgb(1, 1, 1);
}

function fitTextSize(font, text, maxWidth, preferred, min = 5.4) {
  let size = preferred;
  while (size > min && font.widthOfTextAtSize(String(text ?? ''), size) > maxWidth) size -= 0.25;
  return size;
}

function uniqueTypes(boxes) {
  return [...new Set((boxes || []).map((b) => b.type).filter(Boolean))];
}

function maxPanflexModules(source) {
  return source.panflexProfile?.maxModules ?? Math.max(0, ...(source.boxes || []).map((b) => b.panflexModules?.length ?? (b.panflex ? 1 : 0)));
}

function tableSchema(source, fields) {
  const allBoxes = source.boxes || [];
  return {
    showType: uniqueTypes(allBoxes).length > 1,
    showAngle: Boolean(fields.angles && source.hasAngleColumn),
    panflexCount: fields.panflex ? maxPanflexModules(source) : 0,
  };
}

function tableColumns(schema, compact = false) {
  const cols = [{ key: 'box', label: 'Box', frac: compact ? 0.62 : 0.72 }];
  if (schema.showType) cols.push({ key: 'type', label: 'Type', frac: compact ? 1.25 : 1.5 });
  if (schema.showAngle) cols.push({ key: 'angle', label: 'Angle', frac: 1.0 });
  if (schema.panflexCount === 1) cols.push({ key: 'pf0', label: 'Panflex', frac: compact ? 1.25 : 1.5 });
  else if (schema.panflexCount > 1) {
    for (let i = 0; i < schema.panflexCount; i += 1) cols.push({ key: `pf${i}`, label: `PF${i + 1}`, frac: 1.0 });
  }
  if (cols.length === 1) cols.push({ key: 'type', label: 'Type', frac: 3.0 });
  return cols;
}

function cellValue(box, key) {
  if (key === 'box') return safe(box.box).replace('#', '');
  if (key === 'angle') return hasValue(box.angle) ? `${box.angle}°` : '—';
  if (key.startsWith('pf')) {
    const index = Number(key.slice(2));
    return safe(box.panflexModules?.[index]);
  }
  return safe(box[key]);
}

function numericPickupIdentifier(value) {
  return /^-?\d+(?:\.\d+)?$/.test(String(value ?? '').trim());
}

function pickupInfo(source) {
  const entries = source.pickupEntries || [];
  const frontRear = entries.length === 2 && /front/i.test(entries[0].label) && /rear/i.test(entries[1].label);
  const leftRight = entries.length === 2 && /left/i.test(entries[0].label) && /right/i.test(entries[1].label);

  if (frontRear) {
    const numeric = entries.every((entry) => numericPickupIdentifier(entry.value));
    return { label: numeric ? 'Pickup holes F / R' : 'Pickup points F / R', value: `${entries[0].value} / ${entries[1].value}` };
  }
  if (leftRight) return { label: 'Pickup points L / R', value: `${entries[0].value} / ${entries[1].value}` };
  if (entries.length === 1) {
    const entry = entries[0];
    return numericPickupIdentifier(entry.value)
      ? { label: 'Pickup hole', value: entry.value }
      : { label: 'Pickup point', value: entry.value };
  }
  if (entries.length) return { label: 'Pickup points', value: entries.map((entry) => `${entry.label}: ${entry.value}`).join(' · ') };
  if (source.frontPickupHole || source.rearPickupHole) {
    const values = [source.frontPickupHole, source.rearPickupHole].filter(Boolean);
    const numeric = values.every(numericPickupIdentifier);
    return { label: numeric ? 'Pickup holes F / R' : 'Pickup points F / R', value: values.join(' / ') };
  }
  return null;
}

function motorInfo(source) {
  const entries = source.motorLoadEntries || [];
  if (entries.length === 2 && /left/i.test(entries[0].label) && /right/i.test(entries[1].label)) {
    return { label: 'Motor L / R', value: `${entries[0].value} / ${entries[1].value}` };
  }
  if (entries.length === 2 && /front/i.test(entries[0].label) && /rear/i.test(entries[1].label)) {
    return { label: 'Motor F / R', value: `${entries[0].value} / ${entries[1].value}` };
  }
  if (entries.length === 1) return { label: 'Motor load', value: entries[0].value };
  if (entries.length) return { label: 'Motor loads', value: entries.map((entry) => `${entry.label}: ${entry.value}`).join(' · ') };
  if (source.frontMotorLoad || source.rearMotorLoad) return { label: 'Motor F / R', value: [source.frontMotorLoad, source.rearMotorLoad].filter(Boolean).join(' / ') };
  return null;
}

function mechanicalWarnings(source) {
  return source.mechanicalWarnings || [];
}

function warningColorForSeverity(severity, colors, rgb) {
  const value = String(severity || '').toUpperCase();
  if (value === 'DANGER') return rgb(0.82, 0.22, 0.24);
  if (value === 'CAUTION') return rgb(0.72, 0.58, 0.08);
  return colors.warning;
}

function hasMechanicalDanger(source) {
  return mechanicalWarnings(source).some((warning) => String(warning.severity || '').toUpperCase() === 'DANGER');
}

function drawRoundedPill(page, rgb, { x, y, width, height, fill, text, font, fontSize = 7.2, textColor = rgb(1, 1, 1) }) {
  // pdf-lib has no rounded-rectangle primitive, so build a true rounded
  // rectangle from two rectangles plus four corner circles.
  const radius = Math.min(4.5, height / 2);
  page.drawRectangle({ x: x + radius, y, width: Math.max(0, width - radius * 2), height, color: fill });
  page.drawRectangle({ x, y: y + radius, width, height: Math.max(0, height - radius * 2), color: fill });
  for (const [cx, cy] of [
    [x + radius, y + radius],
    [x + width - radius, y + radius],
    [x + radius, y + height - radius],
    [x + width - radius, y + height - radius],
  ]) page.drawCircle({ x: cx, y: cy, size: radius, color: fill });
  const tw = font.widthOfTextAtSize(text, fontSize);
  page.drawText(text, { x: x + Math.max(6, (width - tw) / 2), y: y + (height - fontSize) / 2 + 0.8, size: fontSize, font, color: textColor, maxWidth: width - 12 });
}

function drawDangerBadge(page, fonts, rgb, x, y, compact = false) {
  const text = compact ? 'DANGER' : 'DANGER — CHECK SOUNDVISION';
  const height = compact ? 15 : 17;
  const width = compact ? 55 : 145;
  drawRoundedPill(page, rgb, {
    x, y, width, height,
    fill: rgb(0.76, 0.12, 0.15),
    text,
    font: fonts.bold,
    fontSize: compact ? 6.6 : 7.1,
  });
  return { width, height };
}

function detailSlots(source, fields) {
  const slots = Array.from({ length: 8 }, () => null);
  if (fields.bumper && source.bumper) slots[0] = { label: 'Rigging', value: source.bumper };
  const pickups = pickupInfo(source);
  if (fields.pickups && pickups) slots[1] = { label: pickups.label, value: pickups.value };
  if (fields.site && source.site != null) slots[2] = { label: 'Site', value: `${source.site}°` };
  if (fields.azimuth && source.azimuth != null) slots[3] = { label: 'Azimuth', value: `${source.azimuth}°` };
  if (fields.bottomElevation && source.bottomElevation) slots[4] = { label: 'Bottom elevation', value: source.bottomElevation };
  const motors = motorInfo(source);
  if (fields.motorLoads && motors) slots[5] = { label: motors.label, value: motors.value };
  if (fields.weight && source.totalWeight) slots[6] = { label: 'Weight', value: source.totalWeight };
  return slots;
}

function drawMetaItem(page, fonts, colors, item, x, y, width) {
  if (!item) return;
  page.drawText(item.label.toUpperCase(), { x, y, size: 7.3, font: fonts.bold, color: colors.muted, maxWidth: width });
  const text = safe(item.value);
  const size = fitTextSize(fonts.bold, text, width, 11.8, 7.2);
  page.drawText(text, { x, y: y - 16.6, size, font: fonts.bold, color: colors.text, maxWidth: width });
}

function drawFixedDetailGrid(page, fonts, colors, slots, pageW, yTop) {
  const available = pageW - margin * 2;
  const widths = [available * 0.40, available * 0.25, available * 0.17, available * 0.18];
  const xs = [margin];
  for (let i = 1; i < 4; i += 1) xs.push(xs[i - 1] + widths[i - 1]);
  for (let col = 0; col < 4; col += 1) drawMetaItem(page, fonts, colors, slots[col], xs[col], yTop, widths[col] - 10);
  const y2 = yTop - 46;
  for (let col = 0; col < 4; col += 1) drawMetaItem(page, fonts, colors, slots[col + 4], xs[col], y2, widths[col] - 10);
  return y2 - 37;
}

function wrapText(font, text, size, maxWidth) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  const splitLongToken = (token) => {
    const chunks = [];
    let chunk = '';
    for (const char of token) {
      const candidate = chunk + char;
      if (chunk && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        chunks.push(chunk);
        chunk = char;
      } else chunk = candidate;
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  };

  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      if (current) { lines.push(current); current = ''; }
      const chunks = splitLongToken(word);
      if (chunks.length) {
        lines.push(...chunks.slice(0, -1));
        current = chunks[chunks.length - 1];
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (!current || font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function stripTrailingMetadataSeparator(value) {
  return String(value ?? '').replace(/(?:\s*[·•|—–-]+\s*)+$/g, '').trimEnd();
}

function truncateLineToWidth(font, text, size, maxWidth, forceEllipsis = false) {
  let value = String(text ?? '').trimEnd();
  if (!forceEllipsis && font.widthOfTextAtSize(value, size) <= maxWidth) return value;
  const ellipsis = '...';
  value = stripTrailingMetadataSeparator(value);
  while (value.length && font.widthOfTextAtSize(value + ellipsis, size) > maxWidth) {
    value = stripTrailingMetadataSeparator(value.slice(0, -1));
  }
  return `${stripTrailingMetadataSeparator(value)}${ellipsis}`;
}

function fitSingleLineSize(font, text, maxWidth, preferred, min) {
  return fitTextSize(font, String(text ?? ''), maxWidth, preferred, min);
}

function fitWrappedTextSize(font, text, maxWidth, maxLines, preferred, min) {
  let size = preferred;
  while (size > min) {
    const lines = wrapText(font, text, size, maxWidth);
    if (lines.length <= maxLines) return { size, lines };
    size -= 0.25;
  }
  return { size: min, lines: wrapText(font, text, min, maxWidth) };
}

function drawWrappedText(page, font, color, text, x, yTop, maxWidth, { preferred, min, maxLines = 2, leadingExtra = 2.5 } = {}) {
  const fitted = fitWrappedTextSize(font, text, maxWidth, maxLines, preferred, min);
  const lines = fitted.lines.slice(0, maxLines);
  const leading = fitted.size + leadingExtra;
  lines.forEach((line, index) => page.drawText(line, { x, y: yTop - index * leading, size: fitted.size, font, color, maxWidth }));
  return { bottom: yTop - Math.max(1, lines.length) * leading, size: fitted.size, lines };
}

function drawDetailedDocumentMetadata(page, fonts, colors, metadata, project, x, yTop, maxWidth) {
  const projectName = metadata?.projectName || projectFallback(project);
  const show = String(metadata?.show || '').trim();
  const city = String(metadata?.city || '').trim();
  const revision = revisionLabel(metadata?.revision);

  // Each user-editable field owns a predictable line. The UI limits are chosen
  // so worst-case wide characters fit these lines without ellipsis or clipping.
  const showText = show || projectName || 'Soundvision project';
  const showSize = fitSingleLineSize(fonts.bold, showText, maxWidth, 8.9, 6.6);
  page.drawText(showText, { x, y: yTop, size: showSize, font: fonts.bold, color: colors.muted, maxWidth });

  const line2Y = yTop - 13.2;
  const revisionWidth = revision ? fonts.bold.widthOfTextAtSize(revision, 8.2) : 0;
  const revisionGap = revision ? 12 : 0;
  const cityWidth = Math.max(40, maxWidth - revisionWidth - revisionGap);
  if (city) {
    const citySize = fitSingleLineSize(fonts.regular, city, cityWidth, 8.4, 6.4);
    page.drawText(city, { x, y: line2Y, size: citySize, font: fonts.regular, color: colors.muted, maxWidth: cityWidth });
  }
  if (revision) {
    page.drawText(revision, { x: x + maxWidth - revisionWidth, y: line2Y, size: 8.2, font: fonts.bold, color: colors.muted, maxWidth: revisionWidth });
  }

  const projectY = yTop - 26.4;
  if (projectName && projectName.toLowerCase() !== showText.toLowerCase()) {
    const projectBlock = drawWrappedText(page, fonts.regular, colors.muted, projectName, x, projectY, maxWidth, { preferred: 8.2, min: 5.8, maxLines: 2, leadingExtra: 1.8 });
    return projectBlock.bottom - 2;
  }
  return projectY - 8;
}

function revisionLabel(raw) {
  const cleaned = String(raw ?? '').replace(/\D+/g, '').slice(0, 3);
  return cleaned ? `REV ${cleaned}` : '';
}

function projectFallback(project) {
  return (project.meta.fileName || 'Soundvision project').replace(/\.xmlp$/i, '').replace(/\.pdf$/i, '');
}

function overviewHeaderParts(metadata, project) {
  const projectName = metadata?.projectName || projectFallback(project);
  const title = metadata?.show || projectName || 'Soundvision project';
  const parts = [];
  if (metadata?.city) parts.push(metadata.city);
  if (projectName && projectName.toLowerCase() !== title.toLowerCase()) parts.push(projectName);
  const rev = revisionLabel(metadata?.revision);
  if (rev) parts.push(rev);
  return { title, subtitle: parts.join('  ·  ') };
}

function formatGeneratedDate() {
  try {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
  } catch (_) {
    return new Date().toLocaleDateString();
  }
}

function sanitizeFilenamePart(value) {
  return String(value ?? '').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
}

function buildFilename(metadata, project) {
  const projectName = metadata?.projectName || projectFallback(project);
  const show = sanitizeFilenamePart(metadata?.show);
  const city = sanitizeFilenamePart(metadata?.city);
  const projectPart = sanitizeFilenamePart(projectName) || 'Soundvision';
  const pieces = [];
  if (show && city) pieces.push(show, city);
  else if (show) pieces.push(show);
  else if (city) pieces.push(projectPart, city);
  else pieces.push(projectPart);
  pieces.push('L-Angle_Sheets');
  const rev = String(metadata?.revision ?? '').replace(/\D+/g, '').slice(0, 3);
  if (rev) pieces.push(`Rev${rev}`);
  return `${pieces.join('_')}.pdf`;
}

async function embedLogo(pdfDoc, logo) {
  if (!logo?.bytes) return null;
  try {
    if (logo.type === 'image/png') return await pdfDoc.embedPng(logo.bytes);
    if (logo.type === 'image/jpeg') return await pdfDoc.embedJpg(logo.bytes);
  } catch (_) {
    return null;
  }
  return null;
}

function drawLogoAndByline(page, fonts, colors, logoImage, preparedBy, generatedDate, pageW, pageH, maxW = 108, maxH = 38, topY = pageH - 31, bylineMaxW = 120) {
  const rightX = pageW - margin;
  let logoLeft = rightX;
  let blockBottom = topY;
  if (logoImage) {
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height);
    const w = logoImage.width * scale;
    const h = logoImage.height * scale;
    logoLeft = rightX - w;
    const logoBottom = topY - h;
    page.drawImage(logoImage, { x: logoLeft, y: logoBottom, width: w, height: h });
    blockBottom = Math.min(blockBottom, logoBottom);
  }

  // Keep the byline beside the logo, but wrap Prepared by rather than silently
  // truncating it. The 32-character UI limit fits in at most two lines here.
  const bylineRight = logoImage ? logoLeft - 9 : rightX;
  let cursorY = topY - 8;
  if (preparedBy) {
    const label = `Prepared by: ${preparedBy}`;
    const fitted = fitWrappedTextSize(fonts.regular, label, bylineMaxW, 2, 6.6, 5.2);
    const leading = fitted.size + 2.0;
    for (const line of fitted.lines.slice(0, 2)) {
      const w = fonts.regular.widthOfTextAtSize(line, fitted.size);
      page.drawText(line, { x: Math.max(margin, bylineRight - w), y: cursorY, size: fitted.size, font: fonts.regular, color: colors.muted, maxWidth: bylineMaxW });
      blockBottom = Math.min(blockBottom, cursorY - fitted.size);
      cursorY -= leading;
    }
    cursorY -= 1.5;
  }

  const generatedLine = `Generated ${generatedDate}`;
  const generatedSize = fitSingleLineSize(fonts.regular, generatedLine, bylineMaxW, 6.6, 5.2);
  const generatedW = fonts.regular.widthOfTextAtSize(generatedLine, generatedSize);
  page.drawText(generatedLine, { x: Math.max(margin, bylineRight - generatedW), y: cursorY, size: generatedSize, font: fonts.regular, color: colors.muted, maxWidth: bylineMaxW });
  blockBottom = Math.min(blockBottom, cursorY - generatedSize);
  return blockBottom;
}

function drawHangColorMarker(page, source, fonts, rgb, pageW, pageH, centerY = pageH - 69) {
  if (!source.hangColor) return;
  const color = rgbFromHex(source.hangColor, rgb);
  if (!color) return;
  // No outline: the marker should read as one clean colour band at a glance.
  page.drawRectangle({ x: 0, y: 0, width: 10, height: pageH, color });

  const cx = margin + 17;
  const cy = centerY;
  page.drawCircle({ x: cx, y: cy, size: 15.5, color });
  const text = String(source.badge || '').slice(0, 4).toUpperCase();
  if (text) {
    const fontSize = fitTextSize(fonts.bold, text, 24, 9.2, 6.0);
    const tw = fonts.bold.widthOfTextAtSize(text, fontSize);
    page.drawText(text, { x: cx - tw / 2, y: cy - 3.2, size: fontSize, font: fonts.bold, color: contrastForHex(source.hangColor, rgb) });
  }
}

function balancedSplitCount(total) {
  if (total <= 1) return total;
  if (total % 4 === 0) return Math.min(total - 1, Math.ceil(total / 8) * 4);
  return Math.ceil(total / 2);
}

function balancedChunks(total, maxPerPage) {
  if (!total) return [0];
  const pages = Math.ceil(total / maxPerPage);
  const base = Math.floor(total / pages);
  let remainder = total % pages;
  const sizes = [];
  for (let i = 0; i < pages; i += 1) {
    const size = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    sizes.push(size);
  }
  return sizes;
}

function detailedPlanForSource(source, fields) {
  const schema = tableSchema(source, fields);
  const columnCount = tableColumns(schema).length;
  const canTwo = columnCount <= 4 && schema.panflexCount <= 1;
  const maxPerPage = canTwo ? 40 : 24;
  const sizes = balancedChunks(source.boxes?.length || 0, maxPerPage);
  const chunks = [];
  let start = 0;
  sizes.forEach((size, index) => {
    chunks.push({ source, schema, boxes: (source.boxes || []).slice(start, start + size), start, chunkIndex: index, chunkCount: sizes.length, canTwo });
    start += size;
  });
  return chunks;
}

function tablePositions(cols, x, width) {
  const totalFrac = cols.reduce((sum, col) => sum + col.frac, 0);
  let cursorX = x;
  return cols.map((col) => {
    const w = width * (col.frac / totalFrac);
    const position = { ...col, x: cursorX, width: w };
    cursorX += w;
    return position;
  });
}

function drawTable(page, fonts, colors, boxes, x, yTop, width, schema, options = {}) {
  const {
    sourceOffset = 0,
    rowHeight = 28,
    fontSize = 10.5,
    headerHeight = 23,
    compact = false,
    drawTopBorder = true,
  } = options;
  const cols = tableColumns(schema, compact);
  const positions = tablePositions(cols, x, width);
  const headerFontSize = options.headerFontSize ?? (compact ? 6.8 : 8.0);
  if (drawTopBorder) page.drawLine({ start: { x, y: yTop }, end: { x: x + width, y: yTop }, thickness: 0.75, color: colors.line });
  page.drawLine({ start: { x, y: yTop - headerHeight }, end: { x: x + width, y: yTop - headerHeight }, thickness: 0.75, color: colors.line });
  const headerBaseline = yTop - headerHeight + Math.max(5, (headerHeight - headerFontSize) / 2 + 1);
  for (const c of positions) {
    page.drawText(c.label.toUpperCase(), { x: c.x + 5, y: headerBaseline, size: headerFontSize, font: fonts.bold, color: colors.muted, maxWidth: c.width - 9 });
  }

  let rowTop = yTop - headerHeight;
  boxes.forEach((box, localIndex) => {
    const absoluteIndex = sourceOffset + localIndex;
    const rowBottom = rowTop - rowHeight;
    const shaded = Math.floor(absoluteIndex / 4) % 2 === 1;
    if (shaded) page.drawRectangle({ x, y: rowBottom, width, height: rowHeight, color: colors.rowAlt });
    const baseline = rowBottom + Math.max(4.5, (rowHeight - fontSize) / 2 + 1.4);
    for (const c of positions) {
      const val = cellValue(box, c.key);
      const isPanflex = c.key.startsWith('pf');
      const font = isPanflex ? fonts.bold : fonts.regular;
      const color = isPanflex && val !== '—' ? colors.accent : colors.text;
      const size = fitTextSize(font, val, c.width - 9, fontSize, compact ? 5.8 : 7.0);
      page.drawText(val, { x: c.x + 5, y: baseline, size, font, maxWidth: c.width - 9, color });
    }
    page.drawLine({ start: { x, y: rowBottom }, end: { x: x + width, y: rowBottom }, thickness: 0.35, color: colors.line });
    rowTop = rowBottom;
  });
  return rowTop;
}

function detailedRowMetrics(tableTop, bottomReserve, rowsPerColumn) {
  if (!rowsPerColumn) return { rowHeight: 38, fontSize: 13.0, headerHeight: 26 };
  const available = Math.max(140, tableTop - bottomReserve - 28);
  const maxRowHeight = rowsPerColumn <= 8 ? 54 : (rowsPerColumn <= 12 ? 48 : 46);
  const rowHeight = Math.max(21.5, Math.min(maxRowHeight, available / rowsPerColumn));
  const fontSize = Math.max(8.6, Math.min(16.2, rowHeight * 0.32));
  const headerHeight = Math.max(22, Math.min(30, rowHeight * 0.62));
  return { rowHeight, fontSize, headerHeight };
}

function drawSafetyFooter(page, fonts, colors, pageW, textY = 18) {
  const text = 'Verify all data against the original Soundvision report/project before deployment.';
  const size = 6.2;
  const width = fonts.regular.widthOfTextAtSize(text, size);
  page.drawText(text, { x: pageW - margin - width, y: textY, size, font: fonts.regular, color: colors.muted, maxWidth: pageW - margin * 2 });
}

function estimateWarningsReserve(source, fields, fonts, pageW) {
  if (!fields.warnings) return 0;
  const warnings = mechanicalWarnings(source);
  if (!warnings.length) return 0;
  let reserve = 8;
  const maxWidth = pageW - margin * 2 - 18;
  for (const warning of warnings) {
    reserve += 15;
    for (const message of warning.messages || []) reserve += wrapText(fonts.regular, message, 7.6, maxWidth).length * 9.6;
    reserve += 6;
  }
  return reserve;
}

function estimateExtraReserve(source, fields, fonts, pageW) {
  // This value is the lowest Y that the table may consume, not just a height.
  // Keep a protected footer zone and a generous gap above notes/warnings.
  let reserve = 54;
  if (source.exportNote) {
    const fitted = fitWrappedTextSize(fonts.regular, source.exportNote, pageW - margin * 2, 2, 8.2, 7.0);
    reserve += Math.min(2, fitted.lines.length) * (fitted.size + 2.2) + 18;
  }
  reserve += estimateWarningsReserve(source, fields, fonts, pageW);
  return reserve;
}

function drawMechanicalWarningsPdf(page, fonts, colors, rgb, source, x, y, width) {
  const warnings = mechanicalWarnings(source);
  let cursor = y;
  for (const warning of warnings) {
    const severity = String(warning.severity || 'WARNING').toUpperCase();
    const severityColor = warningColorForSeverity(severity, colors, rgb);
    page.drawText(severity, { x, y: cursor, size: 7.5, font: fonts.bold, color: severityColor, maxWidth: 70 });
    cursor -= 11;
    for (const message of warning.messages || []) {
      const lines = wrapText(fonts.regular, message, 7.6, width - 14);
      for (const line of lines) {
        page.drawText(line, { x: x + 8, y: cursor, size: 7.6, font: fonts.regular, color: severityColor, maxWidth: width - 14 });
        cursor -= 9.6;
      }
    }
    cursor -= 6;
  }
  return cursor;
}

function drawDetailedPage({ pdfDoc, fonts, colors, rgb, logoImage, preparedBy, generatedDate, project, metadata, fields, pack, pageNumber, totalPages }) {
  const { source, boxes, start, chunkIndex, chunkCount, schema, canTwo } = pack;
  const page = pdfDoc.addPage(A4);
  const [pageW, pageH] = A4;
  const isContinuation = chunkIndex > 0;
  page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: colors.bg });
  const exportName = source.exportName || source.name;
  const badgeOffset = source.hangColor ? 42 : 0;
  const titleX = margin + badgeOffset;
  let tableTop;

  if (!isContinuation) {
    // v0.16: user-entered document fields have dedicated lines and hang names
    // may wrap to two lines. Accepted input is never replaced with an ellipsis.
    const metadataTopY = pageH - 35;
    const metadataBottom = drawDetailedDocumentMetadata(page, fonts, colors, metadata, project, margin, metadataTopY, 280);

    // Reserve a true vertical boundary beneath document metadata. The colour badge
    // has a 15.5 pt radius, so the title/badge row is pushed far enough down that
    // even a two-line Project name can never intrude into the badge circle.
    const titleY = Math.min(pageH - 98, metadataBottom - 22);
    if (source.hangColor) drawHangColorMarker(page, source, fonts, rgb, pageW, pageH, titleY + 3);
    const titleMaxW = 340 - badgeOffset;
    const titleBlock = drawWrappedText(page, fonts.bold, colors.text, exportName, titleX, titleY, titleMaxW, { preferred: 29, min: 15.5, maxLines: 2, leadingExtra: 2.4 });
    const summaryY = titleBlock.bottom - 4;
    const danger = hasMechanicalDanger(source);
    const dangerWidth = danger ? 145 : 0;
    const summaryMaxW = Math.max(120, pageW - margin - titleX - dangerWidth - (danger ? 16 : 0));
    const summarySize = fitTextSize(fonts.bold, source.summary, summaryMaxW, 10.4, 7.2);
    page.drawText(source.summary, { x: titleX, y: summaryY, size: summarySize, font: fonts.bold, color: colors.muted, maxWidth: summaryMaxW });
    if (danger) drawDangerBadge(page, fonts, rgb, pageW - margin - dangerWidth, summaryY - 4.2);

    const brandBottom = drawLogoAndByline(page, fonts, colors, logoImage, preparedBy, generatedDate, pageW, pageH, 105, 38, pageH - 31, 120);
    const accentY = Math.min(summaryY - 18, brandBottom - 8);
    page.drawRectangle({ x: margin, y: accentY, width: pageW - margin * 2, height: 2.6, color: colors.accent });
    tableTop = drawFixedDetailGrid(page, fonts, colors, detailSlots(source, fields), pageW, accentY - 20) - 6;
  } else {
    const metadataTopY = pageH - 33;
    const metadataBottom = drawDetailedDocumentMetadata(page, fonts, colors, metadata, project, margin, metadataTopY, 340);
    const continuationTitle = `${exportName} — CONTINUED ${chunkIndex + 1}/${chunkCount}`;
    const titleY = Math.min(pageH - 96, metadataBottom - 21);
    if (source.hangColor) drawHangColorMarker(page, source, fonts, rgb, pageW, pageH, titleY + 3);
    const titleMaxW = pageW - margin * 2 - badgeOffset;
    const titleBlock = drawWrappedText(page, fonts.bold, colors.text, continuationTitle, titleX, titleY, titleMaxW, { preferred: 21, min: 12.0, maxLines: 2, leadingExtra: 2.2 });
    const summaryY = titleBlock.bottom - 3;
    const danger = hasMechanicalDanger(source);
    const dangerWidth = danger ? 145 : 0;
    const summaryMaxW = Math.max(120, pageW - margin - titleX - dangerWidth - (danger ? 16 : 0));
    const summarySize = fitTextSize(fonts.bold, source.summary, summaryMaxW, 9.0, 6.8);
    page.drawText(source.summary, { x: titleX, y: summaryY, size: summarySize, font: fonts.bold, color: colors.muted, maxWidth: summaryMaxW });
    if (danger) drawDangerBadge(page, fonts, rgb, pageW - margin - dangerWidth, summaryY - 4.2);
    const accentY = summaryY - 17;
    page.drawRectangle({ x: margin, y: accentY, width: pageW - margin * 2, height: 2.0, color: colors.accent });
    tableTop = accentY - 17;
  }

  const extraReserve = estimateExtraReserve(source, fields, fonts, pageW);
  let tableBottom = tableTop;

  if (boxes.length) {
    const useTwo = canTwo && boxes.length > 12;
    if (useTwo) {
      const split = balancedSplitCount(boxes.length);
      const left = boxes.slice(0, split);
      const right = boxes.slice(split);
      const rowsPerColumn = Math.max(left.length, right.length);
      const metrics = detailedRowMetrics(tableTop, extraReserve, rowsPerColumn);
      const gap = 18;
      const tableW = (pageW - margin * 2 - gap) / 2;
      const leftBottom = drawTable(page, fonts, colors, left, margin, tableTop, tableW, schema, { sourceOffset: start, rowHeight: metrics.rowHeight, fontSize: metrics.fontSize, headerHeight: metrics.headerHeight });
      const rightBottom = drawTable(page, fonts, colors, right, margin + tableW + gap, tableTop, tableW, schema, { sourceOffset: start + split, rowHeight: metrics.rowHeight, fontSize: metrics.fontSize, headerHeight: metrics.headerHeight });
      tableBottom = Math.min(leftBottom, rightBottom);
    } else {
      const metrics = detailedRowMetrics(tableTop, extraReserve, boxes.length);
      tableBottom = drawTable(page, fonts, colors, boxes, margin, tableTop, pageW - margin * 2, schema, { sourceOffset: start, rowHeight: metrics.rowHeight, fontSize: metrics.fontSize, headerHeight: metrics.headerHeight });
    }
  }

  // Notes and Soundvision mechanical notices are shown once, on the final page for this hang.
  if (chunkIndex === chunkCount - 1) {
    const footerSafeTop = 44;
    let textY = tableBottom - 13;
    if (source.exportNote) {
      const fitted = fitWrappedTextSize(fonts.regular, source.exportNote, pageW - margin * 2, 2, 8.2, 7.0);
      const noteHeight = Math.min(2, fitted.lines.length) * (fitted.size + 2.2);
      // The UI caps notes at a PDF-safe maximum. We still fit the font slightly
      // if needed, but we never replace accepted note text with an ellipsis.
      textY = Math.max(textY, footerSafeTop + noteHeight);
      fitted.lines.slice(0, 2).forEach((line, index) => {
        page.drawText(line, { x: margin, y: textY - index * (fitted.size + 2.2), size: fitted.size, font: fonts.regular, color: colors.muted, maxWidth: pageW - margin * 2 });
      });
      textY -= noteHeight + 9;
    }
    if (fields.warnings && mechanicalWarnings(source).length) {
      drawMechanicalWarningsPdf(page, fonts, colors, rgb, source, margin, textY, pageW - margin * 2);
    }
  }

  // Detailed-sheet footer is deliberately page-number only. The hang/export name
  // already appears prominently in the header and can be much wider than the footer.
  const footerLabel = `${pageNumber} / ${totalPages}`;
  page.drawText(footerLabel, { x: margin, y: 18, size: 6.5, font: fonts.regular, color: colors.muted, maxWidth: 90 });
  drawSafetyFooter(page, fonts, colors, pageW, 18);
}

function overviewMetaMap(source, fields) {
  const values = {};
  if (fields.bumper && source.bumper) values.rigging = source.bumper;
  const pickups = pickupInfo(source);
  if (fields.pickups && pickups) values.pickups = pickups.value;
  if (fields.site && source.site != null) values.site = `${source.site}°`;
  if (fields.azimuth && source.azimuth != null) values.azimuth = `${source.azimuth}°`;
  if (fields.bottomElevation && source.bottomElevation) values.bottom = source.bottomElevation;
  const motors = motorInfo(source);
  if (fields.motorLoads && motors) values.motors = motors.value;
  if (fields.weight && source.totalWeight) values.weight = source.totalWeight;
  return values;
}

function overviewRowDefinitions(pageSources, fields) {
  const maps = pageSources.map((source) => overviewMetaMap(source, fields));
  const defs = [
    { key: 'rigging', label: 'Rigging' },
    { key: 'pickups', label: 'Pickup holes / points' },
    { key: 'site', label: 'Site', emphasis: true },
    { key: 'azimuth', label: 'Azimuth' },
    { key: 'bottom', label: 'Bottom elevation', emphasis: true },
    { key: 'motors', label: 'Motor loads' },
    { key: 'weight', label: 'Weight' },
  ];
  return defs.filter((def) => maps.some((map) => hasValue(map[def.key])));
}

function drawOverviewHangHeader(page, fonts, colors, rgb, source, x, topY, width) {
  const markerColor = source.hangColor ? rgbFromHex(source.hangColor, rgb) : colors.accent;
  page.drawRectangle({ x, y: topY + 3, width, height: 5, color: markerColor || colors.accent });

  let titleX = x;
  const titleY = topY - 20;
  if (source.hangColor) {
    const c = rgbFromHex(source.hangColor, rgb);
    page.drawCircle({ x: x + 14, y: titleY + 5, size: 12.5, color: c });
    const badge = String(source.badge || '').toUpperCase().slice(0, 4);
    if (badge) {
      const bs = fitTextSize(fonts.bold, badge, 19, 7.6, 5.0);
      const bw = fonts.bold.widthOfTextAtSize(badge, bs);
      page.drawText(badge, { x: x + 14 - bw / 2, y: titleY + 2.3, size: bs, font: fonts.bold, color: contrastForHex(source.hangColor, rgb) });
    }
    titleX += 33;
  }

  const danger = hasMechanicalDanger(source);
  const compactDangerW = danger ? 55 : 0;
  const title = source.exportName || source.name;
  const titleMaxW = Math.max(55, width - (titleX - x) - compactDangerW - (danger ? 7 : 0));
  const titleBlock = drawWrappedText(page, fonts.bold, colors.text, title, titleX, titleY, titleMaxW, { preferred: 17.5, min: 9.6, maxLines: 2, leadingExtra: 1.6 });
  if (danger) drawDangerBadge(page, fonts, rgb, x + width - compactDangerW, titleY - 2.5, true);
  const summaryY = Math.min(titleY - 19, titleBlock.bottom - 2.5);
  const summarySize = fitTextSize(fonts.bold, source.summary, width, 8.8, 6.3);
  page.drawText(source.summary, { x, y: summaryY, size: summarySize, font: fonts.bold, color: colors.muted, maxWidth: width });
}

function drawOverviewMetaGrid(page, fonts, colors, pageSources, fields, labelX, valueXs, valueWidths, topY) {
  const defs = overviewRowDefinitions(pageSources, fields);
  const maps = pageSources.map((source) => overviewMetaMap(source, fields));
  const rowH = 25.5;
  const labelW = valueXs[0] - labelX - 10;

  defs.forEach((def, rowIndex) => {
    const yTop = topY - rowIndex * rowH;
    const yBottom = yTop - rowH;
    if (rowIndex % 2 === 1) {
      page.drawRectangle({
        x: labelX,
        y: yBottom,
        width: valueXs[valueXs.length - 1] + valueWidths[valueWidths.length - 1] - labelX,
        height: rowH,
        color: colors.rowAlt,
      });
    }
    page.drawLine({
      start: { x: labelX, y: yBottom },
      end: { x: valueXs[valueXs.length - 1] + valueWidths[valueWidths.length - 1], y: yBottom },
      thickness: 0.4,
      color: colors.line,
    });
    page.drawText(def.label.toUpperCase(), {
      x: labelX + 4,
      y: yTop - 16.2,
      size: 7.2,
      font: fonts.bold,
      color: colors.muted,
      maxWidth: labelW - 6,
    });

    pageSources.forEach((source, colIndex) => {
      const raw = maps[colIndex][def.key];
      const value = hasValue(raw) ? String(raw) : '—';
      const x = valueXs[colIndex];
      const width = valueWidths[colIndex];
      const font = fonts.bold;
      const size = fitTextSize(font, value, width - 10, def.emphasis ? 11.0 : 10.0, 6.2);
      page.drawText(value, {
        x: x + 5,
        y: yTop - 16.8,
        size,
        font,
        color: def.emphasis && value !== '—' ? colors.accent : (value === '—' ? colors.muted : colors.text),
        maxWidth: width - 10,
      });
    });
  });

  return topY - defs.length * rowH;
}

function drawOverviewTables(page, fonts, colors, pageSources, fields, valueXs, valueWidths, topY, bottomY) {
  const visibleCounts = pageSources.map((source) => Math.min(source.boxes?.length || 0, 64));
  const maxRows = Math.max(0, ...visibleCounts);
  if (!maxRows) return;

  const headerH = 22;
  const available = Math.max(120, topY - bottomY - headerH);
  // Every hang on the overview page shares one row grid. This makes Box 1, Box 2,
  // four-box dolly shading, etc. line up horizontally for fast comparison.
  const rowHeight = Math.max(11.2, Math.min(27, available / Math.max(1, maxRows)));
  const fontSize = Math.max(6.4, Math.min(10.8, rowHeight * 0.48));
  const headerFontSize = Math.max(7.0, Math.min(9.0, rowHeight * 0.38));

  pageSources.forEach((source, colIndex) => {
    const schema = tableSchema(source, fields);
    const boxes = source.boxes || [];
    if (!boxes.length) return;

    const x = valueXs[colIndex];
    const width = valueWidths[colIndex];
    const count = Math.min(boxes.length, 64);
    drawTable(page, fonts, colors, boxes.slice(0, count), x, topY, width, schema, {
      sourceOffset: 0,
      rowHeight,
      fontSize,
      headerHeight: headerH,
      headerFontSize,
      compact: true,
      drawTopBorder: false,
    });
    if (boxes.length > count) {
      page.drawText(`+ ${boxes.length - count} more boxes — see detailed sheet`, {
        x,
        y: bottomY + 3,
        size: 6.3,
        font: fonts.bold,
        color: colors.warning,
        maxWidth: width,
      });
    }
  });
}

function drawOverviewPages({ pdfDoc, fonts, colors, rgb, logoImage, preparedBy, generatedDate, project, metadata, fields, sources }) {
  const perPage = 4;
  const pages = Math.ceil(sources.length / perPage);

  for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
    const pageSources = sources.slice(pageIndex * perPage, (pageIndex + 1) * perPage);
    const page = pdfDoc.addPage(A3_LANDSCAPE);
    const [pageW, pageH] = A3_LANDSCAPE;
    page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: colors.bg });

    const header = overviewHeaderParts(metadata, project);
    const titleY = pageH - 33;
    const titleMaxW = pageW - margin * 2 - 300;
    const titleSize = fitTextSize(fonts.bold, header.title, titleMaxW, 22.0, 11.0);
    const titleText = truncateLineToWidth(fonts.bold, header.title, titleSize, titleMaxW);
    page.drawText(titleText, { x: margin, y: titleY, size: titleSize, font: fonts.bold, color: colors.text, maxWidth: titleMaxW });

    let leftBottom = titleY - 14;
    if (header.subtitle) {
      const subtitle = truncateLineToWidth(fonts.regular, header.subtitle, 8.4, titleMaxW);
      page.drawText(subtitle, { x: margin, y: titleY - 18.5, size: 8.4, font: fonts.regular, color: colors.muted, maxWidth: titleMaxW });
      leftBottom = titleY - 30;
    }

    const brandBottom = drawLogoAndByline(page, fonts, colors, logoImage, preparedBy, generatedDate, pageW, pageH, 92, 34, pageH - 27, 150);
    const accentY = Math.min(leftBottom - 3, brandBottom - 7);
    page.drawRectangle({ x: margin, y: accentY, width: pageW - margin * 2, height: 2.8, color: colors.accent });

    const labelW = 116;
    const gap = 14;
    const valuesLeft = margin + labelW;
    const usableValues = pageW - margin - valuesLeft - gap * Math.max(0, pageSources.length - 1);
    const colW = usableValues / Math.max(1, pageSources.length);
    const valueXs = pageSources.map((_, idx) => valuesLeft + idx * (colW + gap));
    const valueWidths = pageSources.map(() => colW);

    let y = accentY - 16;
    const headerTop = y - 2;
    pageSources.forEach((source, idx) => drawOverviewHangHeader(page, fonts, colors, rgb, source, valueXs[idx], headerTop, valueWidths[idx]));
    y -= 59;

    const metaBottom = drawOverviewMetaGrid(page, fonts, colors, pageSources, fields, margin, valueXs, valueWidths, y);
    const tableTop = metaBottom - 8;
    const bottomY = 27;

    page.drawText('ENCLOSURE SETTINGS', {
      x: margin + 4,
      y: tableTop - 15,
      size: 7.3,
      font: fonts.bold,
      color: colors.muted,
      maxWidth: labelW - 8,
    });
    drawOverviewTables(page, fonts, colors, pageSources, fields, valueXs, valueWidths, tableTop, bottomY);

    page.drawText(`${pageIndex + 1}/${pages}`, { x: margin, y: 18, size: 7.7, font: fonts.bold, color: colors.muted });
    drawSafetyFooter(page, fonts, colors, pageW, 18);
  }
}

export async function exportFlySheet({
  project,
  sources,
  fields,
  logo,
  preparedBy = '',
  appearance = 'dark',
  style = 'monochrome',
  metadata = {},
  layoutMode = 'detailed',
}) {
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const pdfDoc = await PDFDocument.create();
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
  const logoImage = await embedLogo(pdfDoc, logo);
  const colors = palette(style, appearance, rgb);
  const generatedDate = formatGeneratedDate();

  if (layoutMode === 'overview' || layoutMode === 'both') {
    drawOverviewPages({ pdfDoc, fonts, colors, rgb, logoImage, preparedBy, generatedDate, project, metadata, fields, sources });
  }

  if (layoutMode === 'detailed' || layoutMode === 'both') {
    const plan = sources.flatMap((source) => detailedPlanForSource(source, fields));
    const totalPages = plan.length;
    plan.forEach((pack, index) => {
      drawDetailedPage({
        pdfDoc, fonts, colors, rgb, logoImage, preparedBy, generatedDate, project, metadata, fields,
        pack, pageNumber: index + 1, totalPages,
      });
    });
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildFilename(metadata, project);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
