import { html, useState, useEffect, useRef } from '../ui.js';
import { personName } from '../models.js';
import { buildProtocolPdf } from '../pdf.js';

// Protokoll – genererar PDF lokalt (offline) från projektets avvikelser:
// projektinfo, ritningsutsnitt per avvikelse, foton, statuslista och signatur.
export function Protocol({ repository, project, role, onClose, toast }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawingRef = useRef({ down: false, last: null });
  const [hasSign, setHasSign] = useState(false);
  const [signerName, setSignerName] = useState(personName(project.Besiktningsman));
  const [signerRole, setSignerRole] = useState(role === 'Läsare' ? 'Besiktningsman' : role);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // Sätt upp signaturytan i rätt pixelupplösning
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1f2329';
    ctxRef.current = ctx;
  }, []);

  function pos(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function down(e) {
    e.preventDefault();
    try { canvasRef.current.setPointerCapture(e.pointerId); } catch (_) {}
    drawingRef.current = { down: true, last: pos(e) };
  }
  function move(e) {
    const g = drawingRef.current;
    if (!g.down) return;
    const p = pos(e);
    const ctx = ctxRef.current;
    ctx.beginPath(); ctx.moveTo(g.last.x, g.last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    g.last = p; setHasSign(true);
  }
  function up() { drawingRef.current.down = false; }
  function clearSign() {
    const c = canvasRef.current, ctx = ctxRef.current;
    ctx.clearRect(0, 0, c.width, c.height);
    setHasSign(false);
  }

  async function generate() {
    setBusy(true); setResult(null);
    try {
      const deviations = await repository.listDeviations(project.ProjektGuid);
      const photosByDev = {};
      for (const d of deviations) {
        photosByDev[d.AvvikelseGuid] = await repository.listPhotos(d.AvvikelseGuid);
      }
      // Använd projektets första ritning (faller tillbaka på avvikelsens RitningId).
      const projDrawings = await repository.listDrawingsForProject(project.ProjektGuid);
      let drawing = projDrawings[0] || null;
      if (!drawing && deviations[0] && deviations[0].RitningId) {
        drawing = await repository.getDrawing(deviations[0].RitningId);
      }
      const signatureDataUrl = hasSign ? canvasRef.current.toDataURL('image/png') : null;

      const res = await buildProtocolPdf({
        project, deviations, photosByDev,
        drawingBlob: drawing ? drawing.blob : null,
        signatureDataUrl, signerName, signerRole,
      });
      setResult(res);
      toast && toast('Protokoll genererat');
    } catch (err) {
      console.warn(err); toast && toast('Kunde inte generera PDF');
    } finally { setBusy(false); }
  }

  return html`
    <div class="modal-backdrop" onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="modal">
        <div class="modal-head">
          <h2>Skapa protokoll</h2>
          <button class="x" onClick=${onClose} aria-label="Stäng">✕</button>
        </div>

        <div class="modal-body">
          <div class="card" style=${{ padding: '12px' }}>
            <strong>${project.Title}</strong>
            <div class="project-meta" style=${{ marginTop: '4px' }}>
              <span>${project.Kund || '–'} · ${project.Adress || ''}</span>
              <span class="muted">PDF:en genereras helt lokalt i webbläsaren – inget internet krävs.</span>
            </div>
          </div>

          <div class="row2">
            <div class="field">
              <label htmlFor="s-name">Underskrift – namn</label>
              <input id="s-name" type="text" value=${signerName} onInput=${(e) => setSignerName(e.target.value)} />
            </div>
            <div class="field">
              <label htmlFor="s-role">Roll</label>
              <input id="s-role" type="text" value=${signerRole} onInput=${(e) => setSignerRole(e.target.value)} />
            </div>
          </div>

          <div class="field">
            <label>Signatur</label>
            <canvas class="sign-pad" ref=${canvasRef}
                    onPointerDown=${down} onPointerMove=${move}
                    onPointerUp=${up} onPointerCancel=${up}></canvas>
            <div class="toolbar" style=${{ marginTop: '8px' }}>
              <button class="btn sm" onClick=${clearSign}>Rensa signatur</button>
              <span class="hint">${hasSign ? 'Signatur registrerad.' : 'Signera med finger eller mus.'}</span>
            </div>
          </div>

          ${result && html`
            <div class="card" style=${{ borderColor: '#bfe3c4', background: '#f1faf2' }}>
              <strong>Klart:</strong> ${result.filename}<br/>
              <a href=${result.url} target="_blank" rel="noopener">Öppna PDF</a>
              <div class="hint" style=${{ marginTop: '4px' }}>På iPhone öppnas PDF:en i visaren där du kan dela eller spara.</div>
            </div>`}
        </div>

        <div class="modal-foot">
          <div class="spacer"></div>
          <button class="btn ghost" onClick=${onClose} disabled=${busy}>Stäng</button>
          <button class="btn primary" onClick=${generate} disabled=${busy}>${busy ? 'Genererar…' : '📄 Generera PDF'}</button>
        </div>
      </div>
    </div>`;
}
