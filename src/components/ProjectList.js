import { html, useState, useEffect } from '../ui.js';
import { STATUS_COLOR } from '../models.js';

// Projektvy – listar mockprojekt. Öppna projekt → ritningsvy. Hanterar tomt-läge.
export function ProjectList({ repository, projects, onOpen, refreshKey }) {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const result = {};
      for (const p of projects) {
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
  }, [repository, projects, refreshKey]);

  if (!projects.length) {
    return html`
      <div class="content">
        <div class="empty">
          <div class="big">📋</div>
          <p>Inga projekt ännu.</p>
          <p class="muted">Mockdata seedas vid första start – ladda om sidan om listan är tom.</p>
        </div>
      </div>`;
  }

  return html`
    <div class="content">
      <div class="section-title">Projekt (${projects.length})</div>
      <div class="cards">
        ${projects.map((p) => {
          const c = counts[p.ProjektGuid];
          return html`
            <div class="card project-card" key=${p.ProjektGuid}
                 role="button" tabindex="0"
                 onClick=${() => onOpen(p)}
                 onKeyDown=${(e) => { if (e.key === 'Enter') onOpen(p); }}>
              <div style=${{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style=${{ marginRight: 'auto' }}>${p.Title}</h3>
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
            </div>`;
        })}
      </div>
    </div>`;
}
