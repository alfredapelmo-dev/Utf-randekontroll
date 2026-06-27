// ISO 7010:2020-symboler samt BRAB-symboler som SVG-lager.
// Används som ett valfritt symbol-/teckenlager ovanpå ritningen samt i teckenförklaringen.

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

// Kontrollerad / godkänd – intern bock (ej ISO 7010). Bekräftar att något är
// kontrollerat och OK. Hanteras som snabbsymbol (egen markör, aldrig i protokoll).
export function CheckMark({ size = 24 }) {
  return html`
    <svg viewBox="0 0 48 48" width=${size} height=${size} aria-hidden="true">
      <rect width="48" height="48" rx="6" fill="#2E7D32"/>
      <path d="M12 25 l8 9 l16 -21" stroke="#fff" stroke-width="5" fill="none"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

// Fabrik för BRAB SVG-symboler som laddas från assets/symbols/.
// filename = exakt filnamn utan sökväg (t.ex. 'HANDBRANDSLACKARE.svg').
function makeBrabSymbol(filename) {
  return function BrabSymbol({ size = 34 }) {
    return html`<img
      src=${'assets/symbols/' + filename}
      width=${size} height=${size}
      style=${{ objectFit: 'contain', display: 'block' }}
      aria-hidden="true" />`;
  };
}

export const ISO_LEGEND = [
  { key: 'W021', label: 'Varning (avvikelse)', Comp: WarningTriangle },
  { key: 'F001', label: 'Brandsläckare', Comp: FireExtinguisher },
  { key: 'E001', label: 'Nödutgång', Comp: EmergencyExit },
];

// Uppslagning nyckel → SVG-komponent (används av verktygspalett, markörer m.m.).
export const SYMBOL_COMP = {
  // Avvikelse- och interna markörer
  W021: WarningTriangle,
  F001: FireExtinguisher,
  E001: EmergencyExit,
  CHECK: CheckMark,

  // BRAB-snabbsymboler
  HANDBRANDSLACKARE:                makeBrabSymbol('HANDBRANDSLACKARE.svg'),
  INOMHUSBRANDPOST:                 makeBrabSymbol('INOMHUSBRANDPOST.svg'),
  LARMTRYCKKNAPP:                   makeBrabSymbol('LARMTRYCKKNAPP.svg'),
  BRANDLARMCENTRAL:                 makeBrabSymbol('BRANDLARMCENTRAL.svg'),
  BRANDFORSVARSTABLA:               makeBrabSymbol('BRANDFORSVARSTABLA.svg'),
  BRANDVARNARE_DETEKTOR:            makeBrabSymbol('BRANDVARNARE__DETEKTOR.svg'),
  LARMDON:                          makeBrabSymbol('LARMDON.svg'),
  OPTISKT_LARMDON:                  makeBrabSymbol('OPTISKT_LARMDON.svg'),
  BLIXTLJUS:                        makeBrabSymbol('BLIXTLJUS.svg'),
  BRANDGASFLAKT:                    makeBrabSymbol('BRANDGASFLAKT.svg'),
  ROKLUCKA:                         makeBrabSymbol('ROKLUCKA.svg'),
  UTRYMNINGSVAG:                    makeBrabSymbol('UTRYMNINGSVAG.svg'),
  TILLTRADESVAG_RADDNINGSTJANST:    makeBrabSymbol('TILLTRADESVAG_RADDNINGSTJANST.svg'),
  GENOMLYST_UTRYMNINGSSKYLT:        makeBrabSymbol('GENOMLYST_UTRYMNINGSSKYLT.svg'),
  GENOMLYST_UTRYMNINGSSKYLT_2:      makeBrabSymbol('GENOMLYST_UTRYMNINGSSKYLT_2.svg'),
  GENOMLYST_M_RULLSTOLSPICTOGRAM:   makeBrabSymbol('GENOMLYST_M_RULLSTOLSPICTOGRAM.svg'),
  NY_GENOMLYST_UTRYMNINGSSKYLT:     makeBrabSymbol('NY_GENOMLYST_UTRYMNINGSSKYLT.svg'),
  NY_GENOMLYST_UTRYMNINGSSKYLT_2:   makeBrabSymbol('NY_GENOMLYST_UTRYMNINGSSKYLT_2.svg'),
  NY_GENOMLYST_M_RULLSTOLSPICTOGRAM: makeBrabSymbol('NY_GENOMLYST_M_RULLSTOLSPICTOGRAM.svg'),
  EFTERLYSANDE_UTRYMNINGSKYLT:      makeBrabSymbol('EFTERLYSANDE_UTRYMNINGSKYLT.svg'),
  NY_EFTERLYSANDE_UTRYMNINGSKYLT:   makeBrabSymbol('NY_EFTERLYSANDE_UTRYMNINGSKYLT.svg'),
  EFTERLYSANDE_M_RULLSTOLSPICTOGRAM: makeBrabSymbol('EFTERLYSANDE_M_RULLSTOLSPICTOGRAM.svg'),
  NY_EFTERLYSANDE_M_RULLSTOLSPICTOGRAM: makeBrabSymbol('NY_EFTERLYSANDE_M_RULLSTOLSPICTOGRAM.svg'),
  FONSTERUTRYMNING:                 makeBrabSymbol('FONSTERUTRYMNING.svg'),
  UTRYMNING_VIA_BALKONG:            makeBrabSymbol('UTRYMNING_VIA_BALKONG.svg'),
  UTRYMNINGSPLATS:                  makeBrabSymbol('UTRYMNINGSPLATS.svg'),
  UTRYMNINGSPLAN:                   makeBrabSymbol('UTRYMNINGSPLAN.svg'),
  TRAPPA_FOR_UTRYMNING:             makeBrabSymbol('TRAPPA_FOR_UTRYMNING.svg'),
  ATERINRYMNING_VIA_DORR:           makeBrabSymbol('ATERINRYMNING_VIA_DORR.svg'),
  FRANGANGLIG_DORR:                 makeBrabSymbol('FRANGANGLIG_DORR.svg'),
  UPPSTALLNING_AV_DORR:             makeBrabSymbol('UPPSTALLNING_AV_DORR.svg'),
  NODOPPNINGSKNAPP:                 makeBrabSymbol('NODOPPNINGSKNAPP.svg'),
  TECKENFORKLARING:                 makeBrabSymbol('Teckenforklaring.svg'),
};
