// ═══════════════════════════════════════════════════════════════
// AUTOSAVE ENGINE — periodic Gist sync every 5 minutes
// ═══════════════════════════════════════════════════════════════

import { getDB, getGistConfig, GIST_CONFIG_KEY } from './core/db.js';
import { toast } from './ui/modals.js';
import { updateGistStatus } from './sections/config.js';

const AUTOSAVE_KEY          = 'neuraldeck_autosave';
const AUTOSAVE_LASTTIME_KEY = 'neuraldeck_autosave_lasttime';
const AUTOSAVE_INTERVAL_MS  = 5 * 60 * 1000;

let autosaveTimer  = null;
let lastSavedHash  = null;

// ── Helpers ───────────────────────────────────────────────────

function getDBHash() {
  const db = getDB();
  return `${db.conceptos.length}:${db.meta.ultima_actualizacion}:${JSON.stringify(db).length}`;
}

export function isAutosaveEnabled() {
  const val = localStorage.getItem(AUTOSAVE_KEY);
  return val === null ? true : val === '1';
}

function setAutosaveEnabled(val) {
  localStorage.setItem(AUTOSAVE_KEY, val ? '1' : '0');
}

function getLastSavedTime() {
  return localStorage.getItem(AUTOSAVE_LASTTIME_KEY) || null;
}

function setLastSavedTime(timeStr) {
  localStorage.setItem(AUTOSAVE_LASTTIME_KEY, timeStr);
}

// ── Status indicator ──────────────────────────────────────────

export function setAutosaveStatus(state, detail) {
  const dot   = document.getElementById('autosave-dot');
  const label = document.getElementById('autosave-label');
  if (!dot || !label) return;

  const lastTime  = getLastSavedTime();
  const suffix    = lastTime ? ` · ${lastTime}` : '';

  const states = {
    off:     { color: 'var(--text3)',   shadow: 'none',                       anim: 'none',                   text: `off${suffix}` },
    idle:    { color: 'var(--green)',   shadow: '0 0 5px var(--green)',        anim: 'none',                   text: detail || `guardado${suffix}` },
    pending: { color: 'var(--yellow)',  shadow: 'none',                       anim: 'pulse 1.5s infinite',    text: 'guardando...' },
    error:   { color: 'var(--red)',     shadow: 'none',                       anim: 'none',                   text: `error${suffix}` },
    waiting: { color: 'var(--accent2)', shadow: '0 0 5px var(--accent)',      anim: 'none',                   text: `activo${suffix}` },
  };

  const s = states[state] || states.off;
  dot.style.background = s.color;
  dot.style.boxShadow  = s.shadow;
  dot.style.animation  = s.anim;
  label.textContent    = detail !== undefined ? detail : s.text;
}

// ── Toggle button label ───────────────────────────────────────

export function updateAutosaveToggleBtn() {
  const btn = document.getElementById('autosave-toggle-btn');
  if (!btn) return;
  const enabled   = isAutosaveEnabled();
  btn.textContent = enabled ? '⏸ Desactivar' : '▶ Activar';
  btn.className   = enabled ? 'btn btn-danger btn-sm' : 'btn btn-green btn-sm';
}

// ── Core save routine ─────────────────────────────────────────

export async function runAutosave(silent = false) {
  const saved      = getGistConfig();
  const tokenInput = document.getElementById('gh-token')?.value.trim();
  const gistInput  = document.getElementById('gist-id')?.value.trim();
  const token      = tokenInput || saved.token  || '';
  const gistId     = gistInput  || saved.gistId || '';

  if (!token) {
    setAutosaveStatus('error', 'sin token' + (getLastSavedTime() ? ` · ${getLastSavedTime()}` : ''));
    if (!silent) toast('⚠ Configura el token de GitHub para usar autoguardado');
    return;
  }

  const currentHash = getDBHash();
  if (currentHash === lastSavedHash) {
    const lastTime = getLastSavedTime();
    setAutosaveStatus('waiting', `activo · sin cambios${lastTime ? ' · ' + lastTime : ''}`);
    return;
  }

  const dbCheck = getDB();
  if (dbCheck.conceptos.length === 0) {
    setAutosaveStatus('error', 'bloqueado · BD vacía');
    return;
  }

  setAutosaveStatus('pending');

  try {
    const db      = getDB();
    const content = JSON.stringify(db, null, 2);
    let res, newGistId = gistId;

    if (gistId) {
      res = await fetch(`https://api.github.com/gists/${gistId}`, {
        method:  'PATCH',
        headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ files: { 'neuraldeck_db.json': { content } } })
      });
    } else {
      res = await fetch('https://api.github.com/gists', {
        method:  'POST',
        headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ description: 'NeuralDeck BD', public: false, files: { 'neuraldeck_db.json': { content } } })
      });
      if (res.ok) {
        const data = await res.json();
        newGistId  = data.id;
        localStorage.setItem(GIST_CONFIG_KEY, JSON.stringify({ token, gistId: newGistId }));
        const gistEl = document.getElementById('gist-id');
        if (gistEl) gistEl.value = newGistId;
      }
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    lastSavedHash   = currentHash;
    const now       = new Date();
    const timeStr   = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    setLastSavedTime(timeStr);
    setAutosaveStatus('idle', `guardado ${timeStr}`);
    if (!silent) toast(`☁ Autoguardado — ${timeStr}`);
    updateGistStatus('configured');

  } catch (e) {
    const lastTime = getLastSavedTime();
    setAutosaveStatus('error', `error${lastTime ? ' · ' + lastTime : ''}`);
    if (!silent) toast('⚠ Autoguardado falló: ' + e.message);
  }
}

// ── Start / Stop ──────────────────────────────────────────────

export function startAutosave() {
  stopAutosave(true);
  setAutosaveEnabled(true);
  updateAutosaveToggleBtn();

  const lastTime = getLastSavedTime();
  setAutosaveStatus('waiting', `activo${lastTime ? ' · ' + lastTime : ''}`);
  runAutosave(true);
  autosaveTimer = setInterval(() => runAutosave(false), AUTOSAVE_INTERVAL_MS);
}

export function stopAutosave(timerOnly = false) {
  if (autosaveTimer) { clearInterval(autosaveTimer); autosaveTimer = null; }
  if (!timerOnly) {
    setAutosaveEnabled(false);
    updateAutosaveToggleBtn();
    const lastTime = getLastSavedTime();
    setAutosaveStatus('off', `off${lastTime ? ' · ' + lastTime : ''}`);
  }
}

export function toggleAutosave() {
  if (isAutosaveEnabled()) {
    stopAutosave();
    toast('Autoguardado desactivado');
  } else {
    const cfg = getGistConfig();
    if (!cfg.token) {
      toast('⚠ Primero guarda el token de GitHub en Config → Gist');
      import('./ui/nav.js').then(m => m.goto('config'));
      return;
    }
    startAutosave();
    toast('☁ Autoguardado activado — cada 5 minutos');
  }
}

// ── Expose globals ────────────────────────────────────────────
window.toggleAutosave = toggleAutosave;
