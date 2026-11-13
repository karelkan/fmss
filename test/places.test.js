// FMSS – mitu detaili alusel / kärul (etapp 7c, PlacesPerCart > 1).
// Käivitamine: npm test. Simulatsioonid kontrollivad invariante igal sekundil (ka kohad alusel ja
// käru peatuste nimekiri – CheckPallet, CheckCarts). VALIDEERIMINE.md etapp 7c.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CheckModel } from '../src/fms_glb.js';
import { Enumerate, SimRun, SimInit, SimStep, SimState } from '../src/fms_sim.js';

const CHECKED = { CheckInvariants: true };
const DOT = { Dot: true };
const Cells = rows => rows.map(([X, Y, T, N, extra]) => ({ X, Y, T, ...(N !== undefined && N !== null ? { N } : {}), ...extra }));
const Machine = (name, ops) => ({ Name: name, Model: '', LoadTime: 10, SetupTime: 0, Ops: ops });
const Buffer = (capacity = 2) => ({ Capacity: capacity, Discipline: 'FIFO', LoadTime: 5 });
const OneOp = (op, mean) => ({ Op: op, Mean: mean, Dev: 0 });

function NetworkOf(model) {
  assert.deepEqual(CheckModel(model), [], 'CheckModel');
  const result = Enumerate(model);
  assert.deepEqual(result.Errors, [], 'Enumerate');
  return result.Network;
}
const timeOut = (report, id) => report.Finished.find(item => item.Id === id)?.TimeOut;

// ---------------------------------------------------------------------
// H – avatud konveier (nagu network.test.js): rida y = 3, 900 cm, 20 cm/s, üks alus
//   FromCS 150, BUF1 (MT1, 300 s) 350, BUF2 (MT2, 200 s) 550, SysOut 750
// ---------------------------------------------------------------------
function LayoutH({ Places = 2, Carts = 1, Kl = 0.2, Duration = 1100 } = {}) {
  return {
    Meta: { Name: 'H – avatud konveier, mitu kohta', Version: 1 },
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
    Tracks: [{ Name: 'Liin', Mode: 'Continuous', Carts, PlacesPerCart: Places, Speed: 20, LoadTime: 10, AccessTime: 0 }],
    Machines: [Machine('MT1', ['treimine']), Machine('MT2', ['freesimine'])],
    Buffers: [Buffer(), Buffer()],
    Storage: null,
    Workpieces: [{ Name: 'Võll', Priority: 1, Batch: 1,
                   Routes: [{ Priority: 1, Ops: [OneOp('treimine', 300), OneOp('freesimine', 200)] }] }],
    Sim: { Seed: 1, Duration, Kl, StallTime: 600 },
  };
}

// K1. Kaks kohta alusel, kaks detaili (Kl 0,2: 1 alus + 2 pinki + 4 kohta puhvrites = 7, 2/7 ≥ 0,2).
//   Alus on jaamas iga 45 s järel, kui ta vahepeal ei peatu (H1: network.test.js).
//   t=8     FromCS: peale WP0 -> t=18, peale WP1 -> t=28 (üks peatus, kaks laadimist)
//   t=38    BUF1: maha WP0 -> t=48 (MT1 laadib -> t=58, töötleb -> t=358, puhvrisse -> t=368),
//           maha WP1 -> t=58; alus on BUF1-s jälle t = 58 + 45k
//   t=373   BUF1: peale WP0 -> t=383 (WP1 on pingis); t=393 BUF2, maha -> t=403
//           MT2: laadib -> t=413, töötleb -> t=613, puhvrisse -> t=623; alus BUF2-s t = 403 + 45k
//   t=628   BUF2: peale WP0 -> t=638; t=648 SysOut, maha -> t=658 (WP0 valmis, 658 s)
//           lahkumisel tuuakse WP2; WP1: MT1 laadib t=368 -> 378, töötleb -> 678, puhvrisse -> 688
//   t=673   FromCS (SysOut-ist 300 cm): peale WP2 -> t=683; t=693 BUF1: maha WP2 -> t=703,
//           peale WP1 -> t=713 (sama peatus: maha ja peale); t=723 BUF2, maha -> t=733
//           MT2: laadib -> 743, töötleb -> 943, puhvrisse -> 953; alus BUF2-s t = 733 + 45k
//   t=958   BUF2: peale WP1 -> t=968; t=978 SysOut, maha -> t=988 (WP1 valmis, 988 s).
test('K1: kaks kohta alusel, avatud konveier – tsükliajad klapivad käsitsi arvutusega (658 s, 988 s)', () => {
  const report = SimRun(NetworkOf(LayoutH()), CHECKED);
  assert.equal(timeOut(report, 0), 658);
  assert.equal(timeOut(report, 1), 988);
  assert.equal(report.Tracks[0].MaxLoad, 2);
  assert.equal(report.Tracks[0].Pooled, 1);   // t=18: WP1 peale, kui WP0 on juba alusel
});

