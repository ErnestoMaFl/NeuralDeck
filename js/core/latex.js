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
// ── Markdown parser (LaTeX-safe) ──────────────────────────────
export function markdownToHtml(text) {
  if (!text) return '';
  const placeholders = [];
  let safe = text;
  // Protect $$...$$ first
  safe = safe.replace(/\$\$([\s\S]*?)\$\$/g, (m) => {
    placeholders.push(m); return `%%LATEX_${placeholders.length-1}%%`;
  });
  // Protect $...$
  safe = safe.replace(/(?<![\\$])\$([^\n$]+?)\$(?!\$)/g, (m) => {
    placeholders.push(m); return `%%LATEX_${placeholders.length-1}%%`;
  });
  // HTML-escape
  safe = safe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  // Code blocks
  safe = safe.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => `<pre class="md-code-block"><code>${code.trim()}</code></pre>`);
  safe = safe.replace(/`([^`\n]+)`/g, '<code class="md-inline-code">$1</code>');
  // Headers
  safe = safe.replace(/^### (.+)$/gm, '<div class="md-h3">$1</div>');
  safe = safe.replace(/^## (.+)$/gm,  '<div class="md-h2">$1</div>');
  safe = safe.replace(/^# (.+)$/gm,   '<div class="md-h1">$1</div>');
  // Bold/Italic
  safe = safe.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');
  safe = safe.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // Blockquotes
  safe = safe.replace(/^&gt; (.+)$/gm, '<div class="md-blockquote">$1</div>');
  // Lists
  safe = safe.replace(/^(?:[*-]) (.+)$/gm, '<li class="md-li">$1</li>');
  safe = safe.replace(/((?:<li class="md-li">.*<\/li>\n?)+)/g, '<ul class="md-ul">$1</ul>');
  // Links
  safe = safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a class="md-link" href="$2" target="_blank" rel="noopener">$1</a>');
  // Line breaks
  safe = safe.replace(/\n\n/g, '<br><br>');
  safe = safe.replace(/\n/g, '<br>');
  // Limpiar <br> antes/después de elementos de bloque para evitar doble espaciado
  safe = safe.replace(/(<br>)+(<\/?(?:div|ul|li|pre|blockquote)[^>]*>)/gi, '$2');
  safe = safe.replace(/(<\/?(?:div|ul|li|pre|blockquote)[^>]*>)(<br>)+/gi, '$1');
  // Restore LaTeX
  placeholders.forEach((original, idx) => {
    safe = safe.replace(`%%LATEX_${idx}%%`, original);
  });
  return safe;
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
/** Returns an HTML string with markdown+LaTeX rendering. */
export function latexHtml(text, cssClass = 'latex-content', id = '') {
  if (!text) return `<span class="${cssClass}"></span>`;
  const idAttr = id ? ` id="${id}"` : '';
  const rendered = markdownToHtml(text);
  return `<span class="${cssClass} md-content" data-latex-pending="1"${idAttr}>${rendered}</span>`;
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
  preview.className = 'latex-preview-box md-content';
  preview.innerHTML = markdownToHtml(val);
  renderLatexInElement(preview);
}