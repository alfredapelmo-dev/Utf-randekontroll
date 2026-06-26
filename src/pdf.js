// Klientsidig PDF-generering (fungerar offline). Bygger ett besiktnings-
// protokoll med projektinfo, ritningsutsnitt per avvikelse, foton, statuslista
// och signatur. Använder vendrade jsPDF (window.jspdf).

import { STATUS_COLOR, STATUS_TEXT_ON, DEVIATION_STATUS, formatDate, personName } from './models.js';

const PAGE_W = 210;
const PAGE_H = 297;
const M = 15;            // marginal
const CW = PAGE_W - 2 * M; // innehållsbredd

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Skär ut ett utsnitt av ritningen runt avvikelsens koordinat och ritar en
// statusfärgad markör. Returnerar { dataUrl, w, h } (px).
async function cropDrawing(drawingBlob, relX, relY, statusColor) {
  const url = URL.createObjectURL(drawingBlob);
  try {
    const img = await loadImage(url);
    const nW = img.naturalWidth, nH = img.naturalHeight;
    const outW = 900, outH = 560;
    const cw = Math.min(nW, nW * 0.45);
    const ch = Math.min(nH, cw * (outH / outW));
    let sx = relX * nW - cw / 2;
    let sy = relY * nH - ch / 2;
    sx = Math.max(0, Math.min(sx, nW - cw));
    sy = Math.max(0, Math.min(sy, nH - ch));

    const canvas = document.createElement('canvas');
    canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, outW, outH);

    // markör
    const px = ((relX * nW - sx) / cw) * outW;
    const py = ((relY * nH - sy) / ch) * outH;
    ctx.beginPath();
    ctx.arc(px, py, 16, 0, Math.PI * 2);
    ctx.fillStyle = statusColor;
    ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.stroke();

    return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), w: outW, h: outH };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function imgFormat(dataUrl) {
  return /^data:image\/png/i.test(dataUrl) ? 'PNG' : 'JPEG';
}

