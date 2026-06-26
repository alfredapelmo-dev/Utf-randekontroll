// IndexedDB via idb-biblioteket (samma lagringsteknik som slutprodukten).
// Object stores enligt avsnittet "LOKAL LAGRING" i Datamodell.txt.

import { openDB } from '../vendor/idb.js';

export const DB_NAME = 'utfk-demo';
export const DB_VERSION = 1;

let _dbPromise = null;

export function getDB() {
  if (!_dbPromise) {
    _dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // projects: keyPath = ProjektGuid
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'ProjektGuid' });
        }
        // deviations: keyPath = AvvikelseGuid, index på ProjektGuid + Status
        if (!db.objectStoreNames.contains('deviations')) {
          const s = db.createObjectStore('deviations', { keyPath: 'AvvikelseGuid' });
          s.createIndex('by-projekt', 'ProjektGuid', { unique: false });
          s.createIndex('by-status', 'Status', { unique: false });
        }
        // photos: keyPath = id (Blob + AvvikelseGuid + filnamn)
        if (!db.objectStoreNames.contains('photos')) {
          const s = db.createObjectStore('photos', { keyPath: 'id' });
          s.createIndex('by-avvikelse', 'AvvikelseGuid', { unique: false });
        }
        // drawings: keyPath = RitningId (Blob till ritningsbild)
        if (!db.objectStoreNames.contains('drawings')) {
          db.createObjectStore('drawings', { keyPath: 'RitningId' });
        }
        // syncQueue: keyPath = id (pending create/update/delete-operationer)
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
      },
    });
  }
  return _dbPromise;
}
