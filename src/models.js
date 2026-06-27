// Gemensam datamodell / domänkonstanter (se Datamodell.txt).
// Samma värden används genom hela trappan Demo -> Beta -> Produktion.

export const PROJECT_STATUS = ['Pågående', 'Avslutad', 'Arkiverad'];
export const DEVIATION_STATUS = ['Öppen', 'Åtgärdad', 'Verifierad'];
export const SEVERITY = ['Låg', 'Medel', 'Hög', 'Kritisk'];
export const ROLES = ['Besiktningsman', 'Entreprenör', 'Läsare'];

// Verktyg/symboler som kan placeras på ritningen (ISO 7010-nycklar). Markörtypen
// sparas på avvikelseposten i fältet `Symbol`. Komponenterna finns i iso7010.js.
export const SYMBOLS = [
  { key: 'W021', label: 'Avvikelse' },
  { key: 'F001', label: 'Brandsläckare' },
  { key: 'E001', label: 'Nödutgång' },
];
export const DEFAULT_SYMBOL = 'W021';

// -------------------------------------------------------------------
// SNABBSYMBOLER = interna arbetsmarkörer.
// Placeras på ritningen för internt arbete (släckutrustning, utrymning m.m.)
// och lagras i en EGEN store (`markers`), åtskild från avvikelser. De kommer
// ALDRIG med i protokollet/PDF:en – uteslutningen sker i datamodellen, inte med
// villkor i rapportkoden.
//
// Ordningen här är fallback (mest använda först) tills projektets faktiska bruk
// räknas i SymbolPicker. Utöka listan fritt – UI:t läser den dynamiskt och
// SYMBOL_COMP i iso7010.js måste ha en komponent för varje key.
// -------------------------------------------------------------------
export const QUICK_SYMBOLS = [
  // Intern kontrollmarkör
  { key: 'CHECK', label: 'Kontrollerad', kategori: 'Kontroll' },

  // Släckutrustning
  { key: 'HANDBRANDSLACKARE',     label: 'Handbrandsläckare',    kategori: 'Släckutrustning' },
  { key: 'INOMHUSBRANDPOST',      label: 'Inomhusbrandpost',     kategori: 'Släckutrustning' },

  // Larm
  { key: 'LARMTRYCKKNAPP',        label: 'Larmtryckknapp',       kategori: 'Larm' },
  { key: 'BRANDLARMCENTRAL',      label: 'Brandlarmcentral',     kategori: 'Larm' },
  { key: 'BRANDVARNARE_DETEKTOR', label: 'Brandvarnare/detektor',kategori: 'Larm' },
  { key: 'LARMDON',               label: 'Larmdon',              kategori: 'Larm' },
  { key: 'OPTISKT_LARMDON',       label: 'Optiskt larmdon',      kategori: 'Larm' },
  { key: 'BLIXTLJUS',             label: 'Blixtljus',            kategori: 'Larm' },

  // Information
  { key: 'BRANDFORSVARSTABLA',    label: 'Brandförsvastavla',    kategori: 'Information' },
  { key: 'TECKENFORKLARING',      label: 'Teckenförklaring',     kategori: 'Information' },

  // Ventilation / rökkontroll
  { key: 'BRANDGASFLAKT',         label: 'Brandgasfläkt',        kategori: 'Ventilation' },
  { key: 'ROKLUCKA',              label: 'Röklueka',             kategori: 'Ventilation' },

  // Utrymning – skyltning
  { key: 'GENOMLYST_UTRYMNINGSSKYLT',           label: 'Genomlyst utrymningsskylt',              kategori: 'Utrymning' },
  { key: 'GENOMLYST_UTRYMNINGSSKYLT_2',         label: 'Genomlyst utrymningsskylt 2',            kategori: 'Utrymning' },
  { key: 'GENOMLYST_M_RULLSTOLSPICTOGRAM',      label: 'Genomlyst m. rullstolspictogram',        kategori: 'Utrymning' },
  { key: 'NY_GENOMLYST_UTRYMNINGSSKYLT',        label: 'Ny genomlyst utrymningsskylt',           kategori: 'Utrymning' },
  { key: 'NY_GENOMLYST_UTRYMNINGSSKYLT_2',      label: 'Ny genomlyst utrymningsskylt 2',         kategori: 'Utrymning' },
  { key: 'NY_GENOMLYST_M_RULLSTOLSPICTOGRAM',   label: 'Ny genomlyst m. rullstolspictogram',     kategori: 'Utrymning' },
  { key: 'EFTERLYSANDE_UTRYMNINGSKYLT',         label: 'Efterlysande utrymningsskylt',           kategori: 'Utrymning' },
  { key: 'NY_EFTERLYSANDE_UTRYMNINGSKYLT',      label: 'Ny efterlysande utrymningsskylt',        kategori: 'Utrymning' },
  { key: 'EFTERLYSANDE_M_RULLSTOLSPICTOGRAM',   label: 'Efterlysande m. rullstolspictogram',     kategori: 'Utrymning' },
  { key: 'NY_EFTERLYSANDE_M_RULLSTOLSPICTOGRAM',label: 'Ny efterlysande m. rullstolspictogram',  kategori: 'Utrymning' },

  // Utrymning – vägar och platser
  { key: 'UTRYMNINGSVAG',              label: 'Utrymningsväg',               kategori: 'Utrymning' },
  { key: 'TILLTRADESVAG_RADDNINGSTJANST', label: 'Tillträdesväg räddningstjänst', kategori: 'Utrymning' },
  { key: 'FONSTERUTRYMNING',           label: 'Fönsterutrymning',            kategori: 'Utrymning' },
  { key: 'UTRYMNING_VIA_BALKONG',      label: 'Utrymning via balkong',       kategori: 'Utrymning' },
  { key: 'UTRYMNINGSPLATS',            label: 'Utrymningsplats',             kategori: 'Utrymning' },
  { key: 'UTRYMNINGSPLAN',             label: 'Utrymningsplan',              kategori: 'Utrymning' },
  { key: 'TRAPPA_FOR_UTRYMNING',       label: 'Trappa för utrymning',        kategori: 'Utrymning' },

  // Dörrar
  { key: 'ATERINRYMNING_VIA_DORR',     label: 'Återinrymning via dörr',      kategori: 'Dörrar' },
  { key: 'FRANGANGLIG_DORR',           label: 'Framgånglig dörr',            kategori: 'Dörrar' },
  { key: 'UPPSTALLNING_AV_DORR',       label: 'Uppställning av dörr',        kategori: 'Dörrar' },
  { key: 'NODOPPNINGSKNAPP',           label: 'Nödöppningsknapp',            kategori: 'Dörrar' },
];

