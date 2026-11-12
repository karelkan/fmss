// FMSS – redaktori testid (etapp 6): automaatne ikoonivalik, rada ja punktiir lohistades,
// objektid, kustutamine, ümbernummerdus, ruudustiku suurus.
// Käivitamine: npm test
// Põhitest: näidismudel ehitatakse tühjast ruudustikust ainult redaktori operatsioonidega –
// tulemus peab olema sama joonis, sama võrk ja sama simulatsiooni aruanne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CheckModel, EmptyModel, IconTypes } from '../src/fms_glb.js';
import { Enumerate, SimRun } from '../src/fms_sim.js';
import {
  IconFromPorts, CellPorts, LaySegment, LayPath, CellSteps, ExtendDragPath, PlaceIcon, EraseCell,
  MoveCell, CycleDirection, ResizeLayout, CellsOutside, ParseDim, RestoreModel, CellAt, PALETTE,
  PaletteTool, MAX_LAYOUT_DIM,
} from '../src/fms_ed.js';

const ROOT = new URL('../', import.meta.url);
const demoText = readFileSync(new URL('models/demo.fms.json', ROOT), 'utf8');
const demo = () => JSON.parse(demoText);

const Item = id => PALETTE.find(item => item.Id === id);
const Cells = (...pairs) => pairs.map(([x, y]) => ({ X: x, Y: y }));
const SortCells = cells => [...cells].sort((a, b) => a.Y - b.Y || a.X - b.X);
const IconAt = (model, x, y) => CellAt(model, x, y)?.T ?? null;

function Blank(x = 8, y = 6) {
  const model = EmptyModel('test');
  model.Layout.Dim = { X: x, Y: y };
  return model;
}

// ---------------------------------------------------------------------
// Automaatne ikoonivalik
// ---------------------------------------------------------------------

test('IconFromPorts: iga 2–4 külje kombinatsioon annab ikooni, mille küljed on täpselt need', () => {
  const sides = ['N', 'E', 'S', 'W'];
  for (let mask = 1; mask < 16; mask++) {
    const ports = sides.filter((side, i) => mask & (1 << i));
    const icon = IconFromPorts(ports);
    assert.equal(IconTypes[icon].Kind, 'Track', icon);
    if (ports.length === 1) {
      assert.ok(CellPorts({ T: icon }).includes(ports[0]), `${ports} → ${icon}`);
      assert.equal(CellPorts({ T: icon }).length, 2);
    } else {
      assert.deepEqual(new Set(CellPorts({ T: icon })), new Set(ports), `${ports} → ${icon}`);
    }
  }
  assert.equal(IconFromPorts([]), null);
  assert.equal(IconFromPorts(['W', 'E', 'N']), 'TeeN');
  assert.equal(IconFromPorts(['N', 'S', 'W']), 'TeeW');
  assert.equal(IconFromPorts(['S', 'E']), 'ArcSE');
});

test('IconFromPorts on CellPorts-i pöördfunktsioon kõigil raja ikoonidel', () => {
  for (const [name, icon] of Object.entries(IconTypes)) {
    if (icon.Kind !== 'Track') continue;
    assert.equal(IconFromPorts(CellPorts({ T: name })), name);
  }
});

// ---------------------------------------------------------------------
// Lohistamine
// ---------------------------------------------------------------------

test('CellSteps: külgnaabrite kaudu, igal sammul üks lahter, lõpp sihtkohas', () => {
  for (const [from, to] of [[{ X: 0, Y: 0 }, { X: 3, Y: 2 }], [{ X: 5, Y: 1 }, { X: 0, Y: 4 }], [{ X: 2, Y: 2 }, { X: 2, Y: 0 }]]) {
    const steps = CellSteps(from, to);
    assert.equal(steps.length, Math.abs(to.X - from.X) + Math.abs(to.Y - from.Y));
    let previous = from;
    for (const step of steps) {
      assert.equal(Math.abs(step.X - previous.X) + Math.abs(step.Y - previous.Y), 1);
      previous = step;
    }
    assert.deepEqual(previous, to);
  }
  // diagonaal vaheldub (ei lähe kõigepealt lõpuni ühes suunas)
  assert.deepEqual(CellSteps({ X: 0, Y: 0 }, { X: 2, Y: 2 }), Cells([1, 0], [1, 1], [2, 1], [2, 2]));
});

test('ExtendDragPath: tagasi eelmisse lahtrisse liikudes kaob viimane lõik', () => {
  const path = Cells([0, 0]);
  ExtendDragPath(path, { X: 1, Y: 0 });
  ExtendDragPath(path, { X: 2, Y: 0 });
  ExtendDragPath(path, { X: 1, Y: 0 });
  assert.deepEqual(path, Cells([0, 0], [1, 0]));
  ExtendDragPath(path, { X: 1, Y: 2 });   // hüpe: vahelt täidetakse
  assert.deepEqual(path, Cells([0, 0], [1, 0], [1, 1], [1, 2]));
});

