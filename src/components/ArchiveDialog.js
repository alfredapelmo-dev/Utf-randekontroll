import { html, useState } from '../ui.js';

export function ArchiveDialog({ project, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try { await onConfirm(); }
    finally { setBusy(false); }
  }

  return html`
    <div class="modal-backdrop" onClick=${onClose}>
      <div class="modal" style=${{ maxWidth: '420px' }} onClick=${(e) => e.stopPropagation()}>
        <div class="modal-head">
          <h2>Arkivera projekt</h2>
          <button class="x" onClick=${onClose} aria-label="Stäng">✕</button>
        </div>
        <div class="modal-body">
          <p style=${{ margin: 0 }}>
            Vill du arkivera <strong>${project.Title}</strong>?
          </p>
          <div class="archive-info">
            <div class="archive-info-row">📦 All projektdata sparas i arkivet</div>
            <div class="archive-info-row">🗑 Avvikelser och foton tas bort från aktiva listor</div>
            <div class="archive-info-row">↩ Projektet kan återupptas när som helst</div>
          </div>
          <p class="muted" style=${{ margin: 0, fontSize: '13px' }}>
            I beta-versionen laddas arkivet upp till SharePoint och raderas från aktiva listor automatiskt.
          </p>
        </div>
        <div class="modal-foot">
          <button class="btn ghost" onClick=${onClose} disabled=${busy}>Avbryt</button>
          <button class="btn danger" onClick=${handleConfirm} disabled=${busy}>
            ${busy ? 'Arkiverar…' : 'Arkivera'}
          </button>
        </div>
      </div>
    </div>`;
}
