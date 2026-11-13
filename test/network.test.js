// FMSS – rajavõrgu testid (etapp 7a): mitu rada, konnektorid, avatud konveier.
// Käivitamine: npm test. Simulatsioonid kontrollivad invariante igal sekundil.
// Stsenaariumid G (konnektor), G2 (avatud konveier → konnektor → silmus), H (avatud konveier)
// ja S (kaks silmust, ristmarsruudid) – VALIDEERIMINE.md etapp 7a.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CheckModel } from '../src/fms_glb.js';
import { Enumerate, SimRun, SimInit, SimStep, SimState, StationPaths, ShortestPaths } from '../src/fms_sim.js';
import { TrackGeometry, TrackPoint } from '../src/anima.js';

const CHECKED = { CheckInvariants: true };
const DOT = { Dot: true };
const Cells = rows => rows.map(([X, Y, T, N, extra]) => ({ X, Y, T, ...(N !== undefined && N !== null ? { N } : {}), ...extra }));

const Track = (name, extra = {}) => ({
  Name: name, Mode: 'Continuous', Carts: 1, PlacesPerCart: 1, Speed: 20, LoadTime: 10, AccessTime: 0, ...extra,
});
const Machine = (name, ops, extra = {}) => ({ Name: name, Model: '', LoadTime: 10, SetupTime: 0, Ops: ops, ...extra });
const Buffer = (capacity = 2) => ({ Capacity: capacity, Discipline: 'FIFO', LoadTime: 5 });
const OneOp = (op, mean) => ({ Op: op, Mean: mean, Dev: 0 });

// Enumerate peab õnnestuma; tagastab võrgu.
function NetworkOf(model) {
  assert.deepEqual(CheckModel(model), [], 'CheckModel');
  const result = Enumerate(model);
  assert.deepEqual(result.Errors, [], 'Enumerate');
  return result.Network;
}
function assertEnumError(model, fragment) {
  const result = Enumerate(model);
  assert.equal(result.Network, null);
  assert.ok(result.Errors.some(error => error.Message.includes(fragment)),
    `oodatud viga „${fragment}“, saadi: ${JSON.stringify(result.Errors)}`);
}
const stationPositions = network => network.Stations.map(station => [station.Name, station.Track, station.Position]);

// ---------------------------------------------------------------------
// G – kaks silmust, konnektor vahel (HorCon (3, 4))
//
//   (1,1) SysOut                    (6,0) MT1, (6,1) BUF1
//   rada 1 (vasakul, vastupäeva):   rada 2 (paremal, päripäeva):
//     FromCS 0, CON1 300, SysOut 700,  CON1 0, BUF1 400, ring 1000 cm
//     ring 1000 cm (metrokaart)
//   (1,7) FromCS
// ---------------------------------------------------------------------
function LayoutG() {
  return {
    Meta: { Name: 'G – konnektor', Version: 1 },
    Scale: 100,
    Layout: {
      Dim: { X: 8, Y: 8 },
      Cells: Cells([
        [6, 0, 'MachToolDown', 1], [6, 1, 'InOutBuf', 1], [6, 2, 'VertTr', null, DOT],
        [1, 1, 'SysOut'], [1, 2, 'VertTr', null, DOT],
        [0, 3, 'ArcSE', 1], [1, 3, 'TeeN', 1], [2, 3, 'ArcSW', 1],
        [0, 4, 'VertTr', 1, { Dir: 'S' }], [2, 4, 'TeeE', 1],
        [0, 5, 'ArcNE', 1], [1, 5, 'TeeS', 1], [2, 5, 'ArcNW', 1],
        [1, 6, 'VertTr', null, DOT], [1, 7, 'FromCS'],
        [3, 4, 'HorCon'], [4, 4, 'HorTr', null, DOT],
        [5, 3, 'ArcSE', 2], [6, 3, 'TeeN', 2], [7, 3, 'ArcSW', 2],
        [5, 4, 'TeeW', 2], [7, 4, 'VertTr', 2, { Dir: 'S' }],
        [5, 5, 'ArcNE', 2], [6, 5, 'HorTr', 2], [7, 5, 'ArcNW', 2],
      ]),
    },
    EdgeLengths: [
      { Cells: [[2, 5]], Length: 300 },                              // FromCS -> CON1
      { Cells: [[2, 3]], Length: 400 },                              // CON1 -> SysOut
      { Cells: [[0, 3], [0, 4], [0, 5]], Length: 300 },              // SysOut -> FromCS
      { Cells: [[5, 3]], Length: 400 },                              // CON1 -> BUF1
      { Cells: [[7, 3], [7, 4], [7, 5], [6, 5], [5, 5]], Length: 600 },   // BUF1 -> CON1
    ],
    Tracks: [Track('Vasak'), Track('Parem')],
    Machines: [Machine('MT1', ['treimine'])],
    Buffers: [Buffer()],
    Storage: null,
    Workpieces: [{ Name: 'Võll', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [OneOp('treimine', 300)] }] }],
    Sim: { Seed: 1, Duration: 28800, Kl: 0.85, StallTime: 600 },
  };
}

