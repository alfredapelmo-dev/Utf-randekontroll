import { html, useState, useEffect, useRef } from '../ui.js';
import { repository } from '../repository.js';
import { seedIfEmpty } from '../seed.js';
import { ROLES } from '../models.js';
import { ProjectList } from './ProjectList.js';
import { ProjectBrowser } from './ProjectBrowser.js';
import { DrawingView } from './DrawingView.js';
import { DeviationForm } from './DeviationForm.js';
import { Protocol } from './Protocol.js';
import { ArchiveDialog } from './ArchiveDialog.js';

function loadFavorites() {
  try { return new Set(JSON.parse(localStorage.getItem('utfk-favorites') || '[]')); }
  catch (_) { return new Set(); }
}

function saveFavorites(set) {
  try { localStorage.setItem('utfk-favorites', JSON.stringify([...set])); } catch (_) {}
}

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const role = ROLES[0];
  const [projects, setProjects] = useState([]);
  const [archives, setArchives] = useState([]);
  const [view, setView] = useState('list');   // 'list' | 'projects' | 'project'
  const [activeProject, setActiveProject] = useState(null);
  const [selectedDeviation, setSelectedDeviation] = useState(null);
  const [showProtocol, setShowProtocol] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncCount, setSyncCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toastMsg, setToastMsg] = useState(null);
  const [favorites, setFavorites] = useState(loadFavorites);
  const toastTimer = useRef(null);

  function toast(msg) {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2600);
  }

  async function reloadAll() {
    setProjects(await repository.listProjects());
    setArchives(await repository.listArchives());
    try { setSyncCount((await repository.listSyncQueue()).length); } catch (_) {}
  }

  useEffect(() => {
    (async () => {
      try {
        await seedIfEmpty();
        await reloadAll();
      } catch (e) {
        console.error(e); setError(e.message || String(e));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  function toggleFavorite(guid) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(guid)) { next.delete(guid); toast('Borttagen från favoriter'); }
      else { next.add(guid); toast('Tillagd i favoriter ⭐'); }
      saveFavorites(next);
      return next;
    });
  }

  function openProject(p) { setActiveProject(p); setView('project'); }
  function back() {
    if (view === 'project') { setView('list'); setActiveProject(null); bump(); }
    else if (view === 'projects') { setView('list'); }
  }
  function bump() { setRefreshKey((k) => k + 1); reloadAll(); }

  function closeForm(changed) { setSelectedDeviation(null); if (changed) bump(); }
  function closeProtocol() { setShowProtocol(false); }
  function handleAddNew() { toast('Skapa projekt kommer i beta-versionen.'); }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    try {
      await repository.archiveProject(archiveTarget.ProjektGuid);
      // Ta bort eventuell favorit för arkiverat projekt
      setFavorites((prev) => {
        const next = new Set(prev);
        next.delete(archiveTarget.ProjektGuid);
        saveFavorites(next);
        return next;
      });
      setArchiveTarget(null);
      await reloadAll();
      toast(`"${archiveTarget.Title}" arkiverades`);
    } catch (e) {
      toast('Fel vid arkivering: ' + e.message);
      setArchiveTarget(null);
    }
  }

  async function handleRestore(archive) {
    try {
      await repository.restoreProject(archive.ProjektGuid);
      await reloadAll();
      toast(`"${archive.Title}" återupptogs`);
    } catch (e) {
      toast('Fel vid återupptagning: ' + e.message);
    }
  }

  async function handleDownloadArchive(archive) {
    try {
      const blob = await repository.exportArchiveAsZip(archive.ProjektGuid);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arkiv_${archive.ProjektGuid}_${archive.ArchivedDate.slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast('Arkiv nedladdat');
    } catch (e) {
      toast('Fel vid nedladdning: ' + e.message);
    }
  }

  const showBack = view === 'project' || view === 'projects';

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
          ${showBack
            ? html`<button class="back" onClick=${back} aria-label="Tillbaka">‹</button>`
            : null}
          <div class="appbar-title">
            <strong>Utförandekontroll</strong>
            <span>${view === 'projects' ? 'Projekt' : 'Demo · offline'}</span>
          </div>
        </div>
        <div class="badges">
          <span class=${'badge dot ' + (online ? 'online' : 'offline')}>${online ? 'Online' : 'Offline'}</span>
          <span class="badge" title="Lokala ändringar som väntar på synk">
            Synk-kö: ${syncCount}
          </span>
        </div>
      </header>

      ${view === 'list' && html`
        <${ProjectList}
          repository=${repository}
          projects=${projects}
          favorites=${favorites}
          onToggleFavorite=${toggleFavorite}
          onOpen=${openProject}
          onBrowse=${() => setView('projects')}
          onAddNew=${handleAddNew}
          refreshKey=${refreshKey} />`}

      ${view === 'projects' && html`
        <${ProjectBrowser}
          repository=${repository}
          projects=${projects}
          archives=${archives}
          favorites=${favorites}
          onToggleFavorite=${toggleFavorite}
          onOpen=${openProject}
          onAddNew=${handleAddNew}
          onArchive=${setArchiveTarget}
          onRestore=${handleRestore}
          onDownloadArchive=${handleDownloadArchive} />`}

      ${view === 'project' && html`
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

      ${archiveTarget && html`
        <${ArchiveDialog}
          project=${archiveTarget}
          onConfirm=${handleArchiveConfirm}
          onClose=${() => setArchiveTarget(null)} />`}

      ${toastMsg && html`<div class="toast">${toastMsg}</div>`}
    </div>`;
}
