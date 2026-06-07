// ═══════════════════════════════════════════════════════════════
// CORE — Domain Colors (deterministic, harmonious hues)
// ═══════════════════════════════════════════════════════════════
const DOMAIN_COLOR_CACHE = {};
const GOLDEN_ANGLE = 137.508;

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDomainColor(domain) {
  if (DOMAIN_COLOR_CACHE[domain]) return DOMAIN_COLOR_CACHE[domain];
  const h   = hashString(domain);
  let hue   = (h * GOLDEN_ANGLE) % 360;
  if (hue >= 250 && hue <= 310) hue = (hue + 80) % 360;
  const sat  = 55 + (h % 20);
  const lum  = 55 + (h % 15);
  const color = {
    hue, hsl: `hsl(${hue}, ${sat}%, ${lum}%)`,
    bg:     `hsla(${hue}, ${sat}%, ${lum}%, 0.08)`,
    border: `hsla(${hue}, ${sat}%, ${lum}%, 0.25)`,
    text:   `hsl(${hue}, ${sat}%, ${lum}%)`,
  };
  DOMAIN_COLOR_CACHE[domain] = color;
  return color;
}

export function domainCardStyle(domain) {
  const c = getDomainColor(domain);
  return `border-left: 3px solid ${c.border}; background: linear-gradient(90deg, ${c.bg} 0%, var(--surface) 60%);`;
}

export function domainBadgeStyle(domain) {
  const c = getDomainColor(domain);
  return `background: ${c.bg}; color: ${c.text}; border: 1px solid ${c.border}; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; font-family: var(--mono);`;
}