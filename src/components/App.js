import { html, useState, useEffect, useRef } from '../ui.js';
import { repository } from '../repository.js';
import { seedIfEmpty } from '../seed.js';
import { ROLES } from '../models.js';
import { ProjectList } from './ProjectList.js';
import { DrawingView } from './DrawingView.js';
import { DeviationForm } from './DeviationForm.js';
import { Protocol } from './Protocol.js';

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const role = ROLES[0]; // Demon kör alltid som Besiktningsman (full behörighet).
  const [projects, setProjects] = useState([]);
  const [view, setView] = useState('list');         // 'list' | 'project'
  const [activeProject, setActiveProject] = useState(null);
  const [selectedDeviation, setSelectedDeviation] = useState(null);
  const [showProtocol, setShowProtocol] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncCount, setSyncCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef(null);

  function toast(msg) {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }

  async function reloadSync() {
    try { setSyncCount((await repository.listSyncQueue()).length); } catch (_) {}
  }

  // ---- Steg D0: seed + första laddning (helt offline)
  useEffect(() => {
    (async () => {
      try {
        await seedIfEmpty();
        setProjects(await repository.listProjects());
        await reloadSync();
      } catch (e) {
        console.error(e); setError(e.message || String(e));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // ---- Online/offline-indikator
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  function openProject(p) { setActiveProject(p); setView('project'); }
  function back() { setView('list'); setActiveProject(null); bump(); }
  function bump() { setRefreshKey((k) => k + 1); reloadSync(); }

  function closeForm(changed) {
    setSelectedDeviation(null);
    if (changed) bump();
  }
  function closeProtocol() { setShowProtocol(false); }

  if (!ready) {
    return html`
      <div class="splash">
        <div class="splash-mark"></div>
        <p>${error ? 'Fel vid start: ' + error : 'Laddar demo…'}</p>
      </div>`;
  }

  return html`
    <div class="app">
      <header class="appbar">
        <div class="appbar-row">
          ${view === 'project'
            ? html`<button class="back" onClick=${back} aria-label="Tillbaka">‹</button>`
            : null}
          <div class="appbar-title">
            <strong>Utförandekontroll</strong>
            <span>Demo · offline</span>
          </div>
        </div>
        <div class="badges">
          <span class=${'badge dot ' + (online ? 'online' : 'offline')}>${online ? 'Online' : 'Offline'}</span>
          <span class="badge" title="Lokala ändringar som väntar på synk (demonstrerar offline-first)">
            Synk-kö: ${syncCount}
          </span>
        </div>
      </header>

      ${view === 'list'
        ? html`<${ProjectList} repository=${repository} projects=${projects} onOpen=${openProject} refreshKey=${refreshKey} />`
        : html`
            <${DrawingView}
              repository=${repository}
              project=${activeProject}
              role=${role}
              refreshKey=${refreshKey}
              onSelectDeviation=${setSelectedDeviation}
              onRequestProtocol=${() => setShowProtocol(true)}
              toast=${toast} />`}

      ${selectedDeviation && html`
        <${DeviationForm}
          repository=${repository}
          project=${activeProject}
          role=${role}
          deviation=${selectedDeviation}
          onClose=${closeForm}
          toast=${toast} />`}

      ${showProtocol && activeProject && html`
        <${Protocol}
          repository=${repository}
          project=${activeProject}
          role=${role}
          onClose=${closeProtocol}
          toast=${toast} />`}

      ${toastMsg && html`<div class="toast">${toastMsg}</div>`}
    </div>`;
}
