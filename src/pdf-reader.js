import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

function normalizeCells(items, yTolerance = 2.2) {
  const rows = [];
  const sorted = items
    .filter((item) => item.str && item.transform)
    .map((item) => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5], width: item.width ?? 0 }))
    .filter((item) => item.text)
    .sort((a, b) => b.y - a.y || a.x - b.x);

  for (const item of sorted) {
    let row = rows.find((r) => Math.abs(r.y - item.y) <= yTolerance);
    if (!row) {
      row = { y: item.y, cells: [] };
      rows.push(row);
    }
    row.cells.push(item);
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const cells = row.cells.sort((a, b) => a.x - b.x);
      return {
        y: row.y,
        cells,
        text: cells.map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim(),
      };
    });
}

export async function readPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];

  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const textContent = await page.getTextContent();
    pages.push({ page: pageNo, lines: normalizeCells(textContent.items) });
  }

  return { pages, pageCount: doc.numPages };
}
