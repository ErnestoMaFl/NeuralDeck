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

// ── List ──────────────────────────────────────────────────────

export function renderConceptList() {
  const db            = getDB();
  const q             = (document.getElementById('search-input')?.value || '').toLowerCase();
  const activeDomains = [...document.querySelectorAll('.filter-btn.active')].map(b => b.dataset.domain);
  const domains       = [...new Set(db.conceptos.map(c => c.dominio))];

  // Rebuild filter bar (preserve active state)
  document.getElementById('domain-filters').innerHTML = domains.map(d =>
    `<button class="filter-btn ${activeDomains.includes(d) ? 'active' : ''}" data-domain="${d}" onclick="toggleDomainFilter(this)">${d}</button>`
  ).join('');

  let list = db.conceptos;
  if (q)                list = list.filter(c =>
    c.nombre.toLowerCase().includes(q) ||
    c.dominio.toLowerCase().includes(q) ||
    c.tags.some(t => t.toLowerCase().includes(q))
  );
  if (activeDomains.length) list = list.filter(c => activeDomains.includes(c.dominio));

  document.getElementById('concepts-count').textContent = `${list.length} de ${db.conceptos.length} conceptos`;

  const el = document.getElementById('concept-list');
  if (list.length === 0) {
    el.innerHTML = `<div class="empty">
      <div class="empty-icon">🧠</div>
      <div class="empty-title">Sin conceptos</div>
      <div class="empty-sub">Agrega tu primer concepto o importa un JSON.</div>
    </div>`;
    return;
  }
  el.innerHTML = list.map(c => conceptItem(c)).join('');
}

export function toggleDomainFilter(btn) {
  btn.classList.toggle('active');
  renderConceptList();
}

// ── Detail modal ──────────────────────────────────────────────

export function showConceptDetail(id) {
  const db = getDB();
  const c  = db.conceptos.find(x => x.id === id);
  if (!c) return;

  document.getElementById('modal-concept-title').textContent = c.nombre;

  const errPending   = (c.errores_previos || []).filter(e => !e.corregido);
  const daysUntilDue = getDueIn(c);
  const definicionHtml = latexHtml(c.definicion_actual, 'latex-content', 'detail-definicion-' + c.id);
  const mejoras        = c.mejoras_acumuladas  || [];
  const ejercicios     = c.ultimos_ejercicios  || [];

  document.getElementById('modal-concept-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-section">
        <div class="detail-section-title">Identidad</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
          <span class="tag tag-purple">${c.dominio}</span>
          ${c.tags.map(t => `<span class="tag tag-gray">${t}</span>`).join('')}
        </div>
        <div style="font-size:11px;color:var(--text3);font-family:var(--mono);">ID: ${c.id}</div>
      </div>

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
        <div class="detail-section-title">Definición actual</div>
        ${definicionHtml}
        ${(c.historial_definiciones || []).length > 1
          ? `<div style="margin-top:8px;font-size:11px;color:var(--text3);">${c.historial_definiciones.length} versiones en historial</div>`
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
  const nombre    = document.getElementById('add-nombre').value.trim();
  const dominio   = document.getElementById('add-dominio').value.trim();
  const definicion = document.getElementById('add-definicion').value.trim();
  if (!nombre || !dominio || !definicion) { toast('Nombre, dominio y definición son requeridos'); return; }

  const db = getDB();
  db.conceptos.push({
    id:     String(Date.now()),
    nombre, dominio,
    tags:     _addTags.slice(),
    requiere: _addRequiere.map(r => r.id),
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
  c.nombre          = nombre;
  c.dominio         = dominio;
  c.tags            = _addTags.slice();
  c.requiere        = _addRequiere.map(r => r.id);
  c.estado_teoria   = document.getElementById('add-estado-teoria').value;
  c.estado_practica = document.getElementById('add-estado-practica').value;

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
    nombre:  'Nombre del concepto',
    dominio: 'programación / matemáticas / inglés / electrónica / ...',
    tags:    ['tag1', 'tag2'],
    requiere: [],
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
window.renderConceptList   = renderConceptList;
window.toggleDomainFilter  = toggleDomainFilter;
window.showConceptDetail   = showConceptDetail;
window.showAddModal        = showAddModal;
window.showEditModal       = showEditModal;
window.addConcept          = addConcept;
window.saveConcept         = saveConcept;
window.deleteConcept       = deleteConcept;
window.showTemplateModal   = showTemplateModal;
window.copyTemplate        = copyTemplate;
