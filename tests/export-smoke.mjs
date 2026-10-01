import assert from 'node:assert/strict';
import { exportFlySheet } from '../src/pdf-export.js';

const captured = [];
const overflows = [];
const drawnText = [];
const circles = [];
class FakeFont {
  widthOfTextAtSize(text, size) {
    const width = [...String(text ?? '')].reduce((sum, ch) => {
      if (ch === 'W') return sum + 0.944;
      if (ch === 'M') return sum + 0.833;
      if (ch === ' ') return sum + 0.278;
      if (/\d/.test(ch)) return sum + 0.556;
      if (/[A-Z]/.test(ch)) return sum + 0.667;
      if (/[a-z]/.test(ch)) return sum + 0.5;
      return sum + 0.34;
    }, 0);
    return width * size;
  }
}
class FakePage {
  drawRectangle() {}
  drawLine() {}
  drawCircle(options = {}) { circles.push(options); }
  drawImage() {}
  drawText(text, options = {}) {
    const value = String(text);
    captured.push(value);
    drawnText.push({ value, ...options });
    if (options.maxWidth != null && options.font && options.size != null) {
      const measured = options.font.widthOfTextAtSize(value, options.size);
      if (measured > options.maxWidth + 0.05) overflows.push({ value, measured, maxWidth: options.maxWidth, size: options.size });
    }
  }
}
class FakeDoc {
  static async create() { return new FakeDoc(); }
  async embedFont() { return new FakeFont(); }
  addPage() { return new FakePage(); }
  async save() { return new Uint8Array([1]); }
}

globalThis.window = { PDFLib: { PDFDocument: FakeDoc, StandardFonts: { Helvetica: 'h', HelveticaBold: 'hb' }, rgb: (r, g, b) => ({ r, g, b }) } };
globalThis.document = { body: { appendChild() {} }, createElement() { return { click() {}, remove() {} }; } };
globalThis.URL.createObjectURL = () => 'blob:test';
globalThis.URL.revokeObjectURL = () => {};

const box = (n, type, angle = null, panflex = []) => ({ box: `#${n}`, type, angle, panflexModules: panflex });
const base = {
  id: 's', group: 'FLOWN', configuration: 'vertical, flown array', bumper: 'BUMP', motorCount: 2,
  site: '0', azimuth: '0', bottomElevation: '10 m', totalWeight: '100 kg', validation: { ok: true, issues: [] },
  tableColumns: ['type', 'angle', 'panflex'], hasAngleColumn: true, hasPanflexColumn: true,
  panflexProfile: { maxModules: 1, perType: {} }, mechanicalWarnings: [], boxes: [], summary: '',
};
const sources = [
  { ...base, id: 'k1', name: 'K1', exportName: 'K1', exportNote: 'NOTEWORD '.repeat(12).trim(), summary: '24 × K1', hangColor: '#2f80ed', badge: '', pickupEntries: [{ label: 'Front', value: '1' }, { label: 'Rear', value: '21' }], motorLoadEntries: [{ label: 'Front', value: '50 kg' }, { label: 'Rear', value: '50 kg' }], boxes: Array.from({ length: 24 }, (_, i) => box(i + 1, 'K1', i ? '0.5' : null, ['55/55'])), mechanicalWarnings: [{ severity: 'DANGER', messages: ['Test warning'] }] },
  { ...base, id: 'a15', name: 'A15', exportName: 'A15', summary: '6 × A15', hasAngleColumn: false, pickupEntries: [{ label: 'Front', value: 'F' }, { label: 'Rear', value: 'R' }], motorLoadEntries: [{ label: 'Front', value: '10 kg' }, { label: 'Rear', value: '90 kg' }], boxes: Array.from({ length: 6 }, (_, i) => box(i + 1, i < 4 ? 'A15 FOCUS' : 'A15 WIDE', null, ['55/55'])) },
  { ...base, id: 'single', name: 'A15 SINGLE', exportName: 'A15 SINGLE', summary: '4 × A15 FOCUS', hasAngleColumn: false, pickupEntries: [{ label: 'Front', value: '8' }], motorLoadEntries: [{ label: 'Front', value: '165 kg' }], boxes: Array.from({ length: 4 }, (_, i) => box(i + 1, 'A15 FOCUS', null, ['55/55'])) },
];
const project = { meta: { fileName: 'test.xmlp', distanceUnit: 'm', weightUnit: 'kg' }, sources };
await exportFlySheet({
  project, sources,
  fields: { angles: true, panflex: true, bumper: true, pickups: true, motorLoads: true, site: true, azimuth: true, bottomElevation: true, weight: true, warnings: true },
  metadata: { show: 'Test'.repeat(10), city: 'Sydney'.repeat(4), projectName: 'project'.repeat(4), revision: '123' }, layoutMode: 'both', style: 'monochrome',
});
const has = (value) => captured.some((text) => text === value || text.includes(value));
for (const value of ['ANGLE', 'PICKUP HOLES F / R', '1 / 21', 'PICKUP POINTS F / R', 'F / R', 'PICKUP HOLE', 'MOTOR LOAD', '165 kg', 'DANGER — CHECK SOUNDVISION', 'Test warning']) {
  assert.ok(has(value), `missing ${value}`);
}
assert.ok(!has('Front: 8'), 'single pickup hole should not be prefixed with Front');
assert.ok(!has('Front: 165 kg'), 'single motor load should not be prefixed with Front');
assert.ok(captured.includes('REV 123'), 'numeric revision should render independently and remain fully visible');
assert.ok(!captured.includes('SYSTEM OVERVIEW'), 'overview should not render the redundant SYSTEM OVERVIEW heading');
assert.ok(!captured.includes('FLOWN'), 'Soundvision group headings should not be rendered on overview sheets');
assert.equal(overflows.length, 0, `text overflow detected: ${JSON.stringify(overflows.slice(0, 4))}`);