test('G: Enumerate – kaks rada, konnektori jaam kummalgi, asukohad metrokaardist', () => {
  const network = NetworkOf(LayoutG());
  assert.deepEqual(network.Tracks.map(track => [track.Name, track.Closed, track.Length]),
    [['Vasak', true, 1000], ['Parem', true, 1000]]);
  assert.deepEqual(stationPositions(network),
    [['FromCS', 0, 0], ['CON1', 0, 300], ['SysOut', 0, 700], ['CON1', 1, 0], ['BUF1', 1, 400]]);
  assert.deepEqual(network.Connectors, [{ Name: 'CON1', Cell: { X: 3, Y: 4 }, Stations: [1, 3] }]);
});

test('G: StationPaths – tee üle konnektori, mõlemas suunas', () => {
  const network = NetworkOf(LayoutG());
  const paths = StationPaths(network);
  // Time = pikkus / kiirus (20 cm/s) – teed valitakse aja järgi (etapp 7b)
  assert.deepEqual(paths[0][4], { Length: 700, Time: 35, Legs: [{ Track: 0, From: 0, To: 1 }, { Track: 1, From: 3, To: 4 }] });
  assert.deepEqual(paths[4][2], { Length: 1000, Time: 50, Legs: [{ Track: 1, From: 4, To: 3 }, { Track: 0, From: 1, To: 2 }] });
  assert.deepEqual(paths[1][1], { Length: 0, Time: 0, Legs: [{ Track: 0, From: 1, To: 1 }] });   // silmus: ring ümber
});

// G1. Üks detail korraga (Kl 0,1), üks alus kummalgi rajal (20 cm/s, ring 50 s), laadimine 10 s.
//   Alus 1 on alguses FromCS-is, alus 2 CON1-s; jaamas, kus alus juba seisab, ta ei peatu (ring ümber).
//   t=0     WP0 FromCS-is; sihtkoht BUF1, tee FromCS -> CON1 -> BUF1, CON1 broneeritud
//   t=50    alus 1 FromCS-is (ring), pealelaadimine 10 s; t=60 sõidab, 300 cm -> t=75 CON1, maha 10 s
//   t=85    WP0 konnektoris. Alus 2 on CON1-s t=50, 100, …  -> t=100 peale, t=110 sõidab
//   t=130   BUF1 (400 cm), maha -> t=140; pink laadib 10 s -> t=150, töötlemine 300 s -> t=450
//   t=460   puhvri väljaminevas kohas; sihtkoht SysOut, tee BUF1 -> CON1 -> SysOut
//   alus 2 on BUF1-s t = 140 + 50k -> t=490 peale, t=500 sõidab, 600 cm -> t=530 CON1, maha -> t=540
//   alus 1 on CON1-s t = 85 + 50k; t=535 laaditakse detaili alles konnektorisse -> t=585 peale
//   t=595   sõidab, 400 cm -> t=615 SysOut, maha 10 s -> t=625 lahkub.
test('G1: ühe detaili tsükliaeg üle konnektori klapib käsitsi arvutusega (625 s)', () => {
  const network = NetworkOf(LayoutG());
  const report = SimRun({ ...network, Sim: { ...network.Sim, Kl: 0.1, Duration: 625 } }, CHECKED);
  const first = report.Finished[0];
  assert.equal(first.TimeIn, 0);
  assert.equal(first.TimeOut, 625);
  assert.equal(first.Times.Process, 300);
  assert.equal(first.Times.Load, 100);   // 10 laadimist × 10 s
  assert.deepEqual(report.Connectors, [{ Name: 'CON1', Transfers: 2 }]);
});

test('G: 8 h täiskoormusel ilma ummikuta, iga detail läbib konnektorit kaks korda', () => {
  const model = LayoutG();
  model.Tracks.forEach(track => { track.Carts = 3; });
  const report = SimRun(NetworkOf(model), CHECKED);
  assert.equal(report.Deadlock, false);
  assert.equal(report.Time, 28800);
  assert.ok(report.ThroughputPerHour > 9, `läbilaskevõime ${report.ThroughputPerHour}`);   // pink: 3600 / 320 = 11,25
  const transfers = report.Connectors[0].Transfers;
  assert.ok(transfers >= 2 * report.Completed && transfers <= 2 * report.Created, `ülekandeid ${transfers}`);
});

