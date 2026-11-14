// FMSS – aruanded (etapp 9): Static (algne seis ja lõppseis), Dynamic (tsükliaeg ja osakaalud,
// tüüpide kaupa, aegrida, sündmused), tekstifail. Käivitamine: npm test.
// Kontroll: aruande arvud klapivad SimReport-i ja simulaatori olekuga; stsenaarium A käsitsi
// arvutatud (tsükliaeg 440 s ja selle osad). VALIDEERIMINE.md etapp 9.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CheckModel } from '../core/fms_glb.js';
import { Enumerate, SimRun, SimInit, SimStep, SimState, SimReport } from '../core/fms_sim.js';
import {
  KeepReport, StaticReport, DynamicReport, ReportText, ReportFileName, CaptureEndState, CycleStats,
  TimelineStep, TimelineRows, LineText, REPORT_WIDTH, STATIC_TOPICS, DYNAMIC_TOPICS,
  SimSummaryLines,
} from '../v1/src/fms_rep.js';
import { ClockText } from '../v1/src/anima.js';
import { ScenarioA } from './proto/scenarios.js';

const ROOT = new URL('../', import.meta.url);
const ReadModel = name => JSON.parse(readFileSync(new URL(`models/${name}`, ROOT), 'utf8'));
const CHECKED = { CheckInvariants: true };
const DOT = { Dot: true };
const Cells = rows => rows.map(([X, Y, T, N, extra]) => ({ X, Y, T, ...(N !== undefined && N !== null ? { N } : {}), ...extra }));

function NetworkOf(model) {
  assert.deepEqual(CheckModel(model), [], 'CheckModel');
  const result = Enumerate(model);
  assert.deepEqual(result.Errors, [], 'Enumerate');
  return result.Network;
}

// Simulatsioon lõpuni ja tulemus meelde nagu Simulate-is (fms.js).
function Simulate(model, fileName = 'test.fms.json') {
  const network = NetworkOf(model);
  const report = SimRun(network, CHECKED);
  return { Model: model, Network: network, Report: report, Last: KeepReport(report, SimState(), JSON.stringify(model), fileName) };
}

const Texts = lines => lines.map(LineText);
// Tabeli read pärast päist ja joont kuni tühja reani; veerud on eraldatud vähemalt kahe tühikuga.
function TableAfter(lines, title, header) {
  const texts = Texts(lines);
  const start = texts.indexOf(title);
  assert.ok(start >= 0, `pealkiri ${title}`);
  const head = texts.findIndex((text, i) => i > start && text.trim().startsWith(header));
  assert.ok(head > start, `tabeli päis ${header}`);
  const rows = [];
  for (let i = head + 2; i < texts.length && texts[i].trim() !== '' && typeof lines[i] === 'string'; i++) {
    rows.push(texts[i].trim().split(/ {2,}/));
  }
  return rows;
}
const Number_ = text => parseFloat(String(text).replace(',', '.'));
const TIMELINE_ROW = /^\s*(\d+:\d\d:\d\d)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/;

// Stsenaarium A (üks tööpink, sama mis test/sim.test.js): konveier 2000 cm, FromCS 0, BUF1 500, SysOut 1000.
function LayoutA({ Kl = 0.85, Duration = 28800 } = {}) {
  const scenario = ScenarioA({ Kl, Duration });
  const { Length, ...track } = scenario.Tracks[0];
  return {
    Meta: { Name: 'A – üks tööpink', Version: 1 },
    Scale: 100,
    Layout: {
      Dim: { X: 7, Y: 7 },
      Cells: Cells([
        [3, 0, 'MachToolDown', 1], [3, 1, 'InOutBuf', 1], [3, 2, 'VertTr', null, DOT],
        [0, 3, 'ArcSE', 1], [1, 3, 'HorTr', 1, { Dir: 'E' }], [2, 3, 'HorTr', 1], [3, 3, 'TeeN', 1],
        [4, 3, 'HorTr', 1], [5, 3, 'HorTr', 1], [6, 3, 'ArcSW', 1],
        [0, 4, 'ArcNE', 1], [1, 4, 'TeeS', 1], [2, 4, 'HorTr', 1], [3, 4, 'HorTr', 1],
        [4, 4, 'HorTr', 1], [5, 4, 'TeeS', 1], [6, 4, 'ArcNW', 1],
        [1, 5, 'VertTr', null, DOT], [5, 5, 'VertTr', null, DOT], [1, 6, 'FromCS'], [5, 6, 'SysOut'],
      ]),
    },
    EdgeLengths: [
      { Cells: [[0, 4], [0, 3], [1, 3], [2, 3]], Length: 500 },
      { Cells: [[4, 3], [5, 3], [6, 3], [6, 4]], Length: 500 },
      { Cells: [[4, 4], [3, 4], [2, 4]], Length: 1000 },
    ],
    Tracks: [{ ...track, AccessTime: 0 }],
    Machines: [{ Name: 'MT1', Model: '', LoadTime: 10, SetupTime: 0, Ops: ['treimine'] }],
    Buffers: [{ Capacity: 2, Discipline: 'FIFO', LoadTime: 5 }],
    Storage: null,
    Workpieces: scenario.Workpieces,
    Sim: { ...scenario.Sim },
  };
}