// ---------------------------------------------------------------------
// I – üks AGV joonel (nagu agv.test.js): ots A (0, 3), FromCS (1, 3), BUF1 / MT1 (3, 3),
//   SysOut (5, 3), ots (6, 3); lõigud 100, 200, 200, 100 cm; 50 cm/s; laadimine 10 s
// ---------------------------------------------------------------------
function LayoutI({ Places = 2, Carts = 1, Kl = 0.3, Duration = 800, Mean = 300 } = {}) {
  return {
    Meta: { Name: 'I – AGV, mitu kohta', Version: 1 },
    Scale: 100,
    Layout: {
      Dim: { X: 7, Y: 6 },
      Cells: Cells([
        [3, 0, 'MachToolDown', 1], [3, 1, 'InOutBuf', 1], [3, 2, 'VertTr', null, DOT],
        [0, 3, 'HorTr', 1], [1, 3, 'TeeS', 1], [2, 3, 'HorTr', 1], [3, 3, 'TeeN', 1], [4, 3, 'HorTr', 1],
        [5, 3, 'TeeS', 1], [6, 3, 'HorTr', 1],
        [1, 4, 'VertTr', null, DOT], [1, 5, 'FromCS'], [5, 4, 'VertTr', null, DOT], [5, 5, 'SysOut'],
      ]),
    },
    EdgeLengths: [],
    Tracks: [{ Name: 'AGV', Mode: 'Discrete', Carts, PlacesPerCart: Places, Speed: 50, LoadTime: 10, AccessTime: 0 }],
    Machines: [Machine('MT1', ['treimine'])],
    Buffers: [Buffer()],
    Storage: null,
    Workpieces: [{ Name: 'Võll', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [OneOp('treimine', Mean)] }] }],
    Sim: { Seed: 1, Duration, Kl, StallTime: 600 },
  };
}

// K2. Kaks kohta kärul, kaks detaili (Kl 0,3: 1 käru + 1 pink + 2 kohta puhvris = 4, 2/4 ≥ 0,3). I1: agv.test.js.
//   t=1    FindPal: WP0 vabale kärule (peatused: peale FromCS, maha BUF1); WP1 samale kärule
//          (CartInsertion: peale FromCS, maha BUF1 – sõiduaeg ei muutu)
//   t=2    FromCS: peale WP0 -> t=12, peale WP1 -> t=22; t=26 BUF1 (200 cm), maha WP0 -> t=36,
//          maha WP1 -> t=46. MT1: laadib WP0 t=36 -> 46, töötleb -> 346, puhvrisse -> 356
//   t=357  käru on BUF1-s: peale WP0 -> t=367; t=371 SysOut, maha -> t=381 (WP0 valmis, 381 s)
//          lahkumisel tuuakse WP2: käru sõidab SysOut-ist FromCS-i (400 cm) -> t=389, peale -> 399,
//          t=403 BUF1, maha -> 413. MT1: WP1 t=356 -> 366, töötleb -> 666, puhvrisse -> 676
//   t=677  peale WP1 -> t=687; t=691 SysOut, maha -> t=701 (WP1 valmis, 701 s).
test('K2: kaks kohta kärul – kogumissõit, tsükliajad klapivad käsitsi arvutusega (381 s, 701 s)', () => {
  const report = SimRun(NetworkOf(LayoutI()), CHECKED);
  assert.equal(timeOut(report, 0), 381);
  assert.equal(timeOut(report, 1), 701);
  const track = report.Tracks[0];
  assert.equal(track.MaxLoad, 2);
  assert.equal(track.Pooled, 1);
  assert.equal(track.Collisions, 0);
});

