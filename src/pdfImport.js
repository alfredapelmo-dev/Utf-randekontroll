// PDF-import av planritningar (alternativ A – rastrering vid import).
//
// All pdf.js-logik är isolerad här så att UI-komponenterna hålls rena och Beta kan
// återanvända modulen. pdf.js laddas som UMD-global (window.pdfjsLib) via ett
// klassiskt <script> i index.html.
//
// Princip: en vald PDF-sida RASTRERAS EN GÅNG vid import till en högupplöst
// PNG-Blob som lagras precis som en bildritning. Efter import är ritningen en vanlig
// bild – ingen pdf.js-rendering sker vid visning (stabilast för iOS Safari och
// enklast att synka i Beta). Se pdf-import-prompt.txt för bakgrund.

// Worker-sökväg sätts EN gång vid modulladdning, rot-robust via import.meta.url.
// Filen ligger i src/, så det är ETT steg upp till vendor/. import.meta.url-formen
// fungerar även om appen serveras från en subpath (till skillnad mot en ren sträng
// som resolverar mot sidans base-URL). URL:en är same-origin och pdf.worker.js
// precachas av service workern → fungerar offline.
pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL('../vendor/pdf.worker.js', import.meta.url).href;

// ---- Spärrar -------------------------------------------------------------------
export const MAX_PDF_BYTES = 40 * 1024 * 1024;   // avvisa större input-PDF (minnesskydd)
export const MAX_PAGES = 50;                      // guard mot råkar-200-sidig PDF
export const MAX_BLOB_BYTES = 10 * 1024 * 1024;   // avvisa om en renderad sida blir för stor
export const TARGET_EDGE = 4000;                  // målupplösning, långsida (px)
export const MAX_EDGE = 4096;                     // hård gräns långsida (iOS-canvas)
export const MAX_AREA = 16 * 1024 * 1024;         // ~16 Mpx, iOS Safari canvas-tak

// Öppnar en PDF och gör grundläggande storlekskontroll innan rendering.
// Returnerar { pdf, numPages }. Kastar Error med svenskt meddelande vid problem.
export async function loadPdf(file) {
  if (file.size > MAX_PDF_BYTES) {
    throw new Error('PDF:en är för stor (max 40 MB).');
  }
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  if (pdf.numPages > MAX_PAGES) {
    throw new Error('PDF:en har för många sidor (max 50).');
  }
  return { pdf, numPages: pdf.numPages };
}

// Rastrerar EN sida till en högupplöst PNG-Blob med säker storleksberäkning.
// Returnerar { blob, bredd, hojd } (pixelmått på den renderade canvasen).
export async function renderPageToBlob(pdf, pageNr) {
  const page = await pdf.getPage(pageNr);
  const base = page.getViewport({ scale: 1 });
  const longEdge = Math.max(base.width, base.height);

  // 1) sikta på TARGET_EDGE på långsidan
  let renderScale = TARGET_EDGE / longEdge;
  // 2) clampa långsidan till MAX_EDGE
  const longPx = longEdge * renderScale;
  if (longPx > MAX_EDGE) renderScale *= MAX_EDGE / longPx;
  // 3) clampa total area till MAX_AREA (skyddar nästan kvadratiska PDF:er)
  const w = base.width * renderScale, h = base.height * renderScale;
  if (w * h > MAX_AREA) renderScale *= Math.sqrt(MAX_AREA / (w * h));

  const vp = page.getViewport({ scale: renderScale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(vp.width));
  canvas.height = Math.max(1, Math.round(vp.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';                          // PDF kan vara transparent
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;

  // toBlob (INTE toDataURL) för att hålla IndexedDB/SharePoint-storleken rimlig.
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('Kunde inte rendera PDF-sidan.');
  if (blob.size > MAX_BLOB_BYTES) throw new Error('Den renderade ritningen blev för stor.');
  return { blob, bredd: canvas.width, hojd: canvas.height };
}