// Stsenaarium C0 (ristmarsruudid ilma kesklaota, sama mis test/sim.test.js) – ummik.
function LayoutC0() {
  return {
    Meta: { Name: 'C0 – ummik', Version: 1 },
    Scale: 100,
    Layout: {
      Dim: { X: 8, Y: 7 },
      Cells: Cells([
        [2, 0, 'MachToolDown', 1], [4, 0, 'MachToolDown', 2], [2, 1, 'InOutBuf', 1], [4, 1, 'InOutBuf', 2],
        [2, 2, 'VertTr', null, DOT], [4, 2, 'VertTr', null, DOT],
        [0, 3, 'ArcSE', 1], [1, 3, 'HorTr', 1, { Dir: 'E' }], [2, 3, 'TeeN', 1], [3, 3, 'HorTr', 1], [4, 3, 'TeeN', 1],
        [5, 3, 'HorTr', 1], [6, 3, 'HorTr', 1], [7, 3, 'ArcSW', 1],
        [0, 4, 'ArcNE', 1], [1, 4, 'TeeS', 1], [2, 4, 'HorTr', 1], [3, 4, 'HorTr', 1], [4, 4, 'HorTr', 1],
        [5, 4, 'HorTr', 1], [6, 4, 'TeeS', 1], [7, 4, 'ArcNW', 1],
        [1, 5, 'VertTr', null, DOT], [6, 5, 'VertTr', null, DOT], [1, 6, 'FromCS'], [6, 6, 'SysOut'],
      ]),
    },
    EdgeLengths: [],
    Tracks: [{ Name: 'Konveier', Mode: 'Continuous', Carts: 3, PlacesPerCart: 1, Speed: 20, LoadTime: 10, AccessTime: 0 }],
    Machines: [
      { Name: 'MT1', Model: '', LoadTime: 10, SetupTime: 0, Ops: ['treimine'] },
      { Name: 'MT2', Model: '', LoadTime: 10, SetupTime: 0, Ops: ['freesimine'] },
    ],
    Buffers: [{ Capacity: 1, Discipline: 'FIFO', LoadTime: 5 }, { Capacity: 1, Discipline: 'FIFO', LoadTime: 5 }],
    Storage: null,
    Workpieces: [
      { Name: 'A', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [{ Op: 'treimine', Mean: 200, Dev: 0 }, { Op: 'freesimine', Mean: 200, Dev: 0 }] }] },
      { Name: 'B', Priority: 1, Batch: 1, Routes: [{ Priority: 1, Ops: [{ Op: 'freesimine', Mean: 200, Dev: 0 }, { Op: 'treimine', Mean: 200, Dev: 0 }] }] },
    ],
    Sim: { Seed: 1, Duration: 28800, Kl: 0.85, StallTime: 600 },
  };
}

function DemoWithCrashes() {
  const demo = ReadModel('demo.fms.json');
  demo.Machines.forEach(machine => Object.assign(machine, { CrashMean: 3000, RepairMean: 300, RepairDev: 60 }));
  return demo;
}