// ---------------------------------------------------------------------
// P – kaks silmust, kaks paralleelset konnektorit (CON1 (3, 3), CON2 (3, 5)); 7a ootel töö
//   rada 1 (vasakul, vastupäeva): FromCS (1, 6), CON2, CON1, SysOut (1, 2)
//   rada 2 (paremal, päripäeva):  BUF1 (6, 2), CON2, CON1 (alt üles vasakul küljel)
//   Mõlema konnektori kaudu on tee sama pikk (sümmeetria), seega kumbki sobib.
// ---------------------------------------------------------------------
function LayoutP({ Carts = 3, Kl = 0.85, Capacity = 2 } = {}) {
  return {
    Meta: { Name: 'P – paralleelsed konnektorid', Version: 1 },
    Scale: 100,
    Layout: {
      Dim: { X: 8, Y: 9 },
      Cells: Cells([
        [6, 0, 'MachToolDown', 1], [6, 1, 'InOutBuf', 1],
        [1, 1, 'SysOut'], [1, 2, 'TeeN', 1],
        [0, 2, 'ArcSE', 1], [2, 2, 'ArcSW', 1],
        [0, 3, 'VertTr', 1], [2, 3, 'TeeE', 1], [3, 3, 'HorCon'], [4, 3, 'HorTr', null, DOT],
        [0, 4, 'VertTr', 1, { Dir: 'S' }], [2, 4, 'VertTr', 1],
        [0, 5, 'VertTr', 1], [2, 5, 'TeeE', 1], [3, 5, 'HorCon'], [4, 5, 'HorTr', null, DOT],
        [0, 6, 'ArcNE', 1], [1, 6, 'TeeS', 1], [2, 6, 'ArcNW', 1],
        [1, 7, 'VertTr', null, DOT], [1, 8, 'FromCS'],
        [5, 2, 'ArcSE', 2], [6, 2, 'TeeN', 2], [7, 2, 'ArcSW', 2],
        [5, 3, 'TeeW', 2], [7, 3, 'VertTr', 2, { Dir: 'S' }],
        [5, 4, 'VertTr', 2], [7, 4, 'VertTr', 2],
        [5, 5, 'TeeW', 2], [7, 5, 'VertTr', 2],
        [5, 6, 'ArcNE', 2], [6, 6, 'HorTr', 2], [7, 6, 'ArcNW', 2],
      ]),
    },
    EdgeLengths: [],
    Tracks: [Track('Vasak', { Carts }), Track('Parem', { Carts })],
    Machines: [Machine('MT1', ['treimine'])],
    Buffers: [Buffer(Capacity)],
    Storage: null,
    Workpieces: [{ Name: 'Võll', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [OneOp('treimine', 120)] }] }],
    Sim: { Seed: 1, Duration: 28800, Kl, StallTime: 600 },
  };
}

test('P: paralleelsed konnektorid – kinnise konnektori asemel leitakse vaba kõrvaltee', () => {
  const network = NetworkOf(LayoutP());
  assert.deepEqual(network.Connectors.map(connector => connector.Name), ['CON1', 'CON2']);
  const fromCS = network.Stations.findIndex(station => station.Kind === 'FromCS');
  const buffer = network.Stations.findIndex(station => station.Kind === 'Buffer');
  const through = path => path.Legs.slice(0, -1).map(leg => network.Stations[leg.To].Name);
  const free = ShortestPaths(network, fromCS)[buffer];
  const used = through(free);
  assert.equal(used.length, 1);
  const other = used[0] === 'CON1' ? 'CON2' : 'CON1';
  const usedIndex = network.Connectors.findIndex(connector => connector.Name === used[0]);
  const detour = ShortestPaths(network, fromCS, connectorIndex => connectorIndex !== usedIndex)[buffer];
  assert.deepEqual(through(detour), [other]);
  assert.equal(detour.Length, free.Length);   // sümmeetria: sama pikk
  assert.equal(ShortestPaths(network, fromCS, () => false)[buffer], null);   // mõlemad kinni
});

test('P: täiskoormusel kasutatakse mõlemat konnektorit ja läbilaskevõime kasvab', () => {
  const run = model => SimRun(NetworkOf(model), CHECKED);
  const both = run(LayoutP());
  // võrdlus: sama joonis ühe konnektoriga (CON2 asemel rada)
  const single = LayoutP();
  single.Layout.Cells = single.Layout.Cells.filter(cell => !(cell.Y === 5 && (cell.X === 3 || cell.X === 4)));
  single.Layout.Cells.find(cell => cell.X === 2 && cell.Y === 5).T = 'VertTr';
  single.Layout.Cells.find(cell => cell.X === 5 && cell.Y === 5).T = 'VertTr';
  const one = run(single);
  assert.equal(both.Deadlock, false);
  assert.equal(one.Deadlock, false);
  assert.ok(both.Connectors.every(connector => connector.Transfers > 0), JSON.stringify(both.Connectors));
  const transfers = both.Connectors.reduce((sum, connector) => sum + connector.Transfers, 0);
  assert.ok(transfers >= 2 * both.Completed, `ülekandeid ${transfers}`);
  assert.ok(both.Completed > one.Completed, `kahe konnektoriga ${both.Completed}, ühega ${one.Completed}`);
});

