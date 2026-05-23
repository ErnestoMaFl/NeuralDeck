// ═══════════════════════════════════════════════════════════════
// CORE — LaTeX rendering utilities (KaTeX)
// ═══════════════════════════════════════════════════════════════

/** Waits for KaTeX to be available, then resolves. */
export function katexReady() {
  return new Promise(resolve => {
    if (typeof katex !== 'undefined' && typeof renderMathInElement !== 'undefined') {
      resolve();
      return;
    }
    const check = setInterval(() => {
      if (typeof katex !== 'undefined' && typeof renderMathInElement !== 'undefined') {
        clearInterval(check);
        resolve();
      }
    }, 50);
  });
}

export function renderLatexInElement(el) {
  if (!el) return;
  katexReady().then(() => {
    try {
      renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$',  right: '$',  display: false }
        ],
        throwOnError: false,
        errorColor:   'var(--red)',
        strict:       false
      });
    } catch (_) {
      // Silently ignore — element has plain text fallback
    }
  });
}

/** Returns an HTML string with escaped content, ready for KaTeX processing. */
export function latexHtml(text, cssClass = 'latex-content', id = '') {
  if (!text) return `<span class="${cssClass}"></span>`;
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const idAttr = id ? ` id="${id}"` : '';
  return `<span class="${cssClass}" data-latex-pending="1"${idAttr}>${escaped}</span>`;
}

/** Processes all [data-latex-pending] elements inside a container. */
export function processLatexInContainer(container) {
  if (!container) return;
  container.querySelectorAll('[data-latex-pending]').forEach(el => {
    el.removeAttribute('data-latex-pending');
    renderLatexInElement(el);
  });
}

/** Updates a live preview element from a textarea value. */
export function updateLatexPreview(textareaId, previewId) {
  const ta      = document.getElementById(textareaId);
  const preview = document.getElementById(previewId);
  if (!ta || !preview) return;

  const val = ta.value.trim();
  if (!val) {
    preview.className   = 'latex-preview-box latex-preview-empty';
    preview.textContent = 'Escribe para ver el preview…';
    return;
  }

  preview.className = 'latex-preview-box';
  preview.innerHTML = val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  renderLatexInElement(preview);
}
