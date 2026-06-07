// ═══════════════════════════════════════════════════════════════
// UI — Navigation (sections & inner tabs)
// ═══════════════════════════════════════════════════════════════
import { renderDashboard } from '../sections/dashboard.js';
import { renderConceptList } from '../sections/concepts.js';
import { renderSession } from '../sections/session.js';
import { renderConfig } from '../sections/config.js';
const SECTION_ORDER = ['dashboard', 'concepts', 'session', 'config'];
export function goto(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('sec-' + section).classList.add('active');
  const idx = SECTION_ORDER.indexOf(section);
  if (idx >= 0) document.querySelectorAll('.nav-tab')[idx].classList.add('active');
  const renderers = {
    dashboard: renderDashboard,
    concepts:  renderConceptList,
    session:   renderSession,
    config:    renderConfig,
  };
  renderers[section]?.();
}
export function sessionTab(tab) {
  document.getElementById('session-prepare').style.display = tab === 'prepare' ? '' : 'none';
  document.getElementById('session-apply').style.display   = tab === 'apply'   ? '' : 'none';
  document.querySelectorAll('.inner-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && tab === 'prepare') || (i === 1 && tab === 'apply'));
  });
}
export function configTab(tab) {
  ['gist', 'data', 'prompt'].forEach(t => {
    document.getElementById('config-' + t).style.display = t === tab ? '' : 'none';
  });
  document.querySelectorAll('#sec-config .inner-tab').forEach((t, i) => {
    const tabs = ['gist', 'data', 'prompt'];
    t.classList.toggle('active', tabs[i] === tab);
  });
  // Lazy-render sub-sections
  if (tab === 'data') {
    import('../sections/config.js').then(m => m.renderRawJSON());
  }
  if (tab === 'prompt') {
    import('../sections/config.js').then(m => m.renderTutorPrompt());
  }
}
// Expose globally for inline HTML onclick handlers
window.goto       = goto;
window.sessionTab = sessionTab;
window.configTab  = configTab;