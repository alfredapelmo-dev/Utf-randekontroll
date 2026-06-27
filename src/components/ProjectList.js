import { html, useState, useEffect } from '../ui.js';
import { STATUS_COLOR } from '../models.js';

// Hemvy – visar favoritmarkerade projekt. Knappar för att bläddra alla projekt
// samt lägga till nytt projekt.
export function ProjectList({ repository, projects, favorites, onToggleFavorite, onOpen, onBrowse, onAddNew }) {
  const [counts, setCounts] = useState({});

  const favProjects = projects.filter((p) => favorites.has(p.ProjektGuid));

  useEffect(() => {
    let alive = true;
    (async () => {
      const result = {};
      for (const p of favProjects) {
        const devs = await repository.listDeviations(p.ProjektGuid);
        result[p.ProjektGuid] = {
          total: devs.length,
          Öppen: devs.filter((d) => d.Status === 'Öppen').length,
          Åtgärdad: devs.filter((d) => d.Status === 'Åtgärdad').length,
          Verifierad: devs.filter((d) => d.Status === 'Verifierad').length,
        };
      }
      if (alive) setCounts(result);
    })();
    return () => { alive = false; };
  }, [repository, projects, favorites]);

  return html`
    <div class="content">
      <div class="home-actions">
        <button class="btn primary block" onClick=${onBrowse}>📁 Projekt</button>
        <button class="btn block" onClick=${onAddNew}>+ Lägg till nytt projekt</button>
      </div>

      ${favProjects.length === 0
        ? html`
          <div class="empty" style=${{ marginTop: '24px' }}>
            <div class="big">⭐</div>
            <p>Inga favoriter ännu.</p>
            <p class="muted">Öppna <strong>Projekt</strong> och stjärnmärk de projekt du vill ha här.</p>
          </div>`
        : html`
          <div class="section-title" style=${{ marginTop: '20px' }}>Favoriter (${favProjects.length})</div>
          <div class="cards">
            ${favProjects.map((p) => {
              const c = counts[p.ProjektGuid];
              return html`
                <div class="card project-card" key=${p.ProjektGuid}>
                  <div style=${{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <button
                      class="star-btn starred"
                      onClick=${(e) => { e.stopPropagation(); onToggleFavorite(p.ProjektGuid); }}
                      aria-label="Ta bort från favoriter"
                      title="Ta bort från favoriter"
                    >★</button>
                    <div
                      style=${{ flex: 1, cursor: 'pointer' }}
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
                  </div>
                </div>`;
            })}
          </div>`}
    </div>`;
}