test('LayPath: L-kujuline rada – sirged, kaar nurgas, otsad sirged; rada luuakse ise', () => {
  const model = Blank();
  assert.equal(LayPath(model, Cells([0, 0], [2, 0], [2, 2])), 0);
  assert.deepEqual(SortCells(model.Layout.Cells).map(cell => cell.T), ['HorTr', 'HorTr', 'ArcSW', 'VertTr', 'VertTr']);
  assert.equal(model.Tracks.length, 1);
  assert.ok(model.Layout.Cells.every(cell => cell.N === 1));
  assert.deepEqual(CheckModel(model), []);
});

test('LayPath: raja otsast saab pöörata (ots muutub kaareks, mitte hargnemiseks)', () => {
  const model = Blank();
  LayPath(model, Cells([0, 1], [3, 1]));
  LayPath(model, Cells([3, 1], [3, 3]));
  assert.equal(IconAt(model, 3, 1), 'ArcSW');
  LayPath(model, Cells([0, 1], [0, 0]));   // teine ots üles
  assert.equal(IconAt(model, 0, 1), 'ArcNE');
});

test('LayPath: rada keskelt kõrvale → hargnemine; risti läbi → ristmik', () => {
  const model = Blank();
  LayPath(model, Cells([0, 2], [5, 2]));
  LayPath(model, Cells([2, 2], [2, 4]));
  assert.equal(IconAt(model, 2, 2), 'TeeS');
  LayPath(model, Cells([4, 0], [4, 4]));
  assert.equal(IconAt(model, 4, 2), 'Cruise');
});

test('LayPath: suletud silmus – kõik neli nurka on kaared', () => {
  const model = Blank();
  LayPath(model, Cells([1, 1], [4, 1], [4, 3], [1, 3], [1, 1]));
  assert.equal(IconAt(model, 1, 1), 'ArcSE');
  assert.equal(IconAt(model, 4, 1), 'ArcSW');
  assert.equal(IconAt(model, 4, 3), 'ArcNW');
  assert.equal(IconAt(model, 1, 3), 'ArcNE');
  assert.equal(model.Layout.Cells.length, 10);
});

test('LayPath: rada ei lähe objekti ega punktiiri sisse; ruudustikust välja ei lähe', () => {
  const model = Blank();
  PlaceIcon(model, 2, 0, Item('MachToolDown'));
  assert.equal(LayPath(model, Cells([0, 0], [4, 0])) > 0, true);
  assert.equal(IconAt(model, 2, 0), 'MachToolDown');
  assert.equal(model.Machines.length, 1);
  PlaceIcon(model, 1, 3, Item('Dot'));
  assert.equal(LaySegment(model, 0, 3, 'E'), false);
  assert.equal(LaySegment(model, 7, 5, 'E'), false);
});

test('Punktiir: objektist sirge rajani → hargnemine (jaam); kaarele või raja otsa ei saa', () => {
  const model = Blank();
  LayPath(model, Cells([0, 3], [4, 3], [4, 5]));
  PlaceIcon(model, 1, 0, Item('InOutBuf'));
  assert.equal(LayPath(model, Cells([1, 0], [1, 3]), { Dot: true }), 0);
  assert.equal(IconAt(model, 1, 3), 'TeeN');
  assert.ok(CellAt(model, 1, 1).Dot && CellAt(model, 1, 2).Dot);
  assert.equal(CellAt(model, 1, 1).N, undefined);
  // kaar (4,3) ja raja ots (0,3)
  PlaceIcon(model, 4, 1, Item('SysOut'));
  assert.ok(LayPath(model, Cells([4, 1], [4, 3]), { Dot: true }) > 0);
  assert.equal(IconAt(model, 4, 3), 'ArcSW');
  PlaceIcon(model, 0, 1, Item('FromCS'));
  assert.ok(LayPath(model, Cells([0, 1], [0, 3]), { Dot: true }) > 0);
  assert.equal(IconAt(model, 0, 3), 'HorTr');
});

// ---------------------------------------------------------------------
// Objektid ja kustutamine
// ---------------------------------------------------------------------

test('PlaceIcon: pink ja puhver saavad uue kirje; sama liiki ikoon jätab objekti samaks', () => {
  const model = Blank();
  PlaceIcon(model, 1, 0, Item('MachToolDown'));
  PlaceIcon(model, 3, 0, Item('MachToolUp'));
  assert.deepEqual(model.Machines.map(machine => machine.Name), ['MT1', 'MT2']);
  model.Machines[0].SetupTime = 99;
  PlaceIcon(model, 1, 0, Item('MachToolThruDown'));
  assert.equal(CellAt(model, 1, 0).T, 'MachToolThruDown');
  assert.equal(CellAt(model, 1, 0).N, 1);
  assert.equal(model.Machines[0].SetupTime, 99);
  assert.equal(model.Machines.length, 2);
  PlaceIcon(model, 1, 0, Item('InBuf'));   // teist liiki: pink kaob, puhver tuleb
  assert.equal(model.Machines.length, 1);
  assert.equal(CellAt(model, 3, 0).N, 1);
  assert.equal(model.Buffers.length, 1);
  assert.deepEqual(CheckModel(model), []);
});

