import { html, useState, useEffect, useRef } from '../ui.js';
import { STATUS_COLOR, personName, formatDate, can, newGuid, nowIso } from '../models.js';

// Läser ut en bilds naturliga mått (för korrekt koordinatskala på ritningen).
function imageSize(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ w: 1600, h: 1120 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

// Projektöversikt – nav mellan projektlista och ritningsvy. Visar projektinfo
// (redigerbar), projektets planritningar, dokumentation (brandskyddsbeskrivning
// m.m.) samt avvikelsesammanfattning.
export function ProjectView({ repository, project, role, refreshKey, onOpenDrawing, onEditInfo, onArchive, toast }) {
  const [drawings, setDrawings] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [counts, setCounts] = useState(null);
  const [thumbs, setThumbs] = useState({});
  const [localRefresh, setLocalRefresh] = useState(0);
  const fileRef = useRef(null);
  const drawingRef = useRef(null);

  async function reloadDocs() {
    setDocuments(await repository.listDocuments(project.ProjektGuid));
  }

  useEffect(() => {
    let alive = true;
    const urls = [];
    (async () => {
      const dr = await repository.listDrawingsForProject(project.ProjektGuid);
      const devs = await repository.listDeviations(project.ProjektGuid);
      const docs = await repository.listDocuments(project.ProjektGuid);
      if (!alive) return;
      setDrawings(dr);
      setDocuments(docs);
      setCounts({
        total: devs.length,
        Öppen: devs.filter((d) => d.Status === 'Öppen').length,
        Åtgärdad: devs.filter((d) => d.Status === 'Åtgärdad').length,
        Verifierad: devs.filter((d) => d.Status === 'Verifierad').length,
        perDrawing: dr.reduce((m, d) => {
          m[d.RitningId] = devs.filter((x) => x.RitningId === d.RitningId).length; return m;
        }, {}),
      });
      // Tumnaglar för ritningar
      const t = {};
      for (const d of dr) {
        if (d.blob) { const u = URL.createObjectURL(d.blob); urls.push(u); t[d.RitningId] = u; }
      }
      if (alive) setThumbs(t);
    })();
    return () => { alive = false; urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [repository, project.ProjektGuid, refreshKey, localRefresh]);

  async function handleDrawingUpload(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    try {
      for (const f of files) {
        const { w, h } = await imageSize(f);
        const namn = f.name.replace(/\.[^.]+$/, '') || 'Ritning';
        await repository.saveDrawing({
          RitningId: newGuid(), ProjektGuid: project.ProjektGuid,
          namn, blob: f, bredd: w, hojd: h, Created: nowIso(),
        });
      }
      setLocalRefresh((n) => n + 1);
      if (toast) toast(files.length === 1 ? 'Ritning tillagd' : `${files.length} ritningar tillagda`);
    } catch (err) {
      if (toast) toast('Kunde inte ladda upp ritning: ' + err.message);
    }
  }

  async function handleUpload(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    try {
      for (const f of files) {
        await repository.addDocument(project.ProjektGuid, 'brandskyddsbeskrivning', f, f.name);
      }
      await reloadDocs();
      if (toast) toast(files.length === 1 ? 'Dokument tillagt' : `${files.length} dokument tillagda`);
    } catch (err) {
      if (toast) toast('Kunde inte ladda upp: ' + err.message);
    }
  }

  async function downloadDoc(doc) {
    const rec = await repository.getDocument(doc.id);
    if (!rec || !rec.blob) { if (toast) toast('Filen saknas'); return; }
    const url = URL.createObjectURL(rec.blob);
    const a = document.createElement('a');
    a.href = url; a.download = rec.filnamn; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function deleteDoc(doc) {
    await repository.deleteDocument(doc.id);
    await reloadDocs();
    if (toast) toast('Dokument borttaget');
  }

  const canEdit = can(role, 'editCore');
  const canArchive = project.Status === 'Avslutad';

  return html`
    <div class="content">
      ${/* ---- Projekthuvud ---- */ ''}
      <div class="card project-header">
        <div style=${{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <div style=${{ flex: 1, minWidth: 0 }}>
            <div style=${{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style=${{ margin: 0, marginRight: 'auto' }}>${project.Title}</h2>
              <span class="pill proj">${project.Status}</span>
            </div>
            <div class="info-grid">
              <div><span class="info-label">Kund</span><span>${project.Kund || '–'}</span></div>
              <div><span class="info-label">Adress</span><span>${project.Adress || '–'}</span></div>
              <div><span class="info-label">Besiktningsman</span><span>${personName(project.Besiktningsman)}</span></div>
              <div><span class="info-label">Medlemmar</span><span>${(project.Medlemmar || []).map(personName).join(', ') || '–'}</span></div>
            </div>
            ${project.Beskrivning && html`<p class="project-desc">${project.Beskrivning}</p>`}
          </div>
        </div>
        <div class="project-header-actions">
          ${canEdit && html`<button class="btn sm" onClick=${() => onEditInfo(project)}>✏️ Redigera information</button>`}
          ${canArchive && html`<button class="btn sm danger" onClick=${() => onArchive(project)}>📦 Arkivera projekt</button>`}
        </div>
      </div>

      ${/* ---- Avvikelsesammanfattning ---- */ ''}
      ${counts && html`
        <div class="card stat-card">
          <div class="section-title" style=${{ margin: '0 0 8px' }}>Avvikelser (${counts.total})</div>
          <div class="stat-row">
            ${['Öppen', 'Åtgärdad', 'Verifierad'].map((s) => html`
              <div class="stat-pill" key=${s}>
                <span class="stat-num" style=${{ color: STATUS_COLOR[s] }}>${counts[s]}</span>
                <span class="stat-label">${s.toLowerCase()}</span>
              </div>`)}
          </div>
        </div>`}

      ${/* ---- Planritningar ---- */ ''}
      <div class="docs-head">
        <div class="section-title" style=${{ margin: 0 }}>Planritningar (${drawings.length})</div>
        ${canEdit && html`
          <button class="btn sm primary" onClick=${() => drawingRef.current && drawingRef.current.click()}>+ Ladda upp ritning</button>`}
        <input ref=${drawingRef} type="file" accept="image/*"
               multiple style=${{ display: 'none' }} onChange=${handleDrawingUpload} />
      </div>
      ${drawings.length === 0
        ? html`<div class="empty"><p class="muted">Inga ritningar i projektet.</p></div>`
        : html`
          <div class="drawing-grid">
            ${drawings.map((d) => html`
              <button class="drawing-tile" key=${d.RitningId} onClick=${() => onOpenDrawing(d.RitningId)}>
                <div class="drawing-thumb">
                  ${thumbs[d.RitningId]
                    ? html`<img src=${thumbs[d.RitningId]} alt=${d.namn} />`
                    : html`<div class="drawing-thumb-fallback">📐</div>`}
                </div>
                <div class="drawing-tile-foot">
                  <strong>${d.namn || d.RitningId}</strong>
                  <span class="muted">${(counts && counts.perDrawing[d.RitningId]) || 0} avvikelser</span>
                </div>
              </button>`)}
          </div>`}

      ${/* ---- Dokumentation ---- */ ''}
      <div class="docs-head">
        <div class="section-title" style=${{ margin: 0 }}>Dokumentation (${documents.length})</div>
        ${canEdit && html`
          <button class="btn sm primary" onClick=${() => fileRef.current && fileRef.current.click()}>+ Lägg till dokument</button>`}
        <input ref=${fileRef} type="file" accept=".pdf,application/pdf,image/*"
               multiple style=${{ display: 'none' }} onChange=${handleUpload} />
      </div>
      ${documents.length === 0
        ? html`
          <div class="empty" style=${{ padding: '24px 18px' }}>
            <div class="big">📄</div>
            <p class="muted">Ingen dokumentation ännu.</p>
            <p class="muted" style=${{ fontSize: '13px' }}>Lägg till brandskyddsbeskrivning eller andra PDF-dokument.</p>
          </div>`
        : html`
          <div class="doc-list">
            ${documents.map((doc) => html`
              <div class="doc-row" key=${doc.id}>
                <span class="doc-icon">${doc.mime && doc.mime.includes('pdf') ? '📕' : '📎'}</span>
                <div class="doc-main">
                  <strong>${doc.filnamn}</strong>
                  <span class="muted">${formatBytes(doc.storlek)} · ${formatDate(doc.uploaded)}</span>
                </div>
                <div class="doc-actions">
                  <button class="btn sm" onClick=${() => downloadDoc(doc)} aria-label="Ladda ned">⬇</button>
                  ${canEdit && html`<button class="btn sm danger" onClick=${() => deleteDoc(doc)} aria-label="Ta bort">🗑</button>`}
                </div>
              </div>`)}
          </div>`}
    </div>`;
}

function formatBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' kB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
