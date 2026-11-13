// FMSS – diskreetsete radade testid (etapp 7b): AGV-d, ProgTM, FindPal, tsoonid, Collision.
// Käivitamine: npm test. Simulatsioonid kontrollivad invariante igal sekundil (ka tsoonid).
// Stsenaariumid I (üks AGV), E1–E4 (vastassuunas kärud), F (ristmik) – VALIDEERIMINE.md etapp 7b.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CheckModel, IconTypes } from '../src/fms_glb.js';
import { Enumerate, SimRun, SimInit, SimStep, SimState, SimReport, StationPaths, DriveCart } from '../src/fms_sim.js';
import { EdgePoint, NodePoint, CartPosition, CartPoint, InterpolateCart, WorkpiecePlaces } from '../src/anima.js';

const CHECKED = { CheckInvariants: true };
const DOT = { Dot: true };
const Cells = rows => rows.map(([X, Y, T, N, extra]) => ({ X, Y, T, ...(N !== undefined && N !== null ? { N } : {}), ...extra }));
const Agv = (extra = {}) => ({
  Name: 'AGV', Mode: 'Discrete', Carts: 1, PlacesPerCart: 1, Speed: 100, LoadTime: 10, AccessTime: 0, ...extra,
});
const Machine = (name, ops, extra = {}) => ({ Name: name, Model: '', LoadTime: 10, SetupTime: 0, Ops: ops, ...extra });
const Buffer = (capacity = 2) => ({ Capacity: capacity, Discipline: 'FIFO', LoadTime: 5 });
const OneOp = (op, mean, dev = 0) => ({ Op: op, Mean: mean, Dev: dev });

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
function Model(name, dim, cells, extra = {}) {
  return {
    Meta: { Name: name, Version: 1 },
    Scale: 100,
    Layout: { Dim: dim, Cells: Cells(cells) },
    EdgeLengths: [],
    Tracks: [Agv()],
    Machines: [Machine('MT1', ['treimine'])],
    Buffers: [Buffer()],
    Storage: null,
    Workpieces: [{ Name: 'Võll', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [OneOp('treimine', 300)] }] }],
    Sim: { Seed: 1, Duration: 28800, Kl: 0.85, StallTime: 600 },
    ...extra,
  };
}
const nodeAt = (network, x, y, trackIndex = 0) =>
  network.Tracks[trackIndex].Nodes.findIndex(node => node.X === x && node.Y === y);

// Sõidukatse (ilma detailideta, Kl = 0): kärud sõidavad käsu peale (DriveCart) sihtsõlme.
// Tagastab kärude saabumise ajad ja raja statistika.
function Drive(network, orders, limit = 300) {
  SimInit({ ...network, Sim: { ...network.Sim, Kl: 0 } }, CHECKED);
  for (const [cartIndex, node] of orders) assert.ok(DriveCart(0, cartIndex, node), `käru ${cartIndex}: teed pole`);
  const arrived = orders.map(() => null);
  while (SimState().SYSTEM_TIME < limit && arrived.some(time => time === null) && !SimState().SIMULATION_DONE) {
    SimStep();
    const carts = SimState().Tracks[0].Pallets;
    orders.forEach(([cartIndex, node], i) => {
      const cart = carts[cartIndex];
      if (arrived[i] === null && cart.Goal < 0 && cart.Node === node) arrived[i] = SimState().SYSTEM_TIME;
    });
  }
  const track = SimState().Tracks[0];
  return { Arrived: arrived, Collisions: track.Collisions, Detours: track.Detours, Asides: track.Asides,
           Deadlock: SimState().DEADLOCK, Reason: SimState().Stats.DeadlockReason };
}

// ---------------------------------------------------------------------
// I – üks AGV joonel: ots A (0, 3), FromCS (1, 3), BUF1 / MT1 (3, 3), SysOut (5, 3), ots (6, 3)
//   lõigud 100, 200, 200, 100 cm; kiirus 50 cm/s; laadimine 10 s
// ---------------------------------------------------------------------
function LayoutI({ Carts = 1, Kl = 0.1, Duration = 600, Mean = 300 } = {}) {
  return Model('I – üks AGV', { X: 7, Y: 6 }, [
    [3, 0, 'MachToolDown', 1], [3, 1, 'InOutBuf', 1], [3, 2, 'VertTr', null, DOT],
    [0, 3, 'HorTr', 1], [1, 3, 'TeeS', 1], [2, 3, 'HorTr', 1], [3, 3, 'TeeN', 1], [4, 3, 'HorTr', 1],
    [5, 3, 'TeeS', 1], [6, 3, 'HorTr', 1],
    [1, 4, 'VertTr', null, DOT], [1, 5, 'FromCS'], [5, 4, 'VertTr', null, DOT], [5, 5, 'SysOut'],
  ], {
    Tracks: [Agv({ Carts, Speed: 50 })], Sim: { Seed: 1, Duration, Kl, StallTime: 600 },
    Workpieces: [{ Name: 'Võll', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [OneOp('treimine', Mean)] }] }],
  });
}

