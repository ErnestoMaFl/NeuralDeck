// ═══════════════════════════════════════════════════════════════
// SECTION — Session (prepare package + apply diff)
// ═══════════════════════════════════════════════════════════════
import { getDB, saveDB, today } from '../core/db.js';
import { isDue, applyFSRSRating } from '../core/fsrs.js';
import { toast, openModal } from '../ui/modals.js';
import { _addTags, _addRequiere, renderTagChips, renderRequiereChips } from '../ui/autocomplete.js';

// ── Prepare ───────────────────────────────────────────────────
export function renderSession() {
  const db  = getDB();
  const due = db.conceptos.filter(c => isDue(c));
  document.getElementById('session-count-tag').textContent = due.length + ' conceptos';
  const listEl = document.getElementById('session-concept-list');
  if (due.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">Sin conceptos pendientes hoy. ¡Vuelve mañana!</div>';
  } else {
    listEl.innerHTML = due.map(c => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface2);border-radius:6px;margin-bottom:6px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;">${c.nombre}</div>
          <div style="font-size:11px;color:var(--text3);font-family:var(--mono);">${c.dominio}</div>
        </div>
        <span class="state-pill state-${c.estado_teoria}">T</span>
        <span class="state-pill state-${c.estado_practica}">P</span>
        ${(c.formato_respuesta || []).length > 0
          ? `<span class="tag tag-gray" style="font-size:10px;">⊞ ${c.formato_respuesta.length}f</span>`
          : ''}
      </div>`
    ).join('');
  }
  generateSessionPackage();
}

export function generateSessionPackage() {
  const db     = getDB();
  const due    = db.conceptos.filter(c => isDue(c));
  const energy = document.getElementById('energy-select')?.value || '';

  const indice_global = db.conceptos.map(c => ({
    id: c.id, nombre: c.nombre, dominio: c.dominio,
    tags: c.tags, estado_teoria: c.estado_teoria, estado_practica: c.estado_practica
  }));

  const conceptos_hoy = due.map(c => ({
    id:               c.id,
    nombre:           c.nombre,
    dominio:          c.dominio,
    tags:             c.tags,
    requiere:         c.requiere || [],
    formato_respuesta: c.formato_respuesta || [],  // ← formatos preferidos para la IA
    definicion_actual: c.definicion_actual,
    estado_teoria:    c.estado_teoria,
    estado_practica:  c.estado_practica,
    revision:         c.revision || false,
    mejoras_acumuladas: c.mejoras_acumuladas || [],
    ultimos_ejercicios: (c.ultimos_ejercicios || []).slice(-3),
    errores_pendientes: (c.errores_previos || [])
      .filter(e => !e.corregido)
      .map(e => ({
        id_error:                  e.id_error,
        descripcion:               e.descripcion,
        tipo:                      e.tipo,
        concepto_relacionado_id:   e.concepto_relacionado || null
      }))
  }));

  const pkg = {
    indice_global,
    sesion: { energia: energy || null, fecha: today(), conceptos_hoy }
  };
  document.getElementById('session-package-preview').textContent = JSON.stringify(pkg, null, 2);
}

export function copySessionPackage() {
  const text = document.getElementById('session-package-preview').textContent;
  if (!text || text === '—') { toast('Primero genera el paquete'); return; }
  navigator.clipboard.writeText(text)
    .then(() => toast('📋 Paquete copiado al portapapeles'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      toast('📋 Paquete copiado');
    });
}

// ── Apply diff ────────────────────────────────────────────────
export function applyDiff() {
  const raw = document.getElementById('diff-input').value.trim();
  if (!raw) { toast('Pega el JSON de la IA primero'); return; }
  let diff;
  try { diff = JSON.parse(raw); }
  catch { toast('JSON inválido — revisa el formato'); return; }
  if (!diff.actualizaciones || !Array.isArray(diff.actualizaciones)) {
    toast('El JSON no tiene el campo "actualizaciones"'); return;
  }

  const splits = diff.actualizaciones.filter(u => u.split_recomendado === true);
  if (splits.length > 0) {
    const db = getDB();
    window._pendingDiff = diff;
    const splitBanners = splits.map(upd => {
      const c      = db.conceptos.find(x => x.id === upd.id);
      const nombre = c ? c.nombre : upd.id;
      // Show the suggested definition if the IA provided one
      const defPreview = upd.split_definicion_sugerida
        ? `<div style="margin:8px 0;padding:8px;background:var(--surface3);border-radius:5px;font-size:12px;color:var(--text2);font-family:var(--mono);">${upd.split_definicion_sugerida}</div>`
        : '';
      return `<div class="split-banner">
        <div class="split-banner-title">🔀 División de tarjeta recomendada — ${nombre}</div>
        <div class="split-banner-body">${upd.split_razon || 'La IA detectó que este concepto creció suficiente para separarse en dos tarjetas independientes.'}</div>
        ${defPreview}
        <div class="split-banner-actions">
          <button class="btn btn-primary btn-sm" onclick="createSplitCard('${upd.id}', ${JSON.stringify(upd.split_definicion_sugerida || '')})">✦ Crear tarjeta hija</button>
          <button class="btn btn-ghost btn-sm" onclick="this.closest('.split-banner').remove()">Ignorar esta vez</button>
        </div>
      </div>`;
    }).join('');
    document.getElementById('diff-result').innerHTML = splitBanners +
      `<div style="margin-top:12px;">
        <button class="btn btn-secondary btn-full" onclick="executeDiff()">⚡ Aplicar diff (acumular en concepto original)</button>
      </div>`;
    return;
  }
  executeDiff(diff);
}

export function executeDiff(diff) {
  if (!diff) diff = window._pendingDiff;
  if (!diff) { toast('No hay diff pendiente'); return; }
  const db      = getDB();
  const results = [];
  diff.actualizaciones.forEach(upd => {
    const c = db.conceptos.find(x => x.id === upd.id);
    if (!c) { results.push({ id: upd.id, status: 'error', msg: 'Concepto no encontrado' }); return; }
    if (upd.calificacion_fsrs && [1, 2, 3, 4].includes(upd.calificacion_fsrs)) {
      applyFSRSRating(c, upd.calificacion_fsrs);
    }
    if (upd.estado_teoria)    c.estado_teoria   = upd.estado_teoria;
    if (upd.estado_practica)  c.estado_practica  = upd.estado_practica;
    if (upd.definicion_refinada) {
      c.historial_definiciones = c.historial_definiciones || [];
      c.historial_definiciones.push({ fecha: today(), texto: c.definicion_actual });
      c.definicion_actual = upd.definicion_refinada;
    }
    if (upd.nueva_mejora) {
      c.mejoras_acumuladas = c.mejoras_acumuladas || [];
      c.mejoras_acumuladas.push(upd.nueva_mejora);
    }
    if (upd.nuevo_ejercicio) {
      c.ultimos_ejercicios = c.ultimos_ejercicios || [];
      if (c.ultimos_ejercicios.length >= 3) c.ultimos_ejercicios.shift();
      c.ultimos_ejercicios.push(upd.nuevo_ejercicio);
    }
    if (upd.nuevo_error) {
      c.errores_previos = c.errores_previos || [];
      c.errores_previos.push({
        id_error:            'e' + Date.now(),
        descripcion:         upd.nuevo_error.descripcion,
        tipo:                upd.nuevo_error.tipo,
        concepto_relacionado: upd.nuevo_error.concepto_relacionado_id || null,
        fecha:               today(),
        corregido:           false
      });
    }
    if (upd.error_corregido_id) {
      const err = (c.errores_previos || []).find(e => e.id_error === upd.error_corregido_id);
      if (err) err.corregido = true;
    }
    if (upd.revision_resuelta === true) c.revision = false;
    results.push({ id: upd.id, nombre: c.nombre, status: 'ok', fsrs: upd.calificacion_fsrs, due: c.fsrs.due });
  });
  db.meta.total_sesiones = (db.meta.total_sesiones || 0) + 1;
  saveDB(db);
  window._pendingDiff = null;
  document.getElementById('diff-result').innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">Resultado de la actualización</div></div>
      ${results.map(r => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
          <span style="font-size:16px;">${r.status === 'ok' ? '✅' : '❌'}</span>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;">${r.nombre || r.id}</div>
            ${r.status === 'ok'
              ? `<div style="font-size:11px;color:var(--text3);font-family:var(--mono);">FSRS: ${r.fsrs} · Próximo repaso: ${r.due}</div>`
              : `<div style="font-size:11px;color:var(--red);">${r.msg}</div>`
            }
          </div>
        </div>
      `).join('')}
      <div style="margin-top:12px;font-size:12px;color:var(--text3);">BD actualizada. ${db.meta.total_sesiones} sesiones completadas.</div>
    </div>`;
  toast('✓ Diff aplicado — ' + results.filter(r => r.status === 'ok').length + ' conceptos actualizados');
  document.getElementById('diff-input').value = '';
}

/**
 * Opens the add-concept modal pre-filled with parent's domain, tags and requiere.
 * If the IA provided split_definicion_sugerida, pre-fills the definition field too.
 */
export function createSplitCard(parentId, sugeridaDefinicion = '') {
  const db     = getDB();
  const parent = db.conceptos.find(x => x.id === parentId);
  if (!parent) return;

  import('./concepts.js').then(m => {
    m.showAddModal();

    // Pre-fill domain
    document.getElementById('add-dominio').value = parent.dominio;

    // Pre-fill definition if the IA suggested one
    if (sugeridaDefinicion) {
      const defEl = document.getElementById('add-definicion');
      if (defEl) {
        defEl.value = sugeridaDefinicion;
        // Trigger LaTeX preview update
        import('../core/latex.js').then(({ updateLatexPreview }) => {
          updateLatexPreview('add-definicion', 'preview-definicion');
        });
      }
    }

    // Pre-fill tags and requiere chips
    _addTags.length     = 0;
    _addRequiere.length = 0;
    _addTags.push(...(parent.tags || []));
    _addRequiere.push({ id: parentId, nombre: parent.nombre });
    renderTagChips();
    renderRequiereChips();

    document.querySelector('#modal-add .modal-title').textContent = `Nueva tarjeta hija de: ${parent.nombre}`;
    const hint = sugeridaDefinicion
      ? 'Definición sugerida por la IA pre-cargada — revísala antes de guardar'
      : 'Completa el nombre y definición de la nueva tarjeta';
    toast(hint);
  });
}

// ── Expose globals ────────────────────────────────────────────
window.renderSession          = renderSession;
window.generateSessionPackage = generateSessionPackage;
window.copySessionPackage     = copySessionPackage;
window.applyDiff              = applyDiff;
window.executeDiff            = executeDiff;
window.createSplitCard        = createSplitCard;