// ---------------------------------------------------------------------
// H – avatud konveier (rida y = 3, x = 0 … 8, liigub paremale, 900 cm)
//   FromCS 150, BUF1 (MT1) 350, BUF2 (MT2) 550, SysOut 750
// ---------------------------------------------------------------------
function LayoutH() {
  return {
    Meta: { Name: 'H – avatud konveier', Version: 1 },
    Scale: 100,
    Layout: {
      Dim: { X: 9, Y: 6 },
      Cells: Cells([
        [3, 0, 'MachToolDown', 1], [5, 0, 'MachToolDown', 2],
        [3, 1, 'InOutBuf', 1], [5, 1, 'InOutBuf', 2],
        [3, 2, 'VertTr', null, DOT], [5, 2, 'VertTr', null, DOT],
        [0, 3, 'HorTr', 1, { Dir: 'E' }], [1, 3, 'TeeS', 1], [2, 3, 'HorTr', 1], [3, 3, 'TeeN', 1],
        [4, 3, 'HorTr', 1], [5, 3, 'TeeN', 1], [6, 3, 'HorTr', 1], [7, 3, 'TeeS', 1], [8, 3, 'HorTr', 1],
        [1, 4, 'VertTr', null, DOT], [7, 4, 'VertTr', null, DOT],
        [1, 5, 'FromCS'], [7, 5, 'SysOut'],
      ]),
    },
    EdgeLengths: [],
    Tracks: [Track('Liin')],
    Machines: [Machine('MT1', ['treimine']), Machine('MT2', ['freesimine'])],
    Buffers: [Buffer(), Buffer()],
    Storage: null,
    Workpieces: [{ Name: 'Võll', Priority: 1, Batch: 1,
                   Routes: [{ Priority: 1, Ops: [OneOp('treimine', 300), OneOp('freesimine', 200)] }] }],
    Sim: { Seed: 1, Duration: 28800, Kl: 0.85, StallTime: 600 },
  };
}

test('H: Enumerate – avatud konveier, asukohad raja algusest', () => {
  const network = NetworkOf(LayoutH());
  assert.deepEqual(network.Tracks.map(track => [track.Closed, track.Length]), [[false, 900]]);
  assert.deepEqual(stationPositions(network),
    [['FromCS', 0, 150], ['BUF1', 0, 350], ['BUF2', 0, 550], ['SysOut', 0, 750]]);
  const paths = StationPaths(network);
  assert.equal(paths[2][1], null);           // BUF2 -> BUF1: vastuvoolu ei saa
  assert.equal(paths[1][1], null);           // samasse jaama ei saa (ring puudub)
  assert.equal(paths[1][2].Length, 200);
});

// H1. Üks detail, üks alus (900 cm, 20 cm/s: alus on igas jaamas iga 45 s järel), laadimine 10 s.
//   t=8     alus (algus 0) jõuab FromCS-i (150 cm), peale -> t=18; t=28 BUF1, maha -> t=38
//   t=48    pingis, töötlemine 300 s -> t=348, puhvrisse -> t=358 (BUF2 koht broneeriti t=38)
//   alus on BUF1-s t = 38 + 45k -> t=398 peale, t=408 sõidab; t=418 BUF2, maha -> t=428
//   t=438   pingis, töötlemine 200 s -> t=638, puhvrisse -> t=648; sihtkoht SysOut
//   alus on BUF2-s t = 428 + 45k -> t=653 peale, t=663 sõidab; t=673 SysOut, maha -> t=683.
test('H1: ühe detaili tsükliaeg avatud konveieril klapib käsitsi arvutusega (683 s)', () => {
  const network = NetworkOf(LayoutH());
  const report = SimRun({ ...network, Sim: { ...network.Sim, Kl: 0.1, Duration: 800 } }, CHECKED);
  const first = report.Finished[0];
  assert.equal(first.TimeOut, 683);
  assert.equal(first.Times.Process, 500);
  assert.equal(first.Times.Load, 100);   // 10 laadimist × 10 s
});

test('H: 8 h täiskoormusel ilma ummikuta; koormaga alus ei jõua kunagi raja lõppu', () => {
  const model = LayoutH();
  model.Tracks[0].Carts = 3;
  // invariant „koormaga alus läbis avatud konveieri lõpu“ kontrollitakse igal sekundil
  const report = SimRun(NetworkOf(model), CHECKED);
  assert.equal(report.Deadlock, false);
  assert.ok(report.ThroughputPerHour > 9, `läbilaskevõime ${report.ThroughputPerHour}`);   // MT1: 3600 / 320
});

test('H: invariant tabab koormaga aluse, mis läbib avatud konveieri lõpu', () => {
  const network = NetworkOf(LayoutH());
  SimInit({ ...network, Sim: { ...network.Sim, Kl: 0.1 } }, CHECKED);
  while (SimState().SysWPArray[0].State !== 'ON_PALLET') SimStep();
  // meelega viga: detaili sõidu lõpp viiakse jaama, mida ei ole -> alus sõidab mööda lõpust
  SimState().SysWPArray[0].Path[0].To = 99;
  assert.throws(() => { for (let i = 0; i < 100; i++) SimStep(); }, /avatud konveieri lõpu/);
});

