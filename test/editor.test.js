// FMSS – redaktori testid (etapp 6): automaatne ikoonivalik, rada ja punktiir lohistades,
// objektid, kustutamine, ümbernummerdus, ruudustiku suurus.
// Käivitamine: npm test
// Põhitest: näidismudel ehitatakse tühjast ruudustikust ainult redaktori operatsioonidega –
// tulemus peab olema sama joonis, sama võrk ja sama simulatsiooni aruanne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CheckModel, EmptyModel, IconTypes, OPERATIONS, MAX_WORKPIECE_TYPES } from '../src/fms_glb.js';
import { Enumerate, SimRun } from '../src/fms_sim.js';
import {
  IconFromPorts, CellPorts, LaySegment, LayPath, CellSteps, ExtendDragPath, PlaceIcon, EraseCell,
  MoveCell, CycleDirection, ResizeLayout, CellsOutside, ParseDim, RestoreModel, CellAt, PALETTE,
  PaletteTool, MAX_LAYOUT_DIM, DeleteTrack, SegmentCells, EdgeLengthOf, SetEdgeLength, ModelProblems, ProblemCell,
} from '../src/fms_ed.js';
import {
  SubmitModelForm, FormValues, ParseNumber, NumberText, KnownOperations, NewWorkpiece, CopyWorkpiece, FlushWorkpiece,
  ConfigAllCells, RouteText, ProblemLines,
} from '../src/fms_ed_data.js';
import { ParseModelText } from '../src/fms_file.js';

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

