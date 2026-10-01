import { readPdf } from './pdf-reader.js?v=0.16';
import { parseSoundvisionReport } from './soundvision-parser.js?v=0.16';
import { exportFlySheet } from './pdf-export.js?v=0.16';

const BRANDING_KEY = 'l-angle-sheets-branding-v1';
const LEGACY_BRANDING_KEYS = ['la-angle-sheet-branding-v1'];
const BUILD_VERSION = '0.16';
const DONATION_URL = 'https://buymeacoffee.com/tomspencer';
const NOTE_MAX_LENGTH = 120;
const EXPORT_NAME_MAX_LENGTH = 32;

const HANG_COLOR_PRESETS = {
  none: null,
  black: '#111111',
  blue: '#2f80ed',
  red: '#d94b4b',
  green: '#2fa36b',
  yellow: '#e2c23e',
  orange: '#e7802f',
  violet: '#7e57c2',
  brown: '#8d6e63',
  grey: '#7f8c8d',
  white: '#f1f1ed',
};

const els = {
  pdfInput: document.querySelector('#pdfInput'),
  dropzone: document.querySelector('#dropzone'),
  uploadPanel: document.querySelector('#uploadPanel'),
  parseStatus: document.querySelector('#parseStatus'),
  workspace: document.querySelector('#workspace'),
  projectName: document.querySelector('#projectName'),
  projectMeta: document.querySelector('#projectMeta'),
  sourceList: document.querySelector('#sourceList'),
  selectedCount: document.querySelector('#selectedCount'),
  selectFlownBtn: document.querySelector('#selectFlownBtn'),
  selectAllBtn: document.querySelector('#selectAllBtn'),
  clearBtn: document.querySelector('#clearBtn'),
  newReportBtn: document.querySelector('#newReportBtn'),
  fieldOptions: document.querySelector('#fieldOptions'),
  showInput: document.querySelector('#showInput'),
  cityInput: document.querySelector('#cityInput'),
  projectOverrideInput: document.querySelector('#projectOverrideInput'),
  revisionInput: document.querySelector('#revisionInput'),
  layoutModeSelect: document.querySelector('#layoutModeSelect'),
  preparedByInput: document.querySelector('#preparedByInput'),
  logoInput: document.querySelector('#logoInput'),
  logoFileName: document.querySelector('#logoFileName'),
  logoPreviewWrap: document.querySelector('#logoPreviewWrap'),
  logoPreview: document.querySelector('#logoPreview'),
  removeLogoBtn: document.querySelector('#removeLogoBtn'),
  pdfStyleSelect: document.querySelector('#pdfStyleSelect'),
  orderList: document.querySelector('#orderList'),
  exportBtn: document.querySelector('#exportBtn'),
  exportNotice: document.querySelector('#exportNotice'),
  previewTitle: document.querySelector('#previewTitle'),
  previewContent: document.querySelector('#previewContent'),
  previewModeSelect: document.querySelector('#previewModeSelect'),
  previewSourceSelect: document.querySelector('#previewSourceSelect'),
  previewTargetCaption: document.querySelector('#previewTargetCaption'),
  validationBadge: document.querySelector('#validationBadge'),
  buildVersion: document.querySelector('#buildVersion'),
  supportLink: document.querySelector('#supportLink'),
  supportCardLink: document.querySelector('#supportCardLink'),
  fieldStateNotice: document.querySelector('#fieldStateNotice'),
};

const state = {
  project: null,
  sourceFileName: '',
  selectedIds: new Set(),
  inspectedId: null,
  previewMode: 'detailed',
  previewPage: 0,
  order: [],
  customNames: new Map(),
  notes: new Map(),
  hangColors: new Map(),
  customHangColors: new Map(),
  badges: new Map(),
  duplicateIds: new Set(),
  logo: null,
  logoUrl: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setStatus(message, isError = false) {
  els.parseStatus.textContent = message;
  els.parseStatus.classList.toggle('error', isError);
}

function selectedFields() {
  const result = {};
  for (const input of els.fieldOptions.querySelectorAll('input[type="checkbox"]')) result[input.value] = input.checked;
  return result;
}

function pdfAppearance() {
  return document.querySelector('input[name="pdfAppearance"]:checked')?.value ?? 'dark';
}

function pdfStyle() {
  return els.pdfStyleSelect.value || 'monochrome';
}

function sourceById(id) {
  return state.project?.sources.find((s) => s.id === id) ?? null;
}

function originalProjectName() {
  const raw = state.project?.meta?.fileName || state.sourceFileName || 'Soundvision project';
  return raw.replace(/\.xmlp$/i, '').replace(/\.pdf$/i, '');
}

function revisionDigits(raw = els.revisionInput.value) {
  return String(raw ?? '').replace(/\D+/g, '').slice(0, 3);
}

function revisionLabel(raw = els.revisionInput.value) {
  const cleaned = revisionDigits(raw);
  return cleaned ? `REV ${cleaned}` : '';
}

function documentMetadata() {
  return {
    show: els.showInput.value.trim(),
    city: els.cityInput.value.trim(),
    projectName: els.projectOverrideInput.value.trim() || originalProjectName(),
    revision: revisionDigits(els.revisionInput.value),
  };
}

function detailedHeaderFields() {
  const meta = documentMetadata();
  const show = meta.show || meta.projectName || 'Soundvision project';
  const project = meta.projectName && meta.projectName.toLowerCase() !== show.toLowerCase() ? meta.projectName : '';
  return {
    show,
    city: meta.city,
    project,
    revision: revisionLabel(meta.revision),
  };
}

function overviewHeaderParts() {
  const meta = documentMetadata();
  const title = meta.show || meta.projectName || 'Soundvision project';
  const parts = [];
  if (meta.city) parts.push(meta.city);
  if (meta.projectName && meta.projectName.toLowerCase() !== title.toLowerCase()) parts.push(meta.projectName);
  const rev = revisionLabel(meta.revision);
  if (rev) parts.push(rev);
  return { title, subtitle: parts.join('\u00a0·\u00a0') };
}

function updateProjectDisplay() {
  if (!state.project) return;
  els.projectName.textContent = documentMetadata().projectName;
}

function effectiveName(source) {
  const custom = (state.customNames.get(source.id) || '').trim();
  return custom || source.name;
}

function normalizeNote(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX_LENGTH);
}

function noteFor(source) {
  return normalizeNote(state.notes.get(source.id) || '');
}

function hangColorKey(source) {
  return state.hangColors.get(source.id) || 'none';
}

function hangColorHex(source) {
  const key = hangColorKey(source);
  if (key === 'custom') return state.customHangColors.get(source.id) || '#2f80ed';
  return HANG_COLOR_PRESETS[key] || null;
}

