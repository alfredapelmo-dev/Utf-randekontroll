import { html, useState, useEffect, useRef } from '../ui.js';
import { STATUS_COLOR, can, QUICK_SYMBOLS, DEFAULT_SYMBOL, FLAG_OFFSET_DEFAULT } from '../models.js';
import { SYMBOL_COMP } from '../iso7010.js';
import { SymbolPicker } from './SymbolPicker.js';

const QUICK_LABEL = Object.fromEntries(QUICK_SYMBOLS.map((s) => [s.key, s.label]));
const MAX_RECENT = 4; // hur många senast använda snabbsymboler som visas i raden

const MIN_SCALE = 0.4;
const MAX_SCALE = 8;
const FLAG_HALF_H = 13; // halva flagghöjden (px) – varifrån ledarlinjen startar

// Ritningsvy (kärnfunktionen). Pan/zoom med touch + mus, ISO 7010-markörer som
// SVG-lager. Avvikelser (W021) visas som en flagga med löpnummer + ledarlinje ner
// till punkten (pilspets).
//
// Låst redigeringsläge (gäller både ny utplacering och markerad befintlig flagga):
//   • ett finger drar punkten (pilspetsen)
//   • två fingrar flyttar ID-rutan (flaggan) – pilspetsen står kvar
//   • tryck = nästa steg (ny: bekräfta+öppna formulär · befintlig: öppna meny)
// Befintlig flagga markeras genom att man trycker på den. Åtgärdsraden ger
// snabbval (Markera åtgärdad / Klar / Avbryt). Koordinater sparas relativt (0–1);
// flaggans offset i FlaggaOffsetX/Y.
export function DrawingView({ repository, project, ritningId, role, refreshKey, onSelectDeviation, onRequestProtocol, toast }) {
  const stageRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef({ downTime: 0, downPt: null, moved: false, panId: null, pinchDist: 0, mid: null });

  // Låst redigering (gester routas till stage när edit ≠ null).
  const lockPtrsRef = useRef(new Map());
  const lockRef = useRef({ mode: null, downTime: 0, startPt: null, moved: false, startAnchor: null, startFlag: null, startCentroid: null });

  const [drawing, setDrawing] = useState(null);     // { RitningId, blob, ... }
  const [drawingUrl, setDrawingUrl] = useState(null);
  const [imgNat, setImgNat] = useState(null);       // { w, h }
  const [base, setBase] = useState(null);           // { w, h } visningsstorlek vid scale=1
  const [deviations, setDeviations] = useState([]);
  const [markers, setMarkers] = useState([]);          // interna arbetsmarkörer
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  // Verktyg + redigering. `activeTool` = valt verktyg (null = panorera/inget).
  // `edit` ≠ null låser ritningen:
  //   { kind:'new'|'existing', deviation?, symbol, relX, relY, flagX, flagY, label }
  const [activeTool, setActiveTool] = useState(null);
  const editRef = useRef(null);
  const [edit, setEditState] = useState(null);
  const setEdit = (val) => {
    setEditState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      editRef.current = next;
      return next;
    });
  };

  const [view, setViewState] = useState({ scale: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  const setView = (updater) => {
    setViewState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      viewRef.current = next;
      return next;
    });
  };

  const canCreate = can(role, 'createDeviation');
  const locked = !!edit;

  // ---- Ladda vald ritning som objectURL
  useEffect(() => {
    let url = null;
    (async () => {
      const d = ritningId ? await repository.getDrawing(ritningId) : null;
      if (d && d.blob) {
        url = URL.createObjectURL(d.blob);
        setDrawing(d);
        setDrawingUrl(url);
      } else {
        setDrawing(null);
        setDrawingUrl(null);
      }
    })();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [repository, ritningId]);

  // ---- Ladda avvikelser för den valda ritningen (filtrera projektets avvikelser)
  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await repository.listDeviations(project.ProjektGuid);
      const forDrawing = ritningId ? list.filter((d) => d.RitningId === ritningId) : list;
      if (alive) setDeviations(forDrawing);
    })();
    return () => { alive = false; };
  }, [repository, project.ProjektGuid, ritningId, refreshKey]);

  // ---- Ladda interna arbetsmarkörer för den valda ritningen
  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await repository.listMarkers(project.ProjektGuid);
      const forDrawing = ritningId ? list.filter((m) => m.RitningId === ritningId) : list;
      if (alive) setMarkers(forDrawing);
    })();
    return () => { alive = false; };
  }, [repository, project.ProjektGuid, ritningId, refreshKey]);

  // ---- Passa in ritningen (contain) och centrera
  function fit() {
    const stage = stageRef.current;
    if (!stage || !imgNat) return;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    const ar = imgNat.w / imgNat.h;
    let bw = sw, bh = bw / ar;
    if (bh > sh) { bh = sh; bw = bh * ar; }
    setBase({ w: bw, h: bh });
    setView({ scale: 1, tx: (sw - bw) / 2, ty: (sh - bh) / 2 });
  }

  useEffect(() => { fit(); /* när bildens naturliga storlek är känd */ // eslint-disable-next-line
  }, [imgNat]);

  useEffect(() => {
    const onResize = () => fit();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  // eslint-disable-next-line
  }, [imgNat]);

  // ---- Hjul-zoom (desktop) – icke-passiv för att kunna preventDefault
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e) => {
      e.preventDefault();
      if (editRef.current) return; // ritningen låst under redigering
      const rect = stage.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setView((v) => {
        const ns = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
        const k = ns / v.scale;
        return { scale: ns, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
      });
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, []);

  // ---- Pointer-gester på stage. Routar till låst-läge när edit ≠ null.
  function onPointerDown(e) {
    if (editRef.current) return onLockDown(e);
    const stage = stageRef.current;
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    const pts = pointersRef.current;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestureRef.current;
    if (pts.size === 1) {
      g.moved = false; g.downTime = Date.now();
      g.downPt = { x: e.clientX, y: e.clientY }; g.panId = e.pointerId;
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      g.pinchDist = dist(a, b);
      g.mid = midLocal(a, b, stage);
      g.panId = null;
    }
  }

  function onPointerMove(e) {
    if (editRef.current) return onLockMove(e);
    const pts = pointersRef.current;
    if (!pts.has(e.pointerId)) return;
    const stage = stageRef.current;
    const prev = pts.get(e.pointerId);
    const cur = { x: e.clientX, y: e.clientY };
    pts.set(e.pointerId, cur);
    const g = gestureRef.current;

    if (pts.size === 1 && g.panId === e.pointerId) {
      const dx = cur.x - prev.x, dy = cur.y - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true;
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
    } else if (pts.size >= 2) {
      g.moved = true;
      const [a, b] = [...pts.values()];
      const d = dist(a, b);
      const m = midLocal(a, b, stage);
      if (g.pinchDist > 0) {
        const ratio = d / g.pinchDist;
        setView((v) => {
          const ns = clamp(v.scale * ratio, MIN_SCALE, MAX_SCALE);
          const k = ns / v.scale;
          let tx = m.x - (m.x - v.tx) * k;
          let ty = m.y - (m.y - v.ty) * k;
          if (g.mid) { tx += m.x - g.mid.x; ty += m.y - g.mid.y; }
          return { scale: ns, tx, ty };
        });
      }
      g.pinchDist = d; g.mid = m;
    }
  }

  function onPointerUp(e) {
    if (editRef.current) return onLockUp(e);
    const pts = pointersRef.current;
    const g = gestureRef.current;
    pts.delete(e.pointerId);

    if (pts.size === 0) {
      const dt = Date.now() - g.downTime;
      if (!g.moved && dt < 350 && g.downPt && base) {
        const rel = screenToRel(g.downPt.x, g.downPt.y);
        if (rel) {
          if (activeTool === 'W021') {
            // Avvikelse → låst läge (justera punkt/flagga, bekräfta öppnar formulär).
            if (!canCreate) { if (toast) toast('Rollen kan inte skapa avvikelser'); }
            else setEdit({ kind: 'new', symbol: 'W021', relX: rel.relX, relY: rel.relY, flagX: FLAG_OFFSET_DEFAULT.x, flagY: FLAG_OFFSET_DEFAULT.y, label: 'ID' });
          } else if (activeTool) {
            // Snabbsymbol = intern arbetsmarkör → placeras direkt, inget formulär.
            placeMarker(activeTool, rel.relX, rel.relY);
          } else if (toast) {
            toast('Välj Avvikelse eller en snabbsymbol');
          }
        }
      }
      g.panId = null; g.pinchDist = 0; g.mid = null; g.downPt = null;
    } else if (pts.size === 1) {
      g.panId = [...pts.keys()][0]; g.pinchDist = 0; g.mid = null;
    }
  }

  // Markera befintlig flagga → låst redigering (flytta punkt/flagga + meny).
  function selectFlag(d, index) {
    const offX = typeof d.FlaggaOffsetX === 'number' ? d.FlaggaOffsetX : FLAG_OFFSET_DEFAULT.x;
    const offY = typeof d.FlaggaOffsetY === 'number' ? d.FlaggaOffsetY : FLAG_OFFSET_DEFAULT.y;
    setEdit({ kind: 'existing', deviation: d, symbol: 'W021', relX: d.KoordinatX, relY: d.KoordinatY, flagX: offX, flagY: offY, label: index + 1 });
  }

  // ---- Låst läge: 1 finger flyttar punkten, 2 fingrar flyttar flaggan, tryck = nästa
  function onLockDown(e) {
    const stage = stageRef.current;
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    const m = lockPtrsRef.current;
    m.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = lockRef.current;
    const p = editRef.current;
    if (m.size === 1) {
      g.mode = 'point'; g.downTime = Date.now(); g.moved = false;
      g.startPt = { x: e.clientX, y: e.clientY };
      g.startAnchor = { x: p.relX, y: p.relY };
    } else if (m.size === 2 && p && p.symbol === 'W021') {
      // Två fingrar → flytta ID-rutan (flaggan). Pilspetsen står kvar.
      const pts = [...m.values()];
      g.mode = 'flag'; g.moved = true;
      g.startCentroid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      g.startFlag = { x: p.flagX, y: p.flagY };
    }
  }

  function onLockMove(e) {
    const m = lockPtrsRef.current;
    if (!m.has(e.pointerId)) return;
    m.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = lockRef.current;
    const v = viewRef.current;
    if (!base) return;
    if (m.size >= 2 && g.mode === 'flag') {
      const pts = [...m.values()];
      const cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2;
      const dx = (cx - g.startCentroid.x) / v.scale / base.w;
      const dy = (cy - g.startCentroid.y) / v.scale / base.h;
      setEdit((p) => (p ? { ...p, flagX: g.startFlag.x + dx, flagY: g.startFlag.y + dy } : p));
    } else if (m.size === 1 && g.mode === 'point') {
      const dxs = e.clientX - g.startPt.x, dys = e.clientY - g.startPt.y;
      if (Math.abs(dxs) + Math.abs(dys) > 3) g.moved = true;
      const nx = clamp(g.startAnchor.x + dxs / v.scale / base.w, 0, 1);
      const ny = clamp(g.startAnchor.y + dys / v.scale / base.h, 0, 1);
      setEdit((p) => (p ? { ...p, relX: nx, relY: ny } : p));
    }
  }

  function onLockUp(e) {
    const m = lockPtrsRef.current;
    const g = lockRef.current;
    m.delete(e.pointerId);
    if (m.size === 0) {
      const dt = Date.now() - g.downTime;
      const p = editRef.current;
      if (g.mode === 'point' && !g.moved && dt < 350 && p && p.kind === 'new') {
        // Ny markering: tryck bekräftar och öppnar formuläret.
        createAt(p.relX, p.relY, p.symbol, { x: p.flagX, y: p.flagY });
        setEdit(null); setActiveTool(null);
      }
      // Befintlig flagga: flytta med drag, öppna avvikelsen via kugghjulet.
      g.mode = null;
    } else if (m.size === 1) {
      // Tillbaka till ett finger → fortsätt flytta punkten (utan hopp).
      const [only] = [...m.values()];
      const p = editRef.current;
      g.mode = 'point'; g.moved = true; g.downTime = Date.now();
      g.startPt = { x: only.x, y: only.y };
      g.startAnchor = p ? { x: p.relX, y: p.relY } : null;
    }
  }

  // ---- Spara/avsluta redigering av befintlig flagga
  async function persistEdit(extra = {}) {
    const e = editRef.current;
    if (!e || e.kind !== 'existing') return null;
    try {
      const saved = await repository.saveDeviation({
        ...e.deviation,
        KoordinatX: round3(e.relX), KoordinatY: round3(e.relY),
        FlaggaOffsetX: round3(e.flagX), FlaggaOffsetY: round3(e.flagY),
        ...extra,
      });
      setDeviations((list) => list.map((x) => (x.AvvikelseGuid === saved.AvvikelseGuid ? saved : x)));
      return saved;
    } catch (err) {
      console.warn(err); if (toast) toast('Kunde inte spara'); return null;
    }
  }

  async function editOpenMenu() {
    const saved = await persistEdit();
    setEdit(null);
    if (saved) onSelectDeviation(saved);
  }
  async function editMarkFixed() {
    await persistEdit({ Status: 'Åtgärdad' });
    setEdit(null);
    if (toast) toast('Markerad som åtgärdad');
  }
  async function editDone() {
    await persistEdit();
    setEdit(null);
  }
  function editCancel() { setEdit(null); }

  // Skärmkoordinat → relativ (0–1) ritningskoordinat, klampad.
  function screenToRel(clientX, clientY) {
    const stage = stageRef.current;
    if (!stage || !base) return null;
    const v = viewRef.current;
    const rect = stage.getBoundingClientRect();
    const sx = clientX - rect.left, sy = clientY - rect.top;
    const relX = ((sx - v.tx) / v.scale) / base.w;
    const relY = ((sy - v.ty) / v.scale) / base.h;
    return { relX: clamp(relX, 0, 1), relY: clamp(relY, 0, 1) };
  }

  function createAt(relX, relY, symbol = DEFAULT_SYMBOL, flag = FLAG_OFFSET_DEFAULT) {
    onSelectDeviation({
      __isNew: true,
      ProjektGuid: project.ProjektGuid,
      RitningId: drawing ? drawing.RitningId : ritningId,
      KoordinatX: round3(relX), KoordinatY: round3(relY),
      Symbol: symbol,
      FlaggaOffsetX: round3(flag.x), FlaggaOffsetY: round3(flag.y),
      Title: '', Beskrivning: '',
      Allvarlighetsgrad: 'Medel', Status: 'Öppen',
      Ansvarig: project.Besiktningsman || null,
      FotoReferenser: [],
    });
  }

  // ---- Interna arbetsmarkörer (snabbsymboler)
  async function placeMarker(symbol, relX, relY) {
    try {
      const saved = await repository.saveMarker({
        ProjektGuid: project.ProjektGuid,
        RitningId: drawing ? drawing.RitningId : ritningId,
        Symbol: symbol,
        KoordinatX: round3(relX), KoordinatY: round3(relY),
      });
      setMarkers((list) => [...list, saved]);
    } catch (err) {
      console.warn(err); if (toast) toast('Kunde inte placera markör');
    }
  }

  async function removeMarker(id) {
    try {
      await repository.deleteMarker(id);
      setMarkers((list) => list.filter((m) => m.id !== id));
      setSelectedMarker(null);
      if (toast) toast('Markör borttagen');
    } catch (err) {
      console.warn(err); if (toast) toast('Kunde inte ta bort markör');
    }
  }

  // Väljer en snabbsymbol (från picker eller snabbknapp) som aktivt verktyg.
  function chooseQuickSymbol(key) {
    setActiveTool(key);
    setShowPicker(false);
    setSelectedMarker(null);
  }

  function zoomBy(factor) {
    if (locked) return;
    const stage = stageRef.current; if (!stage) return;
    const cx = stage.clientWidth / 2, cy = stage.clientHeight / 2;
    setView((v) => {
      const ns = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
      const k = ns / v.scale;
      return { scale: ns, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k };
    });
  }

  const summary = ['Öppen', 'Åtgärdad', 'Verifierad'].map((s) => ({
    s, n: deviations.filter((d) => d.Status === s).length,
  }));

  // Användning per snabbsymbol i aktuellt projekt → frekvens i picker + ordning
  // för "senast använda"-raden bredvid Avvikelse-knappen.
  const usage = markers.reduce((m, mk) => { m[mk.Symbol] = (m[mk.Symbol] || 0) + 1; return m; }, {});
  const recentSymbols = (() => {
    const seen = new Set();
    const out = [];
    // Senast använda först (markers laddas i Created-ordning → gå baklänges).
    for (let i = markers.length - 1; i >= 0; i--) {
      const k = markers[i].Symbol;
      if (!seen.has(k)) { seen.add(k); out.push(k); }
      if (out.length >= MAX_RECENT) break;
    }
    return out;
  })();

  const activeLabel = activeTool
    ? (activeTool === 'W021' ? 'Avvikelse' : (QUICK_LABEL[activeTool] || 'symbol'))
    : null;
  const hint = locked
    ? (edit.kind === 'existing'
        ? '1 finger: flytta punkt · 2 fingrar: flytta ID-ruta · ⚙ öppnar avvikelsen'
        : '1 finger: flytta punkt · 2 fingrar: flytta ID-ruta · tryck: klar')
    : activeTool
      ? `Tryck på ritningen för att placera ${activeLabel}.`
      : canCreate
        ? 'Välj Avvikelse eller en snabbsymbol nedan, eller tryck på en flagga.'
        : 'Tryck på en markör för att öppna avvikelsen.';

  // Skärmposition för en relativ koordinat.
  const toScreen = (rx, ry) => ({
    x: view.tx + rx * base.w * view.scale,
    y: view.ty + ry * base.h * view.scale,
  });

  // Befintliga avvikelseflaggor (W021), utom den som redigeras (ritas som aktiv).
  const editingGuid = (edit && edit.kind === 'existing') ? edit.deviation.AvvikelseGuid : null;
  const flagViews = base ? deviations.map((d, i) => {
    if ((d.Symbol || 'W021') !== 'W021') return null;
    if (d.AvvikelseGuid === editingGuid) return null;
    const offX = typeof d.FlaggaOffsetX === 'number' ? d.FlaggaOffsetX : FLAG_OFFSET_DEFAULT.x;
    const offY = typeof d.FlaggaOffsetY === 'number' ? d.FlaggaOffsetY : FLAG_OFFSET_DEFAULT.y;
    const a = toScreen(d.KoordinatX, d.KoordinatY);
    const f = toScreen(d.KoordinatX + offX, d.KoordinatY + offY);
    return { d, index: i, label: i + 1, ax: a.x, ay: a.y, fx: f.x, fy: f.y, color: STATUS_COLOR[d.Status] || '#999' };
  }).filter(Boolean) : [];

  // Aktiv flagga (ny utplacering eller markerad befintlig under flytt).
  const activeFlag = (edit && base && edit.symbol === 'W021') ? (() => {
    const a = toScreen(edit.relX, edit.relY);
    const f = toScreen(edit.relX + edit.flagX, edit.relY + edit.flagY);
    const color = edit.kind === 'existing' ? (STATUS_COLOR[edit.deviation.Status] || '#999') : STATUS_COLOR['Öppen'];
    return { ax: a.x, ay: a.y, fx: f.x, fy: f.y, color, label: edit.label };
  })() : null;

  return html`
    <div class="content">
      <div class="drawing-head">
        <h2>${project.Title}</h2>
        ${summary.map(({ s, n }) => html`
          <span class="pill" key=${s}><span class="swatch" style=${{ background: STATUS_COLOR[s] }}></span>${n} ${s.toLowerCase()}</span>`)}
        ${can(role, 'exportPdf') && html`
          <button class="btn primary sm" onClick=${onRequestProtocol}>📄 Protokoll</button>`}
      </div>

      <div class=${'stage' + (locked ? ' locked' : '')} ref=${stageRef}
           onPointerDown=${onPointerDown}
           onPointerMove=${onPointerMove}
           onPointerUp=${onPointerUp}
           onPointerCancel=${onPointerUp}>
        ${drawingUrl
          ? html`
            <div class="canvas" style=${{
                width: (base ? base.w : 0) + 'px',
                height: (base ? base.h : 0) + 'px',
                transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
              }}>
              <img src=${drawingUrl} alt="Planritning"
                   onLoad=${(e) => setImgNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })} />
            </div>
            <div class="markers">
              ${base && html`
                <svg class="leaders" width="100%" height="100%" aria-hidden="true">
                  ${flagViews.map((it) => leaderSvg(it.fx, it.fy, it.ax, it.ay, it.color, it.d.AvvikelseGuid))}
                  ${activeFlag && leaderSvg(activeFlag.fx, activeFlag.fy, activeFlag.ax, activeFlag.ay, activeFlag.color, 'active')}
                </svg>`}

              ${flagViews.map((it) => html`
                <button class="flag" key=${it.d.AvvikelseGuid}
                        style=${{ left: it.fx + 'px', top: it.fy + 'px', borderColor: it.color, color: it.color }}
                        disabled=${locked} title=${it.d.Title}
                        onPointerDown=${(e) => e.stopPropagation()}
                        onClick=${(e) => { e.stopPropagation(); selectFlag(it.d, it.index); }}>
                  ${it.label}
                </button>`)}

              ${/* Interna arbetsmarkörer (snabbsymboler) – ej i protokoll */ ''}
              ${base && markers.map((m) => {
                const p = toScreen(m.KoordinatX, m.KoordinatY);
                const Comp = SYMBOL_COMP[m.Symbol] || SYMBOL_COMP.W021;
                const sel = selectedMarker === m.id;
                return html`
                  <button class=${'marker symbol' + (sel ? ' sel' : '')} key=${m.id}
                          style=${{ left: p.x + 'px', top: p.y + 'px' }}
                          title=${QUICK_LABEL[m.Symbol] || m.Symbol} disabled=${locked}
                          onPointerDown=${(e) => e.stopPropagation()}
                          onClick=${(e) => { e.stopPropagation(); setSelectedMarker(sel ? null : m.id); }}>
                    <span class="sym-wrap" style=${{ borderColor: sel ? 'var(--brand)' : '#999' }}><${Comp} size=${24} /></span>
                  </button>`;
              })}

              ${activeFlag && html`
                <div class="flag pending" style=${{ left: activeFlag.fx + 'px', top: activeFlag.fy + 'px', color: activeFlag.color }}>
                  ${activeFlag.label}
                </div>`}

              ${activeFlag && edit.kind === 'existing' && html`
                <button class="flag-gear" style=${{ left: activeFlag.fx + 'px', top: activeFlag.fy + 'px' }}
                        title="Öppna avvikelse" aria-label="Öppna avvikelse"
                        onPointerDown=${(e) => e.stopPropagation()}
                        onClick=${(e) => { e.stopPropagation(); editOpenMenu(); }}>⚙</button>`}

              ${edit && base && edit.symbol !== 'W021' && (() => {
                const p = toScreen(edit.relX, edit.relY);
                const Comp = SYMBOL_COMP[edit.symbol] || SYMBOL_COMP.W021;
                return html`
                  <div class="marker pending symbol" style=${{ left: p.x + 'px', top: p.y + 'px' }}>
                    <span class="sym-wrap"><${Comp} size=${30} /></span>
                  </div>`;
              })()}
            </div>`
          : html`<div class="empty" style=${{ position: 'absolute', inset: 0 }}><p>Ritning saknas.</p></div>`}
      </div>

      ${/* ---- Verktygsrad UNDER ritningen ---- */ ''}
      ${canCreate && html`
        <div class="tool-bar" role="toolbar" aria-label="Verktyg">
          <button class=${'tool-btn primary-tool' + (activeTool === 'W021' ? ' active' : '')}
                  aria-pressed=${activeTool === 'W021'} disabled=${locked}
                  onClick=${() => setActiveTool(activeTool === 'W021' ? null : 'W021')}>
            <${SYMBOL_COMP.W021} size=${24} /><span>Avvikelse</span>
          </button>

          <div class="tool-divider" aria-hidden="true"></div>

          ${recentSymbols.map((key) => {
            const Comp = SYMBOL_COMP[key];
            const active = activeTool === key;
            return html`
              <button key=${key} class=${'tool-btn icon-tool' + (active ? ' active' : '')}
                      aria-pressed=${active} disabled=${locked}
                      title=${QUICK_LABEL[key] || key}
                      onClick=${() => setActiveTool(active ? null : key)}>
                ${Comp ? html`<${Comp} size=${24} />` : '⬚'}
              </button>`;
          })}

          <button class="tool-btn quick-tool" disabled=${locked} onClick=${() => setShowPicker(true)}>
            <span class="quick-plus">＋</span><span>Snabbsymbol</span>
          </button>
        </div>`}

      ${/* ---- Borttagningsrad för vald intern markör ---- */ ''}
      ${selectedMarker && !locked && (() => {
        const m = markers.find((x) => x.id === selectedMarker);
        if (!m) return null;
        return html`
          <div class="edit-bar">
            <span class="eb-label">${QUICK_LABEL[m.Symbol] || m.Symbol} (intern markör)</span>
            <div class="spacer"></div>
            <button class="btn danger sm" onClick=${() => removeMarker(m.id)}>Ta bort</button>
            <button class="btn ghost sm" onClick=${() => setSelectedMarker(null)}>Avbryt</button>
          </div>`;
      })()}

      ${locked && html`
        <div class="edit-bar">
          <span class="eb-label">${edit.kind === 'existing' ? `Avvikelse #${edit.label}` : 'Ny markering'}</span>
          <div class="spacer"></div>
          ${edit.kind === 'existing' ? html`
            <button class="btn sm" onClick=${editMarkFixed} disabled=${edit.deviation.Status === 'Åtgärdad'}>Markera åtgärdad</button>
            <button class="btn primary sm" onClick=${editDone}>Klar</button>
            <button class="btn ghost sm" onClick=${editCancel}>Avbryt</button>
          ` : html`
            <button class="btn ghost sm" onClick=${() => { setEdit(null); setActiveTool(null); }}>Avbryt</button>
          `}
        </div>`}

      <div class="zoom-tools">
        <button class="btn sm" onClick=${() => zoomBy(1.25)} disabled=${locked} aria-label="Zooma in">＋</button>
        <button class="btn sm" onClick=${() => zoomBy(0.8)} disabled=${locked} aria-label="Zooma ut">－</button>
        <button class="btn sm" onClick=${fit} disabled=${locked}>Återställ vy</button>
        <span class=${'hint' + (locked ? ' locked' : '')}>${hint}</span>
      </div>

      ${showPicker && html`
        <${SymbolPicker}
          usage=${usage}
          onPick=${chooseQuickSymbol}
          onClose=${() => setShowPicker(false)} />`}
    </div>`;
}

