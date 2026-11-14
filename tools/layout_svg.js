// FMSS – mudeli paigutus SVG-joonisena dokumentatsiooni jaoks (etapp 12).
//
//   node tools/layout_svg.js MUDEL.fms.json ID [X0 X1 Y0 Y1] > joonis.svg
//
// ID on joonise tunnus (nt j41): sellest tulevad <title> id ja ruudustiku mustri id, mis peavad lehel olema
// unikaalsed. X0 … Y1 lõikavad ruudustikust osa (vaikimisi kogu ruudustik). Väljund läheb faili
// site/doc/index.html <figure> sisse; <title> tekst (TITLE) kirjutatakse käsitsi. Värvid ja jooned tulevad
// lehe CSS-klassidest (lay-*, box, box-acc), seega joonis järgib heledat, tumedat ja prinditud välimust.
// Joonis on lihtsustatud (rada, jaamad, sõlmed, suunanool, objektid nimedega), mitte animaatori koopia.
import { readFileSync } from 'node:fs';

const CELL = 44;                                        // [U] ikooni külg joonisel, px
const SIDE_STEP = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const TRACK_PORTS = {                                   // [O] rajaikooni küljed (fms_glb.js IconTypes)
  VertTr: 'NS', HorTr: 'WE', ArcNE: 'NE', ArcSE: 'SE', ArcNW: 'NW', ArcSW: 'SW',
  TeeN: 'WE', TeeE: 'NS', TeeS: 'WE', TeeW: 'NS', Cruise: 'NESW', CrossOver: 'NESW',
};
const BUFFER_SYMBOL = { InBuf: '▲', OutBuf: '▼', InOutBuf: '↕', TurnBuf: '↻' };
const STATION_TARGETS = ['InBuf', 'OutBuf', 'InOutBuf', 'TurnBuf', 'FromCS', 'ToCS', 'SysOut', 'HorCon', 'VertCon'];

// [U] Num – arv SVG-sse (kuni 6 tüvenumbrit, ujukomamüra ära).
const Num = value => String(Number(value.toPrecision(6)));