function badgeFor(source) {
  return (state.badges.get(source.id) || '').trim().toUpperCase().slice(0, 4);
}

function contrastTextHex(hex) {
  const m = String(hex || '').match(/^#([0-9a-f]{6})$/i);
  if (!m) return '#ffffff';
  const v = m[1];
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.62 ? '#111417' : '#ffffff';
}

function orderedSelectedSources() {
  if (!state.project) return [];
  const byId = new Map(state.project.sources.map((source) => [source.id, source]));
  return state.order.filter((id) => state.selectedIds.has(id)).map((id) => byId.get(id)).filter(Boolean);
}

function normalizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function validateNames() {
  const groups = new Map();
  for (const source of orderedSelectedSources()) {
    const key = normalizeName(effectiveName(source));
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(source.id);
  }
  state.duplicateIds = new Set();
  for (const ids of groups.values()) if (ids.length > 1) ids.forEach((id) => state.duplicateIds.add(id));

  for (const row of els.sourceList.querySelectorAll('.source-row')) {
    const duplicate = state.duplicateIds.has(row.dataset.id);
    row.classList.toggle('has-name-error', duplicate);
    row.querySelector('.export-name-input')?.classList.toggle('invalid', duplicate);
    const error = row.querySelector('.name-error');
    if (error) error.textContent = duplicate ? 'Duplicate export name' : '';
  }
}

function selectedCriticalSources() {
  return orderedSelectedSources().filter((source) =>
    !source.boxes?.length || source.validation.issues.some((issue) => /inconsistent Panflex module counts/i.test(issue))
  );
}

function updateFieldStateNotice() {
  if (!els.fieldStateNotice) return;
  const fields = selectedFields();
  const selected = orderedSelectedSources();
  const notes = [];
  if (!fields.angles && selected.some((source) => source.hasAngleColumn)) notes.push('Angles are disabled for this export.');
  if (!fields.panflex && selected.some((source) => source.hasPanflexColumn)) notes.push('Panflex is disabled for this export.');
  els.fieldStateNotice.textContent = notes.join(' ');
  els.fieldStateNotice.hidden = notes.length === 0;
}

function updateExportState() {
  validateNames();
  updateFieldStateNotice();
  const count = state.selectedIds.size;
  const critical = selectedCriticalSources();
  const blocked = count === 0 || state.duplicateIds.size > 0 || critical.length > 0;
  els.exportBtn.disabled = blocked;
  els.exportNotice.classList.remove('warn');

  if (state.duplicateIds.size) {
    els.exportNotice.textContent = 'Rename duplicate selected hangs before exporting.';
  } else if (critical.length) {
    els.exportNotice.textContent = `${critical.length} selected source${critical.length === 1 ? '' : 's'} has a parser issue that prevents a reliable enclosure table.`;
  } else {
    const parserChecks = orderedSelectedSources().filter((source) => !source.validation.ok).length;
    const mechanical = orderedSelectedSources().filter((source) => source.mechanicalWarnings?.length).length;
    if (parserChecks) {
      els.exportNotice.textContent = `${parserChecks} selected source${parserChecks === 1 ? '' : 's'} has a parser check. Review the extracted values before export.`;
      els.exportNotice.classList.add('warn');
    } else if (mechanical) {
      els.exportNotice.textContent = `${mechanical} selected source${mechanical === 1 ? '' : 's'} includes a Soundvision mechanical notice.`;
      els.exportNotice.classList.add('warn');
    } else {
      els.exportNotice.textContent = '';
    }
  }
}

function sourceStats(source) {
  const boxes = source.boxes?.length ?? 0;
  return `${boxes} box${boxes === 1 ? '' : 'es'}`;
}

function mechanicalWarningSeverityClass(severity) {
  const value = String(severity || '').toLowerCase();
  if (value === 'danger') return 'danger';
  if (value === 'caution') return 'caution';
  return 'warning';
}

function hasMechanicalDanger(source) {
  return (source.mechanicalWarnings || []).some((warning) => String(warning.severity || '').toUpperCase() === 'DANGER');
}

function mechanicalWarningsHtml(source) {
  const warnings = source.mechanicalWarnings || [];
  if (!warnings.length) return '';
  return warnings.map((warning) => {
    const severity = String(warning.severity || 'WARNING').toUpperCase();
    const messages = (warning.messages || []).map((message) => `<div>${escapeHtml(message)}</div>`).join('');
    return `<div class="mechanical-warning-item ${mechanicalWarningSeverityClass(severity)}"><div class="mechanical-warning-severity">${escapeHtml(severity)}</div><div class="mechanical-warning-messages">${messages}</div></div>`;
  }).join('');
}

const HANG_COLOR_CHOICES = [
  ['none', 'None'], ['black', 'Black'], ['brown', 'Brown'], ['red', 'Red'], ['orange', 'Orange'], ['yellow', 'Yellow'],
  ['green', 'Green'], ['blue', 'Blue'], ['violet', 'Violet'], ['grey', 'Grey'], ['white', 'White'], ['custom', 'Custom'],
];

function colorSwatchHtml(key, customHex = '#2f80ed') {
  if (key === 'none') return '<span class="hang-color-swatch no-swatch" aria-hidden="true"></span>';
  if (key === 'custom') return '<span class="hang-color-swatch custom-swatch" aria-hidden="true">🎨</span>';
  const hex = key === 'custom' ? customHex : HANG_COLOR_PRESETS[key];
  const whiteClass = key === 'white' ? ' white-swatch' : '';
  return `<span class="hang-color-swatch${whiteClass}" style="--swatch:${escapeHtml(hex || customHex)}" aria-hidden="true"></span>`;
}

function colorPickerHtml(selected, customHex = '#2f80ed') {
  const selectedLabel = HANG_COLOR_CHOICES.find(([key]) => key === selected)?.[1] || 'None';
  const options = HANG_COLOR_CHOICES.map(([key, label]) => `
    <button type="button" class="hang-color-option${selected === key ? ' selected' : ''}" data-color-key="${key}" role="option" aria-selected="${selected === key}">${colorSwatchHtml(key, customHex)}<span>${label}</span></button>`).join('');
  const summarySwatch = selected === 'custom'
    ? `<span class="hang-color-swatch" style="--swatch:${escapeHtml(customHex)}" aria-hidden="true"></span>`
    : colorSwatchHtml(selected, customHex);
  return `<details class="hang-color-picker"><summary class="mini-input hang-color-summary"><span class="hang-color-current">${summarySwatch}<span>${selectedLabel}</span></span><span class="hang-color-chevron" aria-hidden="true">⌄</span></summary><div class="hang-color-menu" role="listbox">${options}</div></details>`;
}

function renderSourceList() {
  els.sourceList.innerHTML = '';
  if (!state.project) return;
  // Preserve Soundvision source order exactly. Group labels are presentation only;
  // they never re-sort or infer product categories.
  const showGroupHeaders = state.project.sources.some((source) => source.group && source.group !== 'Ungrouped');
  let lastGroup = null;

  for (const source of state.project.sources) {
    const group = source.group || 'Ungrouped';
    if (showGroupHeaders && group !== lastGroup) {
      const label = document.createElement('div');
      label.className = 'group-label';
      label.textContent = group;
      els.sourceList.appendChild(label);
      lastGroup = group;
    }

      const row = document.createElement('div');
      row.className = 'source-row';
      row.dataset.id = source.id;
      const incomplete = !source.boxes?.length;
      const issueTag = !source.validation.ok
        ? `<span class="tag warn">${incomplete ? 'INCOMPLETE' : 'CHECK'}</span>`
        : '';
      const danger = hasMechanicalDanger(source);
      const reportTag = source.mechanicalWarnings?.length ? `<button type="button" class="tag mechanical-tag${danger ? ' danger' : ''}" aria-expanded="false">${danger ? 'DANGER' : 'MECHANICAL'}</button>` : '';
      const colorKey = hangColorKey(source);
      const colorHex = hangColorHex(source) || '#2f80ed';
      const badgeHidden = colorKey === 'none';
      const customHidden = colorKey !== 'custom';

      row.innerHTML = `
        <input class="source-check" type="checkbox" aria-label="Include ${escapeHtml(source.name)}" />
        <div class="source-body">
          <button type="button" class="inspect">
            <div class="source-name-line"><span class="source-color-dot" ${colorKey === 'none' ? 'hidden' : ''} style="--dot-color:${escapeHtml(colorHex)}"></span><span class="source-name">${escapeHtml(source.name)}</span></div>
            <div class="source-summary">${escapeHtml(source.summary)} · ${escapeHtml(sourceStats(source))}</div>
            <div class="source-original" ${state.customNames.get(source.id)?.trim() ? '' : 'hidden'}>Soundvision: ${escapeHtml(source.name)}</div>
          </button>
          <div class="source-edit-grid">
            <label class="mini-field export-name-field"><span><span class="mini-label-copy"><strong>Export name</strong> <em>optional</em></span><small class="char-counter export-name-counter">${(state.customNames.get(source.id) || '').length}/${EXPORT_NAME_MAX_LENGTH}</small></span><input class="mini-input export-name-input" type="text" maxlength="${EXPORT_NAME_MAX_LENGTH}" value="${escapeHtml(state.customNames.get(source.id) || '')}" aria-label="Export name for ${escapeHtml(source.name)}" /></label>
            <label class="mini-field note-field"><span><span class="mini-label-copy"><strong>Note</strong> <em>optional</em></span><small class="char-counter note-counter">${noteFor(source).length}/${NOTE_MAX_LENGTH}</small></span><input class="mini-input note-input" type="text" maxlength="${NOTE_MAX_LENGTH}" autocomplete="off" value="${escapeHtml(state.notes.get(source.id) || '')}" aria-label="Note for ${escapeHtml(source.name)}" /></label>
            <div class="mini-field"><span>Hang colour <em>optional</em></span>${colorPickerHtml(colorKey, colorHex)}</div>
            <label class="mini-field custom-color-field" ${customHidden ? 'hidden' : ''}><span>Custom colour</span><input class="mini-input custom-color-input" type="color" value="${escapeHtml(colorHex)}" aria-label="Custom hang colour for ${escapeHtml(source.name)}" /></label>
            <label class="mini-field badge-field" ${badgeHidden ? 'hidden' : ''}><span>Badge <em>optional</em></span><input class="mini-input badge-input" type="text" maxlength="4" placeholder="SL" value="${escapeHtml(badgeFor(source))}" aria-label="Badge for ${escapeHtml(source.name)}" /></label>
          </div>
          <div class="mechanical-warning-panel" hidden>${mechanicalWarningsHtml(source)}</div>
          <div class="name-error" aria-live="polite"></div>
        </div>
        <div class="source-tags">${issueTag}${reportTag}</div>`;

      row.querySelector('.mechanical-tag')?.addEventListener('click', (event) => {
        event.stopPropagation();
        const panel = row.querySelector('.mechanical-warning-panel');
        if (!panel) return;
        const expanded = event.currentTarget.getAttribute('aria-expanded') === 'true';
        event.currentTarget.setAttribute('aria-expanded', String(!expanded));
        panel.hidden = expanded;
      });

      row.querySelector('.source-check').addEventListener('change', (event) => {
        if (event.target.checked) {
          state.selectedIds.add(source.id);
          state.inspectedId = source.id;
        } else {
          state.selectedIds.delete(source.id);
        }
        updateSelectionUI();
      });
      row.querySelector('.inspect').addEventListener('click', () => {
        if (!state.selectedIds.has(source.id)) return;
        state.inspectedId = source.id;
        state.previewMode = 'detailed';
        if (els.previewModeSelect) els.previewModeSelect.value = 'detailed';
        syncPreviewSelector();
        renderCurrentPreview();
      });
      row.querySelector('.export-name-input').addEventListener('input', (event) => {
        state.customNames.set(source.id, event.target.value);
        const counter = row.querySelector('.export-name-counter');
        if (counter) counter.textContent = `${event.target.value.length}/${EXPORT_NAME_MAX_LENGTH}`;
        const original = row.querySelector('.source-original');
        if (original) original.hidden = !event.target.value.trim();
        validateNames();
        renderOrderList();
        syncPreviewSelector();
        updateExportState();
        if (state.previewMode === 'overview' || state.inspectedId === source.id) renderCurrentPreview();
      });
      row.querySelector('.note-input').addEventListener('input', (event) => {
        const normalized = normalizeNote(event.currentTarget.value);
        if (event.currentTarget.value !== normalized) event.currentTarget.value = normalized;
        state.notes.set(source.id, normalized);
        const counter = row.querySelector('.note-counter');
        if (counter) {
          counter.textContent = `${normalized.length}/${NOTE_MAX_LENGTH}`;
          counter.classList.toggle('near-limit', normalized.length >= NOTE_MAX_LENGTH - 10);
        }
        if (state.previewMode === 'overview' || state.inspectedId === source.id) renderCurrentPreview();
      });
      row.querySelectorAll('.hang-color-option').forEach((option) => option.addEventListener('click', (event) => {
        const key = event.currentTarget.dataset.colorKey || 'none';
        state.hangColors.set(source.id, key);
        renderSourceList();
        if (state.previewMode === 'overview' || state.inspectedId === source.id) renderCurrentPreview();
      }));
      row.querySelector('.custom-color-input')?.addEventListener('input', (event) => {
        state.customHangColors.set(source.id, event.target.value);
        row.querySelector('.source-color-dot')?.style.setProperty('--dot-color', event.target.value);
        renderOrderList();
        if (state.previewMode === 'overview' || state.inspectedId === source.id) renderCurrentPreview();
      });
      row.querySelector('.badge-input')?.addEventListener('input', (event) => {
        const value = event.target.value.toUpperCase().replace(/\s+/g, '').slice(0, 4);
        event.target.value = value;
        state.badges.set(source.id, value);
        if (state.previewMode === 'overview' || state.inspectedId === source.id) renderCurrentPreview();
      });
      els.sourceList.appendChild(row);
  }
  updateSelectionUI();
}

function renderOrderList() {
  els.orderList.innerHTML = '';
  const sources = orderedSelectedSources();
  if (!sources.length) {
    els.orderList.innerHTML = '<div class="order-empty">No hangs selected</div>';
    return;
  }
  sources.forEach((source, index) => {
    const row = document.createElement('div');
    row.className = `order-row${Math.floor(index / 4) % 2 === 1 ? ' overview-page-alt' : ''}`;
    const color = hangColorHex(source);
    row.innerHTML = `
      <span class="order-num">${String(index + 1).padStart(2, '0')}</span>
      <span class="order-color${color ? '' : ' no-color'}" style="--order-color:${escapeHtml(color || '#000000')}"></span>
      <span class="order-name" title="${escapeHtml(effectiveName(source))}">${escapeHtml(effectiveName(source))}</span>
      <span class="order-buttons">
        <button type="button" class="icon-button up" aria-label="Move ${escapeHtml(effectiveName(source))} up" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="icon-button down" aria-label="Move ${escapeHtml(effectiveName(source))} down" ${index === sources.length - 1 ? 'disabled' : ''}>↓</button>
      </span>`;
    row.querySelector('.up').addEventListener('click', () => moveSelectedSource(source.id, -1));
    row.querySelector('.down').addEventListener('click', () => moveSelectedSource(source.id, 1));
    els.orderList.appendChild(row);
  });
}

function moveSelectedSource(id, direction) {
  const selected = state.order.filter((sourceId) => state.selectedIds.has(sourceId));
  const index = selected.indexOf(id);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= selected.length) return;
  const targetId = selected[targetIndex];
  const sourcePos = state.order.indexOf(id);
  const targetPos = state.order.indexOf(targetId);
  [state.order[sourcePos], state.order[targetPos]] = [state.order[targetPos], state.order[sourcePos]];
  renderOrderList();
  syncPreviewSelector();
}

