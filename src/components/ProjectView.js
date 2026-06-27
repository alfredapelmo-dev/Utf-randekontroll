import { html, useState, useEffect, useRef } from '../ui.js';
import { STATUS_COLOR, personName, formatDate, can, newGuid, nowIso } from '../models.js';
import { loadPdf, renderPageToBlob } from '../pdfImport.js';

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
  const [converting, setConverting] = useState(null);   // overlay-text under PDF-rendering
  const [pagePick, setPagePick] = useState(null);        // { numPages, resolve } för sidval
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

  // Frågar användaren vilka sidor i en flersidig PDF som ska importeras.
  // Returnerar ett Promise som resolvar med en array sidnummer (eller null = avbryt).
  function askPages(numPages) {
    return new Promise((resolve) => setPagePick({ numPages, resolve }));
  }
  function resolvePages(pages) {
    setPagePick((cur) => { if (cur) cur.resolve(pages); return null; });
  }

  // Importerar en PDF som en eller flera ritningar (en per vald sida). Rastrering
  // sker i pdfImport.js. Returnerar antal tillagda ritningar.
  async function importPdf(f) {
    const { pdf, numPages } = await loadPdf(f);
    let pages = [1];
    if (numPages > 1) {
      pages = await askPages(numPages);
      if (!pages || !pages.length) return 0;   // avbrutet av användaren
    }
    const grund = f.name.replace(/\.[^.]+$/, '') || 'Ritning';
    let n = 0;
    setConverting('Konverterar PDF…');
    try {
      for (const p of pages) {
        const { blob, bredd, hojd } = await renderPageToBlob(pdf, p);
        const namn = numPages > 1 ? `${grund} (sida ${p})` : grund;
        await repository.saveDrawing({
          RitningId: newGuid(), ProjektGuid: project.ProjektGuid,
          namn, blob, bredd, hojd, Created: nowIso(),
        });
        n++;
      }
    } finally {
      setConverting(null);
    }
    return n;
  }

  async function handleDrawingUpload(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    let added = 0;
    try {
      for (const f of files) {
        if (f.type === 'application/pdf') {
          added += await importPdf(f);
        } else {
          // Befintlig bildväg (PNG/JPG) – oförändrad.
          const { w, h } = await imageSize(f);
          const namn = f.name.replace(/\.[^.]+$/, '') || 'Ritning';
          await repository.saveDrawing({
            RitningId: newGuid(), ProjektGuid: project.ProjektGuid,
            namn, blob: f, bredd: w, hojd: h, Created: nowIso(),
          });
          added++;
        }
      }
      if (toast && added) toast(added === 1 ? 'Ritning tillagd' : `${added} ritningar tillagda`);
    } catch (err) {
      if (toast) toast('Kunde inte importera ritning: ' + err.message);
    } finally {
      if (added) setLocalRefresh((n) => n + 1);
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
        <input ref=${drawingRef} type="file" accept="image/*,application/pdf"
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
      ${converting && html`
        <div class="modal-backdrop">
          <div class="modal" style=${{ maxWidth: '320px', textAlign: 'center' }}>
            <div class="modal-body"><p style=${{ margin: 0 }}>${converting}</p></div>
          </div>
        </div>`}

      ${pagePick && html`
        <${PdfPageDialog} numPages=${pagePick.numPages}
          onConfirm=${(pages) => resolvePages(pages)}
          onCancel=${() => resolvePages(null)} />`}
    </div>`;
}

// Sidval för flersidig PDF. Varje vald sida blir en egen ritning. Följer befintlig
// modalstil (jfr ArchiveDialog).
function PdfPageDialog({ numPages, onConfirm, onCancel }) {
  const pages = Array.from({ length: numPages }, (_, i) => i + 1);
  const [sel, setSel] = useState(() => new Set([1]));
  const allSelected = sel.size === numPages;
  const toggle = (p) => setSel((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const toggleAll = () => setSel(allSelected ? new Set() : new Set(pages));

  return html`
    <div class="modal-backdrop" onClick=${onCancel}>
      <div class="modal" style=${{ maxWidth: '420px' }} onClick=${(e) => e.stopPropagation()}>
        <div class="modal-head">
          <h2>Välj sidor att importera</h2>
          <button class="x" onClick=${onCancel} aria-label="Stäng">✕</button>
        </div>
        <div class="modal-body">
          <p class="muted" style=${{ marginTop: 0 }}>
            PDF:en har ${numPages} sidor. Varje vald sida blir en egen ritning.
          </p>
          <label style=${{ display: 'flex', gap: '8px', alignItems: 'center', fontWeight: 600, marginBottom: '8px' }}>
            <input type="checkbox" checked=${allSelected} onChange=${toggleAll} /> Markera alla
          </label>
          <div style=${{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', maxHeight: '220px', overflow: 'auto' }}>
            ${pages.map((p) => html`
              <label key=${p} style=${{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input type="checkbox" checked=${sel.has(p)} onChange=${() => toggle(p)} /> Sida ${p}
              </label>`)}
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn ghost" onClick=${onCancel}>Avbryt</button>
          <button class="btn primary" disabled=${sel.size === 0}
                  onClick=${() => onConfirm([...sel].sort((a, b) => a - b))}>
            Importera${sel.size > 0 ? ` (${sel.size})` : ''}
          </button>
        </div>
      </div>
    </div>`;
}

function formatBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' kB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}
