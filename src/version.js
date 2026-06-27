// Appversion. APP_VERSION visas i headern. DATA_VERSION styr den lokala
// databasen: när den ändras töms IndexedDB och mockdatan seedas om automatiskt
// (se ensureDataVersion i db.js). Höj DATA_VERSION när seed/datamodell ändras,
// annars räcker det att höja APP_VERSION för en ren textändring.
export const APP_VERSION = '0.65';
export const DATA_VERSION = '4';