function syncPreviewSelector() {
  const selected = orderedSelectedSources();
  const mode = els.previewModeSelect?.value || state.previewMode || 'detailed';
  state.previewMode = mode;
  els.previewSourceSelect.innerHTML = '';
  if (els.previewTargetCaption) els.previewTargetCaption.textContent = mode === 'overview' ? 'Overview page' : 'Preview hang';

  if (!selected.length) {
    const option = document.createElement('option');
    option.textContent = 'No selected hangs';
    option.value = '';
    els.previewSourceSelect.appendChild(option);
    els.previewSourceSelect.disabled = true;
    return;
  }

  els.previewSourceSelect.disabled = false;
  if (mode === 'overview') {
    const pages = Math.ceil(selected.length / 4);
    state.previewPage = Math.max(0, Math.min(state.previewPage, pages - 1));
    for (let index = 0; index < pages; index += 1) {
      const pageSources = selected.slice(index * 4, (index + 1) * 4);
      const option = document.createElement('option');
      option.value = `overview:${index}`;
      option.textContent = `Overview ${index + 1}/${pages} — ${pageSources.map((source) => effectiveName(source)).join(' · ')}`;
      option.selected = index === state.previewPage;
      els.previewSourceSelect.appendChild(option);
    }
    return;
  }

  if (!selected.some((s) => s.id === state.inspectedId)) state.inspectedId = selected[0].id;
  for (const source of selected) {
    const option = document.createElement('option');
    option.value = source.id;
    option.textContent = effectiveName(source) + (effectiveName(source) !== source.name ? ` — ${source.name}` : '');
    option.selected = source.id === state.inspectedId;
    els.previewSourceSelect.appendChild(option);
  }
}

