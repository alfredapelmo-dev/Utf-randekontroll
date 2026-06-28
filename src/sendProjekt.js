// DEMOFUNKTION – tas bort vid aktivering av synk

/**
 * Exporterar ett helt projekt (metadata, avvikelser, foton, ritningar, dokument)
 * som en ZIP-fil och delar den via Web Share API (iOS) eller triggar nedladdning.
 *
 * @param {object} repository  - LocalRepository-instansen
 * @param {object} project     - projektobjektet (måste ha ProjektGuid)
 * @param {function} [toast]   - valfri funktion för användarvänliga statusmeddelanden
 */
export async function sendProjekt(repository, project, toast) {
  // JSZip laddas som UMD-global via index.html (demofunktion)
  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip saknas. Kontrollera att CDN-skriptet är inläst i index.html.');
  }

  const guid = project.ProjektGuid;
  if (!guid) throw new Error('Projektet saknar ProjektGuid.');

  if (toast) toast('Hämtar projektdata…');

  // Hämta avvikelser
  const avvikelser = await repository.listDeviations(guid);

  // Hämta foton per avvikelse och bygg upp metadata med ZIP-sökvägar
  const avvikelserMedFotoMeta = [];
  const fotoPoster = []; // { zipSökväg, blob, id, filnamn }

  for (const av of avvikelser) {
    const foton = await repository.listPhotos(av.AvvikelseGuid);
    const fotoMeta = foton.map((f) => {
      // Bestäm filändelse från filnamn eller antag jpg
      const ext = (f.filnamn || 'foto.jpg').split('.').pop().toLowerCase();
      const zipSökväg = `foton/${f.id}.${ext}`;
      fotoPoster.push({ zipSökväg, blob: f.blob, id: f.id, filnamn: f.filnamn });
      return { id: f.id, filnamn: f.filnamn, created: f.created, _zipSökväg: zipSökväg };
    });
    avvikelserMedFotoMeta.push({ ...av, _foton: fotoMeta });
  }

  // Hämta ritningar
  const ritningar = await repository.listDrawingsForProject(guid);
  const ritningPoster = []; // { zipSökväg, blob, ritning }

  const ritningarMeta = await Promise.all(
    ritningar.map(async (r) => {
      const full = await repository.getDrawing(r.RitningId);
      const ext = full?.blob?.type?.includes('png') ? 'png' : 'jpg';
      const zipSökväg = `ritningar/${r.RitningId}.${ext}`;
      ritningPoster.push({ zipSökväg, blob: full?.blob });
      return { ...r, _zipSökväg: zipSökväg };
    })
  );

  // Hämta dokument
  const dokument = await repository.listDocuments(guid);
  const dokumentPoster = [];

  const dokumentMeta = await Promise.all(
    dokument.map(async (d) => {
      const full = await repository.getDocument(d.id);
      const ext = d.filnamn.includes('.') ? d.filnamn.split('.').pop() : 'pdf';
      const zipSökväg = `dokument/${d.id}_${d.filnamn}`;
      dokumentPoster.push({ zipSökväg, blob: full?.blob });
      return { id: d.id, dokumenttyp: d.dokumenttyp, filnamn: d.filnamn, mime: d.mime, storlek: d.storlek, uploaded: d.uploaded, _zipSökväg: zipSökväg };
    })
  );

  if (toast) toast('Skapar ZIP…');

  // Bygg ZIP
  const zip = new JSZip();

  // Paketmanifest – all strukturell data i en fil
  const manifest = {
    _version: 1,
    _exportad: new Date().toISOString(),
    projekt: project,
    avvikelser: avvikelserMedFotoMeta,
    ritningar: ritningarMeta,
    dokument: dokumentMeta,
  };
  zip.file('projekt.json', JSON.stringify(manifest, null, 2));

  // Lägg till binärfiler
  for (const { zipSökväg, blob } of [...fotoPoster, ...ritningPoster, ...dokumentPoster]) {
    if (!blob) continue;
    const buffer = await blob.arrayBuffer();
    zip.file(zipSökväg, buffer);
  }

  let zipBlob;
  try {
    zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  } catch (fel) {
    throw new Error(`Kunde inte skapa ZIP-filen: ${fel.message}`);
  }

  const filnamn = `projekt_${guid.slice(0, 8)}.zip`;
  const fil = new File([zipBlob], filnamn, { type: 'application/zip' });

  // Dela via Web Share API om det stöds (iOS Safari), annars nedladdning
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [fil] })) {
    try {
      await navigator.share({
        title: `Projekt: ${project.Title}`,
        text: 'Bifogat projektpaket från utförandekontroll-appen.',
        files: [fil],
      });
    } catch (fel) {
      // AbortError = användaren avbröt – inget felmeddelande
      if (fel.name !== 'AbortError') throw new Error(`Delning misslyckades: ${fel.message}`);
    }
  } else {
    // Fallback: nedladdning via länk
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filnamn;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    if (toast) toast(`Nedladdning startad: ${filnamn}`);
  }
}