test('I: Enumerate – diskreetse raja graaf: sõlmed, lõigud, jaamad, teed aja järgi', () => {
  const network = NetworkOf(LayoutI());
  const track = network.Tracks[0];
  assert.deepEqual(track.Nodes.map(node => [node.X, node.Y, node.Degree]),
    [[0, 3, 1], [1, 3, 2], [3, 3, 2], [5, 3, 2], [6, 3, 1]]);
  assert.deepEqual(track.Edges.map(edge => [edge.From, edge.To, edge.Length, edge.OneWay]),
    [[0, 1, 100, 0], [1, 2, 200, 0], [2, 3, 200, 0], [3, 4, 100, 0]]);
  assert.deepEqual(network.Stations.map(station => [station.Name, station.Node]), [['FromCS', 1], ['BUF1', 2], ['SysOut', 3]]);
  const paths = StationPaths(network);
  assert.deepEqual(paths[0][2], { Length: 400, Time: 8, Legs: [{ Track: 0, From: 0, To: 2 }] });
  assert.deepEqual(paths[2][0], { Length: 400, Time: 8, Legs: [{ Track: 0, From: 2, To: 0 }] });   // kahesuunaline
  assert.equal(paths[1][1], null);
});

// I1. Üks detail, üks käru (alguses otsas A, 100 cm FromCS-ist).
//   t=0    WP0 FromCS-is, sihtkoht BUF1 -> transpordisoov
//   t=1    FindPal: käru sõidab FromCS-i (100 cm, 2 s) -> t=2 peale 10 s -> t=12
//   t=13…16 sõit BUF1-sse (200 cm, 4 s), t=16 maha -> t=26; pink laadib -> t=36, töötlemine 300 s -> t=336
//   t=346  puhvri väljaminevas kohas, sihtkoht SysOut; käru ootab BUF1-s (vaba)
//   t=347  FindPal: käru on kohal -> peale -> t=357; sõit SysOut-i 200 cm -> t=361, maha -> t=371.
test('I1: ühe AGV tsükliaeg klapib käsitsi arvutusega (371 s)', () => {
  const report = SimRun(NetworkOf(LayoutI()), CHECKED);
  const first = report.Finished[0];
  assert.equal(first.TimeOut, 371);
  assert.equal(first.Times.Process, 300);
  assert.equal(first.Times.Load, 60);        // 6 laadimist × 10 s
  assert.equal(first.Times.Transport, 8);    // 200 + 200 cm, 50 cm/s
  assert.equal(report.Tracks[0].Collisions, 0);
});

test('I2: kaks AGV-d üherealisel joonel – 8 h ilma ummikuta, teine käru ei sega', () => {
  // töötlemine 30 s: pudelikael on transport (ühe käruga pink ~50 %)
  const one = SimRun(NetworkOf(LayoutI({ Kl: 0.85, Duration: 28800, Mean: 30 })), CHECKED);
  const two = SimRun(NetworkOf(LayoutI({ Carts: 2, Kl: 0.85, Duration: 28800, Mean: 30 })), CHECKED);
  assert.equal(two.Deadlock, false, two.DeadlockReason);
  // üherealisel joonel ei saa kärud teineteisest mööda: teine käru on varuks (FindPal ei anna
  // talle tööd, mille teel on teine käru – REQUEST_PATIENCE), läbilaskevõime ei vähene
  assert.ok(two.Completed >= one.Completed, `kahe käruga ${two.Completed}, ühega ${one.Completed}`);
});

// ---------------------------------------------------------------------
// E1 – kaks haru hargnemiste J1 (1, 2) ja J2 (4, 2) vahel, otsad A (0, 2) ja B (5, 2).
//   ülemine haru (SysOut) 457 cm, alumine (FromCS, BUF1) 657 cm; A–J1 ja J2–B 100 cm.
// ---------------------------------------------------------------------
function LayoutE1() {
  return Model('E1 – ümbersõit', { X: 6, Y: 6 }, [
    [2, 0, 'SysOut'],
    [1, 1, 'ArcSE', 1], [2, 1, 'TeeN', 1], [3, 1, 'HorTr', 1], [4, 1, 'ArcSW', 1],
    [0, 2, 'HorTr', 1], [1, 2, 'TeeW', 1], [3, 2, 'MachToolDown', 1], [4, 2, 'TeeE', 1], [5, 2, 'HorTr', 1],
    [1, 3, 'VertTr', 1], [3, 3, 'InOutBuf', 1], [4, 3, 'VertTr', 1],
    [1, 4, 'ArcNE', 1], [2, 4, 'TeeS', 1], [3, 4, 'TeeN', 1], [4, 4, 'ArcNW', 1],
    [2, 5, 'FromCS'],
  ], { Tracks: [Agv({ Carts: 2 })] });
}

