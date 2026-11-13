// FMSS – redaktor: Layout (ruudustik ja ikoonid) ja View.
// Vastab originaali moodulile FMS_ED1.PAS (originaal.md 8.2). Disain: DISAIN.md osa 15.
// Nimed ja tunnused [O]/[T]/[U]: DISAIN.md osa 12.
//
// Osad:
//  - redigeerimise loogika (ilma brauserita, testitav Node'iga): IconFromPorts, LaySegment,
//    LayPath, PlaceIcon, EraseCell, MoveCell, CycleDirection, ResizeLayout. Kõik muudavad
//    mudelit (DISAIN.md osa 8) kohapeal;
//  - Layout: ülal ruudustik, all ikoonipalett (originaalis 13 × 4 ikooni ja palett, joon. 6.4).
//    Rada joonistatakse hiirega lohistades (või Shift + nool) ja ikoon valitakse automaatselt.
//    Paletist valitud ikooni klõps paneb täpselt selle ikooni nagu originaalis;
//  - View: kogu mudel korraga, ilma ruudustikuta (originaalis kuni 41 × 23 ikooni).
//
// Rada lahtris = küljed, mille kaudu rada ikooni läbib (CellPorts). Lohistamisel lisatakse
// lahtrile külg ja ikoon arvutatakse külgedest (IconFromPorts): kaks külge – sirge või kaar,
// kolm – hargnemine (Tee*), neli – ristmik. Külgi, mis naabriga pole ühendatud, arvesse ei võeta
// (LinkedPorts) – nii saab raja otsast pöörata.

import { IconTypes, DIRECTIONS, DirectionPorts, OPERATIONS, CheckModel, CellTrack } from './fms_glb.js';
import { Enumerate } from './fms_sim.js';
import { Texts, FormatText } from './fms_lng.js';
import { ROW_HEIGHT } from './fms_theme.js';
import { DrawLayout, DrawIcon, LayoutView } from './anima.js';
import { SetDesktopView, RequestRedraw, InputBox, MessageBox } from './windows.js';

// =====================================================================
// Konstandid
// =====================================================================

// [O] MAX_LAYOUT_DIM – ruudustiku suurim mõõt: View näitas kuni 41 × 23 ikooni (originaal.md 8.2).
export const MAX_LAYOUT_DIM = { X: 41, Y: 23 };
const UNDO_LIMIT = 100;                       // [U] mitu sammu saab tagasi võtta
const EGA_CELL = { Width: 48, Height: 35 };   // EGA ikoon ruudustikus (nagu animaatoris)
const EGA_PALETTE_CELL = { Width: 44, Height: 32 };
const MODERN_MAX_CELL = 72;
const MODERN_MIN_CELL = 36;
const MODERN_PALETTE_CELL = 34;
const PALETTE_ROWS = 2;

// [U] PALETTE – ikoonipalett: tööriistad (vali / liiguta, kustuta, suunanool) ja originaali
//     ikoonid (joon. 5.4) + sild (CrossOver, etapp 7a). Punktiirühendus (Dot) on raja ikoon
//     pikkusega 0 (lk 54).
export const PALETTE = [
  { Id: 'Select' }, { Id: 'Erase' }, { Id: 'Direction' },
  { Id: 'HorTr', T: 'HorTr' }, { Id: 'VertTr', T: 'VertTr' },
  { Id: 'ArcSE', T: 'ArcSE' }, { Id: 'ArcSW', T: 'ArcSW' }, { Id: 'ArcNE', T: 'ArcNE' }, { Id: 'ArcNW', T: 'ArcNW' },
  { Id: 'TeeN', T: 'TeeN' }, { Id: 'TeeS', T: 'TeeS' }, { Id: 'TeeE', T: 'TeeE' }, { Id: 'TeeW', T: 'TeeW' },
  { Id: 'Cruise', T: 'Cruise' }, { Id: 'CrossOver', T: 'CrossOver' },
  { Id: 'Dot', T: 'VertTr', Dot: true },
  { Id: 'HorCon', T: 'HorCon' }, { Id: 'VertCon', T: 'VertCon' },
  { Id: 'InBuf', T: 'InBuf' }, { Id: 'OutBuf', T: 'OutBuf' }, { Id: 'InOutBuf', T: 'InOutBuf' }, { Id: 'TurnBuf', T: 'TurnBuf' },
  { Id: 'MachToolDown', T: 'MachToolDown' }, { Id: 'MachToolUp', T: 'MachToolUp' },
  { Id: 'MachToolThruDown', T: 'MachToolThruDown' }, { Id: 'MachToolThruUp', T: 'MachToolThruUp' },
  { Id: 'FromCS', T: 'FromCS' }, { Id: 'ToCS', T: 'ToCS' }, { Id: 'SysOut', T: 'SysOut' },
];

// [U] PaletteTool – mida paleti punkt teeb: Select, Erase, Direction, Track, Dot, Connector, Object.
export function PaletteTool(item) {
  if (!item.T) return item.Id;
  if (item.Dot) return 'Dot';
  const kind = IconTypes[item.T].Kind;
  return kind === 'Track' || kind === 'Connector' ? kind : 'Object';
}

// [U] Uute objektide vaikeväärtused (CheckModel-i järgi korrektsed). Nimi lisatakse juurde.
const DEFAULT_TRACK = { Mode: 'Continuous', Carts: 6, PlacesPerCart: 1, Speed: 20, LoadTime: 10, AccessTime: 0 };
const DEFAULT_MACHINE = { Model: '', LoadTime: 20, SetupTime: 60 };
const DEFAULT_BUFFER = { Capacity: 3, Discipline: 'FIFO', LoadTime: 5 };
const DEFAULT_STORAGE = { Capacity: 30, LoadTime: 20 };

// =====================================================================
// Redigeerimise loogika (testitav ilma brauserita)
// =====================================================================

// [U] CellKey, LayoutGrid, InsideGrid – lahtri võti; lahtrid võtme järgi; kas punkt on ruudustikus.
const CellKey = (x, y) => `${x},${y}`;
export function LayoutGrid(model) {
  return new Map(model.Layout.Cells.map(cell => [CellKey(cell.X, cell.Y), cell]));
}
export function InsideGrid(model, x, y) {
  return x >= 0 && y >= 0 && x < model.Layout.Dim.X && y < model.Layout.Dim.Y;
}

// [U] CellAt – lahter kohal (x, y) või null.
export function CellAt(model, x, y) {
  return model.Layout.Cells.find(cell => cell.X === x && cell.Y === y) ?? null;
}

// [T] CellPorts – küljed, mille kaudu rada (ka punktiir ja konnektor) ikooni läbib, koos haruga.
export function CellPorts(cell) {
  const icon = IconTypes[cell.T];
  if (!icon || !icon.Ports) return [];
  return icon.Branch ? [...icon.Ports, icon.Branch] : [...icon.Ports];
}

// [U] IsDotTarget – kas punktiirühendus võib lõppeda selle objektiga (puhver, ladu, väljund).
//     Konnektorini jõuab punktiir konnektori raja küljest (SegmentEnd). Sama reegel on
//     Enumerate-i FollowDotLink-is.
export function IsDotTarget(cell) {
  const kind = IconTypes[cell.T]?.Kind;
  return kind === 'Buffer' || kind === 'Storage' || kind === 'Output';
}

// [U] IconFromPorts – raja ikoon külgede järgi (automaatne ikoonivalik). Üks külg – sirge
//     (raja ots), kaks – sirge või kaar, kolm – hargnemine (haru = küljest, mis puudub, vastas),
//     neli – ristmik. Tühi loend → null.
export function IconFromPorts(ports) {
  const set = new Set(ports);
  switch (set.size) {
    case 0: return null;
    case 1: return set.has('N') || set.has('S') ? 'VertTr' : 'HorTr';
    case 2:
      if (set.has('N') && set.has('S')) return 'VertTr';
      if (set.has('W') && set.has('E')) return 'HorTr';
      return `Arc${set.has('N') ? 'N' : 'S'}${set.has('E') ? 'E' : 'W'}`;
    case 3: {
      const missing = ['N', 'E', 'S', 'W'].find(side => !set.has(side));
      return `Tee${DIRECTIONS[missing].Opposite}`;
    }
    default: return 'Cruise';
  }
}

