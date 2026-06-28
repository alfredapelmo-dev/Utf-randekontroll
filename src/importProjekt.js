// DEMOFUNKTION – tas bort vid aktivering av synk

/**
 * Importerar ett projektpaket (ZIP exporterat av sendProjekt) till lokal IndexedDB.
 * Skapar eller uppdaterar projekt, avvikelser, foton, ritningar och dokument.
 *
 * @param {object}   repository - LocalRepository-instansen
 * @param {File}     zipFil     - ZIP-filen vald av användaren
 * @param {function} [toast]    - valfri funktion för statusmeddelanden
 * @returns {Promise<object>}   det sparade projektobjektet
 */
export async function importProjekt(repository, zipFil, toast) {
  // JSZip laddas som UMD-global via index.html (demofunktion)
  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip saknas. Kontrollera att CDN-skriptet är inläst i index.html.');
  }

  if (toast) toast('Läser ZIP-fil…');

  let zip;
  try {
    zip = await JSZip.loadAsync(zipFil);
  } catch (fel) {
    throw new Error(`Ogiltig ZIP-fil: ${fel.message}`);
  }

  // Läs manifest
  const manifestFil = zip.file('projekt.json');
  if (!manifestFil) throw new Error('ZIP-filen saknar projekt.json – är det rätt fil?');

  let manifest;
  try {
    const text = await manifestFil.async('text');
    manifest = JSON.parse(text);
  } catch (fel) {
    throw new Error(`Kunde inte tolka projekt.json: ${fel.message}`);
  }

  if (!manifest._version || !manifest.projekt?.ProjektGuid) {
    throw new Error('Ogiltig paketstruktur – filen är kanske exporterad från en annan app.');
  }

  const { projekt, avvikelser = [], ritningar = [], dokument = [] } = manifest;

  if (toast) toast('Sparar projekt…');

  // Spara projektet (skapar eller uppdaterar via ProjektGuid)
  const sparat = await repository.saveProject(projekt);

  if (toast) toast('Importerar avvikelser…');

  // Spara avvikelser (utan _foton-metafältet som bara finns i exporten)
  for (const av of avvikelser) {
    const { _foton, ...avData } = av;
    await repository.saveDeviation(avData);

    // Importera foton för denna avvikelse
    for (const fotoMeta of (_foton || [])) {
      const zipPost = zip.file(fotoMeta._zipSökväg);
      if (!zipPost) continue;
      const buffer = await zipPost.async('arraybuffer');
      const blob = new Blob([buffer], { type: 'image/jpeg' });
      await repository.addPhoto(av.AvvikelseGuid, blob, fotoMeta.filnamn);
    }
  }

  if (toast) toast('Importerar ritningar…');

  // Spara ritningar
  for (const r of ritningar) {
    const { _zipSökväg, ...ritData } = r;
    const zipPost = zip.file(_zipSökväg);
    if (zipPost) {
      const buffer = await zipPost.async('arraybuffer');
      // Bestäm MIME-typ från sökvägen
      const mime = _zipSökväg.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const blob = new Blob([buffer], { type: mime });
      await repository.saveDrawing({ ...ritData, blob });
    } else {
      // Ritning utan binärfil sparas ändå (visar fallback-ikon i UI)
      await repository.saveDrawing(ritData);
    }
  }

  if (toast) toast('Importerar dokument…');

  // Spara dokument (undvik dubbletter vid reimport – kontrollera befintliga)
  const befintligaDokument = await repository.listDocuments(projekt.ProjektGuid);
  const befintligaIds = new Set(befintligaDokument.map((d) => d.id));

  for (const d of dokument) {
    if (befintligaIds.has(d.id)) continue; // redan importerad
    const { _zipSökväg, ...docData } = d;
    const zipPost = zip.file(_zipSökväg);
    if (!zipPost) continue;
    const buffer = await zipPost.async('arraybuffer');
    const blob = new Blob([buffer], { type: d.mime || 'application/octet-stream' });
    // addDocument skapar ett nytt id – vi måste använda saveDocument om det finns,
    // annars acceptera nytt id för demon
    await repository.addDocument(projekt.ProjektGuid, d.dokumenttyp || 'brandskyddsbeskrivning', blob, d.filnamn);
  }

  if (toast) toast(`Projekt "${projekt.Title}" importerat!`);
  return sparat;
}
