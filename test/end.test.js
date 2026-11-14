// FMSS – simulatsiooni lõpurežiim (etapp 11d, versioon 1.4): Sim.EndMode (Time, FinishOps, Ship,
// Drain, Order) ja Sim.OrderSequence (Mixed, Batch). Käivitamine: npm test.
// Simulatsioonid kontrollivad invariante igal sekundil. DISAIN.md osa 20, VALIDEERIMINE.md etapp 11d.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CheckModel } from '../core/fms_glb.js';
import { Enumerate, SimRun, SimInit, SimStep, SimState, SimReport } from '../core/fms_sim.js';

const ROOT = new URL('../', import.meta.url);
const ReadModel = name => JSON.parse(readFileSync(new URL(`models/${name}`, ROOT), 'utf8'));
const CHECKED = { CheckInvariants: true };
const DOT = { Dot: true };
const Cells = rows => rows.map(([X, Y, T, N, extra]) => ({ X, Y, T, ...(N !== undefined && N !== null ? { N } : {}), ...extra }));
const Machine = (name, ops, extra = {}) => ({ Name: name, Model: '', LoadTime: 10, SetupTime: 0, Ops: ops, ...extra });
const Buffer = (capacity = 2) => ({ Capacity: capacity, Discipline: 'FIFO', LoadTime: 5 });
const OneOp = (op, mean, dev = 0) => ({ Op: op, Mean: mean, Dev: dev });

function NetworkOf(model) {
  assert.deepEqual(CheckModel(model), [], 'CheckModel');
  const result = Enumerate(model);
  assert.deepEqual(result.Errors, [], 'Enumerate');
  return result.Network;
}

// mudel lõpurežiimi ja muude Sim väljadega
function WithSim(model, sim, batch) {
  const copy = structuredClone(model);
  Object.assign(copy.Sim, sim);
  if (batch !== undefined) copy.Workpieces.forEach(type => { type.Batch = batch; });
  return copy;
}
const Run = (model, sim, batch, options = CHECKED) => {
  const report = SimRun(NetworkOf(WithSim(model, sim, batch)), options);
  return { Report: report, State: SimState() };
};

// detailid alustel / kärudel
const OnPallets = state => state.Tracks.reduce((sum, track) =>
  sum + track.Pallets.reduce((count, pallet) => count + pallet.Places.filter(place => place !== null).length, 0), 0);
// valmis detail või praak, mis on veel süsteemis
const route = (state, workpiece) => state.Workpieces[workpiece.Type].Routes[workpiece.Route].Ops;
const FinishedInside = state => state.SysWPArray.filter(workpiece => workpiece.State !== 'GONE'
  && (workpiece.Scrap || workpiece.OpIndex >= route(state, workpiece).length));

// ---------------------------------------------------------------------
// H – avatud konveier (nagu crash.test.js): FromCS 150, BUF1 (MT1, treimine 300 s) 350,
//   BUF2 (MT2, freesimine 200 s) 550, SysOut 750; üks alus, 20 cm/s; Kl 0,1 – süsteemis üks detail.
// ---------------------------------------------------------------------
function LayoutH({ MT1 = {}, Duration = 1500, Sim = {}, Batch = 1 } = {}) {
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
    Tracks: [{ Name: 'Liin', Mode: 'Continuous', Carts: 1, PlacesPerCart: 1, Speed: 20, LoadTime: 10, AccessTime: 0 }],
    Machines: [Machine('MT1', ['treimine'], MT1), Machine('MT2', ['freesimine'])],
    Buffers: [Buffer(), Buffer()],
    Storage: null,
    Workpieces: [{ Name: 'Võll', Priority: 1, Batch,
                   Routes: [{ Priority: 1, Ops: [OneOp('treimine', 300), OneOp('freesimine', 200)] }] }],
    Sim: { Seed: 1, Duration, Kl: 0.1, StallTime: 600, ...Sim },
  };
}

// ---------------------------------------------------------------------
// L0. Ühilduvus: EndMode Time ja OrderSequence Mixed (vaikimisi) – sama mis ilma väljadeta.
// ---------------------------------------------------------------------
test('L0: EndMode Time / OrderSequence Mixed – aruanne sama mis ilma väljadeta (vanad mudelid)', () => {
  for (const file of ['demo.fms.json', 'agv.fms.json', 'rike.fms.json']) {
    const model = ReadModel(file);
    const plain = SimRun(NetworkOf(model), CHECKED);
    const explicit = SimRun(NetworkOf(WithSim(model, { EndMode: 'Time', OrderSequence: 'Mixed' })), CHECKED);
    assert.deepEqual(explicit, plain, file);
    assert.equal(plain.EndMode, 'Time');
    assert.equal(plain.Ending, null);
    assert.equal(plain.Order, null);
    assert.equal(plain.Time, model.Sim.Duration);
  }
});