// [U] PortLinked, LinkedPorts – kas lahtri külg on naabriga ühendatud (naabril on vastaskülg
//     või punktiirühendus jõuab objektini); lahtri ühendatud küljed.
function PortLinked(grid, cell, port) {
  const step = DIRECTIONS[port];
  const neighbor = grid.get(CellKey(cell.X + step.DX, cell.Y + step.DY));
  if (!neighbor) return false;
  if (CellPorts(neighbor).includes(step.Opposite)) return true;
  return Boolean(cell.Dot) && IsDotTarget(neighbor);
}
export function LinkedPorts(grid, cell) {
  return CellPorts(cell).filter(port => PortLinked(grid, cell, port));
}

// [U] SetCellPorts – raja lahtri ikoon uute külgede järgi; suunanool kaob, kui see ei sobi.
//     Sild (CrossOver) jääb sillaks: selle küljed ei muutu.
function SetCellPorts(cell, ports) {
  if (IconTypes[cell.T].CrossOver) return;
  cell.T = IconFromPorts(ports);
  if (cell.Dir !== undefined && !DirectionPorts(cell.T).includes(cell.Dir)) delete cell.Dir;
}

// [U] MakeCrossOver – sirgest saab sild: sirge jääb oma rajale, risti läheb rada track.
//     W–E rada on N (kaarega üle), N–S rada N2. Suunanool kaob (sillal noolt pole).
function MakeCrossOver(cell, track) {
  const horizontal = IconTypes[cell.T].Ports.includes('W');
  const own = cell.N;
  cell.T = 'CrossOver';
  cell.N = horizontal ? own : track;
  cell.N2 = horizontal ? track : own;
  delete cell.Dir;
}

// [U] UniqueName – esimene vaba nimi kujul prefix + number (MT1, MT2 …).
export function UniqueName(prefix, used) {
  for (let number = 1; ; number++) {
    if (!used.includes(`${prefix}${number}`)) return `${prefix}${number}`;
  }
}

// [U] EnsureTrack – loob rajad kuni numbrini number (vaikeväärtustega). Kutsub: LaySegment, PlaceIcon.
export function EnsureTrack(model, number) {
  while (model.Tracks.length < number) {
    model.Tracks.push({ Name: FormatText(Texts.EdTrackName, { N: model.Tracks.length + 1 }), ...DEFAULT_TRACK });
  }
}

// [U] AddObject – uus pink või puhver vaikeväärtustega; tagastab järjenumbri N (1-põhine).
export function AddObject(model, arrayName) {
  if (arrayName === 'Machines') {
    const name = UniqueName('MT', model.Machines.map(machine => machine.Name));
    model.Machines.push({ Name: name, ...DEFAULT_MACHINE, Ops: [OPERATIONS[0]] });
  } else if (arrayName === 'Buffers') {
    model.Buffers.push({ ...DEFAULT_BUFFER });
  } else {
    EnsureTrack(model, model.Tracks.length + 1);
  }
  return model[arrayName].length;
}

// [U] DropUnusedObject – kui pingil või puhvril pole joonisel enam ühtki ikooni, kustutatakse
//     selle andmed ja järgmiste objektide numbrid (N) nihkuvad ühe võrra. Rajad jäävad alles
//     (need kustutatakse Transport-menüüst), sest rada joonistatakse sageli ümber.
function DropUnusedObject(model, arrayName, number) {
  if (arrayName !== 'Machines' && arrayName !== 'Buffers') return false;
  const sameArray = cell => !cell.Dot && IconTypes[cell.T]?.Array === arrayName;
  if (model.Layout.Cells.some(cell => sameArray(cell) && cell.N === number)) return false;
  model[arrayName].splice(number - 1, 1);
  for (const cell of model.Layout.Cells) {
    if (sameArray(cell) && cell.N > number) cell.N -= 1;
  }
  return true;
}

// [U] CleanEdgeLengths – metrokaardi pikkused (EdgeLengths), mille lahter pole enam raja ikoon.
function CleanEdgeLengths(model) {
  if (!model.EdgeLengths) return;
  const grid = LayoutGrid(model);
  model.EdgeLengths = model.EdgeLengths.filter(edge => edge.Cells.every(([x, y]) => {
    const cell = grid.get(CellKey(x, y));
    return cell && IconTypes[cell.T].Kind === 'Track' && !cell.Dot;
  }));
}

// Lõigu ühe otsa plaan: mis lahtriga juhtub, kui sinna lisatakse külg port.
//   { Create, Ports } – uus lahter; { Cell, Ports } – olemasolev saab uued küljed;
//   { Keep } – lahter jääb samaks (objekt, kuhu punktiir lõpeb, või külg on juba olemas);
//   null – sinna ei saa (nt rada objekti sisse või punktiir raja kaarele).
function SegmentEnd(grid, cell, port, dot, track) {
  if (!cell) return { Create: true, Ports: [port] };
  const kind = IconTypes[cell.T].Kind;
  if (kind === 'Track' && IconTypes[cell.T].CrossOver) return dot ? null : { Keep: true };
  if (kind === 'Track' && !dot && !cell.Dot && cell.N !== track
      && (cell.T === 'HorTr' || cell.T === 'VertTr') && !IconTypes[cell.T].Ports.includes(port)) {
    return { Cell: cell, CrossOver: true };   // teise raja sirge risti -> sild (ei ühendu)
  }
  if (kind === 'Connector') return CellPorts(cell).includes(port) ? { Keep: true } : null;   // rada või punktiir
  if (kind !== 'Track') return dot && IsDotTarget(cell) ? { Keep: true } : null;
  const linked = LinkedPorts(grid, cell);
  if (dot && !cell.Dot) {
    // punktiir raja külge: ainult sirgele, risti → hargnemine (jaam); olemasolev haru jääb
    if (IconTypes[cell.T].Branch === port) return { Keep: true };
    const straight = linked.length === 2 && DIRECTIONS[linked[0]].Opposite === linked[1];
    if (!straight || linked.includes(port) || linked.includes(DIRECTIONS[port].Opposite)) return null;
    return { Cell: cell, Ports: [...linked, port] };
  }
  if (!dot && cell.Dot) return null;   // pidev rada ei läbi punktiirühendust
  const ports = [...new Set([...linked, port])];
  if (cell.Dot && ports.length > 2) return null;   // punktiir ei hargne
  return { Cell: cell, Ports: ports };
}

// [U] LaySegment – ühendab lahtri (x, y) naabriga suunas direction: mõlemad lahtrid saavad
//     vastava külje ja ikoon valitakse automaatselt (IconFromPorts). options.Dot – punktiirühendus,
//     options.Track – uute raja ikoonide raja number. Tagastab, kas ühendati.
//     Kutsub: LayPath, Layout (Shift + nool), testid.
export function LaySegment(model, x, y, direction, { Dot: dot = false, Track: track = 1 } = {}) {
  const step = DIRECTIONS[direction];
  const toX = x + step.DX;
  const toY = y + step.DY;
  if (!InsideGrid(model, x, y) || !InsideGrid(model, toX, toY)) return false;
  const grid = LayoutGrid(model);
  const fromPlan = SegmentEnd(grid, grid.get(CellKey(x, y)), direction, dot, track);
  const toPlan = SegmentEnd(grid, grid.get(CellKey(toX, toY)), step.Opposite, dot, track);
  if (!fromPlan || !toPlan || (fromPlan.Keep && toPlan.Keep)) return false;
  for (const [plan, cellX, cellY] of [[fromPlan, x, y], [toPlan, toX, toY]]) {
    if (plan.Keep) continue;
    if (plan.Create) {
      const cell = { X: cellX, Y: cellY, T: IconFromPorts(plan.Ports) };
      if (dot) cell.Dot = true;
      else { EnsureTrack(model, track); cell.N = track; }
      model.Layout.Cells.push(cell);
    } else if (plan.CrossOver) {
      EnsureTrack(model, track);
      MakeCrossOver(plan.Cell, track);
    } else {
      SetCellPorts(plan.Cell, plan.Ports);
    }
  }
  return true;
}

// [U] CellSteps – lahtrid punktist from punkti to (from välja arvatud) külgnaabrite kaudu,
//     sirgele joonele võimalikult lähedal (kiire hiireliigutus jätab lahtreid vahele).
export function CellSteps(from, to) {
  const steps = [];
  const dx = to.X - from.X;
  const dy = to.Y - from.Y;
  let x = from.X;
  let y = from.Y;
  const offLine = (px, py) => Math.abs((px - from.X) * dy - (py - from.Y) * dx);
  while (x !== to.X || y !== to.Y) {
    const stepX = { X: x + Math.sign(to.X - x), Y: y };
    const stepY = { X: x, Y: y + Math.sign(to.Y - y) };
    const next = y === to.Y || (x !== to.X && offLine(stepX.X, stepX.Y) <= offLine(stepY.X, stepY.Y)) ? stepX : stepY;
    x = next.X;
    y = next.Y;
    steps.push({ X: x, Y: y });
  }
  return steps;
}