test('PlaceIcon: punktiir rajal muudab lahtri punktiiriks ja tagasi; ToCS loob kesklao andmed', () => {
  const model = Blank();
  LayPath(model, Cells([0, 0], [3, 0]));
  PlaceIcon(model, 1, 0, Item('Dot'));
  assert.ok(CellAt(model, 1, 0).Dot);
  assert.equal(CellAt(model, 1, 0).N, undefined);
  PlaceIcon(model, 1, 0, Item('Dot'));
  assert.equal(CellAt(model, 1, 0).Dot, undefined);
  assert.equal(CellAt(model, 1, 0).N, 1);
  model.Storage = null;
  PlaceIcon(model, 5, 5, Item('ToCS'));
  assert.ok(model.Storage && model.Storage.Capacity > 0);
  assert.deepEqual(CheckModel(model), []);
});

test('EraseCell: punktiiri kustutamisel kaob hargnemine; puhvri kustutamisel nummerdatakse ümber', () => {
  const model = Blank();
  LayPath(model, Cells([0, 3], [4, 3]));
  PlaceIcon(model, 1, 1, Item('InBuf'));
  PlaceIcon(model, 3, 1, Item('TurnBuf'));
  LayPath(model, Cells([1, 1], [1, 3]), { Dot: true });
  LayPath(model, Cells([3, 1], [3, 3]), { Dot: true });
  model.Buffers[1].Capacity = 7;
  assert.equal(IconAt(model, 1, 3), 'TeeN');
  EraseCell(model, 1, 2);
  assert.equal(IconAt(model, 1, 3), 'HorTr');
  EraseCell(model, 1, 1);
  assert.equal(model.Buffers.length, 1);
  assert.equal(model.Buffers[0].Capacity, 7);
  assert.equal(CellAt(model, 3, 1).N, 1);
  assert.equal(EraseCell(model, 6, 5), false);
  assert.deepEqual(CheckModel(model), []);
});

test('EraseCell: ristmik kaotab ühe haru; rada jääb alles ka ilma ikoonideta', () => {
  const model = Blank();
  LayPath(model, Cells([0, 2], [4, 2]));
  LayPath(model, Cells([2, 0], [2, 4]));
  assert.equal(IconAt(model, 2, 2), 'Cruise');
  EraseCell(model, 2, 1);
  assert.equal(IconAt(model, 2, 2), 'TeeS');
  for (const cell of [...model.Layout.Cells]) EraseCell(model, cell.X, cell.Y);
  assert.equal(model.Layout.Cells.length, 0);
  assert.equal(model.Tracks.length, 1);
});

test('MoveCell ja CycleDirection', () => {
  const model = Blank();
  PlaceIcon(model, 0, 0, Item('FromCS'));
  assert.equal(MoveCell(model, { X: 0, Y: 0 }, { X: 2, Y: 2 }), true);
  assert.equal(IconAt(model, 2, 2), 'FromCS');
  LayPath(model, Cells([0, 4], [3, 4]));
  assert.equal(MoveCell(model, { X: 2, Y: 2 }, { X: 1, Y: 4 }), false);   // hõivatud
  const cell = CellAt(model, 1, 4);
  const directions = [];
  for (let i = 0; i < 3; i++) { CycleDirection(model, 1, 4); directions.push(cell.Dir); }
  assert.deepEqual(directions, ['E', 'W', undefined]);
  LayPath(model, Cells([2, 4], [2, 5]));   // hargnemisel noolt ei ole
  assert.equal(CycleDirection(model, 2, 4), false);
  assert.equal(CycleDirection(model, 2, 2), false);
});

test('Suunanool kaob, kui ikoon muutub ja nool enam ei sobi', () => {
  const model = Blank();
  LayPath(model, Cells([0, 2], [4, 2]));
  CycleDirection(model, 2, 2);
  assert.equal(CellAt(model, 2, 2).Dir, 'E');
  LayPath(model, Cells([2, 2], [2, 4]));
  assert.equal(IconAt(model, 2, 2), 'TeeS');
  assert.equal(CellAt(model, 2, 2).Dir, undefined);
});