// -------- hjälpare
// Ledarlinje från flaggans underkant (kort lodrätt + diagonal) med pilspets vid punkten.
function leaderSvg(fx, fy, ax, ay, color, key) {
  const by = fy + FLAG_HALF_H;           // flaggans underkant
  const elbowY = by + 12;                // litet lodrätt streck innan diagonalen
  return html`
    <g key=${key}>
      <path d=${`M ${fx} ${by} L ${fx} ${elbowY} L ${ax} ${ay}`}
            fill="none" stroke=${color} stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
      <path d=${arrowPath(ax, ay, fx, elbowY)}
            fill="none" stroke=${color} stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
    </g>`;
}

function arrowPath(ax, ay, fromx, fromy) {
  let dx = ax - fromx, dy = ay - fromy;
  const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
  const ah = 9, a = 0.5;
  const r = (vx, vy, t) => ({ x: vx * Math.cos(t) - vy * Math.sin(t), y: vx * Math.sin(t) + vy * Math.cos(t) });
  const b1 = r(-dx, -dy, a), b2 = r(-dx, -dy, -a);
  return `M ${ax + b1.x * ah} ${ay + b1.y * ah} L ${ax} ${ay} L ${ax + b2.x * ah} ${ay + b2.y * ah}`;
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function midLocal(a, b, stage) {
  const r = stage.getBoundingClientRect();
  return { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function round3(v) { return Math.round(v * 1000) / 1000; }
