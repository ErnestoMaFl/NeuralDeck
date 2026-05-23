// ═══════════════════════════════════════════════════════════════
// SECTION — Dashboard
// ═══════════════════════════════════════════════════════════════
import { getDB, saveDB, today } from '../core/db.js';
import { isDue, getDueIn } from '../core/fsrs.js';
import { latexHtml } from '../core/latex.js';
import { toast } from '../ui/modals.js';

export function renderDashboard() {
  const db  = getDB();
  const due = db.conceptos.filter(c => isDue(c));
  document.getElementById('stat-due').textContent      = due.length;
  document.getElementById('stat-total').textContent    = db.conceptos.length;
  document.getElementById('stat-sessions').textContent = db.meta.total_sesiones || 0;
  document.getElementById('due-count-badge').textContent = due.length;
  const pendingBadge = document.getElementById('nav-pending-badge');
  if (pendingBadge) pendingBadge.textContent = due.length;
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Due list
  const dueList = document.getElementById('due-list');
  if (due.length === 0) {
    dueList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">🎉 Sin conceptos pendientes hoy</div>';
  } else {
    dueList.innerHTML = due.slice(0, 6).map(c => conceptItem(c, true)).join('');
    // Render LaTeX in names
    import('../core/latex.js').then(({ processLatexInContainer }) => {
      processLatexInContainer(dueList);
    });
  }

  // State distribution
  const states     = ['nuevo', 'fallas', 'en_progreso', 'dominado'];
  const statLabels = { nuevo: 'Nuevo', fallas: 'Con fallas', en_progreso: 'En progreso', dominado: 'Dominado' };
  const statColors = { nuevo: 'var(--text3)', fallas: 'var(--red)', en_progreso: 'var(--yellow)', dominado: 'var(--green)' };
  const total      = db.conceptos.length;
  document.getElementById('state-dist').innerHTML = states.map(st => {
    const count = db.conceptos.filter(c => c.estado_teoria === st || c.estado_practica === st).length;
    const pct   = total > 0 ? Math.round(count / total * 100) : 0;
    return `<div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
        <span style="color:${statColors[st]}">${statLabels[st]}</span>
        <span style="color:var(--text3);font-family:var(--mono)">${count}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${statColors[st]}"></div></div>
    </div>`;
  }).join('');

  // Upcoming
  const upcoming = db.conceptos
    .filter(c => !isDue(c))
    .sort((a, b) => (a.fsrs.due || '').localeCompare(b.fsrs.due || ''))
    .slice(0, 5);
  const upEl = document.getElementById('upcoming-list');
  if (upcoming.length === 0) {
    upEl.innerHTML = '<div style="color:var(--text3);font-size:13px;">Sin próximas revisiones programadas</div>';
  } else {
    upEl.innerHTML = upcoming.map(c => {
      const days = getDueIn(c);
      // Name with LaTeX support
      const nameHtml = latexHtml(c.nombre, 'latex-content');
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);">
        <span style="font-size:13px;">${nameHtml}</span>
        <span style="font-family:var(--mono);font-size:11px;color:var(--text3)">+${days}d</span>
      </div>`;
    }).join('');
    import('../core/latex.js').then(({ processLatexInContainer }) => {
      processLatexInContainer(upEl);
    });
  }
}

/**
 * Renders a single concept row. Name is rendered with LaTeX support.
 * Caller must call processLatexInContainer on the parent after inserting.
 */
export function conceptItem(c) {
  const dueStr = c.fsrs.due
    ? (isDue(c)
        ? '<span style="color:var(--accent2);font-family:var(--mono);font-size:11px;">HOY</span>'
        : `<span style="color:var(--text3);font-family:var(--mono);font-size:11px;">+${getDueIn(c)}d</span>`)
    : '';
  const revBadge = c.revision
    ? `<span class="revision-badge revision-on"  onclick="event.stopPropagation();toggleRevision('${c.id}')">⚑ revisión</span>`
    : `<span class="revision-badge revision-off" onclick="event.stopPropagation();toggleRevision('${c.id}')">⚑</span>`;

  const formatoBadge = (c.formato_respuesta || []).length > 0
    ? `<span class="tag tag-gray" style="font-size:10px;" title="${(c.formato_respuesta).join(', ')}">⊞ ${c.formato_respuesta.length} formato${c.formato_respuesta.length > 1 ? 's' : ''}</span>`
    : '';

  // Name rendered with LaTeX — data-latex-pending so processLatexInContainer handles it
  const nameHtml = latexHtml(c.nombre, 'concept-name');

  return `<div class="concept-item ${isDue(c) ? 'due' : ''}" onclick="showConceptDetail('${c.id}')">
    <div class="concept-info">
      ${nameHtml}
      <div class="concept-meta">
        <span class="concept-domain">${c.dominio}</span>
        ${(c.tags || []).map(t => `<span class="tag tag-purple">${t}</span>`).join('')}
        <span class="state-pill state-${c.estado_teoria}">T:${c.estado_teoria}</span>
        <span class="state-pill state-${c.estado_practica}">P:${c.estado_practica}</span>
        ${formatoBadge}
        ${revBadge}
      </div>
    </div>
    ${dueStr}
  </div>`;
}

export function toggleRevision(id) {
  const db = getDB();
  const c  = db.conceptos.find(x => x.id === id);
  if (!c) return;
  c.revision = !c.revision;
  saveDB(db);
  import('../sections/concepts.js').then(m => m.renderConceptList());
  renderDashboard();
  toast(c.revision ? '⚑ Marcado para revisión con IA' : '⚑ Revisión desactivada');
}

// Expose globals
window.toggleRevision = toggleRevision;