// ---------------------------------------------------------------------
// P1. Käsitsi arvutatud (stsenaarium A1, VALIDEERIMINE.md etapp 2): üks detail korraga.
//   ootab FromCS-is 0–25, peale 25–35, sõidab 35–60, maha puhvrisse 60–70, pinki 70–80,
//   töötleb 80–380, puhvrisse 380–390, ootab alust 390–395, peale 395–405, sõidab 405–430,
//   maha SysOut-is 430–440.
//   Tm = 300, Tturn = 0, Tload = 6 × 10 = 60, Ttrans = 25 + 25 = 50, Twait = 25 + 5 = 30; Tts = 440.
//   Osakaalud: 300/440 = 68 %, 60/440 = 14 %, 50/440 = 11 %, 30/440 = 7 %.
// ---------------------------------------------------------------------
test('P1: käsitsi arvutatud tsükliaeg 440 s ja selle osad aruandes (A1)', () => {
  const { Report: report, Last: last, Model: model } = Simulate(LayoutA({ Kl: 0.1, Duration: 1000 }));
  const first = report.Finished[0];
  assert.equal(first.TimeOut - first.TimeIn, 440);
  assert.deepEqual(first.Times, { Process: 300, Setup: 0, Load: 60, Transport: 50, Wait: 30 });

  const one = { ...last, Report: { ...report, Finished: [first], Shares: Object.fromEntries(
    Object.entries(first.Times).map(([key, value]) => [key, value / 440])) } };
  const texts = Texts(DynamicReport(one, model, ['Cycle']));
  assert.ok(texts.includes('  Tsükliaeg Tts: keskmiselt 0:07:20, lühim 0:07:20, pikim 0:07:20'));
  const rows = TableAfter(DynamicReport(one, model, ['Cycle']), 'TSÜKLIAEG JA OSAKAALUD', 'Osa');
  const byName = Object.fromEntries(rows.map(row => [row[0], row.slice(1, 3).map(Number_)]));
  assert.deepEqual(byName['töötlemine Tm'], [300, 68]);
  assert.deepEqual(byName['häälestus Tturn'], [0, 0]);
  assert.deepEqual(byName['laadimine Tload'], [60, 14]);
  assert.deepEqual(byName['transport Ttrans'], [50, 11]);
  assert.deepEqual(byName['ootamine Twait'], [30, 7]);
  assert.deepEqual(byName.kokku, [440, 100]);
  assert.ok(texts.includes('  Osakaalud: töötlemine 68 %, ootamine 7 %, transport 11 %'));
});

// ---------------------------------------------------------------------
// P2. Dynamic klapib SimReport-iga (näidismudel riketega).
// ---------------------------------------------------------------------
test('P2: Dynamic – läbilaskevõime, tsükliaeg, osakaalud, tüübid, aegrida ja sündmused = SimReport', () => {
  const { Report: report, Last: last, Model: model } = Simulate(DemoWithCrashes());
  assert.ok(report.Crashes > 0 && report.Scrapped > 0);
  const lines = DynamicReport(last, model);
  const texts = Texts(lines);
  const stats = CycleStats(report.Finished);

  // osakaalude summa on 1 (detaili aeg jaguneb täielikult osadeks)
  const shareSum = Object.values(report.Shares).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(shareSum - 1) < 1e-9, `osakaalud kokku ${shareSum}`);
  assert.ok(Math.abs(stats.Avg - report.AvgCycleTime) < 1e-9);
  const parts = Object.values(stats.AvgParts).reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(parts - stats.Avg) < 1e-6, 'osade keskmised kokku = keskmine tsükliaeg');

  const throughput = texts.find(text => text.includes('Läbilaskevõime'));
  assert.equal(Number_(throughput.match(/Läbilaskevõime ([\d,]+)/)[1]), Math.round(report.ThroughputPerHour * 10) / 10);
  assert.match(throughput, new RegExp(`valmis ${report.Completed},`));

  const shares = TableAfter(lines, 'TSÜKLIAEG JA OSAKAALUD', 'Osa');
  const keys = ['Process', 'Setup', 'Load', 'Transport', 'Wait'];
  keys.forEach((key, i) => {
    assert.equal(Number_(shares[i][1]), Math.round(stats.AvgParts[key]));
    assert.equal(Number_(shares[i][2]), Math.round(report.Shares[key] * 100));
  });

  const types = TableAfter(lines, 'TSÜKLIAEG TÜÜPIDE KAUPA', 'Tüüp');
  assert.equal(types.length, report.Types.length);
  report.Types.forEach((type, i) => assert.equal(Number(types[i][1]), type.Completed));

  // aegrida: valmis kokku igal real = Stats.Timeline, viimane rida = lõpp
  const step = TimelineStep(report.Time, 60);
  assert.equal(step, 300);
  const points = TimelineRows(report.Timeline, step);
  const timeline = TableAfter(lines, 'AEGRIDA', 'Aeg').map(row => row.join('  ').match(TIMELINE_ROW));
  assert.equal(timeline.length, points.length);
  assert.equal(timeline.length, 28800 / 300 + 1);
  let previous = 0;
  points.forEach((point, i) => {
    const row = timeline[i];
    assert.ok(row, `aegrea rida ${i}`);
    assert.equal(row[1], ClockText(point.Time));
    assert.deepEqual(row.slice(2, 8).map(Number), [point.InSystem, point.Completed, point.Completed - previous,
      point.BusyMachines, point.DownMachines, point.BufferFill.reduce((sum, value) => sum + value, 0)]);
    previous = point.Completed;
  });
  assert.equal(timeline.at(-1)[1], '8:00:00');
  assert.equal(Number(timeline.at(-1)[3]), report.Completed);
  // vahemikus valmis kokku = valmis
  assert.equal(timeline.reduce((sum, row) => sum + Number(row[4]), 0), report.Completed);

  const events = TableAfter(lines, 'SÜNDMUSED', 'Sündmus');
  assert.deepEqual(events.at(-1).slice(0, 2), ['kokku', String(report.EventCount)]);
  assert.equal(events.slice(0, -1).reduce((sum, row) => sum + Number(row[1]), 0), report.EventCount);
  assert.equal(events.find(row => row[0] === 'Crash')[1], String(report.Crashes));
});