// [U] DirectionBetween – külgnaabrite vaheline suund (N/E/S/W) või null.
export function DirectionBetween(from, to) {
  return Object.keys(DIRECTIONS).find(name => from.X + DIRECTIONS[name].DX === to.X && from.Y + DIRECTIONS[name].DY === to.Y) ?? null;
}

// [U] LayPath – joonistab raja või punktiirühenduse mööda lahtrite jada (lohistamine).
//     Tagastab, mitu lõiku ei õnnestunud (nt rada objekti sisse). Kutsub: Layout, testid.
export function LayPath(model, path, options = {}) {
  let blocked = 0;
  for (let i = 1; i < path.length; i++) {
    let from = path[i - 1];
    const cells = DirectionBetween(from, path[i]) ? [path[i]] : CellSteps(from, path[i]);
    for (const to of cells) {
      if (!LaySegment(model, from.X, from.Y, DirectionBetween(from, to), options)) blocked += 1;
      from = to;
    }
  }
  return blocked;
}

// [U] ExtendDragPath – lisab lohistamise teele lahtri; tagasi eelmisse lahtrisse liikudes
//     võetakse viimane lõik ära. Kutsub: Layout, testid.
export function ExtendDragPath(path, cell) {
  const last = path[path.length - 1];
  for (const step of DirectionBetween(last, cell) ? [cell] : CellSteps(last, cell)) {
    const previous = path[path.length - 2];
    if (previous && previous.X === step.X && previous.Y === step.Y) path.pop();
    else path.push(step);
  }
  return path;
}

// [U] EraseCell – kustutab lahtri. Naabruses olev hargnemine või ristmik kaotab selle poole
//     haru; pingi või puhvri viimase ikooniga kaovad ka andmed (DropUnusedObject).
export function EraseCell(model, x, y) {
  const cell = CellAt(model, x, y);
  if (!cell) return false;
  model.Layout.Cells.splice(model.Layout.Cells.indexOf(cell), 1);
  const arrayName = IconTypes[cell.T].Array;
  if (arrayName && !cell.Dot) DropUnusedObject(model, arrayName, cell.N);
  for (const [name, step] of Object.entries(DIRECTIONS)) {
    const neighbor = CellAt(model, x + step.DX, y + step.DY);
    if (!neighbor || IconTypes[neighbor.T].Kind !== 'Track') continue;
    const ports = CellPorts(neighbor);
    if (ports.length > 2 && ports.includes(DIRECTIONS[name].Opposite)) {
      SetCellPorts(neighbor, ports.filter(port => port !== DIRECTIONS[name].Opposite));
    }
  }
  CleanEdgeLengths(model);
  return true;
}

// [U] PlaceIcon – paletist valitud ikoon täpselt lahtrisse (originaali moodi klõps).
//     Sama liiki objekt saab uue ikooni, aga jääb samaks objektiks (N ja andmed alles).
//     Punktiir olemasoleval raja lahtril muudab selle punktiiriks ja tagasi.
//     options.Track – raja ikoonide raja number. Tagastab, kas midagi muutus.
export function PlaceIcon(model, x, y, item, { Track: track = 1 } = {}) {
  if (!InsideGrid(model, x, y) || !item.T) return false;
  const existing = CellAt(model, x, y);
  const icon = IconTypes[item.T];
  if (item.Dot) {
    if (existing && IconTypes[existing.T].Kind === 'Track') {
      if (existing.Dot) {
        delete existing.Dot;
        EnsureTrack(model, track);
        existing.N = track;
      } else {
        existing.Dot = true;
        delete existing.N;
        delete existing.Dir;
        CleanEdgeLengths(model);
      }
      return true;
    }
    if (existing) EraseCell(model, x, y);
    model.Layout.Cells.push({ X: x, Y: y, T: item.T, Dot: true });
    return true;
  }
  if (existing && existing.T === item.T && !existing.Dot) return false;
  if (existing && icon.Kind === 'Track' && IconTypes[existing.T].Kind === 'Track' && !existing.Dot) {
    if (icon.CrossOver) {
      // ristmik -> sild (sama rada mõlemas suunas); sirge -> sild aktiivse rajaga risti
      if (existing.T === 'HorTr' || existing.T === 'VertTr') { EnsureTrack(model, track); MakeCrossOver(existing, track); }
      else { existing.T = 'CrossOver'; existing.N2 = existing.N; delete existing.Dir; }
      return true;
    }
    if (IconTypes[existing.T].CrossOver) {   // sillast tavaline ikoon: N–S rada (N2) kaob
      delete existing.N2;
      existing.T = 'Cruise';
    }
    SetCellPorts(existing, CellPorts({ T: item.T }));
    return true;
  }
  const sameObject = existing && !existing.Dot && icon.Kind === IconTypes[existing.T].Kind && icon.Kind !== 'Track';
  if (sameObject) {
    existing.T = item.T;
  } else {
    if (existing) EraseCell(model, x, y);
    const cell = { X: x, Y: y, T: item.T };
    if (icon.Kind === 'Track') { EnsureTrack(model, track); cell.N = track; }
    if (icon.CrossOver) cell.N2 = track;
    else if (icon.Array) cell.N = AddObject(model, icon.Array);
    model.Layout.Cells.push(cell);
  }
  if (item.T === 'ToCS' && model.Storage === null) model.Storage = { ...DEFAULT_STORAGE };
  return true;
}

// [U] MoveCell – viib lahtri (ikoon koos andmetega) tühja lahtrisse. Tagastab, kas viidi.
export function MoveCell(model, from, to) {
  const cell = CellAt(model, from.X, from.Y);
  if (!cell || !InsideGrid(model, to.X, to.Y) || CellAt(model, to.X, to.Y)) return false;
  cell.X = to.X;
  cell.Y = to.Y;
  CleanEdgeLengths(model);
  return true;
}

// [U] CycleDirection – suunanool raja sirgel või kaarel: puudub → üks külg → teine → puudub [O].
export function CycleDirection(model, x, y) {
  const cell = CellAt(model, x, y);
  if (!cell || cell.Dot) return false;
  const ports = DirectionPorts(cell.T);
  if (ports.length === 0) return false;
  const order = [undefined, ports[1], ports[0]];
  const next = order[(order.indexOf(cell.Dir) + 1) % order.length];
  if (next === undefined) delete cell.Dir; else cell.Dir = next;
  return true;
}

// [U] CellsOutside – mitu ikooni jääb uuest ruudustikust välja.
export function CellsOutside(model, dim) {
  return model.Layout.Cells.filter(cell => cell.X >= dim.X || cell.Y >= dim.Y).length;
}

// [U] ResizeLayout – ruudustiku uued mõõdud; välja jäävad ikoonid kustutatakse (EraseCell).
export function ResizeLayout(model, dim) {
  for (const cell of [...model.Layout.Cells]) {
    if (cell.X >= dim.X || cell.Y >= dim.Y) EraseCell(model, cell.X, cell.Y);
  }
  model.Layout.Dim = { X: dim.X, Y: dim.Y };
}

// [U] ParseDim – „13 x 7“ → { X, Y } või null (piirid MAX_LAYOUT_DIM).
export function ParseDim(text) {
  const match = /^\s*(\d+)\s*[x×X*,;\s]\s*(\d+)\s*$/.exec(text);
  if (!match) return null;
  const dim = { X: Number(match[1]), Y: Number(match[2]) };
  if (dim.X < 1 || dim.Y < 1 || dim.X > MAX_LAYOUT_DIM.X || dim.Y > MAX_LAYOUT_DIM.Y) return null;
  return dim;
}

