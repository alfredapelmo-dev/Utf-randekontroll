// Startpunkt. Monterar React-appen och registrerar service worker för äkta
// offline (flygplansläge). Allt körs lokalt – inget internet krävs.

import { ReactDOM, html } from './ui.js';
import { App } from './components/App.js';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(html`<${App} />`);

// Service worker registreras endast i säker kontext (https eller localhost).
// Utan SW fungerar appen ändå fullt ut så länge sidan är laddad – SW:n lägger
// till offline-cache så att den även startar i flygplansläge.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((err) => {
      console.warn('Service worker kunde inte registreras:', err);
    });
  });
}
