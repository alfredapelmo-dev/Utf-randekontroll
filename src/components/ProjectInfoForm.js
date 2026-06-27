import { html, useState } from '../ui.js';
import { PROJECT_STATUS } from '../models.js';

// Redigera projektinformation. Sparar via repository.saveProject (sätter _dirty
// och köar synk – samma väg som beta använder mot SharePoint).
export function ProjectInfoForm({ repository, project, onClose, toast }) {
  const [form, setForm] = useState({
    Title: project.Title || '',
    Kund: project.Kund || '',
    Adress: project.Adress || '',
    Status: project.Status || 'Pågående',
    Beskrivning: project.Beskrivning || '',
  });
  const [busy, setBusy] = useState(false);

  function set(field, val) { setForm((f) => ({ ...f, [field]: val })); }

  async function save() {
    if (!form.Title.trim()) { if (toast) toast('Projektnamn krävs'); return; }
    setBusy(true);
    try {
      const saved = await repository.saveProject({ ...project, ...form, Title: form.Title.trim() });
      if (toast) toast('Projektinformation sparad');
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
          <h2>Redigera projekt</h2>
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
          <button class="btn ghost" onClick=${() => onClose(null)} disabled=${busy}>Avbryt</button>
          <button class="btn primary" onClick=${save} disabled=${busy}>${busy ? 'Sparar…' : 'Spara'}</button>
        </div>
      </div>
    </div>`;
}