function updateSelectionUI() {
  const count = state.selectedIds.size;
  els.selectedCount.textContent = `${count} selected`;
  for (const row of els.sourceList.querySelectorAll('.source-row')) {
    const id = row.dataset.id;
    const checkbox = row.querySelector('.source-check');
    const selected = state.selectedIds.has(id);
    checkbox.checked = selected;
    row.classList.toggle('is-selected', selected);
  }
  renderOrderList();
  syncPreviewSelector();
  updateExportState();
  renderCurrentPreview();
}

function uniqueTypes(source) {
  return [...new Set((source.boxes || []).map((b) => b.type).filter(Boolean))];
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

function previewMetaSlots(source, fields) {
  const slots = Array.from({ length: 8 }, () => null);
  if (fields.bumper && source.bumper) slots[0] = ['Rigging', source.bumper];
  const pickups = pickupInfo(source);
  if (fields.pickups && pickups) slots[1] = [pickups.label, pickups.value];
  if (fields.site && source.site != null) slots[2] = ['Site', `${source.site}°`];
  if (fields.azimuth && source.azimuth != null) slots[3] = ['Azimuth', `${source.azimuth}°`];
  if (fields.bottomElevation && source.bottomElevation) slots[4] = ['Bottom elevation', source.bottomElevation];
  const motors = motorInfo(source);
  if (fields.motorLoads && motors) slots[5] = [motors.label, motors.value];
  if (fields.weight && source.totalWeight) slots[6] = ['Weight', source.totalWeight];
  return slots;
}

function formatGeneratedDate() {
  try {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date());
  } catch (_) {
    return new Date().toLocaleDateString();
  }
}

function previewStyleClass() {
  const style = pdfStyle();
  return style === 'technical-cyan' ? '' : ` style-${style}`;
}

function maxPanflexModules(source) {
  return source.panflexProfile?.maxModules ?? Math.max(0, ...(source.boxes || []).map((b) => b.panflexModules?.length ?? (b.panflex ? 1 : 0)));
}

function previewTableSchema(source, fields) {
  const types = uniqueTypes(source);
  return {
    showType: types.length > 1,
    showAngle: Boolean(fields.angles && source.hasAngleColumn),
    panflexCount: fields.panflex ? maxPanflexModules(source) : 0,
  };
}

function previewHeaderCells(schema) {
  const cells = ['<th>Box</th>'];
  if (schema.showType) cells.push('<th>Type</th>');
  if (schema.showAngle) cells.push('<th>Angle</th>');
  if (schema.panflexCount === 1) cells.push('<th>Panflex</th>');
  else for (let i = 0; i < schema.panflexCount; i += 1) cells.push(`<th>PF${i + 1}</th>`);
  return cells.join('');
}