// Kärud A-s ja B-s, kumbki teise otsa; mõlema lühim tee on ülemine haru (657 cm).
//   t=1  käru 1 broneerib A–J1, siis J1 + ülemine haru (vaba); käru 2 broneerib B–J2, ülemine haru
//        on kinni -> ümbersõit alumist haru mööda (857 cm ≤ 1,5 × 657 cm + 10 s), broneerib J2 + alumise
//   käru 1: 657 cm / 100 cm/s -> kohal t=7; käru 2: 857 cm -> t=9. Kumbki ei oota.
test('E1: vastassuunas kärud – teine teeb ümbersõidu, kokkupõrget ega ootamist pole', () => {
  const network = NetworkOf(LayoutE1());
  const a = nodeAt(network, 0, 2);
  const b = nodeAt(network, 5, 2);
  const result = Drive(network, [[0, b], [1, a]]);
  assert.deepEqual(result.Arrived, [7, 9]);
  assert.equal(result.Collisions, 0);
  assert.equal(result.Detours, 1);
});

// ---------------------------------------------------------------------
// E2 – joon A (0, 2) – FromCS – J (2, 2) – SysOut – B (4, 2), J-st kõrvalharu BUF1 jaama (2, 1).
//   kõik lõigud 100 cm.
// ---------------------------------------------------------------------
function LayoutE2() {
  return Model('E2 – kõrvalepõige', { X: 5, Y: 4 }, [
    [3, 0, 'MachToolDown', 1], [3, 1, 'InOutBuf', 1], [2, 1, 'TeeE', 1],
    [0, 2, 'HorTr', 1], [1, 2, 'TeeS', 1], [2, 2, 'TeeN', 1], [3, 2, 'TeeS', 1], [4, 2, 'HorTr', 1],
    [1, 3, 'FromCS'], [3, 3, 'SysOut'],
  ], { Tracks: [Agv({ Carts: 2 })] });
}

// Kärud A-s ja B-s, kumbki teise otsa. Ümbersõitu pole.
//   t=1    käru 1 broneerib A … J-ni (J on hargnemine), käru 2 B … J-ni
//   t=2    mõlemad ootavad lõigu lõpus enne J-d teise lõiku -> ring -> Collision: käru 1 (sama
//          ooteaeg, väiksem number) läheb kõrvale BUF1 jaama (150 cm), mis pole käru 2 teel
//   t=3    käru 1 J kaudu kõrvalharule; käru 2 saab J ja tee A-sse: t=3 J, t=4 FromCS, t=5 A
//   t=4    käru 1 BUF1 jaamas, uus tee B-sse: t=5 J, t=6 SysOut, t=7 B.
test('E2: vastassuunas kärud joonel – Collision, üks läheb kõrvalharule ja laseb teise mööda', () => {
  const network = NetworkOf(LayoutE2());
  const result = Drive(network, [[0, nodeAt(network, 4, 2)], [1, nodeAt(network, 0, 2)]]);
  assert.deepEqual(result.Arrived, [7, 5]);
  assert.equal(result.Collisions, 1);
  assert.equal(result.Asides, 1);
  assert.equal(result.Deadlock, false);
});

// E3 – joon A (0, 2) – FromCS – BUF1 – SysOut – B (4, 2) ilma kõrvalteeta: kärud ei saa
// teineteisest mööda -> ring, ümbersõitu ega kõrvalepõiget pole -> selge ummikuteade.
test('E3: vastassuunas kärud joonel ilma kõrvalteeta – ummik tuvastatakse ja teatatakse', () => {
  const network = NetworkOf(Model('E3 – mööda ei saa', { X: 5, Y: 4 }, [
    [2, 0, 'MachToolDown', 1], [2, 1, 'InOutBuf', 1],
    [0, 2, 'HorTr', 1], [1, 2, 'TeeS', 1], [2, 2, 'TeeN', 1], [3, 2, 'TeeS', 1], [4, 2, 'HorTr', 1],
    [1, 3, 'FromCS'], [3, 3, 'SysOut'],
  ], { Tracks: [Agv({ Carts: 2 })] }));
  const result = Drive(network, [[0, nodeAt(network, 4, 2)], [1, nodeAt(network, 0, 2)]]);
  assert.equal(result.Deadlock, true);
  assert.equal(result.Collisions, 1);
  assert.match(result.Reason, /ootavad kärud üksteist \(1, 2\)/);
});

