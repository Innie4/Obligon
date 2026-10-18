import PDFDocument from "pdfkit";
import { businessTimeZone } from "./time.js";

function header(doc, title, subtitle) {
  doc.fontSize(22).fillColor("#0f172a").text("OBLIGON LTD", { continued: false });
  doc.moveDown(0.2).fontSize(11).fillColor("#64748b").text("Fleet fuel management • Lagos, Nigeria");
  doc.moveDown(1).fontSize(18).fillColor("#0f172a").text(title);
  if (subtitle) doc.fontSize(10).fillColor("#64748b").text(subtitle);
  doc.moveDown(1);
}

const pdfText = (value) => String(value ?? "").replaceAll("₦", "NGN ");

function cellLines(doc, value, width) {
  const lines = [];
  for (const paragraph of pdfText(value).split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (doc.widthOfString(candidate) <= width) { current = candidate; continue; }
      if (current) { lines.push(current); current = ""; }
      // An identifier without spaces must also fit its cell, without losing characters.
      for (const character of word) {
        if (current && doc.widthOfString(current + character) > width) { lines.push(current); current = ""; }
        current += character;
      }
    }
    lines.push(current);
  }
  return lines;
}

function table(doc, columns, rows) {
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const scale = Math.min(1, width / totalWidth);
  const cells = columns.map(column => ({ ...column, width: column.width * scale }));
  const padding = 8;
  doc.fontSize(9);
  const lineHeight = doc.currentLineHeight(true);
  const headerLines = cells.map(column => cellLines(doc, column.label, column.width - 12));
  const headerHeight = Math.max(24, Math.max(...headerLines.map(lines => lines.length)) * lineHeight + padding * 2);
  const bottom = () => doc.page.height - doc.page.margins.bottom;
  let y = doc.y + 10;

  function drawLines(lines, top, offset = 0, count = Infinity) {
    let x = left;
    cells.forEach((column, index) => {
      lines[index].slice(offset, offset + count).forEach((line, lineIndex) => {
        doc.text(line, x + 6, top + padding + lineIndex * lineHeight, { width: column.width - 12, lineBreak: false });
      });
      x += column.width;
    });
  }
  function drawHeader() {
    doc.rect(left, y, width, headerHeight).fill("#f1f5f9");
    doc.fillColor("#0f172a").fontSize(9);
    drawLines(headerLines, y);
    y += headerHeight;
  }
  function nextPage() {
    doc.addPage();
    y = doc.page.margins.top;
    drawHeader();
  }
  if (y + headerHeight > bottom()) { doc.addPage(); y = doc.page.margins.top; }
  drawHeader();
  rows.forEach((row, index) => {
    const lines = cells.map(column => cellLines(doc, row[column.key], column.width - 12));
    const lineCount = Math.max(...lines.map(cell => cell.length));
    const rowHeight = Math.max(24, lineCount * lineHeight + padding * 2);
    const freshCapacity = Math.floor((bottom() - doc.page.margins.top - headerHeight - padding * 2) / lineHeight);
    if (y + rowHeight > bottom() && lineCount <= freshCapacity) nextPage();
    let offset = 0;
    while (offset < lineCount) {
      let capacity = Math.floor((bottom() - y - padding * 2) / lineHeight);
      if (capacity < 1) { nextPage(); capacity = Math.floor((bottom() - y - padding * 2) / lineHeight); }
      const count = Math.min(capacity, lineCount - offset);
      const height = Math.max(24, count * lineHeight + padding * 2);
      if (index % 2 === 1) doc.rect(left, y, width, height).fill("#f8fafc");
      doc.fillColor("#334155").fontSize(9);
      drawLines(lines, y, offset, count);
      y += height;
      offset += count;
      if (offset < lineCount) nextPage();
    }
  });
  doc.x = left;
  doc.y = y + 10;
}

function streamBuffer(doc) {
  return new Promise((resolve) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.end();
  });
}

export async function receiptPdf({ reference, createdAt, station, fuelType, litres, amountLabel, status, vehicle, holder }) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  header(doc, "Fuel Purchase Receipt", `Reference ${reference}`);
  doc.fontSize(10).fillColor("#334155");
  doc.text(`Date: ${new Date(createdAt).toLocaleString("en-NG", { timeZone: businessTimeZone() })}`);
  doc.text(`Station: ${station}`);
  doc.text(`Card holder: ${holder ?? "Not available"}`);
  if (vehicle) doc.text(`Vehicle: ${vehicle}`);
  doc.moveDown(1);
  table(
    doc,
    [
      { key: "item", label: "Item", width: 200 },
      { key: "qty", label: "Quantity", width: 120 },
      { key: "amount", label: "Amount", width: 180 }
    ],
    [{ item: fuelType, qty: `${litres} L`, amount: amountLabel }]
  );
  doc.fontSize(12).fillColor("#0f172a").text(`Total: ${pdfText(amountLabel)}`, { align: "right" });
  doc.moveDown(2).fontSize(9).fillColor("#64748b").text(`Status: ${status} • Generated by Obligon LTD`, { align: "center" });
  return streamBuffer(doc);
}

export async function invoicePdf({ number, createdAt, orgName, planName, amountLabel, status, periodLabel }) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  header(doc, `Invoice ${number}`, `Billed to ${orgName}`);
  doc.fontSize(10).fillColor("#334155");
  doc.text(`Issued: ${new Date(createdAt).toLocaleDateString("en-NG", { timeZone: businessTimeZone() })}`);
  doc.text(`Plan: ${planName}`);
  doc.text(`Period: ${periodLabel}`);
  doc.moveDown(1);
  table(
    doc,
    [
      { key: "desc", label: "Description", width: 300 },
      { key: "amount", label: "Amount", width: 200 }
    ],
    [{ desc: `${planName} subscription - ${periodLabel}`, amount: amountLabel }]
  );
  doc.fontSize(12).fillColor("#0f172a").text(`Total: ${pdfText(amountLabel)}`, { align: "right" });
  doc.moveDown(1).fontSize(11).fillColor("#059669").text(`Status: ${status.toUpperCase()}`, { align: "right" });
  doc.moveDown(2).fontSize(9).fillColor("#64748b").text("Payable via your billing dashboard. Generated by Obligon LTD.", { align: "center" });
  return streamBuffer(doc);
}

export async function reportPdf({ title, subtitle, columns, rows }) {
  const doc = new PDFDocument({ size: "A4", margin: 50, layout: columns.length > 4 ? "landscape" : "portrait" });
  header(doc, title, subtitle);
  table(doc, columns, rows);
  doc.moveDown(1).fontSize(9).fillColor("#64748b").text(`Generated ${new Date().toLocaleString("en-NG", { timeZone: businessTimeZone() })} • Obligon LTD`, doc.page.margins.left, doc.y, { align: "center", width: doc.page.width - doc.page.margins.left - doc.page.margins.right });
  return streamBuffer(doc);
}
