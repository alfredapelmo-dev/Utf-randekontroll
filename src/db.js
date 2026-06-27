// IndexedDB via idb-biblioteket (samma lagringsteknik som slutprodukten).
// Object stores enligt avsnittet "LOKAL LAGRING" i Datamodell.txt.

import { openDB } from '../vendor/idb.js';

export const DB_NAME = 'utfk-demo';
export const DB_VERSION = 2;  // v2: lade till archives-store

let _dbPromise = null;

export function getDB() {
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
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
          db.createObjectStore('drawings', { keyPath: 'RitningId' });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }

        // v2: arkiverade projekt (demo = IndexedDB, beta = ZIP på SharePoint)
        // Samma _schema-fält versionerar exportformatet för framtida ZIP-migrering.
        if (oldVersion < 2) {
          db.createObjectStore('archives', { keyPath: 'ProjektGuid' });
        }
      },
    });
  }
  return _dbPromise;
}