// [U] DeleteTrack – kustutab raja: selle ikoonid joonisel ja andmed; järgmiste radade numbrid
//     nihkuvad ühe võrra. Kutsub: Transport-vorm (fms_ed_data.js), testid.
export function DeleteTrack(model, number) {
  const ownCell = cell => IconTypes[cell.T]?.Array === 'Tracks' && !cell.Dot;
  // sild, kus kustutatav rada on ainult ühes suunas, jääb teise raja sirgeks
  for (const cell of model.Layout.Cells.filter(cell => IconTypes[cell.T]?.CrossOver && cell.N !== cell.N2)) {
    if (cell.N === number) { cell.T = 'VertTr'; cell.N = cell.N2; delete cell.N2; }
    else if (cell.N2 === number) { cell.T = 'HorTr'; delete cell.N2; }
  }
  for (const cell of model.Layout.Cells.filter(cell => ownCell(cell) && cell.N === number)) EraseCell(model, cell.X, cell.Y);
  model.Tracks.splice(number - 1, 1);
  for (const cell of model.Layout.Cells) {
    if (ownCell(cell) && cell.N > number) cell.N -= 1;
    if (ownCell(cell) && cell.N2 > number) cell.N2 -= 1;
  }
  CleanEdgeLengths(model);
}

// [U] SegmentCells – raja lõik, kuhu lahter (x, y) kuulub: järjestikused sirged ja kaared kahe
//     hargnemise (või ristmiku, raja otsa) vahel – nagu Enumerate-i MeasureTrack-is. Tagastab
//     { Cells: [[x, y] …] raja järjekorras, Units – pikkus ikoonides koos hargnemiste pooltega }
//     või null (lahter pole lõigu sisemine: hargnemine, punktiir, objekt). Kutsub: Transport-vorm.
export function SegmentCells(model, x, y) {
  const grid = LayoutGrid(model);
  const start = grid.get(CellKey(x, y));
  const isInner = cell => cell && IconTypes[cell.T].Kind === 'Track' && !cell.Dot
    && (CellPorts(cell).length === 2 || IconTypes[cell.T].CrossOver);   // sillast minnakse otse läbi
  if (!isInner(start) || IconTypes[start.T].CrossOver) return null;   // sild on kahe raja lõigus
  const sides = [];
  let units = 0;
  const unitOf = cell => (IconTypes[cell.T].Arc ? Math.PI / 4 : 1);
  const seen = new Set([CellKey(start.X, start.Y)]);
  for (const port of CellPorts(start)) {
    const cells = [];
    let cell = start;
    let exit = port;
    for (;;) {
      const step = DIRECTIONS[exit];
      const next = grid.get(CellKey(cell.X + step.DX, cell.Y + step.DY));
      if (!next || IconTypes[next.T].Kind !== 'Track' || next.Dot || CellTrack(next, step.Opposite) !== start.N
          || !CellPorts(next).includes(step.Opposite)) break;
      if (!isInner(next)) { units += 0.5; break; }   // hargnemine: pool sellest kuulub lõiku
      const crossOver = IconTypes[next.T].CrossOver;
      const key = crossOver ? `${CellKey(next.X, next.Y)},${step.Opposite === 'N' || step.Opposite === 'S' ? 'NS' : 'WE'}` : CellKey(next.X, next.Y);
      if (seen.has(key)) break;  // silmus ilma hargnemiseta
      seen.add(key);
      cells.push(next);
      cell = next;
      exit = crossOver ? DIRECTIONS[step.Opposite].Opposite : CellPorts(next).find(other => other !== step.Opposite);
    }
    sides.push(cells);
  }
  const ordered = [...sides[0].reverse(), start, ...sides[1]];
  units += ordered.reduce((sum, cell) => sum + unitOf(cell), 0);
  return { Cells: ordered.map(cell => [cell.X, cell.Y]), Units: units };
}

// [U] EdgeLengthOf, SetEdgeLength – lõigu käsitsi pikkus (metrokaart, EdgeLengths) või null;
//     uus pikkus (null – mõõtkavast). Kirje kuulub lõigule, kui kõik selle lahtrid on lõigus.
const EdgeInSegment = (edge, cells) => edge.Cells.every(([x, y]) => cells.some(([cx, cy]) => cx === x && cy === y));
export function EdgeLengthOf(model, cells) {
  return (model.EdgeLengths ?? []).find(edge => EdgeInSegment(edge, cells))?.Length ?? null;
}
export function SetEdgeLength(model, cells, length) {
  model.EdgeLengths = (model.EdgeLengths ?? []).filter(edge => !EdgeInSegment(edge, cells));
  if (length !== null) model.EdgeLengths.push({ Cells: cells.map(([x, y]) => [x, y]), Length: length });
}

// [U] ModelProblems – mudeli vead ja hoiatused redaktori jaoks: kõigepealt faili struktuur
//     (CheckModel), kui see on korras, siis rajavõrk ja andmed (Enumerate, DISAIN.md 2.2).
//     Tagastab { Errors, Warnings } – [{ Path, Message }]. Kutsub: Layout, Edit → Check.
export function ModelProblems(model) {
  const errors = CheckModel(model);
  if (errors.length > 0) return { Errors: errors, Warnings: [] };
  const result = Enumerate(model);
  return { Errors: result.Errors, Warnings: result.Warnings };
}

// [U] ProblemCell – veateate koht joonisel: „Layout (x, y)“, pink, puhver või rada → lahter; null.
export function ProblemCell(model, path) {
  const match = /^Layout \((\d+), (\d+)\)/.exec(path);
  if (match) return { X: Number(match[1]), Y: Number(match[2]) };
  const object = /^(Machines|Buffers|Tracks)\[(\d+)\]/.exec(path);
  if (!object) return null;
  const cell = model.Layout.Cells.find(candidate => !candidate.Dot && IconTypes[candidate.T]?.Array === object[1] && candidate.N === Number(object[2]));
  return cell ? { X: cell.X, Y: cell.Y } : null;
}

// [U] RestoreModel – asendab mudeli sisu (sama objekt jääb, sest fms.js hoiab sellele viidet).
export function RestoreModel(model, snapshot) {
  for (const key of Object.keys(model)) delete model[key];
  Object.assign(model, structuredClone(snapshot));
}

// =====================================================================
// Redaktori olek, Undo
// =====================================================================

let EditState = null;   // [U] redaktori olek; null – redaktor pole avatud

// [U] BeginChange, CommitChange – muudatus Undo jaoks: hetktõmmis enne ja salvestus pärast,
//     kui mudel tegelikult muutus.
function BeginChange(edit) {
  return JSON.stringify(edit.Model);
}
function CommitChange(edit, before) {
  if (JSON.stringify(edit.Model) === before) return false;
  edit.Undo.push(before);
  if (edit.Undo.length > UNDO_LIMIT) edit.Undo.shift();
  edit.Redo = [];
  ModelEdited(edit);
  return true;
}

// [U] UndoEdit, RedoEdit – Ctrl-Z / Ctrl-Y.
function UndoEdit(edit) {
  if (edit.Undo.length === 0) { edit.Message = Texts.EdNothingToUndo; return; }
  edit.Redo.push(JSON.stringify(edit.Model));
  RestoreModel(edit.Model, JSON.parse(edit.Undo.pop()));
  ModelEdited(edit);
}
function RedoEdit(edit) {
  if (edit.Redo.length === 0) return;
  edit.Undo.push(JSON.stringify(edit.Model));
  RestoreModel(edit.Model, JSON.parse(edit.Redo.pop()));
  ModelEdited(edit);
}

// Mudel muutus: raja number jääb piiridesse, fms.js saab teada (muudetud mudel).
function ModelEdited(edit) {
  edit.Track = Math.max(1, Math.min(edit.Track, edit.Model.Tracks.length + 1));
  edit.Problems = ModelProblems(edit.Model);
  ClampCursor(edit);
  if (edit.OnChange) edit.OnChange();
  RequestRedraw();
}

function ClampCursor(edit) {
  const dim = edit.Model.Layout.Dim;
  edit.Cursor.X = Math.max(0, Math.min(dim.X - 1, edit.Cursor.X));
  edit.Cursor.Y = Math.max(0, Math.min(dim.Y - 1, edit.Cursor.Y));
}

// =====================================================================
// Joonistamine
// =====================================================================

