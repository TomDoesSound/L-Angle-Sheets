import assert from 'node:assert/strict';
import { parseSoundvisionReport } from '../src/soundvision-parser.js';

const line = (text, y, cells = null) => ({ text, y, cells: cells ?? [{ text, x: 70 }] });
const row = (y, vals) => ({ y, text: vals.map(v => v.text).join(' '), cells: vals });

const pages = [{ page: 1, lines: [
  line('Soundvision', 790),
  line('Version: 2026.3.1', 775),
  line('Date: 2026/09/24', 760),
  line('File name: TEST.xmlp', 745),
  line('Distance unit: m', 735),
  line('Weight unit: kg', 725),
  line('1. Group: MAIN', 720),
  line('1. Source: MAIN L', 700),
  line('1. 1. Physical configuration', 680),
  line('Configuration: vertical, flown array', 660),
  line('Bumper: K1-BUMP', 640),
  line('# motors: 2', 620),
  line('Front pickup position (X; Y; Z, m): 3 (0; 0; 10)', 600),
  line('Rear pickup position (X; Y; Z, m): 7 (0; 0; 10)', 580),
  line('Site: -5 °', 560),
  line('Azimuth: 12 °', 540),
  line('Bottom elevation: 6.2 m', 520),
  line('Total weight (Enclosures + Frames): 1000 kg', 500),
  line('Front motor load: 520 kg', 480),
  line('Rear motor load: 480 kg', 460),
  row(430, [
    { text: '#', x: 85 }, { text: 'Type', x: 119 }, { text: 'Angles (°)', x: 168 },
    { text: 'Site (°)', x: 244 }, { text: 'Top Z (m)', x: 304 }, { text: 'Bottom Z (m)', x: 379 }, { text: 'Panflex', x: 472 },
  ]),
  row(410, [
    { text: '#1', x: 73 }, { text: 'K1', x: 109 }, { text: '0.5', x: 210 },
    { text: '-5.5', x: 265 }, { text: '9.5', x: 340 }, { text: '9.1', x: 430 },
  ]),
  row(390, [
    { text: '#2', x: 73 }, { text: 'K2', x: 109 }, { text: '2', x: 224 },
    { text: '-7.5', x: 265 }, { text: '9.0', x: 340 }, { text: '8.6', x: 430 }, { text: '55/35', x: 491 },
  ]),
  line('1. 2. Acoustic configuration', 360),
]}];

const parsed = parseSoundvisionReport(pages);
assert.equal(parsed.meta.distanceUnit, 'm');
assert.equal(parsed.meta.weightUnit, 'kg');
assert.equal(parsed.sources.length, 1);
const s = parsed.sources[0];
assert.equal(s.name, 'MAIN L');
assert.equal(s.isFlown, true);
assert.equal(s.frontPickupHole, '3');
assert.equal(s.rearPickupHole, '7');
assert.equal(s.azimuth, '12');
assert.equal(s.hasAngleColumn, true);
assert.equal(s.boxes.length, 2);
assert.equal(s.boxes[0].angle, '0.5');
assert.deepEqual(s.boxes[0].panflexModules, []);
assert.deepEqual(s.boxes[1].panflexModules, ['55/35']);

const lSeriesPages = [{ page: 1, lines: [
  line('Soundvision', 790),
  line('File name: LTEST.xmlp', 775),
  line('1. Group: MAIN', 750),
  line('1. Source: L1 MAIN', 730),
  line('Configuration: vertical, flown array', 710),
  line('Bumper: L1-BAR', 690),
  line('# motors: 2', 670),
  row(640, [
    { text: '#', x: 85 }, { text: 'Type', x: 119 }, { text: 'Angles (°)', x: 168 },
    { text: 'Site (°)', x: 244 }, { text: 'Top Z (m)', x: 304 }, { text: 'Bottom Z (m)', x: 379 }, { text: 'Panflex', x: 472 },
  ]),
  row(620, [
    { text: '#1', x: 73 }, { text: 'L1', x: 109 }, { text: '0.8', x: 210 }, { text: '-4.8', x: 265 },
    { text: '14.6', x: 340 }, { text: '13.6', x: 430 }, { text: '45/45 | 45/45', x: 491 },
  ]),
  line('2. Source: L2 REAR', 590),
  line('Configuration: vertical, flown array', 570),
  line('Bumper: L2-BAR inv hole A', 550),
  line('# motors: 2', 530),
  row(500, [
    { text: '#', x: 85 }, { text: 'Type', x: 119 }, { text: 'Site (°)', x: 205 },
    { text: 'Top Z (m)', x: 304 }, { text: 'Bottom Z (m)', x: 379 }, { text: 'Panflex', x: 472 },
  ]),
  row(480, [
    { text: '#1', x: 73 }, { text: 'L2D', x: 109 }, { text: '-13', x: 260 },
    { text: '15.6', x: 340 }, { text: '14.5', x: 430 }, { text: '55/55 | 55/55 | 60/60 | 70/70', x: 491 },
  ]),
]}];

