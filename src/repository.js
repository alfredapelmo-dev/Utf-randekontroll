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
  /* Synk (demonstrerar offline-first; ingen nätverkstrafik i demon) */
  async listSyncQueue() { throw new Error('not implemented'); }
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