function previewRows(boxes, schema, sourceOffset = 0) {
  return boxes.map((box, index) => {
    const shaded = Math.floor((sourceOffset + index) / 4) % 2 === 1;
    const angle = box.angle != null && String(box.angle).trim() !== '' ? `${escapeHtml(box.angle)}°` : '—';
    const pf = [];
    for (let i = 0; i < schema.panflexCount; i += 1) pf.push(`<td class="panflex">${escapeHtml(box.panflexModules?.[i] ?? '—')}</td>`);
    return `<tr class="${shaded ? 'dolly-group-alt' : ''}">
      <td>${escapeHtml(String(box.box ?? '').replace('#', ''))}</td>
      ${schema.showType ? `<td>${escapeHtml(box.type ?? '—')}</td>` : ''}
      ${schema.showAngle ? `<td>${angle}</td>` : ''}
      ${pf.join('')}
    </tr>`;
  }).join('');
}

function balancedSplitCount(total) {
  if (total <= 1) return total;
  if (total % 4 === 0) return Math.min(total - 1, Math.ceil(total / 8) * 4);
  return Math.ceil(total / 2);
}

function renderDetailedPreview(source) {
  if (!source) return;
  const exportName = effectiveName(source);
  els.previewTitle.textContent = exportName;
  if (!source.validation.ok) {
    const bits = [...(source.validation.issues || [])];
    els.validationBadge.textContent = `CHECK · ${bits.join(' · ')}`;
    els.validationBadge.className = 'validation warn';
  } else if (hasMechanicalDanger(source)) {
    els.validationBadge.textContent = 'DANGER · Soundvision mechanical warning';
    els.validationBadge.className = 'validation danger';
  } else if (source.mechanicalWarnings?.length) {
    els.validationBadge.textContent = `MECHANICAL · ${source.mechanicalWarnings.length} notice${source.mechanicalWarnings.length === 1 ? '' : 's'}`;
    els.validationBadge.className = 'validation warn';
  } else {
    els.validationBadge.textContent = '';
    els.validationBadge.className = 'validation';
  }

  const fields = selectedFields();
  const schema = previewTableSchema(source, fields);
  const preparedBy = els.preparedByInput.value.trim();
  const themeClass = pdfAppearance() === 'dark' ? ' dark' : '';
  const styleClass = previewStyleClass();
  const metaSlots = previewMetaSlots(source, fields);
  const headerCells = previewHeaderCells(schema);
  const columnCount = 1 + (schema.showType ? 1 : 0) + (schema.showAngle ? 1 : 0) + schema.panflexCount;
  const compactSchema = columnCount <= 4 && schema.panflexCount <= 1;
  const useTwoTables = source.boxes.length > 12 && compactSchema;

  let tableHtml = '';
  if (source.boxes.length) {
    if (useTwoTables) {
      const split = balancedSplitCount(source.boxes.length);
      tableHtml = `<div class="sheet-table-pair">
        <table class="sheet-table"><thead><tr>${headerCells}</tr></thead><tbody>${previewRows(source.boxes.slice(0, split), schema, 0)}</tbody></table>
        <table class="sheet-table"><thead><tr>${headerCells}</tr></thead><tbody>${previewRows(source.boxes.slice(split), schema, split)}</tbody></table>
      </div>`;
    } else {
      tableHtml = `<table class="sheet-table"><thead><tr>${headerCells}</tr></thead><tbody>${previewRows(source.boxes, schema, 0)}</tbody></table>`;
    }
  }

  const logo = state.logoUrl ? `<img src="${escapeHtml(state.logoUrl)}" alt="Uploaded company logo" />` : '';
  const prepared = preparedBy ? `<div class="sheet-prepared">Prepared by: ${escapeHtml(preparedBy)}</div>` : '';
  const generated = `<div class="sheet-generated">Generated ${escapeHtml(formatGeneratedDate())}</div>`;
  const note = noteFor(source) ? `<div class="sheet-note">${escapeHtml(noteFor(source))}</div>` : '';
  const warnings = fields.warnings && source.mechanicalWarnings?.length
    ? `<div class="sheet-warning-list">${source.mechanicalWarnings.map((warning) => `<div class="sheet-warning ${mechanicalWarningSeverityClass(warning.severity)}"><strong>${escapeHtml(String(warning.severity || 'WARNING').toUpperCase())}</strong>${(warning.messages || []).map((message) => `<div>${escapeHtml(message)}</div>`).join('')}</div>`).join('')}</div>`
    : '';
  const pageColor = hangColorHex(source);
  const badgeText = badgeFor(source);
  const badge = pageColor ? `<span class="sheet-hang-badge${badgeText ? '' : ' blank'}" style="--hang-color:${escapeHtml(pageColor)};color:${contrastTextHex(pageColor)}">${escapeHtml(badgeText)}</span>` : '';
  const colorClass = pageColor ? ' has-hang-color' : '';
  const styleAttr = pageColor ? ` style="--hang-color:${escapeHtml(pageColor)}"` : '';
  const header = detailedHeaderFields();
  const dangerBadge = hasMechanicalDanger(source) ? '<span class="sheet-danger-badge">DANGER — CHECK SOUNDVISION</span>' : '';

  els.previewContent.className = '';
  els.previewContent.innerHTML = `
    <div class="sheet-preview${themeClass}${styleClass}${colorClass}"${styleAttr}>
      <div class="sheet-edge-marker"></div>
      <div class="sheet-head">
        <div class="sheet-header-copy">
          <div class="sheet-project">
            <div class="sheet-project-show">${escapeHtml(header.show)}</div>
            <div class="sheet-project-line2"><span class="sheet-project-city">${escapeHtml(header.city)}</span>${header.revision ? `<span class="sheet-project-revision">${escapeHtml(header.revision)}</span>` : ''}</div>
            ${header.project ? `<div class="sheet-project-name">${escapeHtml(header.project)}</div>` : '<div class="sheet-project-name empty"></div>'}
          </div>
          <div class="sheet-title-row">${badge}<div class="sheet-title">${escapeHtml(exportName)}</div></div>
          <div class="sheet-summary-row"><div class="sheet-summary">${escapeHtml(source.summary)}</div>${dangerBadge}</div>
        </div>
        <div class="sheet-brand">${logo}${prepared}${generated}</div>
      </div>
      <div class="sheet-accent-line"></div>
      <div class="sheet-meta fixed-grid">
        ${metaSlots.map((slot) => slot ? `<div class="sheet-meta-item"><div class="label">${escapeHtml(slot[0])}</div><div class="value">${escapeHtml(slot[1])}</div></div>` : '<div class="sheet-meta-item empty" aria-hidden="true"></div>').join('')}
      </div>
      ${tableHtml}
      ${note}${warnings}
      <div class="sheet-safety">Verify all data against the original Soundvision report/project before deployment.</div>
    </div>`;
}

