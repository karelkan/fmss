// FMSS – dokumentatsioon (etapp 12): site/doc/index.html on kooskõlas koodi, DISAIN.md sõnastiku ja
// näidismudelitega. Dokument on käsitsi kirjutatud; test annab märku, kui see jääb maha.
// Käivitamine: npm test. DISAIN.md osa 21, VALIDEERIMINE.md etapp 12.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LayoutSvg } from '../tools/layout_svg.js';

const ROOT = new URL('../', import.meta.url);
const Read = path => readFileSync(new URL(path, ROOT), 'utf8');
const DOC = Read('site/doc/index.html');

// HTML-lõigu tekst: sildid ära, olemid lahti, tühikud kokku
const PlainText = fragment => fragment.replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
// Markdowni lahtri tekst: `kood` ja **paks** ära
const PlainMarkdown = cell => cell.replace(/`/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

// DISAIN.md osa 12.2 sõnastiku read: [nimed, tunnus]
function GlossaryRows() {
  const text = Read('DISAIN.md');
  const part = text.slice(text.indexOf('### 12.2'), text.indexOf('## 13.'));
  return part.split('\n')
    .filter(line => line.startsWith('|') && !line.startsWith('| Nimi') && !line.startsWith('|---'))
    .map(line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()))
    .map(([names, , tag]) => [PlainMarkdown(names), tag.replace(/\s+/g, ' ')]);
}

// dokumendi tabelite read antud klassiga: lahtrite tekstid
function DocTableRows(className) {
  const rows = [];
  for (const table of DOC.matchAll(new RegExp(`<table class="${className}">([\\s\\S]*?)</table>`, 'g'))) {
    for (const row of table[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
      const cells = [...row[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map(cell => PlainText(cell[1]));
      if (cells.length > 0) rows.push(cells);
    }
  }
  return rows;
}

test('D1 iga DISAIN.md sõnastiku rida on dokumendis samade nimede ja tunnusega', () => {
  const glossary = GlossaryRows();
  assert.ok(glossary.length > 150, `sõnastikus ${glossary.length} rida`);
  // nimed ja tunnus; sama nimelahter (nt „abiprotseduurid“) võib olla mitu korda
  const doc = DocTableRows('glossary').map(cells => `${cells[0]} → ${cells[cells.length - 1]}`);
  for (const [names, tag] of glossary) {
    const index = doc.indexOf(`${names} → ${tag}`);
    assert.ok(index >= 0, `dokumendi sõnastikus puudub või tunnus erineb: ${names} → ${tag}`);
    doc.splice(index, 1);
  }
  assert.deepEqual(doc, [], 'dokumendis on ridu, mida DISAIN.md-s pole');
});

test('D2 iga EventHandler (fms_sim.js) on dokumendi tabelis 7.2', () => {
  const source = Read('core/fms_sim.js');
  const block = source.match(/const EventHandlers = \{([\s\S]*?)\};/)[1];
  const handlers = [...block.matchAll(/(\w+): (\w+Proc)/g)].map(match => [match[2], match[1]]);
  assert.ok(handlers.length >= 11);
  const doc = DocTableRows('handlers');
  for (const [proc, event] of handlers) {
    const row = doc.find(cells => cells[0] === proc);
    assert.ok(row, `tabelis 7.2 puudub ${proc}`);
    assert.equal(row[1], event, `${proc} sündmus`);
    const header = source.match(new RegExp(`// (\\[[^\\]]+\\]) ${proc} `));
    assert.ok(header, `${proc} päisekommentaar`);
    assert.equal(row[3], header[1], `${proc} tunnus`);
  }
  assert.equal(doc.length, handlers.length, 'tabelis on käsitlejaid, mida koodis pole');
});

