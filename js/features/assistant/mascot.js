// js/features/assistant/mascot.js
// XpenseBot's mascot: a friendly wallet face, inline SVG (no image assets,
// no build step). Uses currentColor so it inherits each theme's palette.

import { el } from '../../core/dom.js';

const SVG = `
<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="XpenseBot">
  <rect x="4" y="11" width="40" height="28" rx="8" fill="currentColor" opacity="0.16"/>
  <rect x="4" y="11" width="40" height="28" rx="8" stroke="currentColor" stroke-width="2.2"/>
  <circle cx="37" cy="25" r="3" fill="currentColor"/>
  <circle cx="16" cy="23" r="2.4" fill="currentColor"/>
  <circle cx="25" cy="23" r="2.4" fill="currentColor"/>
  <path d="M14.5 30.5q6 5.5 12 0" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
</svg>`.trim();

/**
 * @param {string} [className] extra class for sizing/placement.
 * @returns {HTMLElement}
 */
export function mascotIcon(className) {
    return el('span', { class: `xbot-mascot${className ? ' ' + className : ''}`, innerHTML: SVG });
}