function overviewPreviewMetaMap(source, fields) {
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

function overviewPreviewRows(pageSources, fields) {
  const maps = pageSources.map((source) => overviewPreviewMetaMap(source, fields));
  const defs = [
    ['rigging', 'Rigging'],
    ['pickups', 'Pickup holes / points'],
    ['site', 'Site'],
    ['azimuth', 'Azimuth'],
    ['bottom', 'Bottom elevation'],
    ['motors', 'Motor loads'],
    ['weight', 'Weight'],
  ];
  return defs.filter(([key]) => maps.some((map) => map[key] != null && String(map[key]).trim() !== ''))
    .map(([key, label]) => ({ key, label, maps }));
}

function previewTableGridTemplate(schema) {
  const parts = ['.58fr'];
  if (schema.showType) parts.push('1.25fr');
  if (schema.showAngle) parts.push('.9fr');
  for (let i = 0; i < schema.panflexCount; i += 1) parts.push('1fr');
  if (parts.length === 1) parts.push('2fr');
  return parts.join(' ');
}

function previewOverviewTableCells(box, schema) {
  if (!box) return '<span></span>';
  const cells = [`<span>${escapeHtml(String(box.box ?? '').replace('#', ''))}</span>`];
  if (schema.showType) cells.push(`<span>${escapeHtml(box.type ?? '—')}</span>`);
  if (schema.showAngle) cells.push(`<span>${box.angle != null && String(box.angle).trim() !== '' ? `${escapeHtml(box.angle)}°` : '—'}</span>`);
  for (let i = 0; i < schema.panflexCount; i += 1) cells.push(`<span class="panflex">${escapeHtml(box.panflexModules?.[i] ?? '—')}</span>`);
  return cells.join('');
}

function previewOverviewHeaderCells(schema) {
  const cells = ['<span>Box</span>'];
  if (schema.showType) cells.push('<span>Type</span>');
  if (schema.showAngle) cells.push('<span>Angle</span>');
  if (schema.panflexCount === 1) cells.push('<span>Panflex</span>');
  else for (let i = 0; i < schema.panflexCount; i += 1) cells.push(`<span>PF${i + 1}</span>`);
  if (cells.length === 1) cells.push('<span>Type</span>');
  return cells.join('');
}

function renderOverviewPreview() {
  const selected = orderedSelectedSources();
  if (!selected.length) return;
  const pages = Math.ceil(selected.length / 4);
  state.previewPage = Math.max(0, Math.min(state.previewPage, pages - 1));
  const pageSources = selected.slice(state.previewPage * 4, (state.previewPage + 1) * 4);
  const fields = selectedFields();
  const themeClass = pdfAppearance() === 'dark' ? ' dark' : '';
  const styleClass = previewStyleClass();
  const preparedBy = els.preparedByInput.value.trim();
  const logo = state.logoUrl ? `<img src="${escapeHtml(state.logoUrl)}" alt="Uploaded company logo" />` : '';
  const checks = pageSources.filter((source) => !source.validation?.ok).length;
  const dangerCount = pageSources.filter((source) => hasMechanicalDanger(source)).length;
  const mechanical = pageSources.filter((source) => source.mechanicalWarnings?.length).length;

  els.previewTitle.textContent = `Overview · ${state.previewPage + 1}/${pages}`;
  if (checks) {
    els.validationBadge.textContent = `CHECK · ${checks} source${checks === 1 ? '' : 's'}`;
    els.validationBadge.className = 'validation warn';
  } else if (dangerCount) {
    els.validationBadge.textContent = `DANGER · ${dangerCount} source${dangerCount === 1 ? '' : 's'}`;
    els.validationBadge.className = 'validation danger';
  } else if (mechanical) {
    els.validationBadge.textContent = `MECHANICAL · ${mechanical} source${mechanical === 1 ? '' : 's'}`;
    els.validationBadge.className = 'validation warn';
  } else {
    els.validationBadge.textContent = '';
    els.validationBadge.className = 'validation';
  }

  const hangHeaders = pageSources.map((source) => {
    const color = hangColorHex(source);
    const badgeText = badgeFor(source);
    const markerStyle = color ? ` style="--hang-color:${escapeHtml(color)}"` : '';
    const badge = color ? `<span class="overview-hang-badge${badgeText ? '' : ' blank'}" style="--hang-color:${escapeHtml(color)};color:${contrastTextHex(color)}">${escapeHtml(badgeText)}</span>` : '';
    const danger = hasMechanicalDanger(source) ? '<span class="overview-danger-badge">DANGER</span>' : '';
    return `<div class="overview-hang-head${color ? ' has-color' : ''}"${markerStyle}><div class="overview-hang-strip"></div><div class="overview-hang-title-row">${badge}<strong>${escapeHtml(effectiveName(source))}</strong>${danger}</div><small>${escapeHtml(source.summary)}</small></div>`;
  }).join('');

  const metaRows = overviewPreviewRows(pageSources, fields).map(({ key, label, maps }, rowIndex) => `<div class="overview-meta-row${rowIndex % 2 ? ' alt' : ''}" style="--hang-count:${pageSources.length}"><div class="overview-meta-label">${escapeHtml(label)}</div>${pageSources.map((_, index) => `<div class="overview-meta-value${['site','bottom'].includes(key) ? ' emphasis' : ''}">${escapeHtml(maps[index][key] ?? '—')}</div>`).join('')}</div>`).join('');

  const maxRows = Math.max(0, ...pageSources.map((source) => source.boxes?.length || 0));
  const rowHeight = Math.max(18, Math.min(32, 520 / Math.max(1, maxRows)));
  const tableCols = pageSources.map((source) => {
    const schema = previewTableSchema(source, fields);
    const template = previewTableGridTemplate(schema);
    const rows = Array.from({ length: maxRows }, (_, index) => {
      const box = source.boxes?.[index];
      const shaded = Math.floor(index / 4) % 2 === 1;
      return `<div class="overview-box-row${shaded ? ' dolly-group-alt' : ''}${box ? '' : ' empty'}" style="grid-template-columns:${template};--overview-row-height:${rowHeight}px">${box ? previewOverviewTableCells(box, schema) : '<span></span>'}</div>`;
    }).join('');
    return `<div class="overview-table-col"><div class="overview-table-head" style="grid-template-columns:${template}">${previewOverviewHeaderCells(schema)}</div>${rows}</div>`;
  }).join('');

  const overviewHeader = overviewHeaderParts();
  els.previewContent.className = '';
  els.previewContent.innerHTML = `<div class="overview-preview${themeClass}${styleClass}">
    <div class="overview-preview-head"><div><div class="overview-show-title">${escapeHtml(overviewHeader.title)}</div>${overviewHeader.subtitle ? `<div class="overview-project">${escapeHtml(overviewHeader.subtitle)}</div>` : ''}</div><div class="overview-brand">${logo}<div class="overview-brand-copy">${preparedBy ? `<div>Prepared by: ${escapeHtml(preparedBy)}</div>` : ''}<div>Generated ${escapeHtml(formatGeneratedDate())}</div></div></div></div>
    <div class="overview-accent-line"></div>
    <div class="overview-values-wrap"><div class="overview-label-spacer"></div><div class="overview-hang-area"><div class="overview-hang-grid" style="--hang-count:${pageSources.length}">${hangHeaders}</div></div></div>
    <div class="overview-meta-grid">${metaRows}</div>
    <div class="overview-table-area" style="--hang-count:${pageSources.length}"><div class="overview-table-label">Enclosure settings</div>${tableCols}</div>
    <div class="overview-footer"><div class="overview-page-num">${state.previewPage + 1}/${pages}</div><div class="sheet-safety">Verify all data against the original Soundvision report/project before deployment.</div></div>
  </div>`;
}

function renderCurrentPreview() {
  const selected = orderedSelectedSources();
  if (!selected.length) {
    els.previewTitle.textContent = 'Select a hang';
    els.validationBadge.textContent = '';
    els.previewContent.className = 'preview-empty';
    els.previewContent.textContent = 'Choose a source above to inspect the extracted data.';
    return;
  }
  if ((els.previewModeSelect?.value || state.previewMode) === 'overview') renderOverviewPreview();
  else renderDetailedPreview(sourceById(state.inspectedId) || selected[0]);
}

function rerenderPreview() {
  updateProjectDisplay();
  syncPreviewSelector();
  renderCurrentPreview();
}

function clearReportMetadata() {
  els.showInput.value = '';
  els.cityInput.value = '';
  els.projectOverrideInput.value = '';
  els.revisionInput.value = '';
  for (const input of [els.showInput, els.cityInput, els.projectOverrideInput, els.revisionInput]) updateCharCounter(input);
}

function resetFieldDefaults() {
  for (const input of els.fieldOptions.querySelectorAll('input[type="checkbox"]')) input.checked = input.value !== 'warnings';
  updateFieldStateNotice();
}

function resetReport() {
  state.project = null;
  state.sourceFileName = '';
  state.selectedIds.clear();
  state.inspectedId = null;
  state.previewMode = 'detailed';
  state.previewPage = 0;
  state.order = [];
  state.customNames.clear();
  state.notes.clear();
  state.hangColors.clear();
  state.customHangColors.clear();
  state.badges.clear();
  state.duplicateIds.clear();
  els.pdfInput.value = '';
  els.sourceList.innerHTML = '';
  els.orderList.innerHTML = '';
  els.previewSourceSelect.innerHTML = '';
  if (els.previewModeSelect) els.previewModeSelect.value = 'detailed';
  if (els.layoutModeSelect) els.layoutModeSelect.value = 'detailed';
  els.previewContent.className = 'preview-empty';
  els.previewContent.textContent = 'Choose a source above to inspect the extracted data.';
  els.previewTitle.textContent = 'Select a hang';
  els.validationBadge.textContent = '';
  els.workspace.hidden = true;
  els.uploadPanel.hidden = false;
  clearReportMetadata();
  resetFieldDefaults();
  setStatus('');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadReport(file) {
  if (!file) return;
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    setStatus('Please choose a PDF file.', true);
    return;
  }

  try {
    setStatus(`Reading ${file.name}…`);
    els.workspace.hidden = true;
    state.project = null;
    state.sourceFileName = file.name;
    state.selectedIds.clear();
    state.previewMode = 'detailed';
    state.previewPage = 0;
    if (els.previewModeSelect) els.previewModeSelect.value = 'detailed';
    if (els.layoutModeSelect) els.layoutModeSelect.value = 'detailed';
    state.customNames.clear();
    state.notes.clear();
    state.hangColors.clear();
    state.customHangColors.clear();
    state.badges.clear();
    resetFieldDefaults();
    const { pages, pageCount } = await readPdf(file);
    setStatus(`Parsing ${pageCount} pages…`);
    const project = parseSoundvisionReport(pages);
    state.project = project;

    if (!project.sources.length) throw new Error('No Soundvision sources were detected in this report.');

    state.order = project.sources.map((source) => source.id);
    for (const source of project.sources) {
      if (source.isFlown) state.selectedIds.add(source.id);
      state.hangColors.set(source.id, 'none');
    }
    state.inspectedId = project.sources.find((s) => state.selectedIds.has(s.id))?.id ?? project.sources[0].id;

    updateProjectDisplay();
    els.projectMeta.textContent = [
      project.meta.version ? `Soundvision ${project.meta.version}` : null,
      project.meta.date || null,
      `${project.sources.length} sources detected`,
      [project.meta.distanceUnit, project.meta.weightUnit].filter(Boolean).length ? `Units ${[project.meta.distanceUnit, project.meta.weightUnit].filter(Boolean).join(' / ')}` : null,
    ].filter(Boolean).join(' · ');

    renderSourceList();
    syncPreviewSelector();
    renderCurrentPreview();
    els.uploadPanel.hidden = true;
    els.workspace.hidden = false;
    setStatus('');
  } catch (error) {
    console.error(error);
    setStatus(error?.message || 'Could not parse this PDF.', true);
    els.workspace.hidden = true;
    els.uploadPanel.hidden = false;
  }
}

function dataUrlToBytes(dataUrl) {
  const [, base64 = ''] = String(dataUrl).split(',');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Could not read logo.'));
    reader.readAsDataURL(file);
  });
}

