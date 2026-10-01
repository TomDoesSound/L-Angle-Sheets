import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

const expected = {
  showInput: 40,
  cityInput: 24,
  projectOverrideInput: 32,
  revisionInput: 3,
  preparedByInput: 32,
};
for (const [id, max] of Object.entries(expected)) {
  const re = new RegExp(`id=["']${id}["'][^>]*maxlength=["']${max}["']`);
  assert.match(html, re, `${id} must keep PDF-safe maxlength ${max}`);
}
assert.match(app, /const NOTE_MAX_LENGTH = 120;/, 'notes must use the 120-character PDF-safe maximum');
assert.match(app, /const EXPORT_NAME_MAX_LENGTH = 32;/, 'export names must use the tested 32-character maximum');
assert.match(html, /DANGER conditions are always flagged/, 'UI must explain automatic DANGER badges');
assert.match(app, /DANGER — CHECK SOUNDVISION/, 'detailed preview must surface DANGER');
console.log('v0.16 input-limit smoke test passed');