// [U] EditorLayout – Layout akna osad: infurida, ruudustik (nähtav osa ja kerimine), palett.
//     EGA: ikoon 48 × 35 nagu animaatoris; kaasaegne: ikoon nii suur, kui ruumi on.
function EditorLayout(theme, desktop, edit) {
  const ega = theme.Name === 'EGA';
  const dim = edit.Model.Layout.Dim;
  const info = { X: desktop.X, Y: desktop.Y, Width: desktop.Width, Height: ROW_HEIGHT + (ega ? 0 : 8) };
  const paletteCell = ega ? EGA_PALETTE_CELL : { Width: MODERN_PALETTE_CELL, Height: MODERN_PALETTE_CELL };
  const perRow = Math.min(PALETTE.length, Math.max(1, Math.floor((desktop.Width - 16) / paletteCell.Width)));
  const paletteRows = Math.max(PALETTE_ROWS, Math.ceil(PALETTE.length / perRow));
  const columns = Math.ceil(PALETTE.length / paletteRows);
  const paletteWidth = columns * paletteCell.Width;
  const paletteHeight = paletteRows * paletteCell.Height;
  const palette = {
    X: Math.round(desktop.X + (desktop.Width - paletteWidth) / 2),
    Y: desktop.Y + desktop.Height - paletteHeight - (ega ? 4 : 8),
    Width: paletteWidth, Height: paletteHeight, Columns: columns, Cell: paletteCell,
  };
  const area = {
    X: desktop.X + (ega ? 8 : 16), Y: info.Y + info.Height + (ega ? 3 : 8),
    Width: desktop.Width - (ega ? 16 : 32), Height: palette.Y - info.Y - info.Height - (ega ? 8 : 18),
  };
  let cellWidth;
  let cellHeight;
  if (ega) {
    cellWidth = EGA_CELL.Width;
    cellHeight = EGA_CELL.Height;
  } else {
    cellWidth = cellHeight = Math.max(MODERN_MIN_CELL, Math.min(MODERN_MAX_CELL, area.Width / dim.X, area.Height / dim.Y));
  }
  const visible = {
    X: Math.max(1, Math.min(dim.X, Math.floor(area.Width / cellWidth))),
    Y: Math.max(1, Math.min(dim.Y, Math.floor(area.Height / cellHeight))),
  };
  const grid = {
    X: Math.round(area.X + (area.Width - visible.X * cellWidth) / 2),
    Y: Math.round(area.Y + (area.Height - visible.Y * cellHeight) / 2),
    Width: visible.X * cellWidth, Height: visible.Y * cellHeight,
  };
  const items = PALETTE.map((item, index) => ({
    Index: index,
    X: palette.X + (index % columns) * paletteCell.Width,
    Y: palette.Y + Math.floor(index / columns) * paletteCell.Height,
    Width: paletteCell.Width, Height: paletteCell.Height,
  }));
  return { Info: info, Area: area, Grid: grid, Visible: visible, CW: cellWidth, CH: cellHeight, Palette: palette, Items: items, Ega: ega };
}

// Kerimine nii, et kursor oleks nähtav, ja piiridesse.
function ClampScroll(edit, layout) {
  const dim = edit.Model.Layout.Dim;
  for (const axis of ['X', 'Y']) {
    const visible = layout.Visible[axis];
    if (edit.Cursor[axis] < edit.Scroll[axis]) edit.Scroll[axis] = edit.Cursor[axis];
    if (edit.Cursor[axis] >= edit.Scroll[axis] + visible) edit.Scroll[axis] = edit.Cursor[axis] - visible + 1;
    edit.Scroll[axis] = Math.max(0, Math.min(dim[axis] - visible, edit.Scroll[axis]));
  }
}

// Ruudustiku vaade kerimisega: lahter (x, y) on ekraanil kohas Grid + (x − Scroll) × CW.
function GridView(edit, layout) {
  return {
    X: layout.Grid.X - edit.Scroll.X * layout.CW, Y: layout.Grid.Y - edit.Scroll.Y * layout.CH,
    CW: layout.CW, CH: layout.CH, Dim: edit.Model.Layout.Dim, Ega: layout.Ega,
  };
}

// [U] DrawBufferKind – puhvri liik ikooni sees: ▲ InBuf, ▼ OutBuf, ▲▼ InOutBuf, ring TurnBuf.
//     Animaatoris on puhvri kastis kohad, redaktoris liik. Kutsub: LayoutPainter, palett.
function DrawBufferKind(theme, view, cell) {
  const center = { X: view.X + (cell.X + 0.5) * view.CW, Y: view.Y + (cell.Y + 0.6) * view.CH };
  const size = Math.max(2, view.CW * 0.08);
  const sizeY = size * view.CH / view.CW;
  const triangle = (direction, offset) => {
    const tipY = center.Y + offset + direction * sizeY;
    const baseY = center.Y + offset - direction * sizeY;
    theme.Polygon([{ X: center.X, Y: tipY }, { X: center.X - size, Y: baseY }, { X: center.X + size, Y: baseY }], 'SlotArrow');
  };
  switch (cell.T) {
    case 'InBuf': triangle(-1, 0); break;
    case 'OutBuf': triangle(1, 0); break;
    case 'InOutBuf': triangle(-1, -sizeY * 1.2); triangle(1, sizeY * 1.2); break;
    case 'TurnBuf':
      theme.Ellipse(center.X, center.Y, size * 1.4, sizeY * 1.4, 'SlotArrow', { Fill: false, Width: 1 });
      triangle(1, 0);
      break;
    default: break;
  }
}

// Tööriista pilt paletis: nool (vali), rist (kustuta), suunanool.
function DrawToolGlyph(theme, rect, id, ega) {
  const cx = rect.X + rect.Width / 2;
  const cy = rect.Y + rect.Height / 2;
  const s = Math.min(rect.Width, rect.Height * (ega ? 48 / 35 : 1)) * 0.22;
  const sy = ega ? s * 35 / 48 : s;
  switch (id) {
    case 'Select':
      theme.Polygon([
        { X: cx - s * 0.6, Y: cy - sy }, { X: cx - s * 0.6, Y: cy + sy * 0.7 }, { X: cx - s * 0.1, Y: cy + sy * 0.25 },
        { X: cx + s * 0.25, Y: cy + sy }, { X: cx + s * 0.5, Y: cy + sy * 0.85 }, { X: cx + s * 0.15, Y: cy + sy * 0.1 },
        { X: cx + s * 0.75, Y: cy + sy * 0.1 },
      ], 'LayoutValue');
      break;
    case 'Erase':
      theme.Line(cx - s, cy - sy, cx + s, cy + sy, 'Deadlock', { Width: ega ? 1 : 2 });
      theme.Line(cx - s, cy + sy, cx + s, cy - sy, 'Deadlock', { Width: ega ? 1 : 2 });
      break;
    case 'Direction':
      theme.Line(cx - s, cy, cx + s * 0.2, cy, 'Arrow', { Width: ega ? 1 : 2 });
      theme.Polygon([{ X: cx + s, Y: cy }, { X: cx + s * 0.1, Y: cy - sy * 0.7 }, { X: cx + s * 0.1, Y: cy + sy * 0.7 }], 'Arrow');
      break;
    default: break;
  }
}

// Paleti punkt: ikoon väikeses lahtris; valitud punkt raamiga.
function DrawPaletteItem(theme, layout, rect, item, selected, hover) {
  if (selected && layout.Ega) theme.StrokeRect(rect.X, rect.Y, rect.Width, rect.Height, 'Highlight');
  else if (selected) theme.StrokeRect(rect.X + 1, rect.Y + 1, rect.Width - 2, rect.Height - 2, 'Highlight', { Width: 2, Radius: 4 });
  else if (hover && !layout.Ega) theme.StrokeRect(rect.X + 1, rect.Y + 1, rect.Width - 2, rect.Height - 2, 'LayoutGrid', { Radius: 3 });
  if (!item.T) { DrawToolGlyph(theme, rect, item.Id, layout.Ega); return; }
  const inset = layout.Ega ? 2 : 4;
  const view = {
    X: rect.X + inset, Y: rect.Y + inset * (layout.Ega ? 0.75 : 1),
    CW: rect.Width - 2 * inset, CH: rect.Height - 2 * inset * (layout.Ega ? 0.75 : 1), Ega: layout.Ega,
  };
  const cell = { X: 0, Y: 0, T: item.T, ...(item.Dot ? { Dot: true } : {}) };
  const kind = IconTypes[item.T].Kind;
  DrawIcon(theme, view, cell, kind === 'Machine' ? 'MT' : '');
  if (kind === 'Buffer') DrawBufferKind(theme, view, cell);
}