const lParsed = parseSoundvisionReport(lSeriesPages);
assert.equal(lParsed.sources.length, 2);
assert.deepEqual(lParsed.sources[0].boxes[0].panflexModules, ['45/45', '45/45']);
assert.equal(lParsed.sources[0].panflexProfile.maxModules, 2);
assert.equal(lParsed.sources[1].hasAngleColumn, false);
assert.deepEqual(lParsed.sources[1].boxes[0].panflexModules, ['55/55', '55/55', '60/60', '70/70']);
assert.equal(lParsed.sources[1].panflexProfile.maxModules, 4);
console.log('parser smoke test passed');

const genericPickupPages = [{ page: 1, lines: [
  line('Soundvision', 790),
  line('File name: PICKS.xmlp', 775),
  line('1. Source: A10 1', 750),
  line('Configuration: vertical, flown array with HF left', 730),
  line('Bumper: A10-BUMP', 710),
  line('# motors: 2', 690),
  line('Front pickup position (X; Y; Z, m): F (0; 0; 10)', 670),
  line('Rear pickup position (X; Y; Z, m): R (0; 0; 10)', 650),
  line('Front motor load: 10 kg', 630),
  line('Rear motor load: 90 kg', 610),
  row(580, [
    { text: '#', x: 85 }, { text: 'Type', x: 119 }, { text: 'Site (°)', x: 205 },
    { text: 'Top Z (m)', x: 304 }, { text: 'Bottom Z (m)', x: 379 }, { text: 'Panflex', x: 472 },
  ]),
  row(560, [
    { text: '#1', x: 73 }, { text: 'A10 FOCUS', x: 109 }, { text: '-5', x: 260 },
    { text: '15', x: 340 }, { text: '14.6', x: 430 }, { text: '55/55', x: 491 },
  ]),
]}];
const genericParsed = parseSoundvisionReport(genericPickupPages).sources[0];
assert.equal(genericParsed.frontPickupHole, 'F');
assert.equal(genericParsed.rearPickupHole, 'R');
assert.deepEqual(genericParsed.pickupEntries.map(({ label, value }) => ({ label, value })), [{ label: 'Front', value: 'F' }, { label: 'Rear', value: 'R' }]);
assert.equal(genericParsed.hasAngleColumn, false);