// ---------------------------------------------------------------------
// E4 – möödasõidurada: A (0, 2) – FromCS (2, 2) – BUF1 (3, 2) – J1 (4, 2) = ülemine / alumine haru =
//   J2 (6, 2) – SysOut (7, 2) – B (8, 2). A–FromCS 1000 cm (metrokaart), muud 100 cm, harud 357,08 cm.
// ---------------------------------------------------------------------
function LayoutE4({ OneWay = false } = {}) {
  const upper = OneWay ? { Dir: 'E' } : {};
  const lower = OneWay ? { Dir: 'W' } : {};
  return Model('E4 – möödasõidurada', { X: 9, Y: 4 }, [
    [3, 0, 'MachToolDown', 1], [3, 1, 'InOutBuf', 1],
    [4, 1, 'ArcSE', 1], [5, 1, 'HorTr', 1, upper], [6, 1, 'ArcSW', 1],
    [0, 2, 'HorTr', 1], [1, 2, 'HorTr', 1], [2, 2, 'TeeS', 1], [3, 2, 'TeeN', 1], [4, 2, 'TeeW', 1],
    [6, 2, 'TeeE', 1], [7, 2, 'TeeS', 1], [8, 2, 'HorTr', 1],
    [2, 3, 'FromCS'], [4, 3, 'ArcNE', 1], [5, 3, 'HorTr', 1, lower], [6, 3, 'ArcNW', 1], [7, 3, 'SysOut'],
  ], { Tracks: [Agv({ Carts: 2 })], EdgeLengths: [{ Cells: [[1, 2]], Length: 1000 }] });
}

// Käru 1 A-st B-sse, käru 2 B-st A-sse. Käru 1 hoiab pikka üherealist osa A … J1 (1200 cm),
// käru 2 jõuab haru lõppu enne J1-d (200 + 357,08 − 50 cm, t=6) ja ootab seal, kuni käru 1 on
// J1-s (t=12) – siis lähevad nad mööda (käru 1 teist haru pidi).
//   käru 1: 1200 + 357,08 + 200 = 1757,08 cm -> t=18; käru 2: t=12 J1-s, siis 1200 cm -> t=24.
for (const oneWay of [false, true]) {
  test(`E4: möödasõidurada (${oneWay ? 'ühesuunalised' : 'kahesuunalised'} harud) – kärud lähevad mööda ilma Collision-ita`, () => {
    const network = NetworkOf(LayoutE4({ OneWay: oneWay }));
    assert.deepEqual(network.Tracks[0].Edges.filter(edge => edge.OneWay !== 0).length, oneWay ? 2 : 0);
    const result = Drive(network, [[0, nodeAt(network, 8, 2)], [1, nodeAt(network, 0, 2)]]);
    assert.deepEqual(result.Arrived, [18, 24]);
    assert.equal(result.Collisions, 0);
    assert.equal(result.Detours, oneWay ? 0 : 1);
  });
}

test('E4: ühesuunalist haru ei läbita vastu suunda (tee ümber)', () => {
  const network = NetworkOf(LayoutE4({ OneWay: true }));
  const paths = StationPaths(network);
  const fromCS = network.Stations.findIndex(station => station.Kind === 'FromCS');
  const sysOut = network.Stations.findIndex(station => station.Kind === 'SysOut');
  const there = paths[fromCS][sysOut];
  const back = paths[sysOut][fromCS];
  assert.equal(there.Length, back.Length);   // sümmeetriline: üks haru kumbagi pidi
  const upper = network.Tracks[0].Edges.findIndex(edge => edge.Inner.some(([x, y]) => x === 5 && y === 1));
  assert.equal(network.Tracks[0].Edges[upper].OneWay, 1);
});

// ---------------------------------------------------------------------
// F – ristmik: neli haru ristmikust (Cruise (3, 3)), igaühe otsas jaam:
//   W FromCS, N BUF1 (MT1), S BUF2 (MT2), E SysOut. Iga sõit läbib ristmikku.
// ---------------------------------------------------------------------
function LayoutF({ Carts = 3, Seed = 1 } = {}) {
  return Model('F – ristmik', { X: 7, Y: 7 }, [
    [4, 0, 'MachToolDown', 1], [4, 1, 'InOutBuf', 1], [3, 1, 'TeeE', 1], [3, 2, 'VertTr', 1],
    [1, 3, 'TeeS', 1], [2, 3, 'HorTr', 1], [3, 3, 'Cruise', 1], [4, 3, 'HorTr', 1], [5, 3, 'TeeS', 1],
    [1, 4, 'FromCS'], [5, 4, 'SysOut'],
    [3, 4, 'VertTr', 1], [3, 5, 'TeeW', 1], [2, 5, 'InOutBuf', 2], [2, 6, 'MachToolUp', 2],
  ], {
    Tracks: [Agv({ Carts, Speed: 20 })],
    Machines: [Machine('MT1', ['treimine']), Machine('MT2', ['freesimine'])],
    Buffers: [Buffer(), Buffer()],
    Workpieces: [{ Name: 'Võll', Priority: 1, Batch: 1,
                   Routes: [{ Priority: 1, Ops: [OneOp('treimine', 60, 20), OneOp('freesimine', 50, 20)] }] }],
    Sim: { Seed, Duration: 28800, Kl: 0.85, StallTime: 600 },
  });
}

