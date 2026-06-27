import { html, useState, useEffect } from '../ui.js';
import { STATUS_COLOR, formatDate } from '../models.js';

export function ProjectBrowser({ repository, projects, archives, favorites, onToggleFavorite, onOpen, onAddNew, onArchive, onRestore, onDownloadArchive }) {
  const [counts, setCounts] = useState({});
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const activeProjects = projects.filter((p) => p.Status !== 'Arkiverad');

  useEffect(() => {
    let alive = true;
    (async () => {
      const result = {};
      for (const p of activeProjects) {
        const devs = await repository.listDeviations(p.ProjektGuid);
        result[p.ProjektGuid] = {
          Öppen: devs.filter((d) => d.Status === 'Öppen').length,
          Åtgärdad: devs.filter((d) => d.Status === 'Åtgärdad').length,
          Verifierad: devs.filter((d) => d.Status === 'Verifierad').length,
        };
      }
      if (alive) setCounts(result);
    })();
    return () => { alive = false; };
  }, [repository, projects]);

  const q = query.trim().toLowerCase();
  const filtered = activeProjects.filter((p) =>
    !q ||
    (p.Title || '').toLowerCase().includes(q) ||
    (p.Kund || '').toLowerCase().includes(q) ||
    (p.Adress || '').toLowerCase().includes(q)
  );

  return html`
    <div class="content">
      <div class="browser-toolbar">
        <div class="search-wrap">
          <span class="search-icon" aria-hidden="true">🔍</span>
          <input
            class="search-input"
            type="search"
            placeholder="Sök projekt, kund eller adress…"
            value=${query}
            onInput=${(e) => setQuery(e.target.value)}
            aria-label="Sök projekt"
          />
        </div>
        <button class="btn primary" onClick=${onAddNew}>+ Lägg till nytt projekt</button>
      </div>

      <div class="section-title" style=${{ marginTop: '14px' }}>
        ${q ? `Resultat (${filtered.length})` : `Aktiva projekt (${activeProjects.length})`}
      </div>

      ${filtered.length === 0 && html`
        <div class="empty">
          <div class="big">${q ? '🔍' : '📋'}</div>
          <p>${q ? `Inga projekt matchar "${query}".` : 'Inga aktiva projekt.'}</p>
        </div>`}

      <div class="cards">
        ${filtered.map((p) => {
          const c = counts[p.ProjektGuid];
          const starred = favorites.has(p.ProjektGuid);
          const canArchive = p.Status === 'Avslutad';
          return html`
            <div class="card project-card" key=${p.ProjektGuid}>
              <div style=${{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <button
                  class=${'star-btn' + (starred ? ' starred' : '')}
                  onClick=${(e) => { e.stopPropagation(); onToggleFavorite(p.ProjektGuid); }}
                  aria-label=${starred ? 'Ta bort från favoriter' : 'Favoritmarkera'}
                  title=${starred ? 'Ta bort från favoriter' : 'Favoritmarkera'}
                >★</button>
                <div style=${{ flex: 1, minWidth: 0 }}>
                  <div
                    style=${{ cursor: 'pointer' }}
                    role="button" tabindex="0"
                    onClick=${() => onOpen(p)}
                    onKeyDown=${(e) => { if (e.key === 'Enter') onOpen(p); }}
                  >
                    <div style=${{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style=${{ margin: 0, marginRight: 'auto' }}>${p.Title}</h3>
                      <span class="pill proj">${p.Status}</span>
                    </div>
                    <div class="project-meta">
                      <span>${p.Kund || '–'}</span>
                      <span>${p.Adress || ''}</span>
                    </div>
                    <div class="project-stats">
                      ${c
                        ? html`
                          <span class="pill"><span class="swatch" style=${{ background: STATUS_COLOR['Öppen'] }}></span>${c['Öppen']} öppna</span>
                          <span class="pill"><span class="swatch" style=${{ background: STATUS_COLOR['Åtgärdad'] }}></span>${c['Åtgärdad']} åtgärdade</span>
                          <span class="pill"><span class="swatch" style=${{ background: STATUS_COLOR['Verifierad'] }}></span>${c['Verifierad']} verifierade</span>`
                        : html`<span class="muted" style=${{ fontSize: '12px' }}>Räknar…</span>`}
                    </div>
                  </div>
                  ${canArchive && html`
                    <div style=${{ marginTop: '10px' }}>
                      <button class="btn sm danger" onClick=${() => onArchive(p)}>
                        📦 Arkivera
                      </button>
                    </div>`}
                </div>
              </div>
            </div>`;
        })}
      </div>

      ${/* Arkivsektion */ ''}
      <button
        class="archive-toggle"
        onClick=${() => setShowArchived((v) => !v)}
        aria-expanded=${showArchived}
      >
        <span>📁 Arkiverade projekt (${archives.length})</span>
        <span class=${'archive-chevron' + (showArchived ? ' open' : '')}>›</span>
      </button>

      ${showArchived && html`
        <div class="cards" style=${{ marginTop: '10px' }}>
          ${archives.length === 0 && html`
            <p class="muted" style=${{ fontSize: '13px', padding: '4px 2px' }}>Inga arkiverade projekt.</p>`}
          ${archives.map((a) => html`
            <div class="card archive-card" key=${a.ProjektGuid}>
              <div style=${{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span class="archive-icon" aria-hidden="true">📦</span>
                <div style=${{ flex: 1, minWidth: 0 }}>
                  <div style=${{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style=${{ margin: 0, marginRight: 'auto', fontSize: '15px' }}>${a.Title}</h3>
                    <span class="pill proj">Arkiverat</span>
                  </div>
                  <div class="project-meta">
                    <span>${a.Kund || '–'}</span>
                    <span>Arkiverat ${formatDate(a.ArchivedDate)}</span>
                  </div>
                  <div style=${{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <button class="btn sm primary" onClick=${() => onRestore(a)}>↩ Återuppta</button>
                    <button class="btn sm" onClick=${() => onDownloadArchive(a)}>⬇ Ladda ned</button>
                  </div>
                </div>
              </div>
            </div>`)}
        </div>`}
    </div>`;
}