const a15VariantPages = [{ page: 1, lines: [
  line('Soundvision', 790),
  line('Distance unit: m', 780),
  line('Weight unit: kg', 770),
  line('1. Source: A15 SINGLE', 750),
  line('Configuration: vertical, flown array with HF left', 730),
  line('Bumper: A15-BUMP+MBAR', 710),
  line('# motors: 1', 690),
  line('Front pickup position (X; Y; Z, m): 8 (0; 0; 5)', 670),
  line('Front motor load: 165 kg', 650),
  row(620, [
    { text: '#', x: 85 }, { text: 'Type', x: 119 }, { text: 'Site (°)', x: 205 },
    { text: 'Top Z (m)', x: 304 }, { text: 'Bottom Z (m)', x: 379 }, { text: 'Panflex', x: 472 },
  ]),
  row(600, [
    { text: '#1', x: 73 }, { text: 'A15 FOCUS', x: 109 }, { text: '-5', x: 260 },
    { text: '5', x: 340 }, { text: '4.5', x: 430 }, { text: '55/55', x: 491 },
  ]),
  line('2. Source: KS28 LR', 570),
  line('Configuration: vertical, flown array', 550),
  line('Bumper: KS28-BUMP', 530),
  line('# motors: 2', 510),
  line('Front left pickup position (X; Y; Z, m): EXT (0; 0; 5)', 490),
  line('Front right pickup position (X; Y; Z, m): EXT (0; 0; 5)', 470),
  line('Front left motor load: 640 kg', 450),
  line('Front right motor load: 640 kg', 430),
  row(400, [
    { text: '#', x: 85 }, { text: 'Type', x: 119 }, { text: 'Site (°)', x: 205 },
    { text: 'Top Z (m)', x: 304 }, { text: 'Bottom Z (m)', x: 379 },
  ]),
  row(380, [
    { text: '#1', x: 73 }, { text: 'KS28', x: 109 }, { text: '0', x: 260 }, { text: '5', x: 340 }, { text: '4.5', x: 430 },
  ]),
]}];
const a15Variants = parseSoundvisionReport(a15VariantPages).sources;
assert.equal(a15Variants[0].motorCount, 1);
assert.deepEqual(a15Variants[0].pickupEntries.map(({ label, value }) => ({ label, value })), [{ label: 'Front', value: '8' }]);
assert.deepEqual(a15Variants[0].motorLoadEntries.map(({ label, value }) => ({ label, value })), [{ label: 'Front', value: '165 kg' }]);
assert.deepEqual(a15Variants[1].pickupEntries.map(({ label, value }) => ({ label, value })), [{ label: 'Front left', value: 'EXT' }, { label: 'Front right', value: 'EXT' }]);

const warningPages = [{ page: 1, lines: [
  line('Soundvision', 790),
  line('1. Source: OVER LIMIT', 760),
  line('Configuration: vertical, flown array', 740),
  line('Bumper: K1-BUMP', 720),
  line('# motors: 2', 700),
  line('Mechanical warnings:', 680),
  line('DANGER', 660),
  line('L-Acoustics does not allow this configuration.', 640),
  line('Safety factor is below minimum recommended by applicable standards.', 620),
  line('WARNING', 600),
  line('Maximum limit is 24 enclosures.', 580),
  row(550, [
    { text: '#', x: 85 }, { text: 'Type', x: 119 }, { text: 'Angles (°)', x: 168 },
    { text: 'Site (°)', x: 244 }, { text: 'Top Z (m)', x: 304 }, { text: 'Bottom Z (m)', x: 379 },
  ]),
  row(530, [{ text: '#1', x: 73 }, { text: 'K1', x: 109 }, { text: '0', x: 210 }, { text: '0', x: 265 }, { text: '5', x: 340 }, { text: '4.5', x: 430 }]),
]}];
const warned = parseSoundvisionReport(warningPages).sources[0];
assert.equal(warned.mechanicalWarnings.length, 2);
assert.equal(warned.mechanicalWarnings[0].severity, 'DANGER');
assert.equal(warned.mechanicalWarnings[1].severity, 'WARNING');
assert.match(warned.mechanicalWarnings[1].messages[0], /Maximum limit/);

const imperialPages = [{ page: 1, lines: [
  line('Soundvision', 790),
  line('Distance unit: ft.in', 780),
  line('Weight unit: lb', 770),
  line('1. Source: IMPERIAL', 750),
  line('Configuration: vertical, flown array', 730),
  line('Bumper: K2-BUMP', 710),
  line('# motors: 2', 690),
  line('Bottom elevation: 21.01 ft.in', 670),
  line('Total weight (Enclosures + Frames): 3101.65 lb', 650),
  row(620, [
    { text: '#', x: 85 }, { text: 'Type', x: 119 }, { text: 'Angles (°)', x: 168 },
    { text: 'Site (°)', x: 244 }, { text: 'Top Z (ft.in)', x: 304 }, { text: 'Bottom Z (ft.in)', x: 379 }, { text: 'Panflex', x: 472 },
  ]),
  row(600, [{ text: '#1', x: 73 }, { text: 'K2', x: 109 }, { text: '5', x: 210 }, { text: '0', x: 265 }, { text: '49.03', x: 340 }, { text: '48.01', x: 430 }, { text: '55/55', x: 491 }]),
]}];
const imperial = parseSoundvisionReport(imperialPages);
assert.equal(imperial.meta.distanceUnit, 'ft.in');
assert.equal(imperial.meta.weightUnit, 'lb');
assert.equal(imperial.sources[0].bottomElevation, '21.01 ft.in');
assert.equal(imperial.sources[0].totalWeight, '3101.65 lb');

