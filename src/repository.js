// Dataåtkomstlager. ALL data går via detta interface – UI-koden känner aldrig
// till IndexedDB eller (senare) Microsoft Graph.
//
// FRAMÅTKOMPATIBILITET:
//   Demo  -> LocalRepository  (IndexedDB)
//   Beta  -> GraphRepository  (SharePoint/Graph)
// Samma metoder/signaturer. UI:t ska INTE behöva ändras när implementationen
// byts. Synk-metafält (_spId, _etag, _dirty) och en syncQueue läggs upp redan
// nu så att GraphRepository kan ta vid utan att modellen bryts.

import { getDB } from './db.js';
import { newGuid, nowIso } from './models.js';

/** Abstrakt interface – dokumenterar kontraktet UI:t förlitar sig på. */
export class Repository {
  /* Projekt */
  async listProjects() { throw new Error('not implemented'); }
  async getProject(guid) { throw new Error('not implemented'); }
  async saveProject(project) { throw new Error('not implemented'); }
  /* Avvikelser */
  async listDeviations(projektGuid) { throw new Error('not implemented'); }
  async getDeviation(guid) { throw new Error('not implemented'); }
  async saveDeviation(deviation) { throw new Error('not implemented'); }
  async deleteDeviation(guid) { throw new Error('not implemented'); }
  /* Foton */
  async addPhoto(avvikelseGuid, blob, filename) { throw new Error('not implemented'); }
  async listPhotos(avvikelseGuid) { throw new Error('not implemented'); }
  async getPhoto(id) { throw new Error('not implemented'); }
  async deletePhoto(id) { throw new Error('not implemented'); }
  /* Ritningar */
  async getDrawing(ritningId) { throw new Error('not implemented'); }
  async saveDrawing(drawing) { throw new Error('not implemented'); }
  async listDrawings() { throw new Error('not implemented'); }
  async listDrawingsForProject(projektGuid) { throw new Error('not implemented'); }
  /* Dokument (brandskyddsbeskrivning m.m.) */
  async addDocument(projektGuid, dokumenttyp, blob, filnamn) { throw new Error('not implemented'); }
  async listDocuments(projektGuid) { throw new Error('not implemented'); }
  async getDocument(id) { throw new Error('not implemented'); }
  async deleteDocument(id) { throw new Error('not implemented'); }
  /* Interna arbetsmarkörer (snabbsymboler – ej i protokoll) */
  async listMarkers(projektGuid) { throw new Error('not implemented'); }
  async saveMarker(marker) { throw new Error('not implemented'); }
  async deleteMarker(id) { throw new Error('not implemented'); }
  /* Synk (demonstrerar offline-first; ingen nätverkstrafik i demon) */
  async listSyncQueue() { throw new Error('not implemented'); }
  /* Arkivering */
  async archiveProject(projektGuid) { throw new Error('not implemented'); }
  async listArchives() { throw new Error('not implemented'); }
  async restoreProject(projektGuid) { throw new Error('not implemented'); }
  async exportArchiveAsZip(projektGuid) { throw new Error('not implemented'); }
}

export class LocalRepository extends Repository {
  // ---------------------------------------------------------- Projekt
  async listProjects() {
    const db = await getDB();
    const all = await db.getAll('projects');
    return all.sort((a, b) => String(a.Title || '').localeCompare(String(b.Title || ''), 'sv'));
  }

  async getProject(guid) {
    return (await getDB()).get('projects', guid);
  }

  async saveProject(project) {
    const db = await getDB();
    const now = nowIso();
    const rec = { ...project };
    if (!rec.ProjektGuid) rec.ProjektGuid = newGuid();
    if (!rec.Created) rec.Created = now;
    rec.Modified = now;
    if (rec._spId === undefined) rec._spId = null;
    if (rec._etag === undefined) rec._etag = null;
    rec._dirty = true;
    await db.put('projects', rec);
    await this._enqueue('project', rec.ProjektGuid, rec._spId ? 'update' : 'create');
    return rec;
  }