function clearLogoUi() {
  state.logo = null;
  state.logoUrl = null;
  els.logoInput.value = '';
  els.logoFileName.textContent = 'No logo';
  els.logoPreview.removeAttribute('src');
  els.logoPreview.alt = '';
  els.logoPreviewWrap.hidden = true;
}

function saveBranding() {
  try {
    localStorage.setItem(BRANDING_KEY, JSON.stringify({
      preparedBy: els.preparedByInput.value.trim(),
      logoDataUrl: state.logoUrl || '',
      logoName: state.logo?.name || '',
      logoType: state.logo?.type || '',
    }));
  } catch (error) {
    console.warn('Could not save branding locally:', error);
  }
}

function restoreBranding() {
  clearLogoUi();
  try {
    let raw = localStorage.getItem(BRANDING_KEY);
    if (!raw) {
      for (const key of LEGACY_BRANDING_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.preparedBy) els.preparedByInput.value = String(saved.preparedBy).slice(0, els.preparedByInput.maxLength || 32);
    if (saved.logoDataUrl && /^data:image\/(png|jpeg);base64,/i.test(saved.logoDataUrl)) {
      const type = saved.logoType || (saved.logoDataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg');
      state.logoUrl = saved.logoDataUrl;
      state.logo = { type, bytes: dataUrlToBytes(saved.logoDataUrl), name: saved.logoName || 'Saved logo' };
      els.logoPreview.src = state.logoUrl;
      els.logoPreview.alt = 'Company logo preview';
      els.logoFileName.textContent = state.logo.name;
      els.logoPreviewWrap.hidden = false;
    }
  } catch (error) {
    console.warn('Could not restore branding:', error);
    clearLogoUi();
  }
}

els.pdfInput.addEventListener('change', () => loadReport(els.pdfInput.files?.[0]));
els.dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  els.dropzone.classList.add('dragover');
});
els.dropzone.addEventListener('dragleave', () => els.dropzone.classList.remove('dragover'));
els.dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  els.dropzone.classList.remove('dragover');
  loadReport(event.dataTransfer?.files?.[0]);
});

