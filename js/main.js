// ═══════════════════════════════════════════════════════════════
// MAIN — Application entry point
// ═══════════════════════════════════════════════════════════════
// Core
import './core/db.js';
import './core/fsrs.js';
import './core/latex.js';
import './core/domain-colors.js';
// UI primitives
import { initModalOverlays } from './ui/modals.js';
import './ui/autocomplete.js';
import './ui/nav.js';
// Sections (side-effect: each registers window.* globals)
import './sections/dashboard.js';
import './sections/concepts.js';
import './sections/session.js';
import './sections/config.js';
// Autosave
import {
  isAutosaveEnabled,
  startAutosave,
  stopAutosave,
  setAutosaveStatus,
  updateAutosaveToggleBtn
} from './autosave.js';
// ── LaTeX preview listener (add modal textarea) ───────────────
import { updateLatexPreview } from './core/latex.js';
window.updateLatexPreview = updateLatexPreview;
// ── Energy select → regenerate session package ────────────────
import { generateSessionPackage } from './sections/session.js';
document.addEventListener('change', e => {
  if (e.target.id === 'energy-select') generateSessionPackage();
});
// ── Boot ──────────────────────────────────────────────────────
import { renderDashboard } from './sections/dashboard.js';
initModalOverlays();
renderDashboard();
updateAutosaveToggleBtn();
if (isAutosaveEnabled()) {
  startAutosave();
} else {
  const lastTime = localStorage.getItem('neuraldeck_autosave_lasttime');
  setAutosaveStatus('off', `off${lastTime ? ' · ' + lastTime : ''}`);
}