// ---------------------------------------------------------------------
// G2 – avatud konveier FromCS-ist konnektorini (raja otsas), sealt silmus pingi ja väljundiga
// ---------------------------------------------------------------------
function LayoutG2() {
  return {
    Meta: { Name: 'G2 – sisendkonveier', Version: 1 },
    Scale: 100,
    Layout: {
      Dim: { X: 8, Y: 6 },
      Cells: Cells([
        [0, 1, 'HorTr', 1, { Dir: 'E' }], [1, 1, 'TeeS', 1], [2, 1, 'HorTr', 1], [3, 1, 'HorCon'],
        [1, 2, 'VertTr', null, DOT], [1, 3, 'FromCS'],
        [4, 0, 'ArcSE', 2], [5, 0, 'HorTr', 2], [6, 0, 'HorTr', 2], [7, 0, 'ArcSW', 2],
        [4, 1, 'TeeW', 2], [7, 1, 'VertTr', 2, { Dir: 'S' }],
        [4, 2, 'ArcNE', 2], [5, 2, 'TeeS', 2], [6, 2, 'TeeS', 2], [7, 2, 'ArcNW', 2],
        [5, 3, 'VertTr', null, DOT], [5, 4, 'InOutBuf', 1], [5, 5, 'MachToolUp', 1],
        [6, 3, 'VertTr', null, DOT], [6, 4, 'SysOut'],
      ]),
    },
    EdgeLengths: [],
    Tracks: [Track('Sisend', { Carts: 2 }), Track('Ring', { Carts: 2 })],
    Machines: [Machine('MT1', ['treimine'])],
    Buffers: [Buffer()],
    Storage: null,
    Workpieces: [{ Name: 'Võll', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [{ Op: 'treimine', Mean: 240, Dev: 30 }] }] }],
    Sim: { Seed: 1, Duration: 14400, Kl: 0.85, StallTime: 600 },
  };
}

test('G2: konnektor avatud konveieri otsas – jaam otsaikooni keskel, detailid jõuavad silmusele', () => {
  const network = NetworkOf(LayoutG2());
  assert.deepEqual(network.Tracks.map(track => [track.Name, track.Closed, track.Length]),
    [['Sisend', false, 300], ['Ring', true, Math.round((6 + Math.PI) * 100 * 1000) / 1000]]);
  const connectorStation = network.Stations.find(station => station.Kind === 'Connector' && station.Track === 0);
  assert.equal(connectorStation.Position, 250);   // (2, 1) keskel
  assert.deepEqual(connectorStation.Junction, { X: 2, Y: 1 });
  const report = SimRun(network, CHECKED);
  assert.equal(report.Deadlock, false);
  assert.ok(report.Completed > 30, `valmis ${report.Completed}`);
  assert.ok(report.Connectors[0].Transfers >= report.Completed);
});

// ---------------------------------------------------------------------
// S – kaks silmust ühe konnektoriga, ristmarsruudid, väikesed puhvrid, keskladu (stress)
//   rada 1: FromCS, ToCS, SysOut, MT1;  rada 2: MT2, MT3
//   A: a1 (MT1) -> a2 (MT2 / MT3);  B: b1 (MT2 / MT3) -> b2 (MT1)
// ---------------------------------------------------------------------
function LayoutS({ Seed = 1 } = {}) {
  return {
    Meta: { Name: 'S – kaks silmust', Version: 1 },
    Scale: 100,
    Layout: {
      Dim: { X: 11, Y: 8 },
      Cells: Cells([
        [1, 0, 'MachToolDown', 1], [1, 1, 'InOutBuf', 1], [1, 2, 'VertTr', null, DOT],
        [3, 1, 'SysOut'], [3, 2, 'VertTr', null, DOT],
        [0, 3, 'ArcSE', 1], [1, 3, 'TeeN', 1], [2, 3, 'HorTr', 1], [3, 3, 'TeeN', 1], [4, 3, 'ArcSW', 1],
        [0, 4, 'VertTr', 1, { Dir: 'S' }], [4, 4, 'TeeE', 1],
        [0, 5, 'ArcNE', 1], [1, 5, 'TeeS', 1], [2, 5, 'HorTr', 1], [3, 5, 'TeeS', 1], [4, 5, 'ArcNW', 1],
        [1, 6, 'VertTr', null, DOT], [1, 7, 'FromCS'], [3, 6, 'VertTr', null, DOT], [3, 7, 'ToCS'],
        [5, 4, 'HorCon'],
        [7, 0, 'MachToolDown', 2], [7, 1, 'InOutBuf', 2], [7, 2, 'VertTr', null, DOT],
        [9, 0, 'MachToolDown', 3], [9, 1, 'InOutBuf', 3], [9, 2, 'VertTr', null, DOT],
        [6, 3, 'ArcSE', 2], [7, 3, 'TeeN', 2], [8, 3, 'HorTr', 2], [9, 3, 'TeeN', 2], [10, 3, 'ArcSW', 2],
        [6, 4, 'TeeW', 2], [10, 4, 'VertTr', 2, { Dir: 'S' }],
        [6, 5, 'ArcNE', 2], [7, 5, 'HorTr', 2], [8, 5, 'HorTr', 2], [9, 5, 'HorTr', 2], [10, 5, 'ArcNW', 2],
      ]),
    },
    EdgeLengths: [],
    Tracks: [Track('Vasak', { Carts: 3 }), Track('Parem', { Carts: 3 })],
    Machines: [
      Machine('MT1', ['a1', 'b2'], { SetupTime: 30 }),
      Machine('MT2', ['a2', 'b1'], { SetupTime: 30 }),
      Machine('MT3', ['a2', 'b1'], { SetupTime: 30 }),
    ],
    Buffers: [Buffer(1), Buffer(1), Buffer(1)],
    Storage: { Capacity: 20, LoadTime: 10 },
    Workpieces: [
      { Name: 'A', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [{ Op: 'a1', Mean: 200, Dev: 50 }, { Op: 'a2', Mean: 300, Dev: 50 }] }] },
      { Name: 'B', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [{ Op: 'b1', Mean: 300, Dev: 50 }, { Op: 'b2', Mean: 200, Dev: 50 }] }] },
    ],
    Sim: { Seed, Duration: 28800, Kl: 0.95, StallTime: 600 },
  };
}