console.log('parser regression extensions passed');

// Regression: ft.in L2 reports can combine the box id and type into one PDF text item.
// This previously made an otherwise valid L2 source appear as "0 boxes / INCOMPLETE".
const ftInL2Pages = [{ page: 1, lines: [
  line('Soundvision', 790),
  line('Distance unit: ft.in', 780),
  line('Weight unit: lb', 770),
  line('1. Source: L2 1', 750),
  line('Configuration: vertical, flown array', 730),
  line('Bumper: L2-BAR hole A', 710),
  line('# motors: 2', 690),
  line('Front pickup position (X; Y; Z, ft.in): 1 (116.10; 0.00; 49.10)', 670),
  line('Rear pickup position (X; Y; Z, ft.in): 17 (116.10; -3.02; 49.08)', 650),
  line('Bottom elevation: 34.12 ft.in', 630),
  row(600, [
    { text: '#', x: 76 }, { text: 'Type', x: 91 }, { text: 'Site', x: 122 }, { text: '(°)', x: 146 },
    { text: 'Top', x: 164 }, { text: 'Z', x: 188 }, { text: '(ft.in)', x: 199 },
    { text: 'Bottom', x: 230 }, { text: 'Z', x: 272 }, { text: '(ft.in)', x: 282 }, { text: 'Panflex', x: 369 },
  ]),
  row(580, [{ text: '#1 L2', x: 73 }, { text: '2', x: 153 }, { text: '49.02', x: 196 }, { text: '45.03', x: 280 }, { text: '35/35 | 35/35 | 35/35 | 35/35', x: 315 }]),
  row(560, [{ text: '#2 L2', x: 73 }, { text: '-8', x: 149 }, { text: '45.03', x: 196 }, { text: '41.05', x: 280 }, { text: '55/55 | 55/55 | 55/55 | 55/55', x: 315 }]),
  row(540, [{ text: '#3 L2', x: 73 }, { text: '-18', x: 142 }, { text: '41.05', x: 196 }, { text: '37.08', x: 280 }, { text: '55/55 | 55/55 | 55/55 | 55/55', x: 315 }]),
  row(520, [{ text: '#4 L2D', x: 73 }, { text: '-28', x: 142 }, { text: '37.09', x: 196 }, { text: '34.12', x: 280 }, { text: '55/55 | 55/55 | 60/60 | 70/70', x: 315 }]),
]}];
const ftInL2 = parseSoundvisionReport(ftInL2Pages).sources[0];
assert.equal(ftInL2.boxes.length, 4);
assert.equal(ftInL2.summary, '3 × L2 + 1 × L2D');
assert.equal(ftInL2.hasAngleColumn, false);
assert.equal(ftInL2.panflexProfile.maxModules, 4);
assert.deepEqual(ftInL2.boxes[3].panflexModules, ['55/55', '55/55', '60/60', '70/70']);
assert.equal(ftInL2.validation.ok, true);
console.log('v0.8 ft.in L2 regression passed');