test('K: PlacesPerCart = 1 – samad tsükliajad mis enne (H1 683 s, I1 371 s)', () => {
  const h = SimRun(NetworkOf(LayoutH({ Places: 1, Kl: 0.1, Duration: 800 })), CHECKED);
  assert.equal(timeOut(h, 0), 683);
  const i = SimRun(NetworkOf(LayoutI({ Places: 1, Kl: 0.1, Duration: 600 })), CHECKED);
  assert.equal(timeOut(i, 0), 371);
});

// ---------------------------------------------------------------------
// Invariandid tabavad meelega tehtud vead
// ---------------------------------------------------------------------
function RunUntil(network, condition) {
  SimInit(network, CHECKED);
  while (!condition(SimState())) SimStep();
  return SimState();
}
const loadedCart = state => state.Tracks[0].Pallets[0].Places.filter(id => id !== null).length === 2
  && state.SysWPArray.every(workpiece => workpiece.State !== 'LOADING');

test('K: invariant – kärul on rohkem detaile kui kohti', () => {
  const state = RunUntil(NetworkOf(LayoutI()), loadedCart);
  state.Tracks[0].Pallets[0].Places.push(null);   // kolmas koht kahekohalisel kärul
  assert.throws(() => SimStep(), /kohti 3/);
});

test('K: invariant – detaili mahalaadimine puudub käru peatuste nimekirjast', () => {
  const state = RunUntil(NetworkOf(LayoutI()), loadedCart);
  const cart = state.Tracks[0].Pallets[0];
  cart.StopList = cart.StopList.filter(stop => stop.WP !== cart.Places[1]);
  assert.throws(() => SimStep(), /pole mahalaadimist/);
});

test('K: invariant – detail viitab teisele kohale alusel', () => {
  const state = RunUntil(NetworkOf(LayoutH()), current => current.Tracks[0].Pallets[0].Places.every(id => id !== null)
    && current.SysWPArray.every(workpiece => workpiece.State !== 'LOADING'));
  const pallet = state.Tracks[0].Pallets[0];
  pallet.Places.reverse();
  assert.throws(() => SimStep(), /vale asukohaga|pole alusel/);
});

// ---------------------------------------------------------------------
// Kl: Ndet / (Ntm + Nmt + Nbuf + Ncon) < Kl, Ntm = aluste arv (7c), mitte kohtade arv
//   (kohad tõid süsteemi detaile, mis ootasid FromCS-is – VALIDEERIMINE.md 7c leid 1)
// ---------------------------------------------------------------------
test('K: Kl ei loe kohti alusel – detaile süsteemis sama palju, tsükliaeg ei kasva', () => {
  const reports = [1, 2, 3].map(places => SimRun(NetworkOf(LayoutH({ Places: places, Carts: 3, Kl: 0.85, Duration: 28800 }))));
  assert.deepEqual(reports.map(report => report.MaxWip), [8, 8, 8]);   // 0,85 × (3 + 2 + 4)
  assert.deepEqual(reports.map(report => report.Completed), [88, 88, 88]);
  assert.ok(reports[2].AvgCycleTime <= reports[0].AvgCycleTime + 1);
});