// ---------------------------------------------------------------------
// L1. Käsitsi arvutatud (mudel H, T = 200: WP0 töötlemine MT1-s t=48…348, puhvrisse t=358).
//   B ja C: pink lõpetab, detail jääb BUF1-te (MT2 operatsioon on tegemata) – lõpp t=358.
//   D (T = 400): detail tehakse lõpuni – lõpp tema lahkumisel t=683 (sama mis Time-režiimis pika kestusega).
// ---------------------------------------------------------------------
test('L1: mudel H, T = 200 – B ja C lõpevad t=358 (pink tühi), D detaili lahkumisel', () => {
  const free = SimRun(NetworkOf(LayoutH({ Duration: 1500 })), CHECKED);
  const leaves = free.Finished[0].TimeOut;
  for (const mode of ['FinishOps', 'Ship']) {
    const report = SimRun(NetworkOf(LayoutH({ Duration: 200, Sim: { EndMode: mode } })), CHECKED);
    const state = SimState();
    assert.equal(report.Time, 358, mode);
    assert.deepEqual(report.Ending, { Start: 200, Duration: 158, PeriodCompleted: 0, CompletedAfter: 0,
                                      ScrappedAfter: 0, LeftInSystem: 1, Capped: false }, mode);
    // BUF2 koht broneeriti enne töötlemist (ReserveNextBeforeStart), aga sõitu ei tule
    assert.equal(state.SysWPArray[0].State, 'WAIT_PICKUP', `${mode}: detail ootab BUF1 väljaminevas kohas`);
    assert.deepEqual(state.SysWPArray[0].Location, { Kind: 'Buffer', Index: 0, Dir: 'Out' });
    assert.equal(state.MachineArray[0].OpsDone, 1);
    assert.equal(report.Created, 1, `${mode}: pärast T uusi ei tooda`);
  }
  // D: T = 400 (ülempiir 2T = 800; T = 200 korral katkeks lõpetamine t=400)
  const drain = SimRun(NetworkOf(LayoutH({ Duration: 400, Sim: { EndMode: 'Drain' } })), CHECKED);
  assert.equal(leaves, 683);
  assert.equal(drain.Time, leaves);
  assert.equal(drain.Completed, 1);
  assert.equal(drain.InSystem, 0);
  assert.equal(drain.Ending.CompletedAfter, 1);
  // perioodi 0…T näitajad on samad mis Time-režiimis kell T
  const atT = SimRun(NetworkOf(LayoutH({ Duration: 400 })), CHECKED);
  for (const key of ['ThroughputPerHour', 'AvgWip', 'MaxWip', 'Machines', 'Buffers', 'Tracks']) assert.deepEqual(drain[key], atT[key], key);
});

// ---------------------------------------------------------------------
// L2. Käsitsi arvutatud makespan (Order): mudel H, partii 1, MT1 rike pärast 100 s töötlemist,
//   remont 120 s (crash.test.js R1, R2): WP0 praak lahkub t=348, asendus WP1 tuleb t=348 ja lahkub
//   t=1038. Tellimus 1 / 1, makespan 1038. Ilma asenduseta oleks tellimus tehtud t=348 (0 / 1).
// ---------------------------------------------------------------------
test('L2: Order – praak asendatakse, makespan 1038 s klapib käsitsi arvutusega', () => {
  const network = NetworkOf(LayoutH({ MT1: { RepairMean: 120 }, Duration: 3000, Sim: { EndMode: 'Order' } }));
  const report = SimRun(network, { ...CHECKED, CrashAfter: [[100]] });
  assert.equal(report.Scrapped, 1);
  assert.equal(report.Completed, 1);
  assert.equal(report.Created, 2);
  assert.equal(report.Time, 1038);
  assert.deepEqual(report.Order, { Sequence: 'Mixed', Total: 1, Completed: 1, Done: true, Makespan: 1038 });
  assert.equal(report.Ending, null);
});

