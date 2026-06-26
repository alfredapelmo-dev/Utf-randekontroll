// Seedar IndexedDB med mockdata vid första start (helt offline).
// Skriver direkt mot stores (inte via repository.saveX) så att syncQueue startar
// TOM – seedad data representerar redan befintliga poster. Användarens egna
// ändringar fyller sedan kön och demonstrerar offline-first.

import { getDB } from './db.js';
import { newGuid, nowIso } from './models.js';

export const DEMO_DRAWING_ID = 'plan1.png';

const PERSONS = {
  anna: { displayName: 'Anna Bergström', email: 'anna.bergstrom@example.se' },
  erik: { displayName: 'Erik Lund', email: 'erik.lund@example.se' },
  sara: { displayName: 'Sara Holm', email: 'sara.holm@bygg.example.se' },
  johan: { displayName: 'Johan Ek', email: 'johan.ek@bygg.example.se' },
};

async function fetchBlob(url) {
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Kunde inte ladda ${url} (${res.status})`);
  return res.blob();
}

function mkDev(projektGuid, title, besk, sev, status, ansvarig, x, y, fotoRefs) {
  const now = nowIso();
  return {
    AvvikelseGuid: newGuid(),
    ProjektGuid: projektGuid,
    Title: title,
    Beskrivning: besk,
    Allvarlighetsgrad: sev,
    Status: status,
    Ansvarig: ansvarig,
    RitningId: DEMO_DRAWING_ID,
    KoordinatX: x,
    KoordinatY: y,
    FotoReferenser: fotoRefs ? fotoRefs.slice() : [],
    AtgardadDatum: status === 'Åtgärdad' || status === 'Verifierad' ? now : null,
    VerifieradDatum: status === 'Verifierad' ? now : null,
    Created: now,
    Modified: now,
    _spId: null,
    _etag: null,
    _dirty: false,
  };
}

export async function seedIfEmpty() {
  const db = await getDB();
  if ((await db.count('projects')) > 0) return false;

  // Ritning (bundlad PNG) som Blob i IndexedDB.
  try {
    const blob = await fetchBlob('assets/drawing-sample.png');
    await db.put('drawings', {
      RitningId: DEMO_DRAWING_ID, namn: 'Plan 1', blob, bredd: 1600, hojd: 1120,
    });
  } catch (e) {
    console.warn('[seed] ritning:', e);
  }

  // Projekt
  const p1 = newGuid(), p2 = newGuid(), p3 = newGuid();
  const projects = [
    {
      ProjektGuid: p1, Title: 'Kv. Almen 3 – Ombyggnad', Status: 'Pågående',
      Kund: 'Almen Fastigheter AB', Adress: 'Storgatan 12, Norrköping',
      Beskrivning: 'Utförandekontroll av brandskydd vid ombyggnad av plan 1.',
      Medlemmar: [PERSONS.anna, PERSONS.erik, PERSONS.sara, PERSONS.johan],
      Besiktningsman: PERSONS.anna, MappRelativPath: '/Projekt/Kv. Almen 3',
    },
    {
      ProjektGuid: p2, Title: 'Skolan Lindansaren – Nybyggnad', Status: 'Pågående',
      Kund: 'Kommunfastigheter', Adress: 'Skolvägen 4, Linköping',
      Beskrivning: 'Slutbesiktning av brandskydd i nybyggd skolbyggnad.',
      Medlemmar: [PERSONS.erik, PERSONS.johan], Besiktningsman: PERSONS.erik,
      MappRelativPath: '/Projekt/Skolan Lindansaren',
    },
    {
      ProjektGuid: p3, Title: 'Lagerhall Syd – Garanti', Status: 'Avslutad',
      Kund: 'LogiPart AB', Adress: 'Industrigatan 9, Norrköping',
      Beskrivning: 'Garantibesiktning. Samtliga avvikelser verifierade.',
      Medlemmar: [PERSONS.anna, PERSONS.johan], Besiktningsman: PERSONS.anna,
      MappRelativPath: '/Projekt/Lagerhall Syd',
    },
  ];
  {
    const tx = db.transaction('projects', 'readwrite');
    for (const p of projects) {
      await tx.store.put({ ...p, Created: nowIso(), Modified: nowIso(), _spId: null, _etag: null, _dirty: false });
    }
    await tx.done;
  }

  // Avvikelser (koordinater relativt 0.0–1.0 av ritningens bredd/höjd).
  const devs = [
    mkDev(p1, 'Blockerad utrymningsväg', 'Pallar står placerade i utrymningsväg vid entrén.', 'Hög', 'Öppen', PERSONS.johan, 0.31, 0.88),
    mkDev(p1, 'Brandsläckare saknas', 'Handbrandsläckare saknas vid konferensrummet.', 'Medel', 'Åtgärdad', PERSONS.sara, 0.74, 0.22, ['photo-extinguisher.jpg']),
    mkDev(p1, 'Dörrstängare ur funktion', 'Branddörr mellan kontor och teknik stänger inte fullt.', 'Låg', 'Verifierad', PERSONS.johan, 0.66, 0.66, ['photo-door.jpg']),
    mkDev(p1, 'Otätad genomföring', 'Kabelgenomföring i brandcellsgräns är ej tätad.', 'Kritisk', 'Öppen', PERSONS.sara, 0.50, 0.50),
    mkDev(p2, 'Felaktig skyltning', 'Efterlysande hänvisningsskylt saknas vid trapphus.', 'Medel', 'Öppen', PERSONS.johan, 0.40, 0.30),
    mkDev(p2, 'Sprinkler ej trycksatt', 'Sektion B var ej trycksatt vid kontroll.', 'Hög', 'Åtgärdad', PERSONS.erik, 0.62, 0.55),
  ];
  {
    const tx = db.transaction('deviations', 'readwrite');
    for (const d of devs) await tx.store.put(d);
    await tx.done;
  }

  // Seed-foton som Blob, kopplade till respektive avvikelse via FotoReferenser.
  await seedPhoto(devs[1], 'photo-extinguisher.jpg');
  await seedPhoto(devs[2], 'photo-door.jpg');

  return true;
}

async function seedPhoto(dev, filename) {
  try {
    const blob = await fetchBlob(`assets/${filename}`);
    const db = await getDB();
    await db.put('photos', {
      id: newGuid(), AvvikelseGuid: dev.AvvikelseGuid, filnamn: filename, blob, created: nowIso(),
    });
  } catch (e) {
    console.warn('[seed] foto:', e);
  }
}