test('IconFromPorts on CellPorts-i pöördfunktsioon kõigil raja ikoonidel (v.a sild)', () => {
  for (const [name, icon] of Object.entries(IconTypes)) {
    if (icon.Kind !== 'Track' || icon.CrossOver) continue;   // sild tekib ristumisel, mitte külgedest
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

test('Palett: kõik ikoonid (v.a Empty) ja tööriistad on olemas', () => {
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

// ---------------------------------------------------------------------
// 6b: rajad, lõigu pikkus, vormid, detailid, kontroll
// ---------------------------------------------------------------------

test('DeleteTrack: raja ikoonid ja andmed kaovad, järgmise raja number nihkub', () => {
  const model = Blank();
  LayPath(model, Cells([0, 0], [3, 0]), { Track: 1 });
  LayPath(model, Cells([0, 2], [3, 2]), { Track: 2 });
  model.Tracks[1].Name = 'Teine';
  PlaceIcon(model, 5, 5, Item('FromCS'));
  DeleteTrack(model, 1);
  assert.deepEqual(model.Tracks.map(track => track.Name), ['Teine']);
  assert.ok(model.Layout.Cells.filter(cell => cell.T !== 'FromCS').every(cell => cell.Y === 2 && cell.N === 1));
  assert.equal(IconAt(model, 5, 5), 'FromCS');
  assert.deepEqual(CheckModel(model), []);
});

test('SegmentCells: lõik kahe hargnemise vahel (nagu Enumerate), pikkus koos hargnemiste pooltega', () => {
  const model = demo();
  const InOrder = (cells, expected) => assert.ok(
    JSON.stringify(cells) === JSON.stringify(expected) || JSON.stringify(cells) === JSON.stringify([...expected].reverse()),
    JSON.stringify(cells));   // raja järjekorras, ükskõik kummas suunas
  const top = SegmentCells(model, 5, 3);
  InOrder(top.Cells, [[4, 3], [5, 3], [6, 3]]);
  assert.equal(top.Units, 4);
  const corner = SegmentCells(model, 11, 3);   // MT2 jaam (7,3) … ToCS jaam (10,4), kaks kaart
  InOrder(corner.Cells, [[8, 3], [9, 3], [10, 3], [11, 3], [11, 4]]);
  assert.ok(Math.abs(corner.Units - (4 + Math.PI / 2)) < 1e-9);
  assert.equal(SegmentCells(model, 3, 3), null);   // hargnemine
  assert.equal(SegmentCells(model, 3, 2), null);   // punktiir
});

test('SetEdgeLength: metrokaardi pikkus muudab raja pikkust täpselt lõigu võrra', () => {
  const model = demo();
  const lengthBefore = Enumerate(model).Network.Tracks[0].Length;
  const corner = SegmentCells(model, 9, 3);
  SetEdgeLength(model, corner.Cells, 1000);
  assert.equal(EdgeLengthOf(model, corner.Cells), 1000);
  const result = Enumerate(model);
  assert.deepEqual(result.Errors, []);
  const expected = lengthBefore - corner.Units * model.Scale + 1000;
  assert.ok(Math.abs(result.Network.Tracks[0].Length - expected) < 0.01, `${result.Network.Tracks[0].Length} ≠ ${expected}`);
  SetEdgeLength(model, corner.Cells, 800);   // asendab, ei lisa teist
  assert.equal(model.EdgeLengths.length, 1);
  SetEdgeLength(model, corner.Cells, null);
  assert.deepEqual(model.EdgeLengths, []);
});

test('SetEdgeLength: sama mis käsitsi kirjutatud EdgeLengths (animaatori test)', () => {
  const model = demo();
  SetEdgeLength(model, SegmentCells(model, 5, 3).Cells, 1000);
  const manual = demo();
  manual.EdgeLengths = [{ Cells: [[4, 3], [5, 3], [6, 3]], Length: 1000 }];
  assert.deepEqual(Enumerate(model).Network, Enumerate(manual).Network);
});

test('ParseNumber, NumberText: koma ja punkt; tühi ja tekst → NaN', () => {
  assert.equal(ParseNumber('0,85'), 0.85);
  assert.equal(ParseNumber(' 12 '), 12);
  assert.ok(Number.isNaN(ParseNumber('')));
  assert.ok(Number.isNaN(ParseNumber('kaks')));
  assert.equal(NumberText(0.85), '0,85');
  const { Values, Errors } = FormValues([
    { Key: 'A', Kind: 'Number', Text: '3' }, { Key: 'B', Kind: 'Number', Text: '', Optional: true },
    { Key: 'C', Kind: 'Choice', Choices: ['pidev', 'diskreetne'], Values: ['Continuous', 'Discrete'], Value: 1 },
    { Key: 'D', Kind: 'Check', Value: true }, { Key: 'E', Kind: 'Text', Text: '  MT9 ' }, { Key: 'F', Kind: 'Label', Label: 'x' },
  ]);
  assert.deepEqual(Errors, []);
  assert.deepEqual(Values, { A: 3, B: null, C: 'Discrete', D: true, E: 'MT9' });
});

// Puhvri vorm nagu EditBuffer-is.
function BufferFields(capacity, loadTime) {
  return [
    { Key: 'Capacity', Label: 'Kohti', Kind: 'Number', Text: capacity, Path: 'Buffers[1].Capacity' },
    { Key: 'LoadTime', Label: 'Laadimisaeg, s', Kind: 'Number', Text: loadTime, Path: 'Buffers[1].LoadTime' },
  ];
}
const ApplyBuffer = (target, values) => Object.assign(target.Buffers[0], values);

test('SubmitModelForm: korras väärtused rakenduvad ja muudatusest teatatakse', () => {
  const model = demo();
  let before = null;
  const errors = SubmitModelForm(model, BufferFields('5', '7,5'), ApplyBuffer, ['Buffers[1]'], (json) => { before = json; });
  assert.deepEqual(errors, []);
  assert.equal(model.Buffers[0].Capacity, 5);
  assert.equal(model.Buffers[0].LoadTime, 7.5);
  assert.equal(JSON.parse(before).Buffers[0].Capacity, 3);
});

test('SubmitModelForm: CheckModel-i piirid tulevad välja juurde, mudel jääb muutmata', () => {
  const model = demo();
  let called = false;
  const onChange = () => { called = true; };
  let errors = SubmitModelForm(model, BufferFields('0', '5'), ApplyBuffer, ['Buffers[1]'], onChange);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].Key, 'Capacity');
  assert.match(errors[0].Message, /^Kohti: /);
  errors = SubmitModelForm(model, BufferFields('2,5', 'palju'), ApplyBuffer, ['Buffers[1]'], onChange);
  assert.deepEqual(errors.map(error => error.Key), ['LoadTime']);   // arv puudub → enne CheckModel-i
  errors = SubmitModelForm(model, BufferFields('2,5', '1'), ApplyBuffer, ['Buffers[1]'], onChange);
  assert.match(errors[0].Message, /täisarv/);
  assert.equal(model.Buffers[0].Capacity, 3);
  assert.equal(called, false);
});

test('KnownOperations: pinkide omad ees, siis originaali loend, kordusteta', () => {
  const model = demo();
  model.Machines[0].Ops.push('keevitamine');
  const ops = KnownOperations(model);
  assert.deepEqual(ops.slice(0, 4), ['treimine', 'puurimine', 'keevitamine', 'freesimine']);
  assert.equal(new Set(ops).size, ops.length);
  for (const op of OPERATIONS) assert.ok(ops.includes(op));
});

test('Workpiece data: New, Copy, Flush; kõige rohkem 16 tüüpi', () => {
  const model = demo();
  const copy = CopyWorkpiece(model, 1);
  assert.equal(model.Workpieces[copy - 1].Name, 'Võll (koopia)');
  assert.deepEqual(model.Workpieces[copy - 1].Routes, model.Workpieces[0].Routes);
  assert.notEqual(model.Workpieces[copy - 1].Routes, model.Workpieces[0].Routes);
  const created = NewWorkpiece(model);
  assert.equal(model.Workpieces[created - 1].Routes[0].Ops[0].Op, 'treimine');
  assert.deepEqual(CheckModel(model), []);
  FlushWorkpiece(model, 1);
  assert.equal(model.Workpieces[0].Name, 'Äärik');
  while (model.Workpieces.length < MAX_WORKPIECE_TYPES) NewWorkpiece(model);
  assert.equal(NewWorkpiece(model), null);
  assert.equal(CopyWorkpiece(model, 1), null);
  assert.equal(new Set(model.Workpieces.map(workpiece => workpiece.Name)).size, MAX_WORKPIECE_TYPES);
  assert.deepEqual(CheckModel(model), []);
  assert.equal(RouteText(demo().Workpieces[0].Routes[0], 0), '1. (prioriteet 1) treimine → freesimine');
});

test('ConfigAllCells: pingid, puhvrid, rada ja keskladu ülevalt alla, igaüks üks kord', () => {
  const cells = ConfigAllCells(demo()).map(cell => [cell.X, cell.Y, cell.T]);
  assert.deepEqual(cells, [[3, 0, 'MachToolDown'], [7, 0, 'MachToolDown'], [3, 1, 'InOutBuf'], [7, 1, 'TurnBuf'], [1, 3, 'ArcSE'], [2, 6, 'FromCS']]);
});

test('Kontroll: näidismudel on korras; viga leiab koha joonisel', () => {
  assert.deepEqual(ModelProblems(demo()), { Errors: [], Warnings: [] });
  const model = demo();
  EraseCell(model, 6, 4);   // silmus katki
  const problems = ProblemLines(model);
  assert.ok(problems.Errors >= 1);
  assert.ok(problems.Lines[0].Text.startsWith('Viga: '));
  assert.ok(problems.Lines[0].Cell);
  assert.deepEqual(ProblemCell(demo(), 'Machines[2].Ops'), { X: 7, Y: 0 });
  assert.deepEqual(ProblemCell(demo(), 'Buffers[1]'), { X: 3, Y: 1 });
  assert.deepEqual(ProblemCell(demo(), 'Layout (4, 5)'), { X: 4, Y: 5 });
  assert.equal(ProblemCell(demo(), 'Workpieces[1].Name'), null);
});

test('Pingi kustutamine joonisel: fail jääb laaditavaks, viga annab kontroll', () => {
  const model = demo();
  EraseCell(model, 7, 0);   // MT2 – ainus freesija
  assert.equal(model.Machines.length, 1);
  assert.deepEqual(CheckModel(model), []);
  assert.deepEqual(ParseModelText(JSON.stringify(model), 'x.fms.json').Errors, []);
  PlaceIcon(model, 7, 0, Item('MachToolDown'));   // uus pink (treimine) samasse kohta
  const { Errors: errors } = ModelProblems(model);
  assert.ok(errors.some(error => /freesimine/.test(error.Message)), JSON.stringify(errors));
});

// ---------------------------------------------------------------------
// 7a: konnektorid ja mitu rada
// ---------------------------------------------------------------------

// Stsenaarium G2 (test/network.test.js) redaktoriga: avatud sisendkonveier (rada 1) lõpeb
// konnektoris, konnektorist edasi silmus (rada 2) pingi ja väljundiga.
test('Konnektor redaktoriga: rada otsast konnektorisse ja konnektorist silmusele (G2)', () => {
  const model = Blank(8, 6);
  PlaceIcon(model, 3, 1, Item('HorCon'));
  assert.equal(LayPath(model, Cells([0, 1], [3, 1]), { Track: 1 }), 0);          // raja ots konnektoris
  assert.equal(LayPath(model, Cells([4, 0], [7, 0], [7, 2], [4, 2], [4, 0]), { Track: 2 }), 0);
  assert.equal(LayPath(model, Cells([3, 1], [4, 1]), { Track: 2 }), 0);          // konnektor -> silmus: hargnemine
  assert.equal(IconAt(model, 4, 1), 'TeeW');
  assert.equal(IconAt(model, 2, 1), 'HorTr');
  assert.equal(LaySegment(model, 3, 1, 'N'), false);                               // konnektoril on ainult W ja E
  PlaceIcon(model, 1, 3, Item('FromCS'));
  PlaceIcon(model, 5, 4, Item('InOutBuf'));
  PlaceIcon(model, 5, 5, Item('MachToolUp'));
  PlaceIcon(model, 6, 4, Item('SysOut'));
  for (const [x, fromY, toY] of [[1, 3, 1], [5, 4, 2], [6, 4, 2]]) {
    assert.equal(LayPath(model, Cells([x, fromY], [x, toY]), { Dot: true }), 0);
  }
  CycleDirection(model, 0, 1);
  CycleDirection(model, 7, 1);
  const expected = [
    [0, 1, 'HorTr', 1, 'E'], [1, 1, 'TeeS', 1], [2, 1, 'HorTr', 1], [3, 1, 'HorCon'],
    [4, 0, 'ArcSE', 2], [5, 0, 'HorTr', 2], [6, 0, 'HorTr', 2], [7, 0, 'ArcSW', 2],
    [4, 1, 'TeeW', 2], [7, 1, 'VertTr', 2, 'S'],
    [4, 2, 'ArcNE', 2], [5, 2, 'TeeS', 2], [6, 2, 'TeeS', 2], [7, 2, 'ArcNW', 2],
  ];
  for (const [x, y, type, number, dir] of expected) {
    const cell = CellAt(model, x, y);
    assert.equal(cell.T, type, `(${x}, ${y})`);
    assert.equal(cell.N, number, `(${x}, ${y}) N`);
    assert.equal(cell.Dir, dir, `(${x}, ${y}) Dir`);
  }
  assert.equal(model.Tracks.length, 2);
  model.Workpieces = [{ Name: 'Võll', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [{ Op: OPERATIONS[0], Mean: 200, Dev: 0 }] }] }];
  model.Storage = null;
  assert.deepEqual(ModelProblems(model).Errors, []);
  const network = Enumerate(model).Network;
  assert.deepEqual(network.Tracks.map(track => track.Closed), [false, true]);
  assert.deepEqual(network.Stations.map(station => station.Name), ['FromCS', 'CON1', 'CON1', 'SysOut', 'BUF1']);
  const report = SimRun({ ...network, Sim: { ...network.Sim, Duration: 3600 } }, { CheckInvariants: true });
  assert.ok(report.Completed > 0);
});

test('Konnektor redaktoriga: punktiir hargnemisest konnektori küljeni (G)', () => {
  const model = Blank(8, 6);
  LayPath(model, Cells([5, 0], [7, 0], [7, 2], [5, 2], [5, 0]), { Track: 1 });
  PlaceIcon(model, 3, 1, Item('HorCon'));
  assert.equal(LayPath(model, Cells([3, 1], [5, 1]), { Dot: true }), 0);
  assert.ok(CellAt(model, 4, 1).Dot);
  assert.equal(IconAt(model, 5, 1), 'TeeW');
  PlaceIcon(model, 3, 3, Item('VertCon'));
  assert.ok(LayPath(model, Cells([3, 3], [5, 3]), { Dot: true }) > 0);   // VertCon-il pole E külge
});

test('Sild redaktoriga: teise raja sirge risti -> sild; raja kustutamine; ristmik <-> sild', () => {
  const model = Blank(6, 6);
  LayPath(model, Cells([0, 3], [5, 3]), { Track: 1 });
  assert.equal(LayPath(model, Cells([2, 0], [2, 5]), { Track: 2 }), 0);
  assert.deepEqual(CellAt(model, 2, 3), { X: 2, Y: 3, T: 'CrossOver', N: 1, N2: 2 });
  assert.equal(IconAt(model, 2, 2), 'VertTr');
  assert.deepEqual(CheckModel(model), []);
  // naabri kustutamine ei muuda silda hargnemiseks
  EraseCell(model, 2, 4);
  assert.equal(IconAt(model, 2, 3), 'CrossOver');
  // raja 1 kustutamisel jääb raja 2 sirge (rada 2 saab numbri 1)
  DeleteTrack(model, 1);
  assert.deepEqual(CellAt(model, 2, 3), { X: 2, Y: 3, T: 'VertTr', N: 1 });
  assert.deepEqual(CheckModel(model), []);
  // sama raja ristmik -> sild (palett) ja tagasi
  const loop = Blank(6, 6);
  LayPath(loop, Cells([0, 2], [4, 2]));
  LayPath(loop, Cells([2, 0], [2, 4]));
  assert.equal(IconAt(loop, 2, 2), 'Cruise');
  PlaceIcon(loop, 2, 2, Item('CrossOver'));
  assert.deepEqual(CellAt(loop, 2, 2), { X: 2, Y: 2, T: 'CrossOver', N: 1, N2: 1 });
  PlaceIcon(loop, 2, 2, Item('Cruise'));
  assert.deepEqual(CellAt(loop, 2, 2), { X: 2, Y: 2, T: 'Cruise', N: 1 });
});

test('Sild: CheckModel nõuab N2 ainult sillal', () => {
  const model = Blank(3, 3);
  LayPath(model, Cells([0, 1], [2, 1]));
  CellAt(model, 1, 1).N2 = 1;
  assert.ok(CheckModel(model).some(error => error.Path.endsWith('.N2')));
  delete CellAt(model, 1, 1).N2;
  CellAt(model, 1, 1).T = 'CrossOver';
  assert.ok(CheckModel(model).some(error => error.Path.endsWith('.N2')));
});

// Stsenaarium E4 (test/agv.test.js) redaktoriga: diskreetne rada (AGV), möödasõidurada kahe
// hargnemise vahel, harudel vastassuunalised nooled (ühesuunalised lõigud), jaamad punktiirita.
test('Diskreetne rada redaktoriga: möödasõidurada, raja-harud ja ühesuunalised nooled (E4)', () => {
  const model = Blank(9, 4);
  assert.equal(LayPath(model, Cells([0, 2], [4, 2]), { Track: 1 }), 0);
  assert.equal(LayPath(model, Cells([4, 2], [4, 1], [6, 1], [6, 2], [8, 2]), { Track: 1 }), 0);
  assert.equal(LayPath(model, Cells([4, 2], [4, 3], [6, 3], [6, 2]), { Track: 1 }), 0);
  PlaceIcon(model, 3, 0, Item('MachToolDown'));
  PlaceIcon(model, 3, 1, Item('InOutBuf'));
  PlaceIcon(model, 2, 3, Item('FromCS'));
  PlaceIcon(model, 7, 3, Item('SysOut'));
  for (const [x, y] of [[2, 3], [3, 1], [7, 3]]) {
    assert.equal(LayPath(model, Cells([x, y], [x, 2]), { Dot: true }), 0, `(${x}, ${y})`);
  }
  CycleDirection(model, 5, 1);                         // ülemine haru: E
  CycleDirection(model, 5, 3);
  CycleDirection(model, 5, 3);                         // alumine haru: E -> W
  const expected = [
    [4, 1, 'ArcSE'], [5, 1, 'HorTr', 'E'], [6, 1, 'ArcSW'],
    [0, 2, 'HorTr'], [1, 2, 'HorTr'], [2, 2, 'TeeS'], [3, 2, 'TeeN'], [4, 2, 'TeeW'],
    [6, 2, 'TeeE'], [7, 2, 'TeeS'], [8, 2, 'HorTr'],
    [4, 3, 'ArcNE'], [5, 3, 'HorTr', 'W'], [6, 3, 'ArcNW'],
  ];
  for (const [x, y, type, dir] of expected) {
    const cell = CellAt(model, x, y);
    assert.equal(cell.T, type, `(${x}, ${y})`);
    assert.equal(cell.N, 1, `(${x}, ${y}) N`);
    assert.equal(cell.Dir, dir, `(${x}, ${y}) Dir`);
  }
  // pideva rajana on haru viga, diskreetsena korras
  model.Workpieces = [{ Name: 'Võll', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [{ Op: OPERATIONS[0], Mean: 200, Dev: 0 }] }] }];
  model.Storage = null;
  assert.ok(ModelProblems(model).Errors.length > 0);
  model.Tracks[0].Mode = 'Discrete';
  model.Tracks[0].Carts = 2;
  assert.deepEqual(ModelProblems(model).Errors, []);
  const network = Enumerate(model).Network;
  assert.deepEqual(network.Tracks[0].Nodes.filter(node => node.Junction).map(node => [node.X, node.Y]), [[4, 2], [6, 2]]);
  assert.deepEqual(network.Tracks[0].Edges.map(edge => edge.OneWay).filter(dir => dir !== 0).length, 2);
  const report = SimRun({ ...network, Sim: { ...network.Sim, Duration: 3600 } }, { CheckInvariants: true });
  assert.equal(report.Deadlock, false);
  assert.ok(report.Completed > 0);
  // metrokaart: raja otsa lõik (ots on sõlm – pool ikooni) ja selle pikkus nagu Enumerate-is
  const segment = SegmentCells(model, 1, 2);
  assert.deepEqual(segment.Cells, [[0, 2], [1, 2]]);
  assert.equal(segment.Units, 2);                       // 0,5 (ots) + 1 + 0,5 (FromCS jaam)
  SetEdgeLength(model, segment.Cells, 1000);
  assert.deepEqual(ModelProblems(model).Errors, []);
  const stretched = Enumerate(model).Network.Tracks[0].Edges.find(edge => edge.Stretched);
  assert.equal(stretched.Length, 1000);
});