test('L3: Order – kell T enne tellimuse lõppu: tulemus nagu Time, tellimus jäi pooleli', () => {
  const model = ReadModel('demo.fms.json');
  const time = SimRun(NetworkOf(WithSim(model, { Duration: 3600 })), CHECKED);
  const order = SimRun(NetworkOf(WithSim(model, { Duration: 3600, EndMode: 'Order' }, 1000)), CHECKED);
  for (const key of ['Time', 'Created', 'Completed', 'InSystem', 'ThroughputPerHour', 'Machines', 'Types']) {
    assert.deepEqual(order[key], time[key], key);
  }
  assert.deepEqual(order.Order, { Sequence: 'Mixed', Total: 2000, Completed: time.Completed, Done: false, Makespan: null });
});

// ---------------------------------------------------------------------
// L4. Lõpuseis vastab tabelile (DISAIN.md 20) – kõik näidismudelid, invariandid igal sekundil.
//   B: ükski detail pole pingis; C: lisaks alused / kärud ja konnektorid tühjad ja ükski valmis
//   detail ega praak pole süsteemis; D: süsteem tühi. Pärast T uusi ei tooda (Created nagu Time-is).
// ---------------------------------------------------------------------
for (const file of ['demo.fms.json', 'rike.fms.json', 'agv.fms.json', 'kinnitus.fms.json', 'allhange.fms.json', 'reduktor.fms.json', 'mootor.fms.json']) {
  test(`L4: ${file} – lõpuseis B, C, D vastab tabelile`, () => {
    const model = WithSim(ReadModel(file), { EndMode: 'Time' });
    const time = Run(model, {}).Report;
    const results = {};
    for (const mode of ['FinishOps', 'Ship', 'Drain']) {
      const { Report: report, State: state } = Run(model, { EndMode: mode });
      results[mode] = report;
      assert.equal(report.Deadlock, false, `${mode}: ${report.DeadlockReason}`);
      assert.equal(report.Created, time.Created, `${mode}: pärast T uusi ei tooda`);
      assert.equal(report.Ending.Capped, false, mode);
      assert.equal(report.Ending.Start, model.Sim.Duration);
      assert.equal(report.Ending.PeriodCompleted, time.Completed, mode);
      for (const key of ['ThroughputPerHour', 'AvgWip', 'MaxWip', 'Machines', 'Buffers', 'Tracks']) {
        assert.deepEqual(report[key], time[key], `${mode}: perioodi 0…T ${key}`);
      }
      assert.ok(state.MachineArray.every(machine => machine.WP === null), `${mode}: pingid tühjad`);
      if (mode === 'FinishOps') continue;
      assert.equal(OnPallets(state), 0, `${mode}: alused tühjad`);
      assert.ok(state.Tracks.every(track => track.Pallets.every(pallet => pallet.ReservedWPs.length === 0)), `${mode}: broneeringuteta`);
      assert.ok(state.ConnectorArray.every(connector => connector.WP === null), `${mode}: konnektorid tühjad`);
      assert.deepEqual(FinishedInside(state), [], `${mode}: valmis detaile pole sees`);
      if (mode === 'Drain') {
        assert.equal(report.InSystem, 0);
        assert.equal(report.Completed + report.Scrapped, report.Created);
      }
    }
    assert.ok(results.FinishOps.Time <= results.Ship.Time && results.Ship.Time <= results.Drain.Time);
    assert.ok(results.Ship.Completed >= results.FinishOps.Completed);
  });
}

// ---------------------------------------------------------------------
// L5. Order: tellimus täidetakse, süsteem tühi – kõik näidised, mõlemad järjekorrad.
// ---------------------------------------------------------------------
for (const file of ['demo.fms.json', 'rike.fms.json', 'agv.fms.json', 'reduktor.fms.json', 'mootor.fms.json']) {
  test(`L5: ${file} – Order (Segamini ja Partii järjest): igast tüübist Batch tükki, süsteem tühi`, () => {
    for (const sequence of ['Mixed', 'Batch']) {
      const { Report: report } = Run(ReadModel(file), { EndMode: 'Order', OrderSequence: sequence }, 3);
      const total = 3 * report.Types.length;
      assert.equal(report.Deadlock, false);
      assert.equal(report.InSystem, 0);
      assert.ok(report.Types.every(type => type.Completed === 3), sequence);
      assert.deepEqual(report.Order, { Sequence: sequence, Total: total, Completed: total, Done: true, Makespan: report.Time });
      assert.ok(report.Time < report.Duration);
    }
  });
}