// Kerimisnool ruudustiku serval (kui seal on veel lahtreid).
function ScrollArrows(edit, layout) {
  const dim = edit.Model.Layout.Dim;
  const { Grid: grid } = layout;
  const arrows = [];
  const margin = layout.Ega ? 7 : 10;
  if (edit.Scroll.X > 0) arrows.push({ Id: 'W', X: grid.X - margin, Y: grid.Y, Width: margin, Height: grid.Height });
  if (edit.Scroll.X + layout.Visible.X < dim.X) arrows.push({ Id: 'E', X: grid.X + grid.Width, Y: grid.Y, Width: margin, Height: grid.Height });
  if (edit.Scroll.Y > 0) arrows.push({ Id: 'N', X: grid.X, Y: grid.Y - margin, Width: grid.Width, Height: margin });
  if (edit.Scroll.Y + layout.Visible.Y < dim.Y) arrows.push({ Id: 'S', X: grid.X, Y: grid.Y + grid.Height, Width: grid.Width, Height: margin });
  return arrows;
}

function DrawScrollArrow(theme, arrow) {
  const cx = arrow.X + arrow.Width / 2;
  const cy = arrow.Y + arrow.Height / 2;
  const s = Math.min(arrow.Width, arrow.Height) * 0.4;
  const points = {
    W: [{ X: cx - s, Y: cy }, { X: cx + s, Y: cy - 2 * s }, { X: cx + s, Y: cy + 2 * s }],
    E: [{ X: cx + s, Y: cy }, { X: cx - s, Y: cy - 2 * s }, { X: cx - s, Y: cy + 2 * s }],
    N: [{ X: cx, Y: cy - s }, { X: cx - 2 * s, Y: cy + s }, { X: cx + 2 * s, Y: cy + s }],
    S: [{ X: cx, Y: cy + s }, { X: cx - 2 * s, Y: cy - s }, { X: cx + 2 * s, Y: cy - s }],
  }[arrow.Id];
  theme.Polygon(points, 'Arrow');
}

// Infurida: mudel, ruudustik, raja number, kursor, muudetud.
function InfoText(edit) {
  const model = edit.Model;
  const track = model.Tracks[edit.Track - 1];
  return FormatText(Texts.EdInfo, {
    Name: model.Meta.Name || Texts.DesktopUntitled,
    X: model.Layout.Dim.X, Y: model.Layout.Dim.Y,
    Track: edit.Track, TrackName: track ? track.Name : Texts.EdNewTrack,
    CX: edit.Cursor.X, CY: edit.Cursor.Y,
  });
}

// [U] ProblemsText – kontrolli tulemus infureal: vigade ja hoiatuste arv (K – nimekiri).
function ProblemsText(edit) {
  const { Errors: errors, Warnings: warnings } = edit.Problems;
  if (errors.length === 0 && warnings.length === 0) return Texts.EdProblemsNone;
  return FormatText(Texts.EdProblems, { Errors: errors.length, Warnings: warnings.length });
}

// Lahtri ristkülik ekraanil (raam kursori ja lohistamise jaoks).
function CellRect(view, x, y) {
  return { X: Math.round(view.X + x * view.CW), Y: Math.round(view.Y + y * view.CH), Width: Math.round(view.CW), Height: Math.round(view.CH) };
}

// [U] LayoutPainter – Layout: infurida, ruudustik (kerimisega), palett. (windows.js DesktopView)
function LayoutPainter(theme, desktop) {
  const edit = EditState;
  if (!edit) return;
  edit.Theme = theme;
  const layout = EditorLayout(theme, desktop, edit);
  ClampScroll(edit, layout);
  edit.Layout = layout;
  const ega = layout.Ega;

  // Infurida
  const problems = ProblemsText(edit);
  const problemsRole = edit.Problems.Errors.length ? 'Error' : (ega ? 'SimStatusText' : 'WindowLabel');
  const problemsX = layout.Info.X + layout.Info.Width - theme.TextWidth(problems) - (ega ? 8 : 16);
  if (ega) {
    theme.FillRect(layout.Info.X, layout.Info.Y, layout.Info.Width, layout.Info.Height, 'SimStatusBar');
    theme.Text(layout.Info.X + 8, layout.Info.Y, InfoText(edit), 'SimStatusText');
    theme.Text(problemsX, layout.Info.Y, problems, problemsRole);
    theme.FillRect(desktop.X, layout.Info.Y + layout.Info.Height, desktop.Width, desktop.Height - layout.Info.Height, 'LayoutBack');
  } else {
    theme.Text(layout.Info.X + 16, layout.Info.Y + 4, InfoText(edit), 'WindowText');
    theme.Text(problemsX, layout.Info.Y + 4, problems, problemsRole);
    const panel = { X: desktop.X + 8, Y: layout.Area.Y - 6, Width: desktop.Width - 16, Height: layout.Area.Height + 12 };
    theme.Panel(panel.X, panel.Y, panel.Width, panel.Height, 'Window');
    theme.RoundRect(panel.X + 1, panel.Y + 1, panel.Width - 2, panel.Height - 2, 5, 'LayoutBack');
    const palettePanel = { X: layout.Palette.X - 8, Y: layout.Palette.Y - 4, Width: layout.Palette.Width + 16, Height: layout.Palette.Height + 8 };
    theme.Panel(palettePanel.X, palettePanel.Y, palettePanel.Width, palettePanel.Height, 'Window');
  }

  // Ruudustik
  const view = GridView(edit, layout);
  const { Grid: grid } = layout;
  theme.Clip(grid.X, grid.Y, grid.Width + 1, grid.Height + 1, () => {
    DrawLayout(theme, view, edit.Model);
    for (const cell of edit.Model.Layout.Cells) {
      if (IconTypes[cell.T]?.Kind === 'Buffer') DrawBufferKind(theme, view, cell);
    }
    const drag = edit.Drag;
    if (drag && drag.Kind === 'Move' && drag.Target) {
      const target = CellRect(view, drag.Target.X, drag.Target.Y);
      theme.StrokeRect(target.X, target.Y, target.Width + 1, target.Height + 1, drag.TargetFree ? 'Highlight' : 'Deadlock', { Width: ega ? 1 : 1.5, Dash: [3, 2] });
    }
    const cursor = CellRect(view, edit.Cursor.X, edit.Cursor.Y);
    theme.StrokeRect(cursor.X, cursor.Y, cursor.Width + 1, cursor.Height + 1, 'Highlight', { Width: ega ? 1 : 1.5 });
  });
  if (!ega) theme.StrokeRect(grid.X - 1, grid.Y - 1, grid.Width + 3, grid.Height + 3, 'LayoutGrid', { Width: 0.5 });
  edit.Arrows = ScrollArrows(edit, layout);
  edit.Arrows.forEach(arrow => DrawScrollArrow(theme, arrow));

  // Palett
  if (ega) theme.FillRect(desktop.X, layout.Palette.Y - 3, desktop.Width, 1, 'LayoutGrid');
  layout.Items.forEach((rect, index) => DrawPaletteItem(theme, layout, rect, PALETTE[index], index === edit.Tool, index === edit.HoverItem));
}

// [U] ViewPainter – View: kogu mudel korraga, ilma ruudustikuta. (windows.js DesktopView)
function ViewPainter(theme, desktop) {
  const edit = EditState;
  if (!edit) return;
  const model = edit.Model;
  const ega = theme.Name === 'EGA';
  const title = FormatText(Texts.EdViewInfo, { Name: model.Meta.Name || Texts.DesktopUntitled, X: model.Layout.Dim.X, Y: model.Layout.Dim.Y });
  let rect;
  if (ega) {
    theme.FillRect(desktop.X, desktop.Y, desktop.Width, ROW_HEIGHT, 'SimStatusBar');
    theme.Text(desktop.X + 8, desktop.Y, title, 'SimStatusText');
    rect = { X: desktop.X, Y: desktop.Y + ROW_HEIGHT, Width: desktop.Width, Height: desktop.Height - ROW_HEIGHT };
    theme.FillRect(rect.X, rect.Y, rect.Width, rect.Height, 'LayoutBack');
  } else {
    theme.Text(desktop.X + 16, desktop.Y + 4, title, 'WindowText');
    const panel = { X: desktop.X + 8, Y: desktop.Y + ROW_HEIGHT + 8, Width: desktop.Width - 16, Height: desktop.Height - ROW_HEIGHT - 16 };
    theme.Panel(panel.X, panel.Y, panel.Width, panel.Height, 'Window');
    theme.RoundRect(panel.X + 1, panel.Y + 1, panel.Width - 2, panel.Height - 2, 5, 'LayoutBack');
    rect = { X: panel.X + 12, Y: panel.Y + 10, Width: panel.Width - 24, Height: panel.Height - 20 };
  }
  DrawLayout(theme, LayoutView(theme, rect, model.Layout.Dim), model, { Grid: false });
}

// =====================================================================
// Sisend
// =====================================================================