  // ---------------------------------------------------------- Avvikelser
  async listDeviations(projektGuid) {
    const db = await getDB();
    // Speglar Graph $filter=ProjektGuid eq '...': hämtar ALLTID per projekt via
    // det indexerade fältet, aldrig hela listan (se 5000-gränsen i Datamodell.txt).
    const list = await db.getAllFromIndex('deviations', 'by-projekt', projektGuid);
    return list.sort((a, b) => new Date(a.Created || 0) - new Date(b.Created || 0));
  }

  async getDeviation(guid) {
    return (await getDB()).get('deviations', guid);
  }

  async saveDeviation(deviation) {
    const db = await getDB();
    const now = nowIso();
    const prev = deviation.AvvikelseGuid ? await db.get('deviations', deviation.AvvikelseGuid) : null;
    const rec = { ...(prev || {}), ...deviation };

    if (!rec.AvvikelseGuid) rec.AvvikelseGuid = newGuid();
    if (!rec.Created) rec.Created = now;
    rec.Modified = now;
    if (!Array.isArray(rec.FotoReferenser)) {
      rec.FotoReferenser = rec.FotoReferenser ? [].concat(rec.FotoReferenser) : [];
    }

    // Statusövergångar sätter datumstämplar (samma semantik genom hela trappan).
    if (rec.Status === 'Öppen') { rec.AtgardadDatum = null; rec.VerifieradDatum = null; }
    if (rec.Status === 'Åtgärdad') {
      if (!rec.AtgardadDatum) rec.AtgardadDatum = now;
      rec.VerifieradDatum = null;
    }
    if (rec.Status === 'Verifierad') {
      if (!rec.AtgardadDatum) rec.AtgardadDatum = now;
      if (!rec.VerifieradDatum) rec.VerifieradDatum = now;
    }

    if (rec._spId === undefined) rec._spId = null;
    if (rec._etag === undefined) rec._etag = null;
    rec._dirty = true;

    await db.put('deviations', rec);
    await this._enqueue('deviation', rec.AvvikelseGuid, rec._spId ? 'update' : 'create');
    return rec;
  }

  async deleteDeviation(guid) {
    const db = await getDB();
    const photos = await db.getAllFromIndex('photos', 'by-avvikelse', guid);
    const tx = db.transaction(['deviations', 'photos'], 'readwrite');
    await Promise.all(photos.map((p) => tx.objectStore('photos').delete(p.id)));
    await tx.objectStore('deviations').delete(guid);
    await tx.done;
    await this._enqueue('deviation', guid, 'delete');
  }

  // ---------------------------------------------------------- Foton (Blob)
  async addPhoto(avvikelseGuid, blob, filename) {
    const db = await getDB();
    const id = newGuid();
    const namn = filename || `${avvikelseGuid}_${Date.now()}.jpg`;
    const rec = { id, AvvikelseGuid: avvikelseGuid, filnamn: namn, blob, created: nowIso() };
    await db.put('photos', rec);

    // Uppdatera FotoReferenser på avvikelsen (lista med filnamn enligt modellen).
    const dev = await db.get('deviations', avvikelseGuid);
    if (dev) {
      const refs = Array.isArray(dev.FotoReferenser) ? dev.FotoReferenser.slice() : [];
      refs.push(namn);
      dev.FotoReferenser = refs;
      dev.Modified = nowIso();
      dev._dirty = true;
      await db.put('deviations', dev);
    }
    return rec;
  }

  async listPhotos(avvikelseGuid) {
    return (await getDB()).getAllFromIndex('photos', 'by-avvikelse', avvikelseGuid);
  }

  async getPhoto(id) {
    return (await getDB()).get('photos', id);
  }

  async deletePhoto(id) {
    const db = await getDB();
    const photo = await db.get('photos', id);
    await db.delete('photos', id);
    if (photo) {
      const dev = await db.get('deviations', photo.AvvikelseGuid);
      if (dev && Array.isArray(dev.FotoReferenser)) {
        dev.FotoReferenser = dev.FotoReferenser.filter((f) => f !== photo.filnamn);
        dev.Modified = nowIso();
        dev._dirty = true;
        await db.put('deviations', dev);
      }
    }
  }