// Regression: PDF.js may collapse the complete L2 ft.in data row into one text item.
// The parser must not treat Site / Z / Panflex values as part of the enclosure type.
const ftInL2CollapsedPages = [{ page: 1, lines: [
  line('Soundvision', 790),
  line('Distance unit: ft.in', 780),
  line('Weight unit: lb', 770),
  line('1. Source: L2 COLLAPSED', 750),
  line('Configuration: vertical, flown array', 730),
  line('Bumper: L2-BAR hole A', 710),
  line('# motors: 2', 690),
  row(600, [
    { text: '#', x: 76 }, { text: 'Type', x: 91 }, { text: 'Site', x: 122 }, { text: '(°)', x: 146 },
    { text: 'Top', x: 164 }, { text: 'Z', x: 188 }, { text: '(ft.in)', x: 199 },
    { text: 'Bottom', x: 230 }, { text: 'Z', x: 272 }, { text: '(ft.in)', x: 282 }, { text: 'Panflex', x: 369 },
  ]),
  row(580, [{ text: '#1 L2 2 49.02 45.03 35/35 | 35/35 | 35/35 | 35/35', x: 73 }]),
  row(560, [{ text: '#2 L2 -8 45.03 41.05 55/55 | 55/55 | 55/55 | 55/55', x: 73 }]),
  row(540, [{ text: '#3 L2 -18 41.05 37.08 55/55 | 55/55 | 55/55 | 55/55', x: 73 }]),
  row(520, [{ text: '#4 L2D -28 37.09 34.12 55/55 | 55/55 | 60/60 | 70/70', x: 73 }]),
]}];
const ftInL2Collapsed = parseSoundvisionReport(ftInL2CollapsedPages).sources[0];
assert.equal(ftInL2Collapsed.summary, '3 × L2 + 1 × L2D');
assert.equal(ftInL2Collapsed.boxes[0].type, 'L2');
assert.equal(ftInL2Collapsed.boxes[0].site, '2');
assert.equal(ftInL2Collapsed.boxes[0].topZ, '49.02');
assert.equal(ftInL2Collapsed.boxes[0].bottomZ, '45.03');
assert.deepEqual(ftInL2Collapsed.boxes[3].panflexModules, ['55/55', '55/55', '60/60', '70/70']);
console.log('v0.9 collapsed ft.in L2 regression passed');

// Regression: the actual ft.in L2 PDF can expose only Type + Panflex as reliable
// column anchors while Site / Z headers are merged into one PDF.js item. In that
// case coordinate grouping can put all scalar fields into `type`; the parser must
// still isolate L2/L2D and retain the four Panflex modules.
const ftInL2MergedHeaderPages = [{ page: 1, lines: [
  line('Soundvision', 790),
  line('Distance unit: ft.in', 780),
  line('Weight unit: lb', 770),
  line('1. Source: L2 MERGED HEADER', 750),
  line('Configuration: vertical, flown array', 730),
  line('Bumper: L2-BAR hole A', 710),
  row(600, [
    { text: '#', x: 76 },
    { text: 'Type', x: 91 },
    { text: 'Site (°) Top Z (ft.in) Bottom Z (ft.in)', x: 122 },
    { text: 'Panflex', x: 369 },
  ]),
  // Deliberately emulate the bad grouping seen from PDF.js: the visual columns
  // have been folded into the Type item while Panflex is still discoverable.
  row(580, [
    { text: '#1', x: 73 },
    { text: 'L2 2 49.02 45.03 35/35 | 35/35 | 35/35 | 35/35', x: 92 },
  ]),
  row(560, [
    { text: '#2', x: 73 },
    { text: 'L2 -8 45.03 41.05 55/55 | 55/55 | 55/55 | 55/55', x: 92 },
  ]),
  row(540, [
    { text: '#3', x: 73 },
    { text: 'L2 -18 41.05 37.08 55/55 | 55/55 | 55/55 | 55/55', x: 92 },
  ]),
  row(520, [
    { text: '#4', x: 73 },
    { text: 'L2D -28 37.09 34.12 55/55 | 55/55 | 60/60 | 70/70', x: 92 },
  ]),
]}];
const ftInL2MergedHeader = parseSoundvisionReport(ftInL2MergedHeaderPages).sources[0];
assert.equal(ftInL2MergedHeader.summary, '3 × L2 + 1 × L2D');
assert.deepEqual(ftInL2MergedHeader.boxes.map((box) => box.type), ['L2', 'L2', 'L2', 'L2D']);
assert.equal(ftInL2MergedHeader.panflexProfile.maxModules, 4);
assert.deepEqual(ftInL2MergedHeader.boxes[3].panflexModules, ['55/55', '55/55', '60/60', '70/70']);
console.log('v0.9.1 merged-header ft.in L2 regression passed');