export async function buildProtocolPdf({
  project, deviations, photosByDev, drawingBlob, signatureDataUrl, signerName, signerRole,
}) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = M;

  const ensure = (h) => {
    if (y + h > PAGE_H - M) { doc.addPage(); y = M; }
  };

  // ---- Sidhuvud
  doc.setFillColor(...hexToRgb('#C62828'));
  doc.rect(0, 0, PAGE_W, 22, 'F');
  doc.setTextColor('#ffffff');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('Besiktningsprotokoll', M, 14);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text('Utförandekontroll', PAGE_W - M, 14, { align: 'right' });
  y = 30;

  // ---- Projektinfo
  doc.setTextColor('#1f2329');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
  doc.text(String(project.Title || 'Projekt'), M, y); y += 7;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  const meta = [
    ['Kund/Beställare', project.Kund || '–'],
    ['Adress', project.Adress || '–'],
    ['Besiktningsman', personName(project.Besiktningsman)],
    ['Status', project.Status || '–'],
    ['Datum', formatDate(new Date().toISOString())],
    ['Antal avvikelser', String(deviations.length)],
  ];
  for (const [k, v] of meta) {
    doc.setTextColor('#6b7280'); doc.text(`${k}:`, M, y);
    doc.setTextColor('#1f2329'); doc.text(String(v), M + 40, y);
    y += 6;
  }
  y += 2;

  // ---- Statussummering (färgade chips)
  const counts = DEVIATION_STATUS.map((s) => ({
    s, n: deviations.filter((d) => d.Status === s).length,
  }));
  let cx = M;
  for (const { s, n } of counts) {
    const label = `${n} ${s}`;
    doc.setFontSize(10);
    const w = doc.getTextWidth(label) + 10;
    doc.setFillColor(...hexToRgb(STATUS_COLOR[s]));
    doc.roundedRect(cx, y, w, 8, 2, 2, 'F');
    doc.setTextColor(STATUS_TEXT_ON[s]);
    doc.text(label, cx + 5, y + 5.5);
    cx += w + 4;
  }
  y += 14;

  // ---- Sammanställning (tabell)
  doc.setTextColor('#1f2329'); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Sammanställning', M, y); y += 6;
  doc.setFontSize(9);
  doc.setTextColor('#6b7280');
  doc.text('#', M, y); doc.text('Avvikelse', M + 8, y);
  doc.text('Allvarlighet', M + 110, y); doc.text('Status', M + 150, y);
  y += 2; doc.setDrawColor('#e3e6ea'); doc.line(M, y, M + CW, y); y += 4;

  doc.setFont('helvetica', 'normal');
  deviations.forEach((d, i) => {
    ensure(7);
    doc.setTextColor('#1f2329');
    doc.text(String(i + 1), M, y);
    const title = doc.splitTextToSize(String(d.Title || '–'), 96)[0];
    doc.text(title, M + 8, y);
    doc.setTextColor('#6b7280');
    doc.text(String(d.Allvarlighetsgrad || '–'), M + 110, y);
    // statusprick
    doc.setFillColor(...hexToRgb(STATUS_COLOR[d.Status] || '#999999'));
    doc.circle(M + 150, y - 1.2, 1.6, 'F');
    doc.setTextColor('#1f2329');
    doc.text(String(d.Status || '–'), M + 154, y);
    y += 6;
  });
  y += 4;

  // ---- Detalj per avvikelse
  for (let i = 0; i < deviations.length; i++) {
    const d = deviations[i];
    const statusColor = STATUS_COLOR[d.Status] || '#999999';

    ensure(20);
    doc.setDrawColor('#e3e6ea'); doc.line(M, y, M + CW, y); y += 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor('#1f2329');
    doc.text(`${i + 1}. ${d.Title || '–'}`, M, y); y += 6;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor('#6b7280');
    const detail = [
      `Allvarlighetsgrad: ${d.Allvarlighetsgrad || '–'}`,
      `Status: ${d.Status || '–'}`,
      `Ansvarig: ${personName(d.Ansvarig)}`,
      `Åtgärdad: ${formatDate(d.AtgardadDatum)}    Verifierad: ${formatDate(d.VerifieradDatum)}`,
    ];
    for (const line of detail) { ensure(5.5); doc.text(line, M, y); y += 5; }

    if (d.Beskrivning) {
      doc.setTextColor('#1f2329');
      const wrapped = doc.splitTextToSize(String(d.Beskrivning), CW);
      ensure(wrapped.length * 5 + 2);
      doc.text(wrapped, M, y); y += wrapped.length * 5 + 2;
    }

    // Ritningsutsnitt
    if (drawingBlob && typeof d.KoordinatX === 'number' && typeof d.KoordinatY === 'number') {
      try {
        const crop = await cropDrawing(drawingBlob, d.KoordinatX, d.KoordinatY, statusColor);
        const w = 110, h = w * (crop.h / crop.w);
        ensure(h + 4);
        doc.addImage(crop.dataUrl, 'JPEG', M, y, w, h);
        doc.setFontSize(8); doc.setTextColor('#6b7280');
        doc.text('Ritningsutsnitt', M, y + h + 3);
        y += h + 7;
      } catch (e) { console.warn('crop', e); }
    }

    // Foton
    const photos = photosByDev[d.AvvikelseGuid] || [];
    if (photos.length) {
      const pw = 42, gap = 4, perRow = Math.max(1, Math.floor((CW + gap) / (pw + gap)));
      for (let pi = 0; pi < photos.length; pi++) {
        const col = pi % perRow;
        if (col === 0) ensure(pw + 6);
        const xPos = M + col * (pw + gap);
        try {
          const dataUrl = await blobToDataURL(photos[pi].blob);
          const im = await loadImage(dataUrl);
          const ratio = im.naturalHeight / im.naturalWidth || 1;
          const h = Math.min(pw * ratio, 50);
          doc.addImage(dataUrl, imgFormat(dataUrl), xPos, y, pw, h);
        } catch (e) { console.warn('photo', e); }
        if (col === perRow - 1 || pi === photos.length - 1) y += pw + 6;
      }
    }
    y += 2;
  }

  // ---- Signatur
  ensure(46);
  doc.setDrawColor('#e3e6ea'); doc.line(M, y, M + CW, y); y += 8;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor('#1f2329');
  doc.text('Underskrift', M, y); y += 4;
  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, 'PNG', M, y, 70, 26);
    } catch (e) { console.warn('sign', e); }
  }
  doc.setDrawColor('#9aa3ad'); doc.line(M, y + 28, M + 70, y + 28);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor('#6b7280');
  doc.text(`${signerName || personName(project.Besiktningsman)} · ${signerRole || 'Besiktningsman'}`, M, y + 33);
  doc.text(`Datum: ${formatDate(new Date().toISOString())}`, M, y + 38);

  // ---- Spara / ladda ner (fungerar offline)
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = String(project.Title || 'Projekt').replace(/[^\wåäöÅÄÖ\- ]+/g, '').trim();
  const filename = `Protokoll_${safeName}_${dateStr}.pdf`;

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);

  return { filename, url };
}