// ---------------------------------------------------------------------
// L6. Partii järjest (originaal.md 7, II.2): sissetoomise järjekord tüüpide kaupa Priority järgi.
// ---------------------------------------------------------------------
test('L6: Partii järjest – tüübid partii kaupa Priority järjekorras; Time-režiimis ringiratast', () => {
  const model = ReadModel('demo.fms.json');
  model.Workpieces[0].Priority = 2;   // Äärik (prioriteet 1) enne Võlli
  model.Workpieces[0].Batch = 3;
  model.Workpieces[1].Batch = 2;
  const { State: state } = Run(model, { OrderSequence: 'Batch', Duration: 7200 });
  const types = state.SysWPArray.slice(0, 10).map(workpiece => workpiece.Type);
  assert.deepEqual(types, [1, 1, 0, 0, 0, 1, 1, 0, 0, 0]);
  const order = Run(model, { EndMode: 'Order', OrderSequence: 'Batch', Duration: 7200 }).State;
  assert.deepEqual(order.SysWPArray.map(workpiece => workpiece.Type), [1, 1, 0, 0, 0]);
  // Segamini: kõige vähem sisse toodud tüüp, viigi korral esimene (nagu enne)
  const mixed = Run(model, { EndMode: 'Order', Duration: 7200 }).State;
  assert.deepEqual(mixed.SysWPArray.map(workpiece => workpiece.Type), [0, 1, 0, 1, 0]);
});

test('L7: partii 0 – tüüpi ei tooda (kõigis režiimides); CheckModel lubab 0, keelab tundmatu režiimi', () => {
  const model = ReadModel('demo.fms.json');
  model.Workpieces[1].Batch = 0;
  for (const sim of [{}, { OrderSequence: 'Batch' }, { EndMode: 'Order' }]) {
    const { Report: report } = Run(model, { Duration: 3600, ...sim });
    assert.equal(report.Types[1].Started, 0, JSON.stringify(sim));
    assert.ok(report.Types[0].Started > 0);
  }
  const wrong = WithSim(model, { EndMode: 'Forever', OrderSequence: 'Random' });
  assert.deepEqual(CheckModel(wrong).map(error => error.Path), ['Sim.EndMode', 'Sim.OrderSequence']);
  model.Workpieces[1].Batch = -1;
  assert.deepEqual(CheckModel(model).map(error => error.Path), ['Workpieces[2].Batch']);
});

// ---------------------------------------------------------------------
// L8. Ülempiir: lõpetamine kestab kuni veel ühe T (kokku 2T), siis „katkes“.
// ---------------------------------------------------------------------
test('L8: Tehas tühjaks, T = 600 – ülempiir 2T, süsteemi jääb detaile', () => {
  const report = Run(ReadModel('demo.fms.json'), { EndMode: 'Drain', Duration: 600 }).Report;
  assert.equal(report.Time, 1200);
  assert.equal(report.Ending.Capped, true);
  assert.ok(report.Ending.LeftInSystem > 0);
  assert.equal(report.Ending.LeftInSystem, report.InSystem);
});

// ---------------------------------------------------------------------
// L9. Partii järjest vähendab häälestust (Allhanketehas, tellimus 4 tk tüübist, 5 seemet).
//   Treipingid vahetavad perekonda harvem; makespan on aga pikem (VALIDEERIMINE.md 11d leid).
// ---------------------------------------------------------------------
test('L9: Allhanketehas – Partii järjest: treipinkide häälestus väiksem kui Segamini', () => {
  const model = ReadModel('allhange.fms.json');
  for (const seed of [1, 2, 3, 4, 5]) {
    const setup = {};
    for (const sequence of ['Mixed', 'Batch']) {
      const report = Run(model, { EndMode: 'Order', OrderSequence: sequence, Seed: seed }, 4, {}).Report;
      assert.equal(report.Order.Done, true, `${sequence} seeme ${seed}`);
      const lathes = report.Machines.filter(machine => machine.Name.startsWith('TR'));
      setup[sequence] = lathes.reduce((sum, machine) => sum + machine.StateTime.SETUP, 0);
    }
    assert.ok(setup.Batch < setup.Mixed * 0.6, `seeme ${seed}: ${setup.Batch} vs ${setup.Mixed}`);
  }
});