// v0.16 worst-case input acceptance test. These are the maximum UI lengths and
// deliberately use Helvetica's widest common uppercase glyph. No accepted field
// may be replaced by an ellipsis. DANGER must appear even when warning details are off.
captured.length = 0;
overflows.length = 0;
drawnText.length = 0;
circles.length = 0;
const maxShow = 'W'.repeat(40);
const maxCity = 'W'.repeat(24);
const maxProject = 'W'.repeat(32);
const maxName = 'W'.repeat(32);
const maxPrepared = 'W'.repeat(32);
const maxNote = Array.from({ length: 20 }, () => 'WWWWW').join(' '); // 119 chars
const stressSource = {
  ...sources[0],
  exportName: maxName,
  exportNote: maxNote,
  badge: 'WWWW',
  mechanicalWarnings: [{ severity: 'DANGER', messages: ['L-Acoustics does not allow this configuration.'] }],
};
await exportFlySheet({
  project: { ...project, sources: [stressSource] },
  sources: [stressSource],
  fields: { angles: true, panflex: true, bumper: true, pickups: true, motorLoads: true, site: true, azimuth: true, bottomElevation: true, weight: true, warnings: false },
  preparedBy: maxPrepared,
  metadata: { show: maxShow, city: maxCity, projectName: maxProject, revision: '999' },
  layoutMode: 'both',
  style: 'monochrome',
});
assert.ok(captured.includes(maxShow), 'max-width Show must print in full');
assert.ok(captured.includes(maxCity), 'max-width City must print in full');
assert.ok(captured.includes(maxProject), 'max-width Project name must print in full');
assert.ok(captured.join('').includes(maxName), 'max-width Export name must print in full across at most two title lines');
assert.ok(captured.join('').includes(maxPrepared), 'max-width Prepared by value must print in full across its byline lines');
assert.ok(captured.join(' ').includes(maxNote), 'max-width Note must print in full across its two note lines');
assert.ok(captured.includes('REV 999'), 'max revision must print in full');
assert.ok(captured.includes('DANGER — CHECK SOUNDVISION'), 'DANGER badge must print even when full warning details are disabled');
assert.ok(!captured.includes('L-Acoustics does not allow this configuration.'), 'full warning text should remain optional');
assert.ok(!captured.some((text) => text.endsWith('...')), 'v0.16 stress export must not ellipsize accepted user metadata');
assert.equal(overflows.length, 0, `stress text overflow detected: ${JSON.stringify(overflows.slice(0, 6))}`);

// v0.16 regression: the 31 pt diameter detailed hang-colour circle must sit
// completely below the document metadata block, even at maximum input lengths.
const detailedHangCircle = circles.find((c) => Math.abs((c.size ?? 0) - 15.5) < 0.01);
assert.ok(detailedHangCircle, 'detailed hang-colour circle must be drawn');
const projectTextParts = drawnText.filter((d) => d.value === maxProject && d.y > 760);
assert.ok(projectTextParts.length >= 1, 'stress project metadata must be drawn');
const metadataLowestBaseline = Math.min(...projectTextParts.map((d) => d.y));
assert.ok(detailedHangCircle.y + detailedHangCircle.size <= metadataLowestBaseline - 2,
  `hang badge intrudes into metadata: badgeTop=${detailedHangCircle.y + detailedHangCircle.size}, metadataBaseline=${metadataLowestBaseline}`);

// Detailed footers are page-number only; long export names must never be repeated there.
assert.ok(captured.includes('1 / 1'), 'detailed footer must render page number only');
assert.ok(!drawnText.some((d) => d.y === 18 && d.value.includes(maxName)), 'detailed footer must not repeat the export name');
assert.ok(!captured.some((text) => text.endsWith('...')), 'v0.16 stress export must not ellipsize accepted user metadata');
console.log('export smoke + v0.16 stress test passed');