test('S: kaks silmust ja ristmarsruudid – 8 h ilma lahendamatu ummikuta (5 seemet)', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const report = SimRun(NetworkOf(LayoutS({ Seed: seed })), CHECKED);
    assert.equal(report.Deadlock, false, `seeme ${seed}: ${report.DeadlockReason}`);
    assert.equal(report.Time, 28800);
    assert.ok(report.ThroughputPerHour > 4, `seeme ${seed}: ${report.ThroughputPerHour} tk/h`);
  }
});

test('S: korratavus – sama seeme sama tulemus', () => {
  const network = NetworkOf(LayoutS());
  assert.deepEqual(SimRun(network), SimRun(network));
});

// ---------------------------------------------------------------------
// Andmekontroll
// ---------------------------------------------------------------------

test('Konnektor: üks külg ühendamata', () => {
  const model = LayoutH();
  model.Layout.Dim.X = 10;
  model.Layout.Cells.push({ X: 9, Y: 3, T: 'HorCon' });
  assertEnumError(model, 'peab ühendama kaht rada');
});

test('Konnektor: ühendab raja iseendaga', () => {
  const model = LayoutH();
  model.Layout = {
    Dim: { X: 3, Y: 2 },
    Cells: Cells([
      [0, 0, 'ArcSE', 1], [1, 0, 'HorCon'], [2, 0, 'ArcSW', 1],
      [0, 1, 'ArcNE', 1], [1, 1, 'HorTr', 1, { Dir: 'W' }], [2, 1, 'ArcNW', 1],
    ]),
  };
  assertEnumError(model, 'iseendaga');
});

test('Kaks rada puutuvad kokku ilma konnektorita', () => {
  const model = LayoutH();
  model.Layout.Dim.X = 10;
  model.Tracks.push(Track('Teine'));
  model.Layout.Cells.push({ X: 9, Y: 3, T: 'HorTr', N: 2, Dir: 'E' });
  assertEnumError(model, 'ilma konnektorita');
});

test('Avatud konveier: järgmise operatsiooni pink on vastuvoolu', () => {
  const model = LayoutH();
  model.Workpieces[0].Routes[0].Ops.reverse();   // freesimine (MT2) -> treimine (MT1)
  assertEnumError(model, '„treimine“ ühegi pingini ei vii rada BUF2 juurest');
});

test('Avatud konveier: SysOut on puhvrist vastuvoolu', () => {
  const model = LayoutH();
  // SysOut ja FromCS vahetavad kohad: SysOut (1, 5), FromCS (7, 5)
  model.Layout.Cells.find(cell => cell.T === 'FromCS').T = 'Tmp';
  model.Layout.Cells.find(cell => cell.T === 'SysOut').T = 'FromCS';
  model.Layout.Cells.find(cell => cell.T === 'Tmp').T = 'SysOut';
  assertEnumError(model, 'BUF1 juurest ei vii rada SysOut-i');
});

test('EdgeLengths: kirje, mille lahtrid pole ühelgi rajal', () => {
  const model = LayoutG();
  model.EdgeLengths.push({ Cells: [[3, 0]], Length: 100 });
  assertEnumError(model, 'ühe lõigu');
});

test('Hilisem etapp: mitu kohta kärul (7c)', () => {
  const places = LayoutG();
  places.Tracks[0].PlacesPerCart = 2;
  assertEnumError(places, 'etapis 7c');
});

// ---------------------------------------------------------------------
// Animaator: mitme raja geomeetria
// ---------------------------------------------------------------------

test('Animaator: iga raja jaamad ekraanil oma ikooni keskel (ka konnektori jaam raja otsas)', () => {
  for (const network of [NetworkOf(LayoutG()), NetworkOf(LayoutG2()), NetworkOf(LayoutH())]) {
    network.Tracks.forEach((track, trackIndex) => {
      const geometry = TrackGeometry(network, trackIndex);
      for (const station of network.Stations.filter(item => item.Track === trackIndex)) {
        const point = TrackPoint(geometry, station.Position);
        assert.ok(Math.abs(point.X - (station.Junction.X + 0.5)) < 1e-3 && Math.abs(point.Y - (station.Junction.Y + 0.5)) < 1e-3,
          `${network.Name}: ${station.Name} rajal ${track.Name} -> (${point.X}, ${point.Y})`);
      }
    });
  }
});

test('Animaator: avatud konveieril on punktid pidevad algusest lõpuni', () => {
  const network = NetworkOf(LayoutH());
  const geometry = TrackGeometry(network, 0);
  let previous = TrackPoint(geometry, 0);
  assert.ok(Math.abs(previous.X - 0) < 1e-6);
  for (let position = 1; position < 900; position++) {
    const point = TrackPoint(geometry, position);
    assert.ok(Math.hypot(point.X - previous.X, point.Y - previous.Y) < 0.02, `hüpe kohal ${position}`);
    previous = point;
  }
  assert.ok(Math.abs(previous.X - 8.99) < 1e-3);
});

