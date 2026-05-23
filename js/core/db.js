// ═══════════════════════════════════════════════════════════════
// CORE — DB (storage, sanitize, helpers)
// ═══════════════════════════════════════════════════════════════

export const STORAGE_KEY      = 'neuraldeck_db';
export const GIST_CONFIG_KEY  = 'neuraldeck_gist';

export const DEFAULT_DB = {
  meta: { version: '1.0', ultima_actualizacion: today(), total_sesiones: 0 },
  conceptos: []
};

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function sanitizeDB(db) {
  if (!db || !Array.isArray(db.conceptos)) return db;

  const usedIds = new Set(
    db.conceptos
      .filter(c => c.id && String(c.id).trim() !== '' && c.id !== 'AUTOGENERADO_POR_APP')
      .map(c => String(c.id).trim())
  );

  db.conceptos = db.conceptos.map(c => {
    const rawId = (c.id !== undefined && c.id !== null) ? String(c.id).trim() : '';
    if (!rawId || rawId === 'AUTOGENERADO_POR_APP') {
      let newId;
      do { newId = String(Date.now()) + String(Math.floor(Math.random() * 99999)).padStart(5, '0'); }
      while (usedIds.has(newId));
      usedIds.add(newId);
      c.id = newId;
    } else {
      c.id = rawId;
    }

    if (!c.fsrs || typeof c.fsrs !== 'object') c.fsrs = {};
    c.fsrs = {
      stability:   typeof c.fsrs.stability  === 'number' ? c.fsrs.stability  : 0,
      difficulty:  typeof c.fsrs.difficulty === 'number' ? c.fsrs.difficulty : 5,
      due:         c.fsrs.due        || today(),
      last_review: c.fsrs.last_review || null,
      reps:        typeof c.fsrs.reps    === 'number' ? c.fsrs.reps    : 0,
      lapses:      typeof c.fsrs.lapses  === 'number' ? c.fsrs.lapses  : 0,
      state:       c.fsrs.state || 'new'
    };

    if (!Array.isArray(c.tags))                c.tags = [];
    if (!Array.isArray(c.requiere))            c.requiere = [];
    if (!Array.isArray(c.mejoras_acumuladas))  c.mejoras_acumuladas = [];
    if (!Array.isArray(c.ultimos_ejercicios))  c.ultimos_ejercicios = [];
    if (!Array.isArray(c.errores_previos))     c.errores_previos = [];
    if (!c.definicion_actual)                  c.definicion_actual = '';
    if (!Array.isArray(c.historial_definiciones)) {
      c.historial_definiciones = [{ fecha: today(), texto: c.definicion_actual }];
    }
    if (!c.estado_teoria)   c.estado_teoria  = 'nuevo';
    if (!c.estado_practica) c.estado_practica = 'nuevo';

    return c;
  });

  return db;
}

export function getDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const db  = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_DB));
    return sanitizeDB(db);
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

export function saveDB(db) {
  db.meta.ultima_actualizacion = today();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

export function getGistConfig() {
  try { return JSON.parse(localStorage.getItem(GIST_CONFIG_KEY)) || {}; }
  catch { return {}; }
}