const Inside = (rect, point) => point.X >= rect.X && point.X < rect.X + rect.Width && point.Y >= rect.Y && point.Y < rect.Y + rect.Height;

// Ruudustiku lahter hiire all (ka väljaspool nähtavat osa, piiratud ruudustikuga) või null.
function CellUnder(edit, point, clamp = false) {
  const layout = edit.Layout;
  if (!layout) return null;
  if (!clamp && !Inside(layout.Grid, point)) return null;
  const view = GridView(edit, layout);
  const dim = edit.Model.Layout.Dim;
  const x = Math.floor((point.X - view.X) / view.CW);
  const y = Math.floor((point.Y - view.Y) / view.CH);
  const visibleX = [edit.Scroll.X, edit.Scroll.X + layout.Visible.X - 1];
  const visibleY = [edit.Scroll.Y, edit.Scroll.Y + layout.Visible.Y - 1];
  return {
    X: Math.max(visibleX[0], Math.min(visibleX[1], Math.min(dim.X - 1, x))),
    Y: Math.max(visibleY[0], Math.min(visibleY[1], Math.min(dim.Y - 1, y))),
  };
}

function CurrentItem(edit) {
  return PALETTE[edit.Tool];
}

// [U] ClickCell – paleti tööriist ühel lahtril (klõps, Enter, tühik).
function ClickCell(edit, x, y) {
  const item = CurrentItem(edit);
  const tool = PaletteTool(item);
  const before = BeginChange(edit);
  switch (tool) {
    case 'Select':
      if (CellAt(edit.Model, x, y) && edit.OnEditCell) edit.OnEditCell(CellAt(edit.Model, x, y));
      return;
    case 'Erase': EraseCell(edit.Model, x, y); break;
    case 'Direction':
      if (!CycleDirection(edit.Model, x, y)) edit.Message = Texts.EdNoDirection;
      break;
    default: PlaceIcon(edit.Model, x, y, item, { Track: edit.Track }); break;
  }
  CommitChange(edit, before);
  RequestRedraw();
}

// Shift + nool: raja või punktiiri lõik kursorist naabrisse; kustutamisel kustutab naabri.
function StepWithTool(edit, direction) {
  const step = DIRECTIONS[direction];
  const to = { X: edit.Cursor.X + step.DX, Y: edit.Cursor.Y + step.DY };
  if (!InsideGrid(edit.Model, to.X, to.Y)) return;
  const tool = PaletteTool(CurrentItem(edit));
  const before = BeginChange(edit);
  if (tool === 'Track' || tool === 'Dot') {
    if (!LaySegment(edit.Model, edit.Cursor.X, edit.Cursor.Y, direction, { Dot: tool === 'Dot', Track: edit.Track })) {
      edit.Message = Texts.EdBlocked;
    }
  } else if (tool === 'Erase') {
    EraseCell(edit.Model, to.X, to.Y);
  } else if (tool === 'Select') {
    if (MoveCell(edit.Model, edit.Cursor, to)) edit.Cursor = { ...to };
    CommitChange(edit, before);
    RequestRedraw();
    return;
  }
  edit.Cursor = to;
  CommitChange(edit, before);
  RequestRedraw();
}

const ARROW_KEYS = { ArrowUp: 'N', ArrowRight: 'E', ArrowDown: 'S', ArrowLeft: 'W' };

// Ruudustiku suuruse muutmine (G): „13 x 7“; välja jäävate ikoonide korral küsitakse.
function AskGridSize(edit) {
  const dim = edit.Model.Layout.Dim;
  InputBox(Texts.EdSizeTitle, FormatText(Texts.EdSizePrompt, MAX_LAYOUT_DIM), `${dim.X} x ${dim.Y}`, (text) => {
    if (text === null) return;
    const newDim = ParseDim(text);
    if (!newDim) { MessageBox(Texts.EdSizeTitle, [FormatText(Texts.EdSizeBad, MAX_LAYOUT_DIM)]); return; }
    const resize = () => {
      const before = BeginChange(edit);
      ResizeLayout(edit.Model, newDim);
      CommitChange(edit, before);
    };
    const lost = CellsOutside(edit.Model, newDim);
    if (lost === 0) { resize(); return; }
    MessageBox(Texts.EdSizeTitle, [FormatText(Texts.EdSizeLoses, { Count: lost })], [Texts.ButtonYes, Texts.ButtonNo], (button) => {
      if (button === 0) resize();
    });
  });
}

// [U] LayoutKey – klahvid: nooled, Shift + nool, Enter / tühik, Del, Tab, T, G, Ctrl-Z / Ctrl-Y, Esc.
function LayoutKey(edit, name, shift) {
  edit.Message = '';
  if (ARROW_KEYS[name]) {
    if (shift) { StepWithTool(edit, ARROW_KEYS[name]); return true; }
    const step = DIRECTIONS[ARROW_KEYS[name]];
    edit.Cursor = { X: edit.Cursor.X + step.DX, Y: edit.Cursor.Y + step.DY };
    ClampCursor(edit);
    RequestRedraw();
    return true;
  }
  switch (name) {
    case 'Enter': case ' ': ClickCell(edit, edit.Cursor.X, edit.Cursor.Y); return true;
    case 'Delete': case 'Backspace': {
      const before = BeginChange(edit);
      EraseCell(edit.Model, edit.Cursor.X, edit.Cursor.Y);
      CommitChange(edit, before);
      RequestRedraw();
      return true;
    }
    case 'Tab':
      edit.Tool = (edit.Tool + (shift ? -1 : 1) + PALETTE.length) % PALETTE.length;
      edit.HoverItem = null;
      RequestRedraw();
      return true;
    case 't': case 'T':
      edit.Track = edit.Track % (edit.Model.Tracks.length + 1) + 1;
      RequestRedraw();
      return true;
    case 'g': case 'G': AskGridSize(edit); return true;
    case 'k': case 'K': if (edit.OnCheck) edit.OnCheck(); return true;
    case 'Ctrl-Z': if (shift) RedoEdit(edit); else UndoEdit(edit); RequestRedraw(); return true;
    case 'Ctrl-Y': RedoEdit(edit); RequestRedraw(); return true;
    case 'Escape': ExitEditor(); return true;
    default: return false;
  }
}

// Lohistamine: rada / punktiir arvutatakse iga kord algseisust uuesti (tagasi liikudes kaob lõik).
function DragTo(edit, cell) {
  const drag = edit.Drag;
  const last = drag.Path[drag.Path.length - 1];
  if (last.X === cell.X && last.Y === cell.Y) return;
  edit.Cursor = { ...cell };
  if (drag.Kind === 'Path') {
    ExtendDragPath(drag.Path, cell);
    drag.Moved = true;
    RestoreModel(edit.Model, drag.Base);
    const tool = PaletteTool(CurrentItem(edit));
    const blocked = LayPath(edit.Model, drag.Path, { Dot: tool === 'Dot', Track: edit.Track });
    edit.Message = blocked > 0 ? Texts.EdBlocked : '';
  } else if (drag.Kind === 'Erase') {
    for (const step of CellSteps(last, cell)) EraseCell(edit.Model, step.X, step.Y);
    drag.Path.push(cell);
  } else if (drag.Kind === 'Move') {
    drag.Path.push(cell);
    drag.Target = cell;
    drag.TargetFree = !CellAt(edit.Model, cell.X, cell.Y);
  }
  RequestRedraw();
}

function FinishDrag(edit) {
  const drag = edit.Drag;
  edit.Drag = null;
  if (drag.Kind === 'Path' && !drag.Moved) {
    RestoreModel(edit.Model, drag.Base);
    PlaceIcon(edit.Model, drag.Path[0].X, drag.Path[0].Y, CurrentItem(edit), { Track: edit.Track });
  }
  if (drag.Kind === 'Move' && drag.Target) {
    if (MoveCell(edit.Model, drag.Path[0], drag.Target)) edit.Cursor = { ...drag.Target };
    else if (drag.Target.X !== drag.Path[0].X || drag.Target.Y !== drag.Path[0].Y) edit.Message = Texts.EdCellBusy;
  }
  if (drag.Kind === 'Move' && !drag.Target) {   // klõps ilma liigutamata: objekti andmed (Config)
    RequestRedraw();
    ClickCell(edit, drag.Path[0].X, drag.Path[0].Y);
    return;
  }
  CommitChange(edit, drag.Before);
  RequestRedraw();
}