// ---------------------------------------------------------------------
// Sild (CrossOver): mitteühendatud ristumine
// ---------------------------------------------------------------------

// Kaheksa: üks silmus ristub iseendaga sillal (3, 2). Ülemine ring: (3,1) üles, kaared, (4,1) alla,
// sillast läbi W suunas; alumine ring: (2,3) alla, kaared, (3,3) üles, sillast läbi N suunas.
function LayoutEight() {
  return {
    Meta: { Name: 'Kaheksa', Version: 1 },
    Scale: 100,
    Layout: {
      Dim: { X: 7, Y: 5 },
      Cells: Cells([
        [6, 0, 'MachToolDown', 1], [6, 1, 'InOutBuf', 1], [5, 1, 'HorTr', null, DOT],
        [3, 0, 'ArcSE', 1], [4, 0, 'ArcSW', 1],
        [3, 1, 'VertTr', 1, { Dir: 'N' }], [4, 1, 'TeeE', 1],
        [2, 2, 'ArcSE', 1], [3, 2, 'CrossOver', 1, { N2: 1 }], [4, 2, 'ArcNW', 1],
        [2, 3, 'TeeW', 1], [3, 3, 'TeeE', 1],
        [2, 4, 'ArcNE', 1], [3, 4, 'ArcNW', 1],
        [1, 3, 'HorTr', null, DOT], [0, 3, 'SysOut'], [4, 3, 'HorTr', null, DOT], [5, 3, 'FromCS'],
      ]),
    },
    EdgeLengths: [],
    Tracks: [Track('Kaheksa', { Carts: 3 })],
    Machines: [Machine('MT1', ['treimine'])],
    Buffers: [Buffer()],
    Storage: null,
    Workpieces: [{ Name: 'Võll', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [{ Op: 'treimine', Mean: 240, Dev: 30 }] }] }],
    Sim: { Seed: 1, Duration: 7200, Kl: 0.85, StallTime: 600 },
  };
}

test('Sild: kaheksakujuline silmus läbib silda kaks korda (risti), ei ühendu', () => {
  const network = NetworkOf(LayoutEight());
  const track = network.Tracks[0];
  assert.equal(track.Closed, true);
  assert.equal(track.Length, Math.round((6 + 1.5 * Math.PI) * 100 * 1000) / 1000);   // 6 kaart, 4 sirget, sild 2 ×
  const passes = track.Cells.filter(cell => cell.T === 'CrossOver').map(cell => `${cell.Entry}${cell.Exit}`).sort();
  assert.deepEqual(passes, ['EW', 'SN']);
  const report = SimRun(network, CHECKED);
  assert.equal(report.Deadlock, false);
  assert.ok(report.Completed > 10);
});

test('Sild: teine rada ristub avatud konveieriga ilma ühenduseta – H1 tsükliaeg ei muutu', () => {
  const model = LayoutH();
  model.Tracks.push(Track('Ristuv'));
  const cell = model.Layout.Cells.find(item => item.X === 2 && item.Y === 3);
  Object.assign(cell, { T: 'CrossOver', N: 1, N2: 2 });
  for (const y of [0, 1, 2, 4, 5]) model.Layout.Cells.push({ X: 2, Y: y, T: 'VertTr', N: 2, ...(y === 0 ? { Dir: 'S' } : {}) });
  const network = NetworkOf(model);
  assert.deepEqual(network.Tracks.map(track => [track.Name, track.Closed, track.Length]), [['Liin', false, 900], ['Ristuv', false, 600]]);
  const report = SimRun({ ...network, Sim: { ...network.Sim, Kl: 0.1, Duration: 800 } }, CHECKED);
  assert.equal(report.Finished[0].TimeOut, 683);
});

test('Sild: ristmik (Cruise) pideval rajal on endiselt viga, sild mitte', () => {
  const model = LayoutEight();
  const cell = model.Layout.Cells.find(item => item.T === 'CrossOver');
  cell.T = 'Cruise';
  delete cell.N2;
  assertEnumError(model, 'on haru');
});

// ---------------------------------------------------------------------
// Puhvri suund (originaal joon. 5.4: InBuf – detailid liiguvad üles, OutBuf – alla)
// ---------------------------------------------------------------------

