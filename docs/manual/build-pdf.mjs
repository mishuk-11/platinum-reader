// Builds Platinum-Reader-Manual.pdf from master-manual.html with MuPDF (open source).
// Run: node docs/manual/build-pdf.mjs
import * as mupdf from 'mupdf'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))
let html = fs.readFileSync(path.join(dir, 'master-manual.html'), 'utf8')
// Screenshots inline as data URIs: MuPDF lays out HTML from memory, without a base folder.
html = html.replace(/src="(img\/[^"]+\.png)"/g, (_, f) => `src="data:image/png;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}"`)
// The PDF fonts have no emoji, so drop them (the HTML manual keeps them).
html = html.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]️?/gu, '').replace(/background: #f4f5f7;/, 'background: #ffffff;')

const doc = mupdf.Document.openDocument(new TextEncoder().encode(html), 'manual.html')
doc.layout(595, 842, 10.5) // A4 in points
const buf = new mupdf.Buffer()
const writer = new mupdf.DocumentWriter(buf, 'pdf', 'compress-images,garbage=compact')
for (let i = 0; i < doc.countPages(); i++) {
  const page = doc.loadPage(i)
  const dev = writer.beginPage(page.getBounds())
  page.run(dev, mupdf.Matrix.identity)
  writer.endPage()
}
writer.close()
const out = path.join(dir, 'Platinum-Reader-Manual.pdf')
fs.writeFileSync(out, buf.asUint8Array())
console.log(`${doc.countPages()} pages, ${(fs.statSync(out).size / 1048576).toFixed(1)} MB → ${out}`)
