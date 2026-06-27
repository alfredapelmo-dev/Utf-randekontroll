import { html, useState, useEffect, useRef } from '../ui.js';
import {
  SEVERITY, DEVIATION_STATUS, STATUS_COLOR, STATUS_TEXT_ON,
  can, allowedStatusesFor, newGuid, personName, formatDate,
  SYMBOLS, DEFAULT_SYMBOL,
} from '../models.js';
import { buildSuggestionCorpus, rankSuggestions } from '../suggestions.js';

// Avvikelseformulär – skapa/redigera med alla fält + GUID. Foto från
// kamera/bibliotek lagras som Blob. Status (Öppen→Åtgärdad→Verifierad) styr
// färg på ritningen. Rollen styr vilka fält som är redigerbara.
export function DeviationForm({ repository, project, role, deviation, onClose, toast }) {
  const isNew = !!deviation.__isNew;
  const guidRef = useRef(deviation.AvvikelseGuid || newGuid());

  const [form, setForm] = useState({
    Title: deviation.Title || '',
    Beskrivning: deviation.Beskrivning || '',
    Allvarlighetsgrad: deviation.Allvarlighetsgrad || 'Medel',
    Status: deviation.Status || 'Öppen',
    Ansvarig: deviation.Ansvarig || null,
  });
  const [persisted, setPersisted] = useState(!isNew);
  const [changed, setChanged] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const urlsRef = useRef([]);

  // Rubrikförslag (utifrån redan ifyllda brister + inbyggd startlista).
  const [corpus, setCorpus] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSug, setActiveSug] = useState(-1);

  const members = project.Medlemmar || [];
  const editCore = can(role, 'editCore');
  const editDesc = can(role, 'editDescription');
  const changeStatus = can(role, 'changeStatus');
  const allowedStatuses = allowedStatusesFor(role);
  const canSave = editCore || editDesc || changeStatus || can(role, 'addPhoto');
  const canDelete = can(role, 'deleteDeviation') && !isNew;

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); setChanged(true); }

  // ---- Rubrikförslag: bygg korpusen en gång när formuläret öppnas (per projekt).
  useEffect(() => {
    let alive = true;
    (async () => {
      const c = await buildSuggestionCorpus(repository, deviation.ProjektGuid || project.ProjektGuid);
      if (alive) setCorpus(c);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line
  }, [repository, project.ProjektGuid]);

  // Aktuella förslag rangordnas synkront per tangenttryck mot korpusen.
  const suggestions = editCore ? rankSuggestions(form.Title, corpus, 6) : [];
  const showSuggest = suggestOpen && suggestions.length > 0;

  function chooseSuggestion(text) {
    set('Title', text);
    setSuggestOpen(false);
    setActiveSug(-1);
  }
  function onTitleKey(e) {
    if (!showSuggest) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveSug((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveSug((i) => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter' && activeSug >= 0) { e.preventDefault(); chooseSuggestion(suggestions[activeSug].text); }
    else if (e.key === 'Escape') { setSuggestOpen(false); setActiveSug(-1); }
  }

  // ---- Ladda foton för (sparad) avvikelse
  async function loadPhotos() {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    const list = await repository.listPhotos(guidRef.current);
    const withUrls = list.map((p) => ({ ...p, url: URL.createObjectURL(p.blob) }));
    urlsRef.current = withUrls.map((p) => p.url);
    setPhotos(withUrls);
  }
  useEffect(() => {
    if (persisted) loadPhotos();
    return () => { urlsRef.current.forEach((u) => URL.revokeObjectURL(u)); };
    // eslint-disable-next-line
  }, []);

  function record() {
    return {
      AvvikelseGuid: guidRef.current,
      ProjektGuid: deviation.ProjektGuid || project.ProjektGuid,
      RitningId: deviation.RitningId || 'plan1.png',
      KoordinatX: deviation.KoordinatX,
      KoordinatY: deviation.KoordinatY,
      Symbol: deviation.Symbol || DEFAULT_SYMBOL,
      FlaggaOffsetX: deviation.FlaggaOffsetX,
      FlaggaOffsetY: deviation.FlaggaOffsetY,
      Title: form.Title.trim(),
      Beskrivning: form.Beskrivning,
      Allvarlighetsgrad: form.Allvarlighetsgrad,
      Status: form.Status,
      Ansvarig: form.Ansvarig,
    };
  }

  async function persist() {
    const saved = await repository.saveDeviation(record());
    setPersisted(true);
    return saved;
  }

  async function handlePhoto(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (editCore && !form.Title.trim()) { toast && toast('Ange en rubrik innan du lägger till foto'); return; }
    setBusy(true);
    try {
      if (!persisted) await persist();
      await repository.addPhoto(guidRef.current, file, file.name);
      await loadPhotos();
      setChanged(true);
    } catch (err) {
      console.warn(err); toast && toast('Kunde inte spara fotot');
    } finally { setBusy(false); }
  }

  async function removePhoto(id) {
    setBusy(true);
    try { await repository.deletePhoto(id); await loadPhotos(); setChanged(true); }
    finally { setBusy(false); }
  }

  async function save() {
    if (editCore && !form.Title.trim()) { toast && toast('Rubrik krävs'); return; }
    setBusy(true);
    try { await persist(); onClose(true); }
    catch (err) { console.warn(err); toast && toast('Kunde inte spara'); setBusy(false); }
  }

  async function remove() {
    if (!window.confirm('Ta bort avvikelsen och dess foton?')) return;
    setBusy(true);
    try { await repository.deleteDeviation(guidRef.current); onClose(true); }
    catch (err) { console.warn(err); setBusy(false); }
  }

  const xRel = typeof deviation.KoordinatX === 'number' ? deviation.KoordinatX : null;
  const yRel = typeof deviation.KoordinatY === 'number' ? deviation.KoordinatY : null;
  const symbolLabel = (SYMBOLS.find((s) => s.key === (deviation.Symbol || DEFAULT_SYMBOL)) || {}).label || 'Avvikelse';

  return html`
    <div class="modal-backdrop" onClick=${(e) => { if (e.target === e.currentTarget) onClose(changed); }}>
      <div class="modal">
        <div class="modal-head">
          <h2>${isNew ? 'Ny avvikelse' : 'Avvikelse'}</h2>
          <button class="x" onClick=${() => onClose(changed)} aria-label="Stäng">✕</button>
        </div>

        <div class="modal-body">
          <div class="field suggest-wrap">
            <label htmlFor="f-title">Rubrik *</label>
            <input id="f-title" type="text" value=${form.Title} disabled=${!editCore}
                   placeholder="t.ex. Blockerad utrymningsväg" autocomplete="off"
                   role="combobox" aria-expanded=${showSuggest} aria-autocomplete="list"
                   onInput=${(e) => { set('Title', e.target.value); setSuggestOpen(true); setActiveSug(-1); }}
                   onFocus=${() => setSuggestOpen(true)}
                   onBlur=${() => setTimeout(() => setSuggestOpen(false), 120)}
                   onKeyDown=${onTitleKey} />
            ${showSuggest && html`
              <ul class="suggest-list" role="listbox">
                ${suggestions.map((s, i) => html`
                  <li key=${s.text} role="option" aria-selected=${i === activeSug}
                      class=${'suggest-item' + (i === activeSug ? ' active' : '')}
                      onMouseDown=${(e) => { e.preventDefault(); chooseSuggestion(s.text); }}>
                    <span class="suggest-text">${highlightMatch(s.text, form.Title)}</span>
                    ${s.source === 'historik' ? html`<span class="suggest-tag">tidigare</span>` : null}
                  </li>`)}
              </ul>`}
          </div>

          <div class="field">
            <label htmlFor="f-desc">Beskrivning</label>
            <textarea id="f-desc" value=${form.Beskrivning} disabled=${!editDesc}
                      placeholder="Beskriv avvikelsen…"
                      onInput=${(e) => set('Beskrivning', e.target.value)}></textarea>
          </div>

          <div class="row2">
            <div class="field">
              <label htmlFor="f-sev">Allvarlighetsgrad</label>
              <select id="f-sev" value=${form.Allvarlighetsgrad} disabled=${!editCore}
                      onChange=${(e) => set('Allvarlighetsgrad', e.target.value)}>
                ${SEVERITY.map((s) => html`<option key=${s} value=${s}>${s}</option>`)}
              </select>
            </div>
            <div class="field">
              <label htmlFor="f-ansvarig">Ansvarig</label>
              <select id="f-ansvarig" disabled=${!editCore}
                      value=${form.Ansvarig ? (form.Ansvarig.email || personName(form.Ansvarig)) : ''}
                      onChange=${(e) => {
                        const m = members.find((x) => (x.email || personName(x)) === e.target.value);
                        set('Ansvarig', m || null);
                      }}>
                <option value="">– Ingen –</option>
                ${members.map((m) => html`
                  <option key=${m.email || personName(m)} value=${m.email || personName(m)}>${personName(m)}</option>`)}
              </select>
            </div>
          </div>

          <div class="field">
            <label>Status</label>
            <div class="status-picker">
              ${DEVIATION_STATUS.map((s) => {
                const active = form.Status === s;
                const allowed = changeStatus && allowedStatuses.includes(s);
                return html`
                  <button key=${s} class="status-opt" aria-pressed=${active}
                          disabled=${!allowed && !active}
                          style=${active ? { background: STATUS_COLOR[s], color: STATUS_TEXT_ON[s], borderColor: STATUS_COLOR[s] } : null}
                          onClick=${() => allowed && set('Status', s)}>
                    <span class="swatch" style=${{ background: STATUS_COLOR[s] }}></span>${s}
                  </button>`;
              })}
            </div>
            ${!changeStatus && html`<span class="hint">Rollen ${role} kan inte ändra status.</span>`}
          </div>

          <div class="field">
            <label>Foton (${photos.length})</label>
            <div class="photos">
              ${photos.map((p) => html`
                <div class="photo" key=${p.id}>
                  <img src=${p.url} alt=${p.filnamn} />
                  ${editCore || can(role, 'addPhoto')
                    ? html`<button class="del" onClick=${() => removePhoto(p.id)} aria-label="Ta bort foto">✕</button>`
                    : null}
                </div>`)}
              ${can(role, 'addPhoto') && html`
                <label class="photo-add">
                  <span class="plus">＋</span><span>Lägg till</span>
                  <input type="file" accept="image/*" capture="environment" onChange=${handlePhoto} />
                </label>`}
            </div>
            ${photos.length === 0 && !can(role, 'addPhoto') ? html`<span class="hint">Inga foton.</span>` : null}
          </div>

          <div class="field">
            <label>Placering på ritning</label>
            <div class="readout">
              Typ: ${symbolLabel} · Ritning: ${deviation.RitningId || 'plan1.png'} ·
              X: ${xRel !== null ? xRel.toFixed(3) : '–'} (${xRel !== null ? Math.round(xRel * 100) + '%' : '–'}) ·
              Y: ${yRel !== null ? yRel.toFixed(3) : '–'} (${yRel !== null ? Math.round(yRel * 100) + '%' : '–'})
            </div>
          </div>

          ${!isNew && html`
            <div class="field">
              <span class="hint">
                GUID ${guidRef.current.slice(0, 8)}… · Åtgärdad ${formatDate(deviation.AtgardadDatum)} · Verifierad ${formatDate(deviation.VerifieradDatum)}
              </span>
            </div>`}
        </div>

        <div class="modal-foot">
          ${canDelete && html`<button class="btn danger" onClick=${remove} disabled=${busy}>Ta bort</button>`}
          <div class="spacer"></div>
          <button class="btn ghost" onClick=${() => onClose(changed)} disabled=${busy}>Stäng</button>
          ${canSave && html`<button class="btn primary" onClick=${save} disabled=${busy}>${busy ? 'Sparar…' : 'Spara'}</button>`}
        </div>
      </div>
    </div>`;
}

// Fetmarkerar den matchande delen av ett förslag (rent textbaserat, ingen HTML).
function highlightMatch(text, query) {
  const q = (query || '').trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  return html`${text.slice(0, idx)}<strong>${text.slice(idx, idx + q.length)}</strong>${text.slice(idx + q.length)}`;
}