// Silmus: ülemine rida y = 0, alumine y = 6. Läbivad pingid (x = 2, 4) ülemise ja alumise raja
// vahel: sissetulev puhver pingi kohal, väljaminev all (ThruDown) või vastupidi (ThruUp).
// FromCS, ToCS ja SysOut on alumise raja all.
function LayoutThrough({ Machine: machineIcon = 'MachToolThruDown', Upper = 'OutBuf', Lower = 'OutBuf', Seed = 1 } = {}) {
  const cells = [[0, 0, 'ArcSE', 1], [6, 0, 'ArcSW', 1], [0, 6, 'ArcNE', 1], [6, 6, 'ArcNW', 1]];
  for (let x = 1; x <= 5; x++) cells.push([x, 0, x === 2 || x === 4 ? 'TeeS' : 'HorTr', 1, x === 1 ? { Dir: 'E' } : undefined]);
  for (let x = 1; x <= 5; x++) cells.push([x, 6, x === 2 || x === 4 ? 'TeeN' : (x % 2 === 1 ? 'TeeS' : 'HorTr'), 1]);
  for (let y = 1; y <= 5; y++) cells.push([0, y, 'VertTr', 1], [6, y, 'VertTr', 1]);
  for (const [x, number] of [[2, 1], [4, 2]]) {
    cells.push([x, 1, 'VertTr', null, DOT], [x, 2, Upper, 2 * number - 1], [x, 3, machineIcon, number],
      [x, 4, Lower, 2 * number], [x, 5, 'VertTr', null, DOT]);
  }
  cells.push([1, 7, 'VertTr', null, DOT], [1, 8, 'FromCS'], [3, 7, 'VertTr', null, DOT], [3, 8, 'ToCS'],
    [5, 7, 'VertTr', null, DOT], [5, 8, 'SysOut']);
  return {
    Meta: { Name: 'Läbivad pingid', Version: 1 },
    Scale: 100,
    Layout: { Dim: { X: 7, Y: 9 }, Cells: Cells(cells) },
    EdgeLengths: [],
    Tracks: [Track('Konveier', { Carts: 3 })],
    Machines: [Machine('MT1', ['a1', 'b2'], { SetupTime: 30 }), Machine('MT2', ['a2', 'b1'], { SetupTime: 30 })],
    Buffers: [1, 2, 3, 4].map(() => Buffer(1)),
    Storage: { Capacity: 20, LoadTime: 10 },
    Workpieces: [
      { Name: 'A', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [{ Op: 'a1', Mean: 200, Dev: 50 }, { Op: 'a2', Mean: 200, Dev: 50 }] }] },
      { Name: 'B', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [{ Op: 'b1', Mean: 200, Dev: 50 }, { Op: 'b2', Mean: 200, Dev: 50 }] }] },
    ],
    Sim: { Seed, Duration: 28800, Kl: 0.95, StallTime: 600 },
  };
}
// Ainult tüüp A (MT1 -> MT2): ristmarsruute pole, ummikut ei teki.
function OneWayFlow(options) {
  const model = LayoutThrough(options);
  model.Workpieces = [model.Workpieces[0]];
  return model;
}

test('Puhvri suund: ThruDown – mõlemad puhvrid ▼ (OutBuf), ▲ (InBuf) pingi kohal on viga', () => {
  NetworkOf(OneWayFlow());
  NetworkOf(OneWayFlow({ Upper: 'InOutBuf', Lower: 'TurnBuf' }));
  assertEnumError(OneWayFlow({ Upper: 'InBuf' }), 'BUF1 (InBuf) ei sobi tööpingi MT1 sissetulevaks puhvriks: siin liiguvad detailid alla');
  assertEnumError(OneWayFlow({ Lower: 'InBuf' }), 'BUF2 (InBuf) ei sobi tööpingi MT1 väljaminevaks puhvriks: siin liiguvad detailid alla');
});

test('Puhvri suund: ThruUp – mõlemad puhvrid ▲ (InBuf), ▼ on viga', () => {
  NetworkOf(OneWayFlow({ Machine: 'MachToolThruUp', Upper: 'InBuf', Lower: 'InBuf' }));
  assertEnumError(OneWayFlow({ Machine: 'MachToolThruUp', Upper: 'OutBuf', Lower: 'InBuf' }), 'siin liiguvad detailid üles');
});

test('Puhvri suund: ühesuunalises puhvris liiguvad detailid ainult ühes suunas', () => {
  const network = NetworkOf(OneWayFlow());
  SimInit(network, CHECKED);
  const seen = network.Buffers.map(() => new Set());
  while (!SimState().SIMULATION_DONE) {
    SimStep();
    SimState().BufferArray.forEach((buffer, i) => buffer.Entries.forEach(entry => seen[i].add(entry.Dir)));
  }
  // ülemised (BUF1, BUF3) ainult sissetulevad, alumised (BUF2, BUF4) ainult väljaminevad
  assert.deepEqual(seen.map(set => [...set].sort()), [['In'], ['Out'], ['In'], ['Out']]);
  assert.ok(SimState().Stats.Completed > 20);
});

// Ristmarsruudid ühekohaliste ühesuunaliste puhvritega: kumbki sissetulev detail ootab teise pingi
// sissetulevat kohta. Detaili ei saa ühesuunalisest puhvrist tagasi saata (invariant) – ummik on
// lahendamatu ja teade ütleb põhjuse. Kahesuunaliste puhvritega lahendatakse sama ummik parkimisega.
test('Puhvri suund: ühesuunalisest puhvrist ei pargita sissetulevat detaili', () => {
  const oneWay = SimRun(NetworkOf(LayoutThrough()), CHECKED);
  assert.equal(oneWay.Deadlock, true);
  assert.match(oneWay.DeadlockReason, /ühesuunalisest puhvrist/);
  assert.equal(oneWay.Parked, 0);
  const twoWay = SimRun(NetworkOf(LayoutThrough({ Upper: 'InOutBuf', Lower: 'InOutBuf' })), CHECKED);
  assert.ok(twoWay.Parked > 0);
  assert.ok(twoWay.Completed > 20);
});