// Snabbsymbol (bock) som bekräftar att något är kontrollerat och OK. Placeras
// med långtryck (håll ~3 s) på ritningen och lagras som intern markör – kommer,
// liksom övriga snabbsymboler, ALDRIG med i protokollet.
export const CHECK_SYMBOL = 'CHECK';

// Avvikelser visas som en flagga (löpnummer) med en flyttbar ledarlinje ner till
// punkten. Standardläge för flaggan: upp och något åt höger om punkten. Offset i
// relativa ritningskoordinater (samma 0–1-system som KoordinatX/Y), sparas per post
// i fälten FlaggaOffsetX/FlaggaOffsetY.
export const FLAG_OFFSET_DEFAULT = { x: 0.06, y: -0.16 };

// Statusfärger – oförändrade genom hela trappan.
export const STATUS_COLOR = {
  'Öppen': '#E53935',       // Röd
  'Åtgärdad': '#FDD835',    // Gul (åtgärdad, ej verifierad)
  'Verifierad': '#43A047',  // Grön
};
// Läsbar textfärg ovanpå respektive statusfärg.
export const STATUS_TEXT_ON = {
  'Öppen': '#ffffff',
  'Åtgärdad': '#5b4a00',
  'Verifierad': '#ffffff',
};

export const SEVERITY_RANK = { 'Låg': 1, 'Medel': 2, 'Hög': 3, 'Kritisk': 4 };

// Klientgenererat GUID – skapas vid skapande (även offline), ändras aldrig.
// Stabil nyckel genom hela synken (se Datamodell.txt).
export function newGuid() {
  if (window.crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC4122 v4-fallback (äldre Safari)
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = [...buf].map((b) => b.toString(16).padStart(2, '0'));
  return (
    hex.slice(0, 4).join('') + '-' +
    hex.slice(4, 6).join('') + '-' +
    hex.slice(6, 8).join('') + '-' +
    hex.slice(8, 10).join('') + '-' +
    hex.slice(10, 16).join('')
  );
}

export function nowIso() {
  return new Date().toISOString();
}

export function formatDate(iso) {
  if (!iso) return '–';
  try {
    return new Date(iso).toLocaleDateString('sv-SE');
  } catch (e) {
    return String(iso);
  }
}

export function personName(p) {
  if (!p) return '–';
  if (typeof p === 'string') return p;
  return p.displayName || p.email || '–';
}

// -------------------------------------------------------------------
// Rollbaserat UI (ENDAST demo – ingen riktig behörighet). Mappas senare
// mot Azure AD-roller i Beta. Styr vilka knappar/funktioner som visas.
// -------------------------------------------------------------------
const PERMISSIONS = {
  Besiktningsman: {
    createDeviation: true, editCore: true, editDescription: true,
    changeStatus: true, verify: true, addPhoto: true, deleteDeviation: true, exportPdf: true,
  },
  Entreprenör: {
    createDeviation: false, editCore: false, editDescription: true,
    changeStatus: true, verify: false, addPhoto: true, deleteDeviation: false, exportPdf: true,
  },
  Läsare: {
    createDeviation: false, editCore: false, editDescription: false,
    changeStatus: false, verify: false, addPhoto: false, deleteDeviation: false, exportPdf: true,
  },
};

export function can(role, action) {
  const p = PERMISSIONS[role];
  return !!(p && p[action]);
}

// Vilka statusval en roll får sätta (Entreprenör kan markera Åtgärdad men inte Verifiera).
export function allowedStatusesFor(role) {
  if (!can(role, 'changeStatus')) return [];
  return can(role, 'verify') ? DEVIATION_STATUS.slice() : ['Öppen', 'Åtgärdad'];
}