  // ---------------------------------------------------------- Ritningar (Blob)
  async getDrawing(ritningId) {
    return (await getDB()).get('drawings', ritningId);
  }

  async saveDrawing(drawing) {
    const db = await getDB();
    await db.put('drawings', drawing);
    return drawing;
  }

  async listDrawings() {
    return (await getDB()).getAll('drawings');
  }

  async listDrawingsForProject(projektGuid) {
    const db = await getDB();
    const list = await db.getAllFromIndex('drawings', 'by-projekt', projektGuid);
    return list.sort((a, b) => String(a.namn || '').localeCompare(String(b.namn || ''), 'sv'));
  }

  // ---------------------------------------------------------- Dokument (Blob)
  async addDocument(projektGuid, dokumenttyp, blob, filnamn) {
    const db = await getDB();
    const rec = {
      id: newGuid(), ProjektGuid: projektGuid, dokumenttyp,
      filnamn, mime: blob.type || 'application/octet-stream',
      storlek: blob.size, blob, uploaded: nowIso(),
    };
    await db.put('documents', rec);
    return rec;
  }

  async listDocuments(projektGuid) {
    const db = await getDB();
    const list = await db.getAllFromIndex('documents', 'by-projekt', projektGuid);
    return list.sort((a, b) => new Date(b.uploaded || 0) - new Date(a.uploaded || 0));
  }

  async getDocument(id) {
    return (await getDB()).get('documents', id);
  }

  async deleteDocument(id) {
    return (await getDB()).delete('documents', id);
  }

  // ------------------------------------------------ Interna arbetsmarkörer
  // Egen entitet (ej avvikelse). Synkas i beta men kommer aldrig med i PDF.
  async listMarkers(projektGuid) {
    const db = await getDB();
    const list = await db.getAllFromIndex('markers', 'by-projekt', projektGuid);
    return list.sort((a, b) => new Date(a.Created || 0) - new Date(b.Created || 0));
  }

  async saveMarker(marker) {
    const db = await getDB();
    const now = nowIso();
    const prev = marker.id ? await db.get('markers', marker.id) : null;
    const rec = { ...(prev || {}), ...marker };
    if (!rec.id) rec.id = newGuid();
    if (!rec.Created) rec.Created = now;
    rec.Modified = now;
    if (rec._spId === undefined) rec._spId = null;
    if (rec._etag === undefined) rec._etag = null;
    rec._dirty = true;
    await db.put('markers', rec);
    await this._enqueue('marker', rec.id, rec._spId ? 'update' : 'create');
    return rec;
  }

  async deleteMarker(id) {
    const db = await getDB();
    await db.delete('markers', id);
    await this._enqueue('marker', id, 'delete');
  }

  // ---------------------------------------------------------- Arkivering
  async archiveProject(projektGuid) {
    const db = await getDB();
    const projekt = await db.get('projects', projektGuid);
    if (!projekt) throw new Error('Projekt hittades inte');

    const avvikelser = await db.getAllFromIndex('deviations', 'by-projekt', projektGuid);
    const foton = (await Promise.all(
      avvikelser.map((a) => db.getAllFromIndex('photos', 'by-avvikelse', a.AvvikelseGuid))
    )).flat();
    const ritningar = await db.getAllFromIndex('drawings', 'by-projekt', projektGuid);
    const dokument = await db.getAllFromIndex('documents', 'by-projekt', projektGuid);
    const markorer = await db.getAllFromIndex('markers', 'by-projekt', projektGuid);

    const archivedAt = nowIso();
    const archive = {
      ProjektGuid: projektGuid,
      ArchivedDate: archivedAt,
      _schema: 1,
      projekt,
      avvikelser,
      foton,
      ritningar,
      dokument,
      markorer,
    };

    const tx = db.transaction(['archives', 'deviations', 'photos', 'projects', 'drawings', 'documents', 'markers'], 'readwrite');
    await tx.objectStore('archives').put(archive);
    for (const a of avvikelser) await tx.objectStore('deviations').delete(a.AvvikelseGuid);
    for (const f of foton) await tx.objectStore('photos').delete(f.id);
    for (const r of ritningar) await tx.objectStore('drawings').delete(r.RitningId);
    for (const d of dokument) await tx.objectStore('documents').delete(d.id);
    for (const m of markorer) await tx.objectStore('markers').delete(m.id);
    const updatedProjekt = { ...projekt, Status: 'Arkiverad', Modified: archivedAt, _dirty: true };
    await tx.objectStore('projects').put(updatedProjekt);
    await tx.done;

    await this._enqueue('project', projektGuid, 'update');
    return { ok: true, archivedAt };
  }