// [U] LayoutInput – klahvid ja hiir Layout aknas (windows.js DesktopView.Input).
function LayoutInput(input) {
  const edit = EditState;
  if (!edit) return false;
  if (input.Kind === 'key') return LayoutKey(edit, input.Name, input.Shift);
  if (!edit.Layout) return false;
  const point = input.Point;
  switch (input.Kind) {
    case 'down': {
      edit.Message = '';
      const itemRect = edit.Layout.Items.find(rect => Inside(rect, point));
      if (itemRect) { edit.Tool = itemRect.Index; RequestRedraw(); return true; }
      const arrow = (edit.Arrows ?? []).find(candidate => Inside(candidate, point));
      if (arrow) {
        edit.Scroll.X += DIRECTIONS[arrow.Id].DX;
        edit.Scroll.Y += DIRECTIONS[arrow.Id].DY;
        edit.Cursor.X = Math.max(edit.Scroll.X, Math.min(edit.Scroll.X + edit.Layout.Visible.X - 1, edit.Cursor.X));
        edit.Cursor.Y = Math.max(edit.Scroll.Y, Math.min(edit.Scroll.Y + edit.Layout.Visible.Y - 1, edit.Cursor.Y));
        RequestRedraw();
        return true;
      }
      const cell = CellUnder(edit, point);
      if (!cell) return false;
      edit.Cursor = { ...cell };
      const tool = PaletteTool(CurrentItem(edit));
      const before = BeginChange(edit);
      if (tool === 'Track' || tool === 'Dot') {
        edit.Drag = { Kind: 'Path', Before: before, Base: JSON.parse(before), Path: [cell], Moved: false };
        RequestRedraw();
        return 'capture';
      }
      if (tool === 'Erase') {
        EraseCell(edit.Model, cell.X, cell.Y);
        edit.Drag = { Kind: 'Erase', Before: before, Path: [cell] };
        RequestRedraw();
        return 'capture';
      }
      if (tool === 'Select') {
        if (!CellAt(edit.Model, cell.X, cell.Y)) { RequestRedraw(); return true; }
        edit.Drag = { Kind: 'Move', Before: before, Path: [cell], Target: null };
        RequestRedraw();
        return 'capture';
      }
      ClickCell(edit, cell.X, cell.Y);
      return true;
    }
    case 'move': {
      if (edit.Drag) {
        DragTo(edit, CellUnder(edit, point, true));
        return true;
      }
      const itemRect = edit.Layout.Items.find(rect => Inside(rect, point));
      const hover = itemRect ? itemRect.Index : null;
      if (hover !== edit.HoverItem) { edit.HoverItem = hover; RequestRedraw(); }
      return true;
    }
    case 'up':
      if (edit.Drag) FinishDrag(edit);
      return true;
    case 'wheel': {
      const dim = edit.Model.Layout.Dim;
      const axis = edit.Layout.Visible.Y < dim.Y ? 'Y' : 'X';
      edit.Scroll[axis] += Math.sign(input.Delta);
      edit.Scroll[axis] = Math.max(0, Math.min(dim[axis] - edit.Layout.Visible[axis], edit.Scroll[axis]));
      edit.Cursor[axis] = Math.max(edit.Scroll[axis], Math.min(edit.Scroll[axis] + edit.Layout.Visible[axis] - 1, edit.Cursor[axis]));
      RequestRedraw();
      return true;
    }
    default:
      return false;
  }
}

// [U] LayoutHint – olekurea vihje: teade, paleti punkt hiire all või valitud tööriist.
function LayoutHint() {
  const edit = EditState;
  if (!edit) return '';
  if (edit.Message) return edit.Message;
  if (edit.HoverItem !== null && edit.HoverItem !== undefined) return Texts.EdPalette[PALETTE[edit.HoverItem].Id];
  return '';
}

function LayoutStatusKeys() {
  return Texts.EdStatusKeys;
}

// View: Esc või klõps viib tagasi.
function ViewInput(input) {
  if (input.Kind === 'key' && ['Escape', 'Enter', ' '].includes(input.Name)) { ExitEditor(); return true; }
  if (input.Kind === 'down') { ExitEditor(); return true; }
  return input.Kind === 'move';
}

// =====================================================================
// Avamine ja sulgemine
// =====================================================================

// [O] EditLayout – Layout: topoloogia redigeerimine (ruudustik ja ikoonipalett).
//     options: Model (muudetakse kohapeal), OnChange() – mudel muutus, OnExit() – aken suleti.
//     Kutsub: fms.js (Edit → Layout).
//     OnEditCell(lahter) – objekti andmed (Config; klõps või Enter tööriistaga „vali“),
//     OnCheck() – vigade nimekiri (K). Tool: 'Select' – alusta tööriistaga „vali“ (Config → Choose).
//     Kui Layout on juba avatud sama mudeliga, jääb Undo alles.
export function EditLayout({ Model: model, OnChange: onChange = null, OnExit: onExit = null, OnEditCell: onEditCell = null,
  OnCheck: onCheck = null, Tool: tool = undefined, Message: message = '' }) {
  const previous = EditState && EditState.Mode === 'Layout' && EditState.Model === model ? EditState : null;
  EditState = {
    Mode: 'Layout', Model: model, OnChange: onChange, OnExit: onExit, OnEditCell: onEditCell, OnCheck: onCheck,
    Tool: tool ? PALETTE.findIndex(item => item.Id === tool) : (previous ? previous.Tool : PALETTE.findIndex(item => item.Id === 'HorTr')),
    HoverItem: null,
    Cursor: previous ? previous.Cursor : { X: 0, Y: 0 }, Scroll: previous ? previous.Scroll : { X: 0, Y: 0 },
    Track: previous ? previous.Track : 1, Undo: previous ? previous.Undo : [], Redo: previous ? previous.Redo : [],
    Drag: null, Message: message, Theme: null, Layout: null, Arrows: [], Problems: ModelProblems(model),
  };
  SetDesktopView({ Painter: LayoutPainter, Input: LayoutInput, StatusKeys: LayoutStatusKeys, StatusHint: LayoutHint });
}

// [U] ViewLayout – View: kogu mudel korraga, ainult vaatamiseks. Kutsub: fms.js (Edit → View).
export function ViewLayout({ Model: model, OnExit: onExit = null }) {
  EditState = { Mode: 'View', Model: model, OnExit: onExit };
  SetDesktopView({ Painter: ViewPainter, Input: ViewInput, StatusKeys: () => Texts.EdViewKeys, StatusHint: () => '' });
}

// [U] ExitEditor – sulgeb redaktori (Esc) ja annab sellest teada.
function ExitEditor() {
  const edit = EditState;
  StopEditor();
  if (edit && edit.OnExit) edit.OnExit();
}

// [U] StopEditor – sulgeb redaktori ilma teateta (uus mudel, Simulate). Kutsub: fms.js.
export function StopEditor() {
  if (!EditState) return;
  EditState = null;
  SetDesktopView(null);
}

// [U] NoteEditorChange – mudelit muudeti väljaspool Layout-i (vorm): Undo-sse ja kontroll uuesti.
//     Tagastab, kas Layout oli avatud. Kutsub: fms.js.
export function NoteEditorChange(model, before) {
  const edit = EditState;
  if (!edit || edit.Mode !== 'Layout' || edit.Model !== model) return false;
  if (JSON.stringify(model) === before) return true;
  edit.Undo.push(before);
  if (edit.Undo.length > UNDO_LIMIT) edit.Undo.shift();
  edit.Redo = [];
  ModelEdited(edit);
  return true;
}

// [U] SetEditorCursor – kursor lahtrisse (Config → All, vigade nimekiri). Kutsub: fms.js.
export function SetEditorCursor(x, y) {
  if (!EditState || EditState.Mode !== 'Layout') return;
  EditState.Cursor = { X: x, Y: y };
  ClampCursor(EditState);
  RequestRedraw();
}

// [U] EditorCursorRect – kursori lahter ekraanil (loogilistes pikslites) või null: vorm
//     (FormBox Avoid) avaneb all või üleval nii, et objekt jääb näha (originaalis avanes aken
//     ekraani all). Kutsub: fms.js.
export function EditorCursorRect() {
  const edit = EditState;
  if (!edit || edit.Mode !== 'Layout' || !edit.Layout) return null;
  const layout = edit.Layout;
  ClampScroll(edit, layout);
  return CellRect(GridView(edit, layout), edit.Cursor.X, edit.Cursor.Y);
}

// [U] EditorActive – kas redaktor (Layout või View) on avatud.
export function EditorActive() {
  return EditState !== null;
}