// ---------------------------------------------------------------------
// P3. Static: lõppseis klapib simulaatori olekuga, algne seis mudeliga.
// ---------------------------------------------------------------------
test('P3: Static – lõppseis = simulaatori olek, algne seis = mudeli parameetrid', () => {
  const { Report: report, Last: last, Model: model, Network: network } = Simulate(DemoWithCrashes());
  const state = SimState();
  const end = last.End;
  // detailid asukoha ja tüübi järgi kokku = süsteemis
  assert.equal(Object.values(end.Where).reduce((sum, value) => sum + value, 0), report.InSystem);
  assert.equal(end.InSystemByType.reduce((sum, value) => sum + value, 0), report.InSystem);
  assert.equal(end.Where.FromCS, state.FromCSQueue.length
    + state.SysWPArray.filter(workpiece => workpiece.Location.Kind === 'Entering').length);
  end.Buffers.forEach((buffer, i) => assert.equal(buffer.In + buffer.Out, state.BufferArray[i].Entries.length));
  report.Types.forEach((type, i) => assert.equal(type.Started - type.Completed - type.Scrapped, end.InSystemByType[i]));

  const lines = StaticReport(model, network, last);
  const texts = Texts(lines);
  assert.ok(texts.includes(`  Detaile sisse ${report.Created}, valmis ${report.Completed}, praak ${report.Scrapped}, süsteemis ${report.InSystem}`));
  assert.ok(texts.includes('  MT1: rikete vahe keskmiselt 3000 s töötlemist, remont 300±60 s'));
  assert.ok(texts.includes(`  Rikkeid ${report.Crashes}, praak ${report.Scrapped} (SysOut-i)`));
  assert.ok(texts.includes('    marsruut 1 (prioriteet 1): treimine 240±30 → freesimine 180±20'));

  const machines = TableAfter(lines, 'TÖÖPINGID', 'Pink       Laad');
  assert.deepEqual(machines.map(row => row.slice(0, 3)), [['MT1', '20', '120'], ['MT2', '20', '90']]);
  const final = TableAfter(lines, 'Lõppseis', 'Pink       Olek');   // esimene lõppseisu pingitabel
  assert.equal(final.length, 2);
  const shares = TableAfter(lines, '  Olekute osakaalud ajast:', 'Pink');
  report.Machines.forEach((machine, i) => {
    assert.equal(Number_(shares[i][1]), Math.round(machine.Utilization * 100));
    assert.equal(Number_(shares[i][6]), Math.round(machine.DownShare * 100));
    // osakaalud kokku 100 % (rakendus + jõude + rikkes)
    assert.ok(Math.abs(machine.Utilization + machine.IdleShare + machine.DownShare - 1) < 1e-9);
  });
  const types = TableAfter(lines, 'DETAILITÜÜBID', 'Tüüp');
  report.Types.forEach((type, i) => assert.deepEqual(types[i].slice(1, 5).map(Number),
    [type.Started, type.Completed, type.Scrapped, end.InSystemByType[i]]));
  const storage = texts.find(text => text.startsWith('  Valmis detaile laos'));
  assert.equal(storage, `  Valmis detaile laos ${report.StorageCount}, pargitud ${end.Storage.Parked}; täituvus ${report.StorageCount + end.Storage.Parked}/30`);
});

