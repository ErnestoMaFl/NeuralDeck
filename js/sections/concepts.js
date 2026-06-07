// ═══════════════════════════════════════════════════════════════
// SECTION — Concepts
// ═══════════════════════════════════════════════════════════════
import { getDB, saveDB, today } from '../core/db.js';
import { isDue, getDueIn } from '../core/fsrs.js';
import { latexHtml, processLatexInContainer, updateLatexPreview } from '../core/latex.js';
import { openModal, closeModal, toast } from '../ui/modals.js';
import {
  resetChipState, loadChipsFromConcept,
  _addTags, _addRequiere, addTagChip
} from '../ui/autocomplete.js';
import { conceptItem } from './dashboard.js';
// ── Filter state ──────────────────────────────────────────────
let _revisionFilterActive = false;
let _activeTagFilters     = new Set();
let _tagPanelOpen         = false;
// ── List ──────────────────────────────────────────────────────
export function renderConceptList() {
  const db            = getDB();
  const q             = (document.getElementById('search-input')?.value || '').toLowerCase();
  const activeDomains = [...document.querySelectorAll('.filter-btn.active[data-domain]')].map(b => b.dataset.domain);
  // ── Rebuild domain filter bar ──────────────────────────────
  const domains = [...new Set(db.conceptos.map(c => c.dominio))];
  document.getElementById('domain-filters').innerHTML = domains.map(d =>
    `<button class="filter-btn ${activeDomains.includes(d) ? 'active' : ''}" data-domain="${d}" onclick="toggleDomainFilter(this)">${d}</button>`
  ).join('');
  // ── Update revision filter button state ────────────────────
  const revBtn = document.getElementById('revision-filter-btn');
  if (revBtn) revBtn.classList.toggle('active', _revisionFilterActive);
  // ── Build tag filter panel ─────────────────────────────────
  const allTags = [...new Set(db.conceptos.flatMap(c => c.tags || []))].sort();
  const tagList = document.getElementById('tag-filter-list');
  if (tagList) {
    tagList.innerHTML = allTags.length === 0
      ? `<div style="font-size:12px;color:var(--text3);">Sin tags todavía</div>`
      : allTags.map(t => `
        <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:12px;color:var(--text2);padding:2px 0;">
          <input type="checkbox" ${_activeTagFilters.has(t) ? 'checked' : ''}
            onchange="onTagFilterChange('${t.replace(/'/g,"\'")}', this.checked)"
            style="accent-color:var(--accent);">
          <span>${t}</span>
        </label>`).join('');
  }
  // Update tag filter button style
  const tagBtn = document.getElementById('tag-filter-btn');
  if (tagBtn) tagBtn.classList.toggle('active', _activeTagFilters.size > 0);
  // ── Apply filters ──────────────────────────────────────────
  let list = db.conceptos;
  if (q) list = list.filter(c =>
    c.nombre.toLowerCase().includes(q) ||
    c.dominio.toLowerCase().includes(q) ||
    (c.tags || []).some(t => t.toLowerCase().includes(q))
  );
  if (activeDomains.length) list = list.filter(c => activeDomains.includes(c.dominio));
  if (_revisionFilterActive) list = list.filter(c => c.revision === true);
  if (_activeTagFilters.size > 0) {
    list = list.filter(c => [..._activeTagFilters].every(t => (c.tags || []).includes(t)));
  }
  // ── Render ─────────────────────────────────────────────────
  const activeFiltersCount =
    (q ? 1 : 0) +
    activeDomains.length +
    (_revisionFilterActive ? 1 : 0) +
    _activeTagFilters.size;
  document.getElementById('concepts-count').textContent =
    activeFiltersCount > 0
      ? `${list.length} de ${db.conceptos.length} conceptos`
      : `${db.conceptos.length} conceptos`;
  const el = document.getElementById('concept-list');
  if (list.length === 0) {
    el.innerHTML = `<div class="empty">
      <div class="empty-icon">🧠</div>
      <div class="empty-title">Sin conceptos</div>
      <div class="empty-sub">${db.conceptos.length === 0 ? 'Agrega tu primer concepto o importa un JSON.' : 'Ningún concepto coincide con los filtros activos.'}</div>
    </div>`;
    return;
  }
  el.innerHTML = list.map(c => conceptItem(c)).join('');
  // Render LaTeX in concept names
  processLatexInContainer(el);
}
export function toggleDomainFilter(btn) {
  btn.classList.toggle('active');
  renderConceptList();
}
export function toggleRevisionFilter() {
  _revisionFilterActive = !_revisionFilterActive;
  renderConceptList();
}
export function toggleTagFilterPanel() {
  _tagPanelOpen = !_tagPanelOpen;
  const panel = document.getElementById('tag-filter-panel');
  if (panel) panel.style.display = _tagPanelOpen ? 'block' : 'none';
  if (_tagPanelOpen) {
    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', _closeTagPanel, { once: true });
    }, 0);
  }
}
function _closeTagPanel(e) {
  const panel = document.getElementById('tag-filter-panel');
  const btn   = document.getElementById('tag-filter-btn');
  if (panel && !panel.contains(e.target) && e.target !== btn) {
    _tagPanelOpen = false;
    panel.style.display = 'none';
  }
}
export function onTagFilterChange(tag, checked) {
  if (checked) _activeTagFilters.add(tag);
  else         _activeTagFilters.delete(tag);
  renderConceptList();
}
// ── Inner tabs of modal-add ───────────────────────────────────
export function modalConceptTab(tab) {
  document.getElementById('modal-panel-def').style.display     = tab === 'def'     ? '' : 'none';
  document.getElementById('modal-panel-formato').style.display = tab === 'formato' ? '' : 'none';
  document.getElementById('modal-tab-def').classList.toggle('active',     tab === 'def');
  document.getElementById('modal-tab-formato').classList.toggle('active', tab === 'formato');
}
// ── Formato helpers ───────────────────────────────────────────
function getSelectedFormatos() {
  return [...document.querySelectorAll('input[name="formato_respuesta"]:checked')]
    .map(cb => cb.value);
}
function setSelectedFormatos(formatos = []) {
  document.querySelectorAll('input[name="formato_respuesta"]').forEach(cb => {
    cb.checked = formatos.includes(cb.value);
  });
  syncHiddenFormato(formatos);
}
function syncHiddenFormato(formatos) {
  const el = document.getElementById('add-formato-respuesta');
  if (el) el.value = JSON.stringify(formatos);
}
// ── Detail modal ──────────────────────────────────────────────
export function showConceptDetail(id) {
  const db = getDB();
  const c  = db.conceptos.find(x => x.id === id);
  if (!c) return;
  // Render name with LaTeX
  const nameEl = document.getElementById('modal-concept-title');
  nameEl.innerHTML = '';
  const nameSpan = document.createElement('span');
  nameSpan.className = 'latex-content';
  nameSpan.setAttribute('data-latex-pending', '1');
  nameSpan.textContent = c.nombre;
  nameEl.appendChild(nameSpan);
  processLatexInContainer(nameEl);
  const errPending   = (c.errores_previos || []).filter(e => !e.corregido);
  const daysUntilDue = getDueIn(c);
  const definicionHtml = latexHtml(c.definicion_actual, 'latex-content', 'detail-definicion-' + c.id);
  const mejoras        = c.mejoras_acumuladas  || [];
  const ejercicios     = c.ultimos_ejercicios  || [];
  const formatos       = c.formato_respuesta   || [];
  document.getElementById('modal-concept-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-section">
        <div class="detail-section-title">Identidad</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
          <span class="tag tag-purple">${c.dominio}</span>
          ${(c.tags || []).map(t => `<span class="tag tag-gray">${t}</span>`).join('')}
        </div>
        <div style="font-size:11px;color:var(--text3);font-family:var(--mono);">ID: ${c.id}</div>
      </div>
      ${formatos.length ? `<div class="detail-section">
        <div class="detail-section-title">Formatos de respuesta preferidos</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${formatos.map(f => `<span class="tag tag-purple" style="font-size:10px;">${f.replace(/_/g,' ')}</span>`).join('')}
        </div>
      </div>` : ''}
      <div class="detail-section">
        <div class="detail-section-title">Estados</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
          <div><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Teoría</div>
            <span class="state-pill state-${c.estado_teoria}">${c.estado_teoria}</span></div>
          <div><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Práctica</div>
            <span class="state-pill state-${c.estado_practica}">${c.estado_practica}</span></div>
          <div><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Próximo repaso</div>
            <div style="font-family:var(--mono);font-size:12px;">${
              c.fsrs.due
                ? (isDue(c) ? '<span style="color:var(--accent2)">HOY</span>' : `en ${daysUntilDue}d`)
                : 'N/A'
            }</div>
          </div>
          <div><div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Revisión IA</div>
            <span class="revision-badge ${c.revision ? 'revision-on' : 'revision-off'}"
              onclick="toggleRevision('${c.id}');this.className='revision-badge '+(getDB().conceptos.find(x=>x.id==='${c.id}')?.revision?'revision-on':'revision-off')"
              style="font-size:12px;">
              ⚑ ${c.revision ? 'activa — la IA priorizará clarificar esta definición' : 'inactiva'}
            </span>
          </div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">Definición actual${(c.historial_definiciones || []).length > 1 ? ` <span class="version-badge" style="margin-left:6px;">v${c.historial_definiciones.length}</span>` : ''}</div>
        ${definicionHtml}
        ${(c.historial_definiciones || []).length > 1
          ? `<details style="margin-top:8px;">
              <summary style="font-size:11px;color:var(--accent2);cursor:pointer;font-family:var(--mono);user-select:none;">
                📜 Ver ${c.historial_definiciones.length} versiones del historial
              </summary>
              <div style="margin-top:6px;">
                ${(c.historial_definiciones || []).slice().reverse().map(h => `<div style="padding:6px 0;border-bottom:1px solid var(--border);">
                  <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:3px;">${h.fecha}</div>
                  <div style="font-size:12px;color:var(--text2);line-height:1.5;">${latexHtml(h.texto, 'latex-content')}</div>
                </div>`).join('')}
              </div>
            </details>`
          : ''}
      </div>
      ${mejoras.length ? `<div class="detail-section">
        <div class="detail-section-title">Mejoras acumuladas</div>
        ${mejoras.map(m => `<div style="padding:3px 0;border-bottom:1px solid var(--border);">${latexHtml(String(m), 'latex-content')}</div>`).join('')}
      </div>` : ''}
      ${ejercicios.length ? `<div class="detail-section">
        <div class="detail-section-title">Últimos ejercicios</div>
        ${ejercicios.map(e => `<div style="padding:6px 0;border-bottom:1px solid var(--border);">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:3px;">
            <span class="tag tag-gray">${e.formato}</span>
            <span style="font-family:var(--mono);font-size:10px;color:var(--text3);">dif: ${e.dificultad}</span>
          </div>
          ${latexHtml(e.descripcion, 'latex-content')}
        </div>`).join('')}
      </div>` : ''}
      ${errPending.length ? `<div class="detail-section" style="border-color:rgba(248,113,113,0.3);">
        <div class="detail-section-title" style="color:var(--red);">⚠ Errores pendientes (${errPending.length})</div>
        ${errPending.map(e => `<div style="padding:5px 0;border-bottom:1px solid var(--border);">
          <span class="tag tag-red">${e.tipo}</span>
          <div style="margin-top:4px;">${latexHtml(e.descripcion, 'latex-content')}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">${e.fecha}</div>
        </div>`).join('')}
      </div>` : ''}
      <div class="detail-section">
        <div class="detail-section-title">FSRS</div>
        <div style="display:flex;gap:16px;font-family:var(--mono);font-size:12px;flex-wrap:wrap;">
          <span>stability: <span class="hl-accent">${(c.fsrs.stability || 0).toFixed(2)}</span></span>
          <span>difficulty: <span class="hl-accent">${(c.fsrs.difficulty || 0).toFixed(2)}</span></span>
          <span>reps: <span class="hl-accent">${c.fsrs.reps || 0}</span></span>
          <span>lapses: <span class="hl-red">${c.fsrs.lapses || 0}</span></span>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="closeModal('modal-concept');showEditModal('${c.id}')">✏ Editar</button>
        <button class="btn btn-danger btn-sm"    onclick="closeModal('modal-concept');deleteConcept('${c.id}')">🗑 Eliminar</button>
      </div>
    </div>
  `;
  processLatexInContainer(document.getElementById('modal-concept-body'));
  openModal('modal-concept');
}
// ── Add modal ─────────────────────────────────────────────────
export function showAddModal() {
  ['add-nombre', 'add-dominio', 'add-definicion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('add-estado-teoria').value   = 'nuevo';
  document.getElementById('add-estado-practica').value = 'nuevo';
  resetChipState();
  setSelectedFormatos([]);
  modalConceptTab('def');   // always start on definition tab
  const preview = document.getElementById('preview-definicion');
  if (preview) {
    preview.className   = 'latex-preview-box latex-preview-empty';
    preview.textContent = 'Escribe para ver el preview…';
  }
  document.querySelector('#modal-add .modal-title').textContent    = 'Nuevo Concepto';
  document.querySelector('#modal-add .btn-primary').onclick        = () => addConcept();
  openModal('modal-add');
}
export function showEditModal(id) {
  const db = getDB();
  const c  = db.conceptos.find(x => x.id === id);
  if (!c) return;
  document.getElementById('add-nombre').value           = c.nombre;
  document.getElementById('add-dominio').value          = c.dominio;
  document.getElementById('add-definicion').value       = c.definicion_actual;
  document.getElementById('add-estado-teoria').value    = c.estado_teoria;
  document.getElementById('add-estado-practica').value  = c.estado_practica;
  loadChipsFromConcept(c);
  setSelectedFormatos(c.formato_respuesta || []);
  modalConceptTab('def');
  updateLatexPreview('add-definicion', 'preview-definicion');
  document.querySelector('#modal-add .modal-title').textContent = 'Editar Concepto';
  document.querySelector('#modal-add .btn-primary').onclick     = () => saveConcept(id);
  openModal('modal-add');
}
// ── Flush pending tag input before save ───────────────────────
function flushPendingTagInput() {
  const inp = document.getElementById('add-tags-input');
  if (!inp) return;
  const val = inp.value.replace(/,/g, '').trim();
  if (val) { addTagChip(val); inp.value = ''; }
  document.getElementById('ac-tags').classList.remove('open');
}
// ── CRUD ──────────────────────────────────────────────────────
export function addConcept() {
  flushPendingTagInput();
  const nombre     = document.getElementById('add-nombre').value.trim();
  const dominio    = document.getElementById('add-dominio').value.trim();
  const definicion = document.getElementById('add-definicion').value.trim();
  if (!nombre || !dominio || !definicion) { toast('Nombre, dominio y definición son requeridos'); return; }
  const db = getDB();
  db.conceptos.push({
    id:     String(Date.now()),
    nombre, dominio,
    tags:     _addTags.slice(),
    requiere: _addRequiere.map(r => r.id),
    formato_respuesta:       getSelectedFormatos(),
    definicion_actual:       definicion,
    historial_definiciones:  [{ fecha: today(), texto: definicion }],
    estado_teoria:           document.getElementById('add-estado-teoria').value,
    estado_practica:         document.getElementById('add-estado-practica').value,
    mejoras_acumuladas:      [],
    ultimos_ejercicios:      [],
    errores_previos:         [],
    fsrs: { stability: 0, difficulty: 5, due: today(), last_review: null, reps: 0, lapses: 0, state: 'new' }
  });
  saveDB(db);
  closeModal('modal-add');
  renderConceptList();
  toast('Concepto agregado ✓');
}
export function saveConcept(id) {
  flushPendingTagInput();
  const db = getDB();
  const c  = db.conceptos.find(x => x.id === id);
  if (!c) return;
  const nombre     = document.getElementById('add-nombre').value.trim();
  const dominio    = document.getElementById('add-dominio').value.trim();
  const definicion = document.getElementById('add-definicion').value.trim();
  if (!nombre || !dominio || !definicion) { toast('Campos requeridos vacíos'); return; }
  if (definicion !== c.definicion_actual) {
    c.historial_definiciones = c.historial_definiciones || [];
    c.historial_definiciones.push({ fecha: today(), texto: c.definicion_actual });
    c.definicion_actual = definicion;
  }
  c.nombre             = nombre;
  c.dominio            = dominio;
  c.tags               = _addTags.slice();
  c.requiere           = _addRequiere.map(r => r.id);
  c.formato_respuesta  = getSelectedFormatos();
  c.estado_teoria      = document.getElementById('add-estado-teoria').value;
  c.estado_practica    = document.getElementById('add-estado-practica').value;
  saveDB(db);
  closeModal('modal-add');
  renderConceptList();
  toast('Concepto actualizado ✓');
}
export function deleteConcept(id) {
  if (!confirm('¿Eliminar este concepto? Esta acción no se puede deshacer.')) return;
  const db      = getDB();
  db.conceptos  = db.conceptos.filter(c => c.id !== id);
  saveDB(db);
  renderConceptList();
  toast('Concepto eliminado');
}
// ── Template modal ────────────────────────────────────────────
export function showTemplateModal() {
  const template = {
    id:      'AUTOGENERADO_POR_APP',
    nombre:  'Nombre del concepto (soporta LaTeX: $E=mc^2$)',
    dominio: 'programación / matemáticas / inglés / electrónica / ...',
    tags:    ['tag1', 'tag2'],
    requiere: [],
    formato_respuesta: [],
    definicion_actual: 'Tu definición aquí. Puedes usar LaTeX: $E = mc^2$ o bloques $$\\int_0^\\infty e^{-x} dx = 1$$',
    historial_definiciones: [{ fecha: 'YYYY-MM-DD', texto: 'Tu definición aquí.' }],
    estado_teoria:   'nuevo',
    estado_practica: 'nuevo',
    mejoras_acumuladas:  [],
    ultimos_ejercicios:  [],
    errores_previos:     [],
    fsrs: { stability: 0, difficulty: 5, due: 'YYYY-MM-DD', last_review: null, reps: 0, lapses: 0, state: 'new' }
  };
  document.getElementById('template-display').textContent = JSON.stringify(template, null, 2);
  openModal('modal-template');
}
export function copyTemplate() {
  const text = document.getElementById('template-display').textContent;
  navigator.clipboard.writeText(text)
    .then(() => toast('📋 Plantilla copiada'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      toast('📋 Plantilla copiada');
    });
}
// ── Expose globals ────────────────────────────────────────────
window.renderConceptList    = renderConceptList;
window.toggleDomainFilter   = toggleDomainFilter;
window.toggleRevisionFilter = toggleRevisionFilter;
window.toggleTagFilterPanel = toggleTagFilterPanel;
window.onTagFilterChange    = onTagFilterChange;
window.modalConceptTab      = modalConceptTab;
window.showConceptDetail    = showConceptDetail;
window.showAddModal         = showAddModal;
window.showEditModal        = showEditModal;
window.addConcept           = addConcept;
window.saveConcept          = saveConcept;
window.deleteConcept        = deleteConcept;
window.showTemplateModal    = showTemplateModal;
window.copyTemplate         = copyTemplate;