els.selectFlownBtn.addEventListener('click', () => {
  state.selectedIds = new Set(state.project.sources.filter((s) => s.isFlown).map((s) => s.id));
  updateSelectionUI();
});
els.selectAllBtn.addEventListener('click', () => {
  state.selectedIds = new Set(state.project.sources.map((s) => s.id));
  updateSelectionUI();
});
els.clearBtn.addEventListener('click', () => {
  state.selectedIds.clear();
  updateSelectionUI();
});
els.newReportBtn.addEventListener('click', resetReport);

els.previewModeSelect?.addEventListener('change', () => {
  state.previewMode = els.previewModeSelect.value || 'detailed';
  syncPreviewSelector();
  renderCurrentPreview();
});
els.previewSourceSelect.addEventListener('change', () => {
  if (!els.previewSourceSelect.value) return;
  if ((els.previewModeSelect?.value || state.previewMode) === 'overview') {
    const match = els.previewSourceSelect.value.match(/^overview:(\d+)$/);
    state.previewPage = match ? Number(match[1]) : 0;
  } else {
    state.inspectedId = els.previewSourceSelect.value;
  }
  renderCurrentPreview();
});
els.fieldOptions.addEventListener('change', () => { updateExportState(); rerenderPreview(); });
els.pdfStyleSelect.addEventListener('change', rerenderPreview);
els.layoutModeSelect.addEventListener('change', () => {
  const layout = els.layoutModeSelect.value;
  if (layout === 'overview' || layout === 'detailed') {
    state.previewMode = layout;
    if (els.previewModeSelect) els.previewModeSelect.value = layout;
  }
  rerenderPreview();
});
document.querySelectorAll('input[name="pdfAppearance"]').forEach((input) => input.addEventListener('change', rerenderPreview));

function updateCharCounter(input) {
  if (!input?.id || !input.maxLength || input.maxLength < 0) return;
  const counter = document.querySelector(`.char-counter[data-counter-for="${input.id}"]`);
  if (!counter) return;
  counter.textContent = `${input.value.length}/${input.maxLength}`;
  counter.classList.toggle('near-limit', input.value.length >= Math.max(1, input.maxLength - 5));
}

els.revisionInput.addEventListener('input', () => {
  const cleaned = revisionDigits(els.revisionInput.value);
  if (els.revisionInput.value !== cleaned) els.revisionInput.value = cleaned;
});

for (const input of [els.showInput, els.cityInput, els.projectOverrideInput, els.revisionInput]) {
  updateCharCounter(input);
  input.addEventListener('input', () => { updateCharCounter(input); rerenderPreview(); });
}
updateCharCounter(els.preparedByInput);
els.preparedByInput.addEventListener('input', () => {
  updateCharCounter(els.preparedByInput);
  saveBranding();
  rerenderPreview();
});

els.logoInput.addEventListener('change', async () => {
  const file = els.logoInput.files?.[0];
  if (!file) return;
  if (!['image/png', 'image/jpeg'].includes(file.type)) {
    alert('Use a PNG or JPG logo for this version.');
    els.logoInput.value = '';
    return;
  }
  try {
    const dataUrl = await fileToDataUrl(file);
    state.logo = { type: file.type, bytes: new Uint8Array(await file.arrayBuffer()), name: file.name };
    state.logoUrl = dataUrl;
    els.logoPreview.src = dataUrl;
    els.logoPreview.alt = 'Company logo preview';
    els.logoFileName.textContent = file.name;
    els.logoPreviewWrap.hidden = false;
    saveBranding();
    rerenderPreview();
  } catch (error) {
    console.error(error);
    clearLogoUi();
    alert('Could not read that logo file.');
  }
});
els.removeLogoBtn.addEventListener('click', () => {
  clearLogoUi();
  saveBranding();
  rerenderPreview();
});

els.exportBtn.addEventListener('click', async () => {
  if (!state.project || !state.selectedIds.size) return;
  updateExportState();
  if (els.exportBtn.disabled) return;
  if (!window.PDFLib) {
    alert('The PDF export library did not load. Check your internet connection and reload the page.');
    return;
  }
  const sources = orderedSelectedSources().map((source) => ({
    ...source,
    exportName: effectiveName(source),
    exportNote: noteFor(source),
    hangColor: hangColorHex(source),
    badge: badgeFor(source),
  }));
  const oldText = els.exportBtn.textContent;
  els.exportBtn.disabled = true;
  els.exportBtn.textContent = 'Generating…';
  try {
    await exportFlySheet({
      project: state.project,
      sources,
      fields: selectedFields(),
      logo: state.logo,
      preparedBy: els.preparedByInput.value.trim(),
      appearance: pdfAppearance(),
      style: pdfStyle(),
      metadata: documentMetadata(),
      layoutMode: els.layoutModeSelect.value || 'detailed',
    });
  } catch (error) {
    console.error(error);
    alert(error?.message || 'Could not generate the PDF.');
  } finally {
    els.exportBtn.textContent = oldText;
    updateExportState();
  }
});

if (els.buildVersion) els.buildVersion.textContent = `v${BUILD_VERSION}`;
for (const link of [els.supportLink, els.supportCardLink].filter(Boolean)) {
  if (DONATION_URL) {
    link.href = DONATION_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  } else {
    link.href = '#';
    link.title = 'Donation URL not configured in this test build';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      alert('Donation link placement is ready. Add the final donation URL before public release.');
    });
  }
}

restoreBranding();
updateCharCounter(els.preparedByInput);
for (const input of [els.showInput, els.cityInput, els.projectOverrideInput, els.revisionInput]) updateCharCounter(input);
renderOrderList();
syncPreviewSelector();