// ---------------------------------------------------------------------
// P4. Ummik ja katkestatud simulatsioon: aruanne on saadaval.
// ---------------------------------------------------------------------
test('P4: ummiku ja katkestuse aruanne', () => {
  const deadlock = Simulate(LayoutC0());
  assert.equal(deadlock.Report.Deadlock, true);
  const header = DynamicReport(deadlock.Last, deadlock.Model).slice(0, 3);
  assert.match(LineText(header[1]), /^Simulatsioon: 0:02:00 \/ 8:00:00, seeme 1 – UMMIK kell 0:02:00$/);
  assert.equal(header[2].Kind, 'Warning');
  assert.match(LineText(header[2]), /^ {2}Ummiku põhjus: ringootamine/);
  const staticTexts = Texts(StaticReport(deadlock.Model, deadlock.Network, deadlock.Last));
  assert.ok(staticTexts.some(text => text.startsWith('  Aeg ') && text.includes('UMMIK')));

  // katkestus (Esc animaatoris): 10 min pärast
  const model = ReadModel('demo.fms.json');
  const network = NetworkOf(model);
  SimInit(network, CHECKED);
  for (let i = 0; i < 600; i++) SimStep();
  const report = SimReport();
  const last = KeepReport(report, SimState(), JSON.stringify(model), 'demo.fms.json');
  const texts = Texts(DynamicReport(last, model));
  assert.equal(texts[1], 'Simulatsioon: 0:10:00 / 8:00:00, seeme 1 – katkestatud kell 0:10:00');
  assert.ok(texts.includes('  Valmis detaile pole – tsükliaega ei saa arvutada.'));
  const timeline = TableAfter(DynamicReport(last, model, ['Timeline']), 'AEGRIDA', 'Aeg');
  assert.equal(timeline.length, 11);   // samm 60 s: 0 … 10 min
  assert.ok(StaticReport(model, network, last).length > 50);
});

// ---------------------------------------------------------------------
// P5. Mudel muutus pärast simulatsiooni; teemade valik; ilma simulatsioonita.
// ---------------------------------------------------------------------
test('P5: muudetud mudel, teemade valik, ilma simulatsioonita', () => {
  const { Last: last, Model: model, Network: network } = Simulate(ReadModel('demo.fms.json'));
  const changed = structuredClone(model);
  changed.Machines[0].SetupTime = 100;
  const staticTexts = Texts(StaticReport(changed, network, last));
  assert.ok(staticTexts.includes('Mudelit on pärast simulatsiooni muudetud.'));
  assert.ok(!staticTexts.includes('Lõppseis'), 'muudetud mudelil lõppseisu ei näidata');
  assert.ok(Texts(DynamicReport(last, changed)).includes('Mudelit on pärast simulatsiooni muudetud.'));
  assert.ok(!Texts(DynamicReport(last, model)).includes('Mudelit on pärast simulatsiooni muudetud.'));

  const only = StaticReport(model, network, last, ['Machines']).filter(line => line.Kind === 'Section').map(LineText);
  assert.deepEqual(only, ['TÖÖPINGID']);
  const dynamicSections = DynamicReport(last, model, ['Timeline', 'Cycle']).filter(line => line.Kind === 'Section').map(LineText);
  assert.deepEqual(dynamicSections, ['TSÜKLIAEG JA OSAKAALUD', 'AEGRIDA']);   // järjekord on alati sama

  const plain = Texts(StaticReport(model, network, null));
  assert.ok(plain.includes('Simulatsiooni pole tehtud.'));
  assert.ok(plain.includes('Algne seis') && !plain.includes('Lõppseis'));
});

