// IndexedDB via idb-biblioteket (samma lagringsteknik som slutprodukten).
// Object stores enligt avsnittet "LOKAL LAGRING" i Datamodell.txt.

import { openDB } from '../vendor/idb.js';

export const DB_NAME = 'utfk-demo';
export const DB_VERSION = 4;  // v2: archives · v3: documents + drawings.by-projekt · v4: markers

let _dbPromise = null;

// Tömmer hela den lokala databasen (stänger cachat handtag först).
export function deleteDB() {
  _dbPromise = null;
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}

// Jämför sparad data-version mot aktuell. Om de skiljer sig (datamodellen/seed
// har ändrats) töms databasen så att ny mockdata seedas om vid nästa start.
// Returnerar true om en omseedning skedde.
export async function ensureDataVersion(dataVersion) {
  const KEY = 'utfk-data-version';
  let cur = null;
  try { cur = localStorage.getItem(KEY); } catch (_) {}
  if (cur !== String(dataVersion)) {
    await deleteDB();
    try { localStorage.setItem(KEY, String(dataVersion)); } catch (_) {}
    return true;
  }
  return false;
}

export function getDB() {
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, tx) {
        // v1-stores
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'ProjektGuid' });
        }
        if (!db.objectStoreNames.contains('deviations')) {
          const s = db.createObjectStore('deviations', { keyPath: 'AvvikelseGuid' });
          s.createIndex('by-projekt', 'ProjektGuid', { unique: false });
          s.createIndex('by-status', 'Status', { unique: false });
        }
        if (!db.objectStoreNames.contains('photos')) {
          const s = db.createObjectStore('photos', { keyPath: 'id' });
          s.createIndex('by-avvikelse', 'AvvikelseGuid', { unique: false });
        }
        if (!db.objectStoreNames.contains('drawings')) {
          const s = db.createObjectStore('drawings', { keyPath: 'RitningId' });
          s.createIndex('by-projekt', 'ProjektGuid', { unique: false });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }

        // v2: arkiverade projekt (demo = IndexedDB, beta = ZIP på SharePoint)
        // Samma _schema-fält versionerar exportformatet för framtida ZIP-migrering.
        if (oldVersion < 2) {
          db.createObjectStore('archives', { keyPath: 'ProjektGuid' });
        }

        // v3: projektdokument (brandskyddsbeskrivning m.m.) + per-projekt-index på
        // ritningar, så projektsidan kan lista respektive projekts planritningar.
        if (oldVersion < 3) {
          const docs = db.createObjectStore('documents', { keyPath: 'id' });
          docs.createIndex('by-projekt', 'ProjektGuid', { unique: false });
          // Lägg till index på befintlig drawings-store (skapad i v1 utan index).
          const drawings = tx.objectStore('drawings');
          if (!drawings.indexNames.contains('by-projekt')) {
            drawings.createIndex('by-projekt', 'ProjektGuid', { unique: false });
          }
        }

        // v4: interna arbetsmarkörer (snabbsymboler). Egen store, åtskild från
        // avvikelser så att de aldrig kommer med i protokollet. Synkas i beta.
        if (oldVersion < 4) {
          const m = db.createObjectStore('markers', { keyPath: 'id' });
          m.createIndex('by-projekt', 'ProjektGuid', { unique: false });
        }
      },
    });
  }
  return _dbPromise;
}