// ---------------------------------------------------------------------
// L10. Samm-sammult (animaator) on sama mis SimRun – lõpetamisega režiim.
// ---------------------------------------------------------------------
test('L10: lõpetamine samm-sammult (nagu animaatoris) on sama mis SimRun-iga; ENDING pärast T', () => {
  const network = NetworkOf(WithSim(ReadModel('agv.fms.json'), { EndMode: 'Ship', Duration: 3600 }));
  const run = SimRun(network);
  SimInit(network);
  let endingSeen = false;
  while (!SimState().SIMULATION_DONE) {
    SimStep();
    if (SimState().ENDING) {
      endingSeen = true;
      assert.ok(SimState().SYSTEM_TIME >= 3600);
    }
  }
  assert.ok(endingSeen);
  assert.deepEqual(SimReport(), run);
});

// ---------------------------------------------------------------------
// L11. Liides: Model data vorm, kokkuvõte (EGA-s ≤ 19 rida), Static ja Dynamic aruanne.
// ---------------------------------------------------------------------
test('L11: redaktor – lõpurežiim ja tüüpide järjekord vormist mudelisse (CheckModel)', async () => {
  const { SubmitModelForm } = await import('../v1/src/fms_ed_data.js');
  const { Texts: Lng } = await import('../core/fms_lng.js');
  const { END_MODES, ORDER_SEQUENCES } = await import('../core/fms_glb.js');
  // nimed mahuvad EGA vormi (≤ 20 märki)
  for (const name of [...Object.values(Lng.FormEndModes), ...Object.values(Lng.FormOrderSequences)]) assert.ok(Array.from(name).length <= 20, name);
  assert.deepEqual(Object.keys(Lng.FormEndModes), END_MODES);
  // vormi vihjed mahuvad EGA dialoogi (kõige pikem vana rida on 74 märki)
  for (const line of [...Lng.FormModelHint, ...Lng.FormWorkpieceHint]) assert.ok(Array.from(line).length <= 74, line);
  const model = ReadModel('demo.fms.json');
  const fields = [
    { Key: 'EndMode', Kind: 'Choice', Values: END_MODES, Value: 4, Path: 'Sim.EndMode' },
    { Key: 'OrderSequence', Kind: 'Choice', Values: ORDER_SEQUENCES, Value: 1, Path: 'Sim.OrderSequence' },
  ];
  const apply = (target, values) => { target.Sim.EndMode = values.EndMode; target.Sim.OrderSequence = values.OrderSequence; };
  assert.deepEqual(SubmitModelForm(model, fields, apply, ['Sim'], null), []);
  assert.deepEqual([model.Sim.EndMode, model.Sim.OrderSequence], ['Order', 'Batch']);
  const batch = [{ Key: 'Batch', Kind: 'Number', Text: '0', Path: 'Workpieces[1].Batch' }];
  assert.deepEqual(SubmitModelForm(model, batch, (target, values) => { target.Workpieces[0].Batch = values.Batch; }, ['Workpieces[1].Batch'], null), []);
  assert.equal(model.Workpieces[0].Batch, 0);
});

