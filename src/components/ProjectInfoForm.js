import { html, useState, useRef } from '../ui.js';
import { PROJECT_STATUS } from '../models.js';
// DEMOFUNKTION – tas bort vid aktivering av synk
import { importProjekt } from '../importProjekt.js';

// Skapa eller redigera projektinformation. Sparar via repository.saveProject
// (sätter _dirty och köar synk – samma väg som beta använder mot SharePoint).
// Nytt projekt = project saknar ProjektGuid; saveProject genererar då ett GUID.
export function ProjectInfoForm({ repository, project, onClose, toast }) {
  const isNew = !project.ProjektGuid;
  // DEMOFUNKTION – tas bort vid aktivering av synk
  // Visa importknapp bara på datorer (pekare = mus, inte fingrar)
  const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const importRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const [form, setForm] = useState({
    Title: project.Title || '',
    Kund: project.Kund || '',
    Adress: project.Adress || '',
    Status: project.Status || 'Pågående',
    Beskrivning: project.Beskrivning || '',
  });
  const [busy, setBusy] = useState(false);

  function set(field, val) { setForm((f) => ({ ...f, [field]: val })); }

  // DEMOFUNKTION – tas bort vid aktivering av synk
  async function handleImport(e) {
    const fil = e.target.files?.[0];
    e.target.value = '';
    if (!fil) return;
    setImporting(true);
    try {
      const sparat = await importProjekt(repository, fil, toast);
      onClose(sparat);
    } catch (fel) {
      if (toast) toast('Importfel: ' + fel.message);
      setImporting(false);
    }
  }

  async function save() {
    if (!form.Title.trim()) { if (toast) toast('Projektnamn krävs'); return; }
    setBusy(true);
    try {
      const saved = await repository.saveProject({ ...project, ...form, Title: form.Title.trim() });
      if (toast) toast(isNew ? 'Projekt skapat' : 'Projektinformation sparad');
      onClose(saved);
    } catch (e) {
      if (toast) toast('Kunde inte spara: ' + e.message);
      setBusy(false);
    }
  }

  return html`
    <div class="modal-backdrop" onClick=${() => onClose(null)}>
      <div class="modal" onClick=${(e) => e.stopPropagation()}>
        <div class="modal-head">
          <h2>${isNew ? 'Nytt projekt' : 'Redigera projekt'}</h2>
          <button class="x" onClick=${() => onClose(null)} aria-label="Stäng">✕</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>Projektnamn</label>
            <input type="text" value=${form.Title} onInput=${(e) => set('Title', e.target.value)} />
          </div>
          <div class="row2">
            <div class="field">
              <label>Kund/Beställare</label>
              <input type="text" value=${form.Kund} onInput=${(e) => set('Kund', e.target.value)} />
            </div>
            <div class="field">
              <label>Status</label>
              <select value=${form.Status} onChange=${(e) => set('Status', e.target.value)}>
                ${PROJECT_STATUS.map((s) => html`<option key=${s} value=${s}>${s}</option>`)}
              </select>
            </div>
          </div>
          <div class="field">
            <label>Adress</label>
            <input type="text" value=${form.Adress} onInput=${(e) => set('Adress', e.target.value)} />
          </div>
          <div class="field">
            <label>Beskrivning</label>
            <textarea value=${form.Beskrivning} onInput=${(e) => set('Beskrivning', e.target.value)}></textarea>
          </div>
        </div>
        <div class="modal-foot">
          ${/* DEMOFUNKTION – tas bort vid aktivering av synk */ ''}
          ${isNew && isDesktop && html`
            <button class="btn ghost" style=${{ marginRight: 'auto' }}
                    onClick=${() => importRef.current && importRef.current.click()}
                    disabled=${importing || busy}>
              ${importing ? 'Importerar…' : '📥 Importera projekt från telefon'}
            </button>
            <input ref=${importRef} type="file" accept=".zip,application/zip"
                   style=${{ display: 'none' }} onChange=${handleImport} />`}
          <button class="btn ghost" onClick=${() => onClose(null)} disabled=${busy || importing}>Avbryt</button>
          <button class="btn primary" onClick=${save} disabled=${busy || importing}>${busy ? (isNew ? 'Skapar…' : 'Sparar…') : (isNew ? 'Skapa projekt' : 'Spara')}</button>
        </div>
      </div>
    </div>`;
}
