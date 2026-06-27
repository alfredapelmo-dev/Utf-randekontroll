import { html, useState } from '../ui.js';
import { QUICK_SYMBOLS } from '../models.js';
import { SYMBOL_COMP } from '../iso7010.js';

// Snabbsymbol-väljare. Visar hela det interna symbolbiblioteket sorterat efter
// mest använda i aktuellt projekt (usage), därefter registrets fallback-ordning.
// Val placerar en intern arbetsmarkör – kommer aldrig med i protokollet.
export function SymbolPicker({ usage = {}, onPick, onClose }) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const ordered = QUICK_SYMBOLS
    .map((s, i) => ({ ...s, _used: usage[s.key] || 0, _i: i }))
    .filter((s) => !q || s.label.toLowerCase().includes(q) || (s.kategori || '').toLowerCase().includes(q))
    .sort((a, b) => (b._used - a._used) || (a._i - b._i));

  return html`
    <div class="modal-backdrop" onClick=${onClose}>
      <div class="modal symbol-picker" onClick=${(e) => e.stopPropagation()}>
        <div class="modal-head">
          <h2>Välj snabbsymbol</h2>
          <button class="x" onClick=${onClose} aria-label="Stäng">✕</button>
        </div>
        <div class="modal-body">
          <p class="muted" style=${{ margin: 0, fontSize: '13px' }}>
            Interna arbetsmarkörer. Visas i appen men kommer inte med i protokollet.
          </p>
          <div class="search-wrap">
            <span class="search-icon" aria-hidden="true">🔍</span>
            <input class="search-input" type="search" placeholder="Sök symbol…"
                   value=${query} onInput=${(e) => setQuery(e.target.value)} aria-label="Sök symbol" />
          </div>

          ${ordered.length === 0
            ? html`<div class="empty"><p class="muted">Inga symboler matchar "${query}".</p></div>`
            : html`
              <div class="symbol-grid">
                ${ordered.map((s) => {
                  const Comp = SYMBOL_COMP[s.key];
                  return html`
                    <button class="symbol-cell" key=${s.key} onClick=${() => onPick(s.key)}>
                      <span class="symbol-cell-icon">${Comp ? html`<${Comp} size=${34} />` : '⬚'}</span>
                      <span class="symbol-cell-label">${s.label}</span>
                      ${s._used > 0 && html`<span class="symbol-cell-badge">${s._used}</span>`}
                    </button>`;
                })}
              </div>`}
        </div>
      </div>
    </div>`;
}