// ---------------------------------------------------------------------
// P6. Kõik read mahuvad EGA aknasse; tekstifail.
// ---------------------------------------------------------------------
test('P6: read kuni REPORT_WIDTH märki (EGA), tekstifail ja failinimi', () => {
  const runs = [Simulate(DemoWithCrashes()), Simulate(ReadModel('agv.fms.json')), Simulate(LayoutC0())];
  for (const run of runs) {
    const lines = [...StaticReport(run.Model, run.Network, run.Last, STATIC_TOPICS),
      ...DynamicReport(run.Last, run.Model, DYNAMIC_TOPICS, { Header: false })];
    const long = Texts(lines).filter(text => Array.from(text).length > REPORT_WIDTH);
    assert.deepEqual(long, [], run.Model.Meta.Name);
    const text = ReportText('Aruanne', lines, '13.11.2026 12:00');
    assert.ok(text.startsWith('FMSS – Aruanne\nKoostatud 13.11.2026 12:00\n\n'));
    assert.ok(text.includes('TÖÖPINGID\n═════════\n'));
    assert.ok(text.endsWith('\n'));
  }
  assert.equal(ReportFileName('demo.fms.json', 'Näidis-PTS', 'static'), 'demo-static.txt');
  assert.equal(ReportFileName('', 'Näidis PTS', 'dynamic'), 'Näidis_PTS-dynamic.txt');
  assert.equal(TimelineStep(3600, 60), 60);
  assert.equal(TimelineStep(86400, 60), 900);
  assert.equal(TimelineStep(28800, 120), 600);
});

// ---------------------------------------------------------------------
// P7. Lõppseis samm-sammult (animaator) = SimRun.
// ---------------------------------------------------------------------
test('P7: lõppseis samm-sammult (nagu animaatoris) on sama mis SimRun-iga', () => {
  const model = ReadModel('agv.fms.json');
  const network = NetworkOf(model);
  const run = SimRun(network);
  const runEnd = CaptureEndState(SimState());
  SimInit(network);
  while (!SimState().SIMULATION_DONE) SimStep();
  assert.deepEqual(CaptureEndState(SimState()), runEnd);
  assert.deepEqual(SimReport().Types, run.Types);
});

// ---------------------------------------------------------------------
// 1.3 (etapp 11c leid 6): Simulate kokkuvõte mahub dialoogi – EGA-s 19 rida
// ---------------------------------------------------------------------
test('1.3, 1.5: kokkuvõte – suures mudelis vähem pinke ja puhvreid (ja konnektorid koondreana), et mahuks; väikeses kõik nagu enne', () => {
  const EGA_LINES = 19;   // MessageBoxMaxLines: 350 / 14 − 6
  for (const file of ['kinnitus.fms.json', 'allhange.fms.json', 'reduktor.fms.json', 'mootor.fms.json']) {
    const report = SimRun(Enumerate(ReadModel(file)).Network, {});
    const full = SimSummaryLines(report, []);
    const fitted = SimSummaryLines(report, [], EGA_LINES);
    assert.ok(full.length > EGA_LINES, `${file}: ilma piirita ${full.length} rida`);
    assert.ok(fitted.length <= EGA_LINES, `${file}: ${fitted.length} rida`);
    const shown = fitted.filter(line => typeof line === 'string' && /^  (KP|TR|HF|MT)\S*: rakendatus/.test(line)).length;
    assert.ok(shown >= 1, `${file}: vähemalt üks pink`);
    assert.ok(fitted.some(line => typeof line === 'string' && line.includes('ja veel')), `${file}: „… ja veel“`);
  }
  // 1.5: 11 konnektoriga mudelis on konnektorite kohta üks koondrida; ilma piirita kõik read nagu enne
  const engine = SimRun(Enumerate(ReadModel('mootor.fms.json')).Network, {});
  const total = engine.Connectors.reduce((sum, connector) => sum + connector.Transfers, 0);
  assert.ok(SimSummaryLines(engine, [], EGA_LINES).includes(`  konnektoreid 11, ülekandeid kokku ${total}`));
  assert.equal(SimSummaryLines(engine, []).filter(line => /^  CON\d+: ülekandeid/.test(line)).length, 11);
  for (const file of ['demo.fms.json', 'agv.fms.json']) {
    const report = SimRun(Enumerate(ReadModel(file)).Network, {});
    assert.deepEqual(SimSummaryLines(report, [], EGA_LINES), SimSummaryLines(report, []), file);
  }
});
