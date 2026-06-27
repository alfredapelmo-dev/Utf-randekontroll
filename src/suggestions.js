// Rubrikförslag för avvikelser ("brister").
//
// Förslagen kommer från TVÅ källor som slås ihop och rangordnas:
//   1. Redan ifyllda brister – rubriker på avvikelser som redan registrerats i
//      projektet. Appen "lär sig" alltså av faktisk användning.
//   2. En inbyggd startlista (COMMON_DEVIATIONS) med vanliga brandskydds-brister.
//      Den är medvetet fröet till den FRAMTIDA förslagsdatabasen.
//
// FRAMÅTKOMPATIBILITET: hela utbytespunkten ligger i buildSuggestionCorpus(). När
// en riktig förslagsdatabas finns (egen SharePoint-lista / API i Beta) byts bara
// den funktionen ut – formuläret och rangordningen (rankSuggestions) är oförändrade.
// Samma mönster som Repository -> LocalRepository/GraphRepository.

// Inbyggd startlista – vanliga brister vid brandbesiktning/utförandekontroll.
// Utöka fritt; detta är embryot till förslagsdatabasen.
export const COMMON_DEVIATIONS = [
  'Blockerad utrymningsväg',
  'Uppställd branddörr',
  'Bristfällig tätning vid branddörr',
  'Trasig nödbelysning',
  'Saknad vägledande markering (nödutgångsskylt)',
  'Saknad eller blockerad brandsläckare',
  'Otätad genomföring i brandcellsgräns',
  'Bristfällig brandtätning kring kabelstege',
  'Skadad brandcellsgräns',
  'Brandfarlig vara felaktigt förvarad',
  'Saknad eller felmonterad dörrstängare',
  'Felaktig eller utlöst detektor',
  'Igensatt brandgasventilation / röklucka',
  'Blockerad räddningsväg eller uppställningsplats',
  'Sprinkler blockerad eller övermålad',
];

// Bygger en rangordnings-korpus: [{ text, count, source }].
// `source`: 'historik' (redan ifylld brist) | 'standard' (inbyggd startlista).
// Detta är UTBYTESPUNKTEN mot en framtida förslagsdatabas.
export async function buildSuggestionCorpus(repository, projektGuid) {
  const byKey = new Map();
  const add = (text, source) => {
    const t = (text || '').trim();
    if (!t) return;
    const key = t.toLowerCase();
    const cur = byKey.get(key);
    if (cur) {
      cur.count += 1;
      // En rubrik som faktiskt använts räknas som historik även om den också
      // finns i startlistan.
      if (source === 'historik') cur.source = 'historik';
    } else {
      byKey.set(key, { text: t, count: 1, source });
    }
  };

  // 1) Redan ifyllda brister i projektet (lär av faktisk användning).
  try {
    const devs = await repository.listDeviations(projektGuid);
    devs.forEach((d) => add(d.Title, 'historik'));
  } catch (_) { /* tom korpus om läsning misslyckas */ }

  // 2) Inbyggd startlista (fröet till förslagsdatabasen).
  COMMON_DEVIATIONS.forEach((t) => add(t, 'standard'));

  return [...byKey.values()];
}

// Ren rangordning av korpusen mot en query. Prefixträff väger tyngre än delsträng,
// högre frekvens väger tyngre. Exakt match utesluts (inget att föreslå då).
export function rankSuggestions(query, corpus, limit = 6) {
  const q = (query || '').trim().toLowerCase();

  // Tom query: visa vanligast använda/standard som snabbval.
  if (!q) {
    return [...corpus]
      .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text, 'sv'))
      .slice(0, limit);
  }

  const scored = [];
  for (const item of corpus) {
    const t = item.text.toLowerCase();
    if (t === q) continue;                 // redan exakt ifylld
    let score;
    if (t.startsWith(q)) score = 100;
    else if (t.includes(q)) score = 50;
    else continue;                          // ingen träff
    score += Math.min(item.count, 20);      // frekvensvikt (mättad)
    if (item.source === 'historik') score += 5; // egna brister först vid lika
    scored.push({ ...item, score });
  }
  scored.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text, 'sv'));
  return scored.slice(0, limit);
}