test('L12: kokkuvõte ja aruanne – lõpetamise ja tellimuse read; suures mudelis mahub EGA-sse', async () => {
  const { SimSummaryLines, StaticReport, DynamicReport, KeepReport, LineText, REPORT_WIDTH } = await import('../v1/src/fms_rep.js');
  const EGA_LINES = 19;
  const text = lines => lines.map(line => (typeof line === 'string' ? line : LineText(line)));
  // A: rida pole (nagu enne)
  const time = Run(ReadModel('demo.fms.json'), {}).Report;
  assert.ok(!text(SimSummaryLines(time, [])).some(line => line.startsWith('Lõpp') || line.startsWith('Tellimus')));
  // B–D suures mudelis
  for (const mode of ['FinishOps', 'Ship', 'Drain']) {
    const model = WithSim(ReadModel('allhange.fms.json'), { EndMode: 'Time' });
    const { Report: report } = Run(model, { EndMode: mode }, undefined, {});
    const lines = text(SimSummaryLines(report, [], EGA_LINES));
    assert.ok(lines.length <= EGA_LINES, `${mode}: ${lines.length}`);
    assert.ok(lines.some(line => line.startsWith('Lõpp „') && line.includes(`lisaks valmis ${report.Ending.CompletedAfter}`)), mode);
    // uued read mahuvad EGA dialoogi (kuni 70 märki ka pikima nimega ja suurte arvudega)
    const worst = { ...report, Time: 57599, Ending: { ...report.Ending, Duration: 28799, CompletedAfter: 999, LeftInSystem: 999 } };
    for (const capped of [false, true]) {
      for (const line of text(SimSummaryLines({ ...worst, Ending: { ...worst.Ending, Capped: capped } }, []))) {
        if (/^(Lõpp|Läbilaskevõime|Tellimus)/.test(line)) assert.ok(Array.from(line).length <= 70, line);
      }
    }
    assert.ok(lines.some(line => line.startsWith('Läbilaskevõime 0…8:00:00')), mode);
  }
  // E: tellimus; Static ja Dynamic
  const model = WithSim(ReadModel('demo.fms.json'), { EndMode: 'Order', OrderSequence: 'Batch' }, 2);
  const network = NetworkOf(model);
  const report = SimRun(network, CHECKED);
  const summary = text(SimSummaryLines(report, []));
  assert.ok(summary.includes(`Tellimus (Partii järjest) täidetud: 4 / 4, aeg ${ClockOf(report.Time)}`), summary.join('\n'));
  const last = KeepReport(report, SimState(), JSON.stringify(model), 'test.fms.json');
  const staticText = text(StaticReport(model, network, last));
  assert.ok(staticText.includes('  Lõpp: Partiid lõpuni – tellimus 4 tk, kestus on ülempiir'));
  assert.ok(staticText.includes('  Tüüpide järjekord: Partii järjest'));
  assert.ok(staticText.some(line => line.includes('tellimus täidetud')));
  const dynamicText = text(DynamicReport(last, model));
  assert.ok(dynamicText.some(line => line.startsWith('  Tellimus (Partii järjest): valmis 4 / 4,')));
  assert.ok(dynamicText.includes(`    täitmise aeg (makespan) ${ClockOf(report.Time)}`));
  // D: Dynamic läbilaskevõime perioodi järgi + lõpetamise rida
  const drainModel = WithSim(ReadModel('demo.fms.json'), { EndMode: 'Drain' });
  const drainNetwork = NetworkOf(drainModel);
  const drain = SimRun(drainNetwork, CHECKED);
  const drainLast = KeepReport(drain, SimState(), JSON.stringify(drainModel), 'test.fms.json');
  const drainText = text(DynamicReport(drainLast, drainModel, ['Cycle']));
  assert.ok(drainText.some(line => line.includes(`perioodil 0…8:00:00 (valmis ${drain.Ending.PeriodCompleted});`)));
  assert.ok(drainText.some(line => line.startsWith('  Lõpetamine (Tehas tühjaks): kestis')));
  assert.ok(text(StaticReport(drainModel, drainNetwork, drainLast)).some(line => line.includes('– lõpuni')));
  // read mahuvad REPORT_WIDTH-i ka pikima režiiminimega ja suurte arvudega (Allhanketehas, kõik režiimid)
  for (const sim of [{ EndMode: 'FinishOps' }, { EndMode: 'Ship', Duration: 3600 }, { EndMode: 'Drain', Duration: 600 }, { EndMode: 'Order' },
                     { EndMode: 'Order', Duration: 3600, OrderSequence: 'Mixed' }]) {
    const big = WithSim(ReadModel('allhange.fms.json'), sim);
    const bigNetwork = NetworkOf(big);
    const bigLast = KeepReport(SimRun(bigNetwork), SimState(), JSON.stringify(big), 'test.fms.json');
    const all = [...text(StaticReport(big, bigNetwork, bigLast)), ...text(DynamicReport(bigLast, big))];
    assert.deepEqual(all.filter(line => Array.from(line).length > REPORT_WIDTH), [], JSON.stringify(sim));
  }
});

// h:mm:ss nagu ClockText
const ClockOf = seconds => `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

// ---------------------------------------------------------------------
// L13. Allhanketehas on 1.4-s tellimus (Order, Partii järjest, 4 tk tüübist). Kellani + Segamini
//   annab 1.3 tulemuse (VALIDEERIMINE.md 11c: seeme 1 – 108 detaili, 13,5 tk/h).
// ---------------------------------------------------------------------
test('L13: Allhanketehas – näidis on tellimus; Kellani + Segamini annab 11c tulemuse', () => {
  const model = ReadModel('allhange.fms.json');
  assert.deepEqual([model.Sim.EndMode, model.Sim.OrderSequence], ['Order', 'Batch']);
  const order = Run(model, {}, undefined, {}).Report;
  assert.equal(order.Order.Done, true);
  assert.equal(order.Order.Total, 48);
  const old = Run(model, { EndMode: 'Time', OrderSequence: 'Mixed' }, undefined, {}).Report;
  assert.equal(old.Completed, 108);
  assert.equal(old.ThroughputPerHour, 13.5);
});