test('F: ristmik – korraga üks käru, keegi ei oota lõputult (8 h, 1–3 käru, 5 seemet)', () => {
  const network = NetworkOf(LayoutF());
  assert.deepEqual(network.Tracks[0].Nodes.filter(node => node.Junction).map(node => [node.X, node.Y]), [[3, 3]]);
  const completed = [];
  for (const carts of [1, 2, 3]) {
    for (let seed = 1; seed <= 5; seed++) {
      // invariant „tsoonis on kaks käru“ kontrollitakse igal sekundil – ka ristmikul
      const report = SimRun(NetworkOf(LayoutF({ Carts: carts, Seed: seed })), CHECKED);
      assert.equal(report.Deadlock, false, `${carts} käru, seeme ${seed}: ${report.DeadlockReason}`);
      assert.ok(report.Tracks[0].MaxWait < 120, `${carts} käru, seeme ${seed}: ootas ${report.Tracks[0].MaxWait} s`);
      if (seed === 1) completed.push(report.Completed);
    }
  }
  assert.ok(completed[1] > completed[0], `valmis 1 / 2 / 3 käruga: ${completed}`);
});

// ---------------------------------------------------------------------
// R – linnavõrk (stress): kahesuunaline ringtee + keskmine põiktee (hargnemised (4, 2) ja (4, 6)),
//   vasakul FromCS, ToCS, SysOut; üleval MT1, MT2, all MT3; puhvrid 1 koht, ristmarsruudid:
//   A: a1 (MT1) -> a2 (MT2 / MT3);  B: b1 (MT2 / MT3) -> b2 (MT1)  (nagu 7a stsenaarium S)
// ---------------------------------------------------------------------
function LayoutR({ Carts = 3, Seed = 1, Kl = 0.95 } = {}) {
  return Model('R – linnavõrk', { X: 8, Y: 9 }, [
    [2, 0, 'MachToolDown', 1], [6, 0, 'MachToolDown', 2], [2, 1, 'InOutBuf', 1], [6, 1, 'InOutBuf', 2],
    [1, 2, 'ArcSE', 1], [2, 2, 'TeeN', 1], [3, 2, 'HorTr', 1], [4, 2, 'TeeS', 1], [5, 2, 'HorTr', 1], [6, 2, 'TeeN', 1], [7, 2, 'ArcSW', 1],
    [0, 3, 'FromCS'], [1, 3, 'TeeW', 1], [4, 3, 'VertTr', 1], [7, 3, 'VertTr', 1],
    [0, 4, 'ToCS'], [1, 4, 'TeeW', 1], [4, 4, 'VertTr', 1], [7, 4, 'VertTr', 1],
    [0, 5, 'SysOut'], [1, 5, 'TeeW', 1], [4, 5, 'VertTr', 1], [7, 5, 'VertTr', 1],
    [1, 6, 'ArcNE', 1], [2, 6, 'HorTr', 1], [3, 6, 'HorTr', 1], [4, 6, 'TeeN', 1], [5, 6, 'HorTr', 1], [6, 6, 'TeeS', 1], [7, 6, 'ArcNW', 1],
    [6, 7, 'InOutBuf', 3], [6, 8, 'MachToolUp', 3],
  ], {
    Tracks: [Agv({ Carts, Speed: 50 })],
    Machines: [
      Machine('MT1', ['a1', 'b2'], { SetupTime: 30 }),
      Machine('MT2', ['a2', 'b1'], { SetupTime: 30 }),
      Machine('MT3', ['a2', 'b1'], { SetupTime: 30 }),
    ],
    Buffers: [Buffer(1), Buffer(1), Buffer(1)],
    Storage: { Capacity: 20, LoadTime: 10 },
    Workpieces: [
      { Name: 'A', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [OneOp('a1', 200, 50), OneOp('a2', 300, 50)] }] },
      { Name: 'B', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [OneOp('b1', 300, 50), OneOp('b2', 200, 50)] }] },
    ],
    Sim: { Seed, Duration: 28800, Kl, StallTime: 600 },
  });
}

test('R: linnavõrk ja ristmarsruudid – 8 h ilma lahendamatu ummikuta (1–4 käru, 5 seemet)', () => {
  for (const carts of [1, 2, 3, 4]) {
    for (let seed = 1; seed <= 5; seed++) {
      const report = SimRun(NetworkOf(LayoutR({ Carts: carts, Seed: seed })), CHECKED);
      assert.equal(report.Deadlock, false, `${carts} käru, seeme ${seed}: ${report.DeadlockReason}`);
      assert.equal(report.Time, 28800);
      assert.ok(report.ThroughputPerHour > 3, `${carts} käru, seeme ${seed}: ${report.ThroughputPerHour} tk/h`);
    }
  }
});

test('R: korratavus – sama seeme sama tulemus', () => {
  const network = NetworkOf(LayoutR());
  assert.deepEqual(SimRun(network), SimRun(network));
});

