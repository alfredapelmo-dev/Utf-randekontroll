import { html, useState, useEffect, useRef } from '../ui.js';
import { repository } from '../repository.js';
import { seedIfEmpty } from '../seed.js';
import { ensureDataVersion } from '../db.js';
import { APP_VERSION, DATA_VERSION } from '../version.js';
import { ROLES } from '../models.js';
import { ProjectList } from './ProjectList.js';
import { ProjectBrowser } from './ProjectBrowser.js';
import { ProjectView } from './ProjectView.js';
import { ProjectInfoForm } from './ProjectInfoForm.js';
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
  const [view, setView] = useState('list');   // 'list' | 'projects' | 'project' | 'drawing'
  const [activeProject, setActiveProject] = useState(null);
  const [activeDrawingId, setActiveDrawingId] = useState(null);
  const [selectedDeviation, setSelectedDeviation] = useState(null);
  const [showProtocol, setShowProtocol] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [editInfo, setEditInfo] = useState(null);
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
        await ensureDataVersion(DATA_VERSION); // töm + seeda om vid ny datamodell
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
  function openDrawing(ritningId) { setActiveDrawingId(ritningId); setView('drawing'); }

  function back() {
    if (view === 'drawing') { setView('project'); setActiveDrawingId(null); bump(); }
    else if (view === 'project') { setView('list'); setActiveProject(null); bump(); }
    else if (view === 'projects') { setView('list'); }
  }
  function bump() { setRefreshKey((k) => k + 1); reloadAll(); }

  function closeForm(changed) { setSelectedDeviation(null); if (changed) bump(); }
  function closeProtocol() { setShowProtocol(false); }

  // Skapa nytt projekt = öppna projektformuläret med en tom mall (utan
  // ProjektGuid). saveProject genererar GUID och köar synk lokalt.
  function handleAddNew() { setEditInfo({ Status: 'Pågående' }); }

  function closeEditInfo(saved) {
    const wasNew = editInfo && !editInfo.ProjektGuid;
    setEditInfo(null);
    if (saved) {
      setActiveProject((p) => (p && p.ProjektGuid === saved.ProjektGuid ? saved : p));
      bump();
      if (wasNew) openProject(saved); // hoppa direkt in i det nya projektet
    }
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    try {
      await repository.archiveProject(archiveTarget.ProjektGuid);
      setFavorites((prev) => {
        const next = new Set(prev);
        next.delete(archiveTarget.ProjektGuid);
        saveFavorites(next);
        return next;
      });
      const wasActive = activeProject && activeProject.ProjektGuid === archiveTarget.ProjektGuid;
      setArchiveTarget(null);
      if (wasActive) { setView('list'); setActiveProject(null); }
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

  const showBack = view !== 'list';
  const subtitle =
    view === 'projects' ? 'Projekt' :
    view === 'project' ? 'Projektöversikt' :
    view === 'drawing' ? 'Ritning' : 'Demo · offline';

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
            <span>${subtitle}</span>
          </div>
          <span class="app-version" title="Appversion">v${APP_VERSION}</span>
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

      ${view === 'project' && activeProject && html`
        <${ProjectView}
          repository=${repository}
          project=${activeProject}
          role=${role}
          refreshKey=${refreshKey}
          onOpenDrawing=${openDrawing}
          onEditInfo=${setEditInfo}
          onArchive=${setArchiveTarget}
          toast=${toast} />`}

      ${view === 'drawing' && activeProject && html`
        <${DrawingView}
          repository=${repository}
          project=${activeProject}
          ritningId=${activeDrawingId}
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

      ${editInfo && html`
        <${ProjectInfoForm}
          repository=${repository}
          project=${editInfo}
          onClose=${closeEditInfo}
          toast=${toast} />`}

      ${archiveTarget && html`
        <${ArchiveDialog}
          project=${archiveTarget}
          onConfirm=${handleArchiveConfirm}
          onClose=${() => setArchiveTarget(null)} />`}

      ${toastMsg && html`<div class="toast">${toastMsg}</div>`}
    </div>`;
}
