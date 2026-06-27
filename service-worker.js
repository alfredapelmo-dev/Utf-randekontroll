/* Service worker – ger äkta offline (flygplansläge). Förcachar hela app-skalet
   vid installation. Allt är lokalt; ingen nätverkstrafik krävs efter första
   laddning. (Registreras endast i säker kontext: https eller localhost.) */

const CACHE = 'utfk-demo-v15';

const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'styles/app.css',

  'vendor/react.production.min.js',
  'vendor/react-dom.production.min.js',
  'vendor/htm.umd.js',
  'vendor/jspdf.umd.min.js',
  'vendor/pdf.js',
  'vendor/pdf.worker.js',
  'vendor/idb.js',
  'vendor/wrap-idb-value.js',

  'src/main.js',
  'src/version.js',
  'src/ui.js',
  'src/models.js',
  'src/db.js',
  'src/pdfImport.js',
  'src/suggestions.js',
  'src/repository.js',
  'src/seed.js',
  'src/iso7010.js',
  'src/pdf.js',
  'src/components/App.js',
  'src/components/ProjectList.js',
  'src/components/ProjectBrowser.js',
  'src/components/ProjectView.js',
  'src/components/ProjectInfoForm.js',
  'src/components/SymbolPicker.js',
  'src/components/ArchiveDialog.js',
  'src/components/DrawingView.js',
  'src/components/DeviationForm.js',
  'src/components/Protocol.js',

  'assets/drawing-sample.png',
  'assets/drawing-plan-a.png',
  'assets/drawing-plan-b.png',
  'assets/drawing-plan-c.png',
  'assets/drawing-plan-d.png',
  'assets/photo-extinguisher.jpg',
  'assets/photo-door.jpg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-192-maskable.png',
  'assets/icons/icon-512-maskable.png',
  'assets/icons/apple-touch-icon-180.png',
  'assets/icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  // Förcacha app-skalet och ta över direkt (skipWaiting) så att uppdaterad kod
  // gäller efter en omladdning i stället för två.
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Städa bort gamla cache-versioner och styr öppna sidor direkt.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // bara samma origin

  // Network-first med cache-fallback: när vi är online (t.ex. localhost under
  // utveckling) hämtas alltid färsk kod; offline/flygplansläge faller tillbaka
  // på förcachat app-skal. Navigeringar faller tillbaka till index.html (SPA).
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        }
        // Servern svarade med fel (t.ex. 404 när hosting är nere) – fall tillbaka på cache
        throw new Error('bad response');
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