// ---------------------------------------------------------------------
// M – segavõrk: pidev silmus (FromCS, SysOut) ja AGV-joon (MT1 üleval, MT2 all) konnektoriga
//   CON1 (3, 4); AGV jaam konnektori juures (5, 4), raja otstes BUF1 (5, 1) ja BUF2 (5, 7).
// ---------------------------------------------------------------------
function LayoutM({ Carts = 1, Seed = 1 } = {}) {
  return Model('M – konveier ja AGV', { X: 7, Y: 9 }, [
    [6, 0, 'MachToolDown', 1], [6, 1, 'InOutBuf', 1], [5, 1, 'TeeE', 2],
    [1, 1, 'SysOut'], [1, 2, 'VertTr', null, DOT], [5, 2, 'VertTr', 2],
    [0, 3, 'ArcSE', 1], [1, 3, 'TeeN', 1], [2, 3, 'ArcSW', 1], [5, 3, 'VertTr', 2],
    [0, 4, 'VertTr', 1, { Dir: 'S' }], [2, 4, 'TeeE', 1], [3, 4, 'HorCon'], [4, 4, 'HorTr', null, DOT], [5, 4, 'TeeW', 2],
    [0, 5, 'ArcNE', 1], [1, 5, 'TeeS', 1], [2, 5, 'ArcNW', 1], [5, 5, 'VertTr', 2],
    [1, 6, 'VertTr', null, DOT], [1, 7, 'FromCS'], [5, 6, 'VertTr', 2],
    [5, 7, 'TeeE', 2], [6, 7, 'InOutBuf', 2], [6, 8, 'MachToolUp', 2],
  ], {
    Tracks: [{ Name: 'Konveier', Mode: 'Continuous', Carts: 2, PlacesPerCart: 1, Speed: 20, LoadTime: 10, AccessTime: 0 },
             Agv({ Carts, Speed: 50 })],
    Machines: [Machine('MT1', ['treimine']), Machine('MT2', ['freesimine'])],
    Buffers: [Buffer(), Buffer()],
    Workpieces: [{ Name: 'Võll', Priority: 1, Batch: 1,
                   Routes: [{ Priority: 1, Ops: [OneOp('treimine', 200, 40), OneOp('freesimine', 150, 40)] }] }],
    Sim: { Seed, Duration: 28800, Kl: 0.85, StallTime: 600 },
  });
}

test('M: konveier ja AGV konnektoriga – detail läheb konveierilt AGV-le ja tagasi (8 h)', () => {
  const network = NetworkOf(LayoutM());
  assert.deepEqual(network.Tracks.map(track => track.Mode), ['Continuous', 'Discrete']);
  const report = SimRun(network, CHECKED);
  assert.equal(report.Deadlock, false, report.DeadlockReason);
  assert.ok(report.Completed > 50, `valmis ${report.Completed}`);
  const transfers = report.Connectors[0].Transfers;
  assert.ok(transfers >= 2 * report.Completed, `ülekandeid ${transfers}`);   // sisse ja välja
  assert.ok(report.Tracks[1].Discrete && report.Tracks[1].Stops > 0);
});

// ---------------------------------------------------------------------
// N – näidismudel (models/demo.fms.json) diskreetse rajana: ring, millel on ainult jaamad.
//   Nagu failis: üks nool -> üks ühesuunaline lõik, ülejäänud kahesuunalised (möödumiskohti pole).
//   Ühesuunaline ring: nool igal lõigul (ToCS–SysOut lõigul pole ikooni, see jääb kahesuunaliseks).
// ---------------------------------------------------------------------
function DemoDiscrete({ Carts, OneWay = false, Seed = 1 }) {
  const model = JSON.parse(readFileSync(new URL('../models/demo.fms.json', import.meta.url), 'utf8'));
  if (OneWay) {
    for (const cell of NetworkOf(model).Tracks[0].Cells) {
      const icon = IconTypes[cell.T];
      if (icon.Branch || icon.Ports.length !== 2) continue;
      model.Layout.Cells.find(item => item.X === cell.X && item.Y === cell.Y).Dir = cell.Exit;
    }
  }
  model.Tracks[0].Mode = 'Discrete';
  model.Tracks[0].Carts = Carts;
  model.Sim.Seed = Seed;
  return model;
}

test('N: näidismudel AGV-dega – ühesuunalisel ringil 1–5 käru ilma ummikuta', () => {
  for (let carts = 1; carts <= 5; carts++) {
    const report = SimRun(NetworkOf(DemoDiscrete({ Carts: carts, OneWay: true })), CHECKED);
    assert.equal(report.Deadlock, false, `${carts} käru: ${report.DeadlockReason}`);
    assert.equal(report.Tracks[0].Collisions, 0);
    assert.ok(report.ThroughputPerHour > 9, `${carts} käru: ${report.ThroughputPerHour} tk/h`);
  }
});