test('D3 paigutuse joonised vastavad näidismudelitele (tools/layout_svg.js)', () => {
  const figures = [['j33', 'models/agv.fms.json'], ['j41', 'models/demo.fms.json'], ['j91', 'models/reduktor.fms.json']];
  for (const [id, file] of figures) {
    const embedded = DOC.match(new RegExp(`<svg viewBox="[^"]*" role="img" aria-labelledby="${id}-title">[\\s\\S]*?</svg>`));
    assert.ok(embedded, `joonis ${id} puudub`);
    const expected = LayoutSvg(JSON.parse(Read(file)), id);
    const actual = embedded[0].replace(new RegExp(`(<title id="${id}-title">)[^<]*`), '$1TITLE');
    assert.equal(actual, expected, `${id} (${file}) – genereeri uuesti: node tools/layout_svg.js ${file} ${id}`);
  }
});

test('D4 sisukorra lingid, viited joonistele ja tabelitele, pildid', () => {
  const ids = new Set([...DOC.matchAll(/ id="([^"]+)"/g)].map(match => match[1]));
  for (const [, target] of DOC.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(target), `link #${target}`);
  const figures = new Set([...DOC.matchAll(/<b>Joonis (\d+\.\d+)\.<\/b>/g)].map(match => match[1]));
  const tables = new Set([...DOC.matchAll(/Tabel (\d+\.\d+)\. /g)].map(match => match[1]));
  // viited tekstis; „diplomitöö tabelist 5.5“ jm on originaali tabelid ja joonised
  const text = PlainText(DOC.replace(/<(style|svg|figcaption)[\s\S]*?<\/\1>/g, ''));
  for (const match of text.matchAll(/\b(joonis|tabel)\w* (\d+\.\d+)/gi)) {
    if (/diplomitöö\s*$/i.test(text.slice(Math.max(0, match.index - 12), match.index))) continue;
    const known = match[1].toLowerCase() === 'joonis' ? figures : tables;
    assert.ok(known.has(match[2]), `viide: ${match[0]}`);
  }
  for (const [, src] of DOC.matchAll(/<img src="([^"]+)"/g)) {
    assert.ok(existsSync(new URL(`site/doc/${src}`, ROOT)), `pilt ${src}`);
  }
  assert.equal([...DOC.matchAll(/<b>Joonis /g)].length, figures.size, 'joonise numbrid ei kordu');
});

test('D5 dokument kirjeldab praegust versiooni', () => {
  const [major, minor] = JSON.parse(Read('package.json')).version.split('.');
  assert.ok(DOC.includes(`dokumentatsioon versioonile ${major}.${minor}`), 'tiitelleht');
  assert.ok(DOC.includes(`kirjeldab FMSS-i versiooni ${major}.${minor}`), 'jalus');
  // tabel 8.2: testide arv failide kaupa annab kokku tekstis oleva arvu
  const testCount = Number(DOC.match(/versioonis \d+\.\d+ on neid (\d+)/)[1]);
  const table = DOC.slice(DOC.indexOf('Tabel 8.2.'), DOC.indexOf('</table>', DOC.indexOf('Tabel 8.2.')));
  const listed = [...table.matchAll(/<td class="num">(\d+)<\/td>/g)].reduce((sum, match) => sum + Number(match[1]), 0);
  assert.equal(listed, testCount, 'tabel 8.2 kokku');
});

test('D6 tools/site.sh paneb dokumendi saidile /doc/ ja avaleht viitab sellele', () => {
  const out = mkdtempSync(join(tmpdir(), 'fmss-site-'));
  try {
    execFileSync('sh', [new URL('tools/site.sh', ROOT).pathname, out], { stdio: 'ignore' });
    assert.ok(existsSync(join(out, 'doc/index.html')), 'doc/index.html');
    for (const [, src] of DOC.matchAll(/<img src="([^"]+)"/g)) assert.ok(existsSync(join(out, 'doc', src)), src);
    assert.ok(existsSync(join(out, 'v1/fonts/WebPlus_IBM_EGA_8x14.woff')), 'EGA font (../v1/fonts/)');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
  assert.ok(Read('site/index.html').includes('href="doc/"'), 'avaleht → doc/');
  assert.ok(DOC.includes('href="../"') && DOC.includes('href="../v1/"'), 'dokument → avaleht ja rakendus');
});