// [U] LayoutSvg – mudeli paigutus SVG-tekstina. area = { X0, X1, Y0, Y1 } (lahtrid, kaasa arvatud).
export function LayoutSvg(model, id, area = null) {
  const { X0, X1, Y0, Y1 } = area ?? { X0: 0, X1: model.Layout.Dim.X - 1, Y0: 0, Y1: model.Layout.Dim.Y - 1 };
  const width = (X1 - X0 + 1) * CELL, height = (Y1 - Y0 + 1) * CELL;
  const cells = new Map(model.Layout.Cells.map(cell => [`${cell.X},${cell.Y}`, cell]));
  const out = [];
  const point = (x, y, side) => {
    const [dx, dy] = side ? SIDE_STEP[side] : [0, 0];
    return [(x - X0) * CELL + CELL / 2 + dx * CELL / 2, (y - Y0) * CELL + CELL / 2 + dy * CELL / 2];
  };
  const line = (a, b, cls) => out.push(`<path class="${cls}" d="M${Num(a[0])},${Num(a[1])} L${Num(b[0])},${Num(b[1])}"/>`);
  const objectName = (array, n) => array === 'Machines' ? model.Machines[n - 1].Name : `BUF${n}`;

  out.push(`<defs><pattern id="${id}-grid" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse" x="-1.2" y="-1.2"><circle class="lay-grid" cx="1.2" cy="1.2" r="1.2"/></pattern></defs>`);
  out.push(`<rect x="-1.2" y="-1.2" width="${Num(width + 2.4)}" height="${Num(height + 2.4)}" fill="url(#${id}-grid)"/>`);

  const sorted = [...model.Layout.Cells].sort((a, b) => a.X - b.X || a.Y - b.Y);
  for (const cell of sorted) {
    const { X: x, Y: y, T: type } = cell;
    if (x < X0 || x > X1 || y < Y0 || y > Y1) continue;
    const [cx, cy] = point(x, y, null);
    const left = (x - X0) * CELL, top = (y - Y0) * CELL;
    if (TRACK_PORTS[type]) {
      const cls = cell.Dot ? 'lay-dot' : 'lay-trk';
      const ports = TRACK_PORTS[type];
      if (type.startsWith('Arc')) {
        // veerandring ümber lahtri nurga, mille küljed kaar ühendab
        const a = point(x, y, ports[0]), b = point(x, y, ports[1]);
        const corner = [left + (ports.includes('E') ? CELL : 0), top + (ports.includes('S') ? CELL : 0)];
        const cross = (a[0] - corner[0]) * (b[1] - corner[1]) - (a[1] - corner[1]) * (b[0] - corner[0]);
        out.push(`<path class="${cls}" d="M${Num(a[0])},${Num(a[1])} A${CELL / 2},${CELL / 2} 0 0 ${cross > 0 ? 1 : 0} ${Num(b[0])},${Num(b[1])}"/>`);
      } else if (type === 'CrossOver') {
        // sild: N–S sirge, W–E poolringiga üle
        line(point(x, y, 'N'), point(x, y, 'S'), cls);
        const a = point(x, y, 'W'), b = point(x, y, 'E'), r = CELL / 5;
        out.push(`<path class="${cls}" d="M${Num(a[0])},${Num(a[1])} L${Num(cx - r)},${Num(cy)} A${Num(r)},${Num(r)} 0 0 1 ${Num(cx + r)},${Num(cy)} L${Num(b[0])},${Num(b[1])}"/>`);
      } else if (type === 'Cruise') {
        line(point(x, y, 'N'), point(x, y, 'S'), cls);
        line(point(x, y, 'W'), point(x, y, 'E'), cls);
        out.push(`<circle class="lay-node" cx="${Num(cx)}" cy="${Num(cy)}" r="3.5"/>`);
      } else {
        line(point(x, y, ports[0]), point(x, y, ports[1]), cls);
      }
      if (type.startsWith('Tee')) {
        // haru: punktiir või objekt -> jaam (sinine täpp), rada -> raja sõlm (valge ring)
        const branch = type[3];
        const neighbor = cells.get(`${x + SIDE_STEP[branch][0]},${y + SIDE_STEP[branch][1]}`) ?? {};
        const station = neighbor.Dot || STATION_TARGETS.includes(neighbor.T);
        line([cx, cy], point(x, y, branch), station ? 'lay-dot' : 'lay-trk');
        out.push(`<circle class="${station ? 'lay-station' : 'lay-node'}" cx="${Num(cx)}" cy="${Num(cy)}" r="${station ? 4 : 3.5}"/>`);
      }
      if (cell.Dir) {
        // suunanool: kolmnurk raja peal
        const [dx, dy] = SIDE_STEP[cell.Dir], size = 6;
        const tip = [cx + dx * size, cy + dy * size], base = [cx - dx * size, cy - dy * size];
        const px = -dy * size * 0.8, py = dx * size * 0.8;
        out.push(`<path class="lay-arrow" d="M${Num(tip[0])},${Num(tip[1])} L${Num(base[0] + px)},${Num(base[1] + py)} L${Num(base[0] - px)},${Num(base[1] - py)} z"/>`);
      }
    } else if (type === 'HorCon' || type === 'VertCon') {
      line(point(x, y, type === 'HorCon' ? 'W' : 'N'), point(x, y, type === 'HorCon' ? 'E' : 'S'), 'lay-trk');
      out.push(`<rect class="box" x="${Num(cx - 11)}" y="${Num(cy - 9)}" width="22" height="18" rx="2"/><text x="${Num(cx)}" y="${Num(cy + 3.5)}" text-anchor="middle" class="lay-t">CON</text>`);
    } else if (type.startsWith('MachTool')) {
      out.push(`<rect class="box-acc" x="${left + 3}" y="${top + 5}" width="${CELL - 6}" height="${CELL - 10}" rx="3"/>`);
      out.push(`<text x="${Num(cx)}" y="${Num(cy + 4)}" text-anchor="middle" class="lay-t t-b">${objectName('Machines', cell.N)}</text>`);
    } else if (BUFFER_SYMBOL[type]) {
      out.push(`<rect class="box" x="${left + 9}" y="${top + 6}" width="${CELL - 18}" height="${CELL - 12}" rx="2"/>`);
      out.push(`<text x="${Num(cx)}" y="${Num(cy + 1)}" text-anchor="middle" class="lay-t">${BUFFER_SYMBOL[type]}</text>`);
      out.push(`<text x="${Num(cx)}" y="${Num(cy + 11)}" text-anchor="middle" class="lay-s lay-dim">${objectName('Buffers', cell.N)}</text>`);
    } else if (type === 'FromCS' || type === 'ToCS' || type === 'SysOut') {
      out.push(`<rect class="box" x="${left + 2}" y="${top + 8}" width="${CELL - 4}" height="${CELL - 16}" rx="3"/>`);
      out.push(`<text x="${Num(cx)}" y="${Num(cy + 3.5)}" text-anchor="middle" class="lay-s t-b">${type}</text>`);
    }
  }
  return [
    `<svg viewBox="-2 -2 ${width + 4} ${height + 4}" role="img" aria-labelledby="${id}-title">`,
    `      <title id="${id}-title">TITLE</title>`,
    ...out.map(item => '      ' + item),
    '    </svg>',
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, id, ...range] = process.argv.slice(2);
  if (!file || !id) {
    console.error('kasutus: node tools/layout_svg.js MUDEL.fms.json ID [X0 X1 Y0 Y1]');
    process.exit(1);
  }
  const model = JSON.parse(readFileSync(file, 'utf8'));
  const area = range.length === 4 ? (([X0, X1, Y0, Y1]) => ({ X0, X1, Y0, Y1 }))(range.map(Number)) : null;
  console.log(LayoutSvg(model, id, area));
}