test('N: näidismudel AGV-dega – kahesuunalisel ringil 2 käru töötab, 3 käru annab selge ummikuteate', () => {
  const two = SimRun(NetworkOf(DemoDiscrete({ Carts: 2 })), CHECKED);
  assert.equal(two.Deadlock, false, two.DeadlockReason);
  assert.ok(two.ThroughputPerHour > 9);
  const three = SimRun(NetworkOf(DemoDiscrete({ Carts: 3 })), CHECKED);
  assert.equal(three.Deadlock, true);
  assert.match(three.DeadlockReason, /ootavad kärud üksteist/);
});

// ---------------------------------------------------------------------
// Animaator (arvutusosa, DISAIN.md 14): käru punkt raja graafis
// ---------------------------------------------------------------------

test('Animaator: lõigu punktid on pidevad, otsad on sõlmede punktides, jaam hargnemisikooni keskel', () => {
  const distance = (a, b) => Math.hypot(a.X - b.X, a.Y - b.Y);
  for (const network of [NetworkOf(LayoutE4()), NetworkOf(LayoutF()), NetworkOf(LayoutR()), NetworkOf(LayoutM())]) {
    const track = network.Tracks.find(item => item.Mode === 'Discrete');
    for (const edge of track.Edges) {
      assert.ok(distance(EdgePoint(edge, 0), NodePoint(track, edge.From)) < 1e-6, `${network.Name}: lõigu algus`);
      assert.ok(distance(EdgePoint(edge, edge.Length), NodePoint(track, edge.To)) < 1e-6, `${network.Name}: lõigu lõpp`);
      const steps = 400;
      for (let i = 1; i <= steps; i++) {
        const gap = distance(EdgePoint(edge, edge.Length * (i - 1) / steps), EdgePoint(edge, edge.Length * i / steps));
        assert.ok(gap < 0.05, `${network.Name}: hüpe ${gap} lõigul ${edge.From}-${edge.To}`);
      }
    }
    for (const station of network.Stations.filter(item => item.Node !== undefined)) {
      const point = NodePoint(track, station.Node);
      assert.ok(Math.abs(point.X - station.Junction.X - 0.5) < 1e-6 && Math.abs(point.Y - station.Junction.Y - 0.5) < 1e-6);
    }
  }
});

test('Animaator: käru liigub sekundi sees sujuvalt; sammhaaval lugedes on aruanne sama', () => {
  const network = NetworkOf(LayoutR({ Carts: 3 }));
  const short = { ...network, Sim: { ...network.Sim, Duration: 3600 } };
  const expected = SimRun(short);
  SimInit(short, CHECKED);
  const maxStep = network.Tracks[0].Speed / network.Scale;   // ikooni sekundis
  while (!SimState().SIMULATION_DONE) {
    const track = SimState().Tracks[0];
    const before = track.Pallets.map(CartPosition);
    SimStep();
    track.Pallets.forEach((cart, cartIndex) => {
      let previous = InterpolateCart(track, before[cartIndex], CartPosition(cart), 0);
      for (let k = 1; k <= 10; k++) {
        const point = InterpolateCart(track, before[cartIndex], CartPosition(cart), k / 10);
        assert.ok(Math.hypot(point.X - previous.X, point.Y - previous.Y) <= maxStep / 10 * 1.6 + 1e-6
          || cart.Edge < 0 && before[cartIndex].Edge === undefined, 'käru hüppab');
        previous = point;
      }
      assert.deepEqual(InterpolateCart(track, before[cartIndex], CartPosition(cart), 1), CartPoint(track, CartPosition(cart)));
    });
    WorkpiecePlaces(SimState());   // detailide kohad (kärul) arvutatakse ilma veata
  }
  assert.deepEqual(SimReport(), expected);
});

// ---------------------------------------------------------------------
// Näidis-AGV (models/agv.fms.json, File → Load): ühesuunaline ringtee päripäeva, kahesuunaline
//   põiktee keskel, parkimisharu vasakul; MT1, MT2, MT3, FromCS, ToCS, SysOut; 3 käru.
// ---------------------------------------------------------------------
function DemoAgv({ Carts = 3, Seed = 1 } = {}) {
  const model = JSON.parse(readFileSync(new URL('../models/agv.fms.json', import.meta.url), 'utf8'));
  model.Tracks[0].Carts = Carts;
  model.Sim.Seed = Seed;
  return model;
}

