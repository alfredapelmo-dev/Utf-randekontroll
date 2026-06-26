// ISO 7010:2020-symboler som SVG-lager. Förenklade, självständiga SVG:er
// (inga externa bildberoenden). Används som ett valfritt symbol-/teckenlager
// ovanpå ritningen samt i teckenförklaringen.

import { html } from './ui.js';

// Varningstriangel (W-serien). Standardmarkör för en avvikelse.
export function WarningTriangle({ size = 24, glyph = '!' }) {
  return html`
    <svg viewBox="0 0 48 44" width=${size} height=${size} aria-hidden="true">
      <path d="M24 3 L46 41 H2 Z" fill="#FFD60A" stroke="#1b1b1b" stroke-width="3" stroke-linejoin="round"/>
      <text x="24" y="36" text-anchor="middle" font-size="26" font-weight="800" fill="#1b1b1b">${glyph}</text>
    </svg>`;
}

// F001 – Brandsläckare (förenklad).
export function FireExtinguisher({ size = 24 }) {
  return html`
    <svg viewBox="0 0 48 48" width=${size} height=${size} aria-hidden="true">
      <rect width="48" height="48" rx="6" fill="#C62828"/>
      <rect x="20" y="14" width="13" height="24" rx="5" fill="#fff"/>
      <rect x="24" y="9" width="5" height="6" fill="#fff"/>
      <path d="M29 11 H37 V14" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    </svg>`;
}

// E001 – Nödutgång (förenklad: löpande person + dörr).
export function EmergencyExit({ size = 24 }) {
  return html`
    <svg viewBox="0 0 48 48" width=${size} height=${size} aria-hidden="true">
      <rect width="48" height="48" rx="6" fill="#2E7D32"/>
      <rect x="30" y="9" width="9" height="30" fill="#fff" opacity="0.9"/>
      <circle cx="17" cy="13" r="3.4" fill="#fff"/>
      <path d="M14 20 l5 -2 4 4 4 2 M14 20 l-2 8 M19 18 l1 9 l5 5 M20 27 l-5 6"
            stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

export const ISO_LEGEND = [
  { key: 'W021', label: 'Varning (avvikelse)', Comp: WarningTriangle },
  { key: 'F001', label: 'Brandsläckare', Comp: FireExtinguisher },
  { key: 'E001', label: 'Nödutgång', Comp: EmergencyExit },
];

// Uppslagning nyckel → SVG-komponent (används av verktygspalett, markörer m.m.).
export const SYMBOL_COMP = {
  W021: WarningTriangle,
  F001: FireExtinguisher,
  E001: EmergencyExit,
};
