// ═══════════════════════════════════════════════════════════════
// UI — Modals & Toast
// ═══════════════════════════════════════════════════════════════
export function openModal(id) {
  document.getElementById(id).classList.add('open');
}
export function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
let toastTimer;
export function toast(msg) {
  const el        = document.getElementById('toast');
  el.textContent  = msg;
  el.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = 'none'; }, 2800);
}
// Expose globally for inline HTML onclick handlers
window.openModal  = (id) => document.getElementById(id).classList.add('open');
window.closeModal = (id) => document.getElementById(id).classList.remove('open');
/** Attach click-outside-to-close on all modal overlays. */
export function initModalOverlays() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
}