test('Näidis-AGV: 8 h ilma ummikuta (1–4 käru, 5 seemet), rohkem kärusid – rohkem valmis', () => {
  const completed = [];
  for (let carts = 1; carts <= 4; carts++) {
    for (let seed = 1; seed <= 5; seed++) {
      const report = SimRun(NetworkOf(DemoAgv({ Carts: carts, Seed: seed })), seed === 1 ? CHECKED : {});
      assert.equal(report.Deadlock, false, `${carts} käru, seeme ${seed}: ${report.DeadlockReason}`);
      assert.ok(report.Tracks[0].MaxWait < 120, `${carts} käru, seeme ${seed}: ootas ${report.Tracks[0].MaxWait} s`);
      if (seed === 1) completed.push(report.Completed);
    }
  }
  assert.ok(completed[0] < completed[1] && completed[1] < completed[2], `valmis 1–4 käruga: ${completed}`);
});

// Invariantide kontroll: meelega tehtud vead tabatakse kohe.
test('Invariandid: tsoon ilma broneeringuta, kaks käru ühes tsoonis, vastu ühesuunalist lõiku', () => {
  const network = NetworkOf(LayoutE4({ OneWay: true }));
  const start = () => {
    SimInit({ ...network, Sim: { ...network.Sim, Kl: 0 } }, CHECKED);
    DriveCart(0, 0, nodeAt(network, 8, 2));
    for (let i = 0; i < 13; i++) SimStep();   // käru 1 on ülemisel harul
    return SimState().Tracks[0];
  };
  let track = start();
  track.Holder.delete(`E${track.Pallets[0].Edge}`);
  assert.throws(() => SimStep(), /pole broneerinud/);
  track = start();
  track.Pallets[1].Node = -1;
  track.Pallets[1].Edge = track.Pallets[0].Edge;
  assert.throws(() => SimStep(), /kaks käru/);
  track = start();
  track.Pallets[0].Dir = -track.Pallets[0].Dir;
  assert.throws(() => SimStep(), /vastu suunda/);
});

// ---------------------------------------------------------------------
// Andmekontroll
// ---------------------------------------------------------------------

test('Diskreetne rada: vastuolulised nooled samal lõigul on viga', () => {
  const model = LayoutE4({ OneWay: true });
  model.Layout.Cells.find(cell => cell.X === 6 && cell.Y === 3).Dir = 'N';   // ArcNW: J1 -> J2 suunas, haru nool W vastu
  assertEnumError(model, 'vastuolus');
});

test('Diskreetne rada: kaks eraldi tükki on viga', () => {
  const model = LayoutI();
  model.Layout.Cells = model.Layout.Cells.filter(cell => !(cell.X === 4 && cell.Y === 3));
  assertEnumError(model, 'pole ühes tükis');
});

test('Diskreetne rada: kärusid rohkem kui sõlmi on viga', () => {
  const model = LayoutI({ Carts: 6 });
  assertEnumError(model, 'rohkem kärusid');
});

test('Diskreetne rada: ühesuunaliselt ei pääse tagasi -> kättesaadavuse viga', () => {
  const model = LayoutI();
  model.Layout.Cells.find(cell => cell.X === 2 && cell.Y === 3).Dir = 'W';   // FromCS -> BUF1 ei saa
  assertEnumError(model, 'operatsiooni');
});

// ---------------------------------------------------------------------
// 7c – mitu detaili kärul: koormusega stsenaariumid (invariandid igal sekundil seemnel 1:
//   kohad, peatuste nimekiri, tsoonid)
// ---------------------------------------------------------------------
test('7c: F, R, M, N (ühesuunaline), Näidis-AGV kahe ja kolme kohaga – 8 h ilma ummikuta', () => {
  const scenarios = [
    ['F', seed => LayoutF({ Carts: 2, Seed: seed })], ['R', seed => LayoutR({ Carts: 3, Seed: seed })],
    ['M', seed => LayoutM({ Seed: seed })], ['N', seed => DemoDiscrete({ Carts: 3, OneWay: true, Seed: seed })],
    ['Näidis-AGV', seed => DemoAgv({ Carts: 3, Seed: seed })],
  ];
  for (const [name, make] of scenarios) {
    for (const places of [2, 3]) {
      for (let seed = 1; seed <= 3; seed++) {
        const model = make(seed);
        for (const track of model.Tracks) track.PlacesPerCart = places;
        const report = SimRun(NetworkOf(model), seed === 1 ? CHECKED : {});
        assert.equal(report.Deadlock, false, `${name}, ${places} kohta, seeme ${seed}: ${report.DeadlockReason}`);
        assert.ok(report.Completed > 0);
      }
    }
  }
});

test('7c: transport on pudelikael (I2, üks käru) – rohkem kohti, rohkem valmis (kogumissõit)', () => {
  const completed = [1, 2, 3].map(places => {
    const model = LayoutI({ Kl: 0.85, Duration: 28800, Mean: 30 });
    model.Tracks[0].PlacesPerCart = places;
    const report = SimRun(NetworkOf(model), CHECKED);
    assert.equal(report.Tracks[0].MaxLoad, places);
    return report.Completed;
  });
  assert.equal(completed[0], 513);
  assert.ok(completed[1] > completed[0] && completed[2] > completed[1], `valmis ${completed.join(' / ')}`);
});