  async listArchives() {
    const db = await getDB();
    const all = await db.getAll('archives');
    return all.map(({ ProjektGuid, ArchivedDate, projekt }) => ({
      ProjektGuid,
      ArchivedDate,
      Title: projekt.Title,
      Kund: projekt.Kund,
      Adress: projekt.Adress,
      Status: projekt.Status,
    })).sort((a, b) => String(a.Title || '').localeCompare(String(b.Title || ''), 'sv'));
  }

  async restoreProject(projektGuid) {
    const db = await getDB();
    const archive = await db.get('archives', projektGuid);
    if (!archive) throw new Error('Arkivet hittades inte');

    const now = nowIso();
    const tx = db.transaction(['archives', 'deviations', 'photos', 'projects', 'drawings', 'documents', 'markers'], 'readwrite');
    const restoredProjekt = { ...archive.projekt, Status: 'Pågående', Modified: now, _dirty: true };
    await tx.objectStore('projects').put(restoredProjekt);
    for (const a of archive.avvikelser) await tx.objectStore('deviations').put(a);
    for (const f of archive.foton) await tx.objectStore('photos').put(f);
    for (const r of archive.ritningar) await tx.objectStore('drawings').put(r);
    for (const d of (archive.dokument || [])) await tx.objectStore('documents').put(d);
    for (const m of (archive.markorer || [])) await tx.objectStore('markers').put(m);
    await tx.objectStore('archives').delete(projektGuid);
    await tx.done;

    await this._enqueue('project', projektGuid, 'update');
    return { ok: true };
  }

  async exportArchiveAsZip(projektGuid) {
    // Demo: bygg ZIP i webbläsaren från archives-store.
    // Beta: hämta befintlig ZIP direkt från SharePoint Document Library.
    const db = await getDB();
    const archive = await db.get('archives', projektGuid);
    if (!archive) throw new Error('Arkivet hittades inte');

    // Konvertera Blob → base64 för JSON-säker inbäddning
    async function blobToBase64(blob) {
      if (!blob) return null;
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
      });
    }

    const fotoData = await Promise.all(
      archive.foton.map(async (f) => ({
        ...f,
        blob: undefined,
        _b64: await blobToBase64(f.blob),
        _mime: f.blob ? f.blob.type : 'image/jpeg',
      }))
    );
    const ritningData = await Promise.all(
      archive.ritningar.map(async (r) => ({
        ...r,
        blob: undefined,
        _b64: await blobToBase64(r.blob),
        _mime: r.blob ? r.blob.type : 'image/png',
      }))
    );

    const manifest = {
      _schema: archive._schema,
      exportedAt: nowIso(),
      ProjektGuid: archive.ProjektGuid,
      ArchivedDate: archive.ArchivedDate,
      counts: {
        avvikelser: archive.avvikelser.length,
        foton: archive.foton.length,
        ritningar: archive.ritningar.length,
      },
    };

    const payload = JSON.stringify({
      manifest,
      projekt: archive.projekt,
      avvikelser: archive.avvikelser,
      foton: fotoData,
      ritningar: ritningData,
    }, null, 2);

    return new Blob([payload], { type: 'application/json' });
  }

  // ---------------------------------------------------------- Synk
  async listSyncQueue() {
    return (await getDB()).getAll('syncQueue');
  }

  async _enqueue(entity, guid, op) {
    const db = await getDB();
    await db.put('syncQueue', {
      id: newGuid(), entity, guid, op, ts: nowIso(), etag: null,
    });
  }
}

// Singleton-instans som hela UI:t importerar. I Beta pekas denna om till en
// GraphRepository utan att komponenterna ändras.
export const repository = new LocalRepository();
