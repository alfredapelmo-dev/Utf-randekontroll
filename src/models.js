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
