// ═══════════════════════════════════════════════════════════════
// UI — Autocomplete & Tag/Requiere chips
// ═══════════════════════════════════════════════════════════════

import { getDB } from '../core/db.js';

// ── In-memory chip state ──────────────────────────────────────
export let _addTags     = [];
export let _addRequiere = [];

// ── Known values from DB ──────────────────────────────────────
export function getKnownDomains() {
  return [...new Set(getDB().conceptos.map(c => c.dominio).filter(Boolean))].sort();
}

export function getKnownTags() {
  return [...new Set(getDB().conceptos.flatMap(c => c.tags || []).filter(Boolean))].sort();
}

// ── Dominio autocomplete ──────────────────────────────────────
export function acDominio(inp) {
  const q       = inp.value.toLowerCase().trim();
  const known   = getKnownDomains();
  const matches = q ? known.filter(d => d.toLowerCase().includes(q)) : known;
  const dd      = document.getElementById('ac-dominio');
  if (!matches.length) { dd.classList.remove('open'); return; }
  dd.innerHTML = matches.map(d =>
    `<div class="ac-item" onmousedown="pickDominio('${d}')">${d}</div>`
  ).join('');
  dd.classList.add('open');
}

export function pickDominio(val) {
  document.getElementById('add-dominio').value = val;
  document.getElementById('ac-dominio').classList.remove('open');
}

// ── Tags autocomplete & chips ─────────────────────────────────
export function acTag(inp) {
  const raw      = inp.value;
  const parts    = raw.split(',');
  const q        = parts[parts.length - 1].trim().toLowerCase();
  const known    = getKnownTags();
  const existing = _addTags.map(t => t.toLowerCase());
  const matches  = (q ? known.filter(t => t.toLowerCase().includes(q)) : known)
    .filter(t => !existing.includes(t.toLowerCase()));
  const dd = document.getElementById('ac-tags');
  if (!matches.length) { dd.classList.remove('open'); return; }
  dd.innerHTML = matches.map(t =>
    `<div class="ac-item" onmousedown="pickTag('${t}')">${t}</div>`
  ).join('');
  dd.classList.add('open');
}

export function pickTag(val) {
  addTagChip(val);
  document.getElementById('add-tags-input').value = '';
  document.getElementById('ac-tags').classList.remove('open');
}

export function tagKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.replace(/,/g, '').trim();
    if (val) { addTagChip(val); e.target.value = ''; }
    document.getElementById('ac-tags').classList.remove('open');
  } else if (e.key === 'Backspace' && !e.target.value) {
    _addTags.pop();
    renderTagChips();
  }
}

export function addTagChip(val) {
  val = val.trim();
  if (!val || _addTags.includes(val)) return;
  _addTags.push(val);
  renderTagChips();
  syncHiddenTags();
}

export function removeTagChip(idx) {
  _addTags.splice(idx, 1);
  renderTagChips();
  syncHiddenTags();
}

export function renderTagChips() {
  document.getElementById('tags-chips').innerHTML = _addTags.map((t, i) =>
    `<span class="tag-chip">${t}<span class="tag-chip-remove" onclick="removeTagChip(${i})">×</span></span>`
  ).join('');
}

function syncHiddenTags() {
  document.getElementById('add-tags').value = _addTags.join(',');
}

// ── Requiere autocomplete & chips ─────────────────────────────
export function acRequiere(inp) {
  const q          = inp.value.trim().toLowerCase();
  const db         = getDB();
  const existingIds = _addRequiere.map(r => r.id);
  const matches    = db.conceptos
    .filter(c => !existingIds.includes(c.id) &&
      (c.nombre.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)))
    .slice(0, 8);
  const dd = document.getElementById('ac-requiere');
  if ((!q && !matches.length) || (!matches.length && q)) { dd.classList.remove('open'); return; }
  dd.innerHTML = matches.map(c =>
    `<div class="ac-item" onmousedown="pickRequiere('${c.id}','${c.nombre.replace(/'/g, "\\'")}')">
      ${c.nombre}<span class="ac-item-tag">${c.id}</span>
    </div>`
  ).join('');
  dd.classList.add('open');
}

export function pickRequiere(id, nombre) {
  addRequiereChip(id, nombre);
  document.getElementById('add-requiere-input').value = '';
  document.getElementById('ac-requiere').classList.remove('open');
}

export function requiereKeydown(e) {
  if (e.key === 'Backspace' && !e.target.value) {
    _addRequiere.pop();
    renderRequiereChips();
    syncHiddenRequiere();
  }
}

export function addRequiereChip(id, nombre) {
  if (_addRequiere.find(r => r.id === id)) return;
  _addRequiere.push({ id, nombre });
  renderRequiereChips();
  syncHiddenRequiere();
}

export function removeRequiereChip(idx) {
  _addRequiere.splice(idx, 1);
  renderRequiereChips();
  syncHiddenRequiere();
}

export function renderRequiereChips() {
  document.getElementById('requiere-chips').innerHTML = _addRequiere.map((r, i) =>
    `<span class="tag-chip" style="background:rgba(74,222,128,0.1);color:var(--green);border-color:rgba(74,222,128,0.2);">
      ${r.nombre}
      <span class="ac-item-tag" style="color:var(--text3);margin-left:4px;">${r.id}</span>
      <span class="tag-chip-remove" onclick="removeRequiereChip(${i})">×</span>
    </span>`
  ).join('');
}

function syncHiddenRequiere() {
  document.getElementById('add-requiere').value = _addRequiere.map(r => r.id).join(',');
}

// ── Blur handler ──────────────────────────────────────────────
export function acBlur(ddId) {
  setTimeout(() => {
    const dd = document.getElementById(ddId);
    if (dd) dd.classList.remove('open');
  }, 150);
}

// ── Reset / load state ────────────────────────────────────────
export function resetChipState() {
  _addTags.length     = 0;
  _addRequiere.length = 0;
  renderTagChips();
  renderRequiereChips();
  syncHiddenTags();
  syncHiddenRequiere();
  const ti = document.getElementById('add-tags-input');
  const ri = document.getElementById('add-requiere-input');
  if (ti) ti.value = '';
  if (ri) ri.value = '';
}

export function loadChipsFromConcept(c) {
  _addTags.length     = 0;
  _addRequiere.length = 0;
  _addTags.push(...(c.tags || []));

  const db = getDB();
  (c.requiere || []).forEach(id => {
    const ref = db.conceptos.find(x => x.id === id);
    _addRequiere.push({ id, nombre: ref ? ref.nombre : id });
  });

  renderTagChips();
  renderRequiereChips();
  syncHiddenTags();
  syncHiddenRequiere();

  const ti = document.getElementById('add-tags-input');
  const ri = document.getElementById('add-requiere-input');
  if (ti) ti.value = '';
  if (ri) ri.value = '';
}

// ── Expose globally for inline HTML onclick handlers ──────────
window.pickDominio       = pickDominio;
window.pickTag           = pickTag;
window.pickRequiere      = pickRequiere;
window.acDominio         = acDominio;
window.acTag             = acTag;
window.acRequiere        = acRequiere;
window.acBlur            = acBlur;
window.tagKeydown        = tagKeydown;
window.requiereKeydown   = requiereKeydown;
window.removeTagChip     = removeTagChip;
window.removeRequiereChip = removeRequiereChip;