test('ResizeLayout: välja jäävad ikoonid kustutatakse koos objektidega; ParseDim', () => {
  const model = Blank();
  PlaceIcon(model, 1, 1, Item('MachToolDown'));
  PlaceIcon(model, 6, 1, Item('MachToolDown'));
  LayPath(model, Cells([0, 4], [7, 4]));
  assert.equal(CellsOutside(model, { X: 5, Y: 6 }), 4);
  ResizeLayout(model, { X: 5, Y: 6 });
  assert.equal(model.Machines.length, 1);
  assert.equal(IconAt(model, 4, 4), 'HorTr');
  assert.deepEqual(model.Layout.Dim, { X: 5, Y: 6 });
  assert.deepEqual(CheckModel(model), []);
  assert.deepEqual(ParseDim('13 x 7'), { X: 13, Y: 7 });
  assert.deepEqual(ParseDim(' 20×10 '), { X: 20, Y: 10 });
  assert.equal(ParseDim(`${MAX_LAYOUT_DIM.X + 1} x 5`), null);
  assert.equal(ParseDim('0 x 5'), null);
  assert.equal(ParseDim('kaks'), null);
});

test('RestoreModel: sisu asendub, objekt jääb samaks (Undo)', () => {
  const model = Blank();
  const before = JSON.stringify(model);
  LayPath(model, Cells([0, 0], [3, 0]));
  const same = model;
  RestoreModel(model, JSON.parse(before));
  assert.equal(model, same);
  assert.equal(model.Layout.Cells.length, 0);
  assert.equal(model.Tracks.length, 0);
});

test('Palett: kõik originaali ikoonid (v.a Empty) ja tööriistad on olemas', () => {
  const icons = new Set(PALETTE.filter(item => item.T && !item.Dot).map(item => item.T));
  for (const name of Object.keys(IconTypes)) if (name !== 'Empty') assert.ok(icons.has(name), name);
  assert.deepEqual(PALETTE.filter(item => !item.T).map(item => item.Id), ['Select', 'Erase', 'Direction']);
  assert.equal(PaletteTool(Item('Dot')), 'Dot');
  assert.equal(PaletteTool(Item('ArcNE')), 'Track');
  assert.equal(PaletteTool(Item('HorCon')), 'Connector');
  assert.equal(PaletteTool(Item('ToCS')), 'Object');
});

// ---------------------------------------------------------------------
// Põhitest: näidismudel redaktoriga
// ---------------------------------------------------------------------

// Näidis-PTS (joon. 5.5) tühjast ruudustikust: silmus ühe lohistamisega, objektid paletist,
// punktiirühendused objektist rajani, suunanool.
function BuildDemoWithEditor() {
  const model = EmptyModel('Näidis-PTS');
  model.Layout.Dim = { X: 13, Y: 7 };
  const loop = Cells([1, 3], [11, 3], [11, 4], [1, 4], [1, 3]);
  assert.equal(LayPath(model, loop), 0);
  PlaceIcon(model, 3, 0, Item('MachToolDown'));
  PlaceIcon(model, 7, 0, Item('MachToolDown'));
  PlaceIcon(model, 3, 1, Item('InOutBuf'));
  PlaceIcon(model, 7, 1, Item('TurnBuf'));
  PlaceIcon(model, 2, 6, Item('FromCS'));
  PlaceIcon(model, 9, 6, Item('ToCS'));
  PlaceIcon(model, 10, 6, Item('SysOut'));
  for (const [x, fromY, toY] of [[3, 1, 3], [7, 1, 3], [2, 6, 4], [9, 6, 4], [10, 6, 4]]) {
    assert.equal(LayPath(model, Cells([x, fromY], [x, toY]), { Dot: true }), 0);
  }
  CycleDirection(model, 5, 4);
  return model;
}

test('Näidismudel redaktoriga: sama joonis kui models/demo.fms.json', () => {
  const model = BuildDemoWithEditor();
  assert.deepEqual(SortCells(model.Layout.Cells), SortCells(demo().Layout.Cells));
  assert.equal(model.Tracks.length, 1);
  assert.equal(model.Machines.length, 2);
  assert.equal(model.Buffers.length, 2);
  assert.deepEqual(CheckModel(model), []);
});

test('Näidismudel redaktoriga: sama võrk ja sama simulatsiooni aruanne', () => {
  const model = BuildDemoWithEditor();
  const original = demo();
  // andmed (etapp 6b: vormid) – siin kopeeritakse näidisest
  for (const key of ['Tracks', 'Machines', 'Buffers', 'Storage', 'Workpieces', 'Sim']) model[key] = structuredClone(original[key]);
  model.Layout.Cells = SortCells(model.Layout.Cells);
  original.Layout.Cells = SortCells(original.Layout.Cells);
  const built = Enumerate(model);
  const expected = Enumerate(original);
  assert.deepEqual(built.Errors, []);
  assert.deepEqual(built.Network, expected.Network);
  assert.deepEqual(SimRun(built.Network), SimRun(expected.Network));
});
