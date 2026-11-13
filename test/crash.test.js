// FMSS – rikked ja juhuslikkus (etapp 8): tööpingi rike (Crash), remont (Repair), praak,
// kestuse jaotused (Sim.Distribution). Käivitamine: npm test.
// Simulatsioonid kontrollivad invariante igal sekundil. VALIDEERIMINE.md etapp 8.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CheckModel } from '../src/fms_glb.js';
import { Enumerate, SimRun } from '../src/fms_sim.js';

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

// ---------------------------------------------------------------------
// H – avatud konveier (nagu network.test.js H1): rida y = 3, 900 cm, 20 cm/s, üks alus.
//   FromCS 150, BUF1 (MT1, 300 s) 350, BUF2 (MT2, 200 s) 550, SysOut 750.
//   Alus on igas jaamas iga 45 s järel, kui ta vahepeal ei peatu.
// ---------------------------------------------------------------------
function LayoutH({ MT1 = {}, MT2 = {}, Kl = 0.1, Duration = 1500, Dev = 0, Distribution } = {}) {
  return {
    Meta: { Name: 'H – avatud konveier, rike', Version: 1 },
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
    Machines: [Machine('MT1', ['treimine'], MT1), Machine('MT2', ['freesimine'], MT2)],
    Buffers: [Buffer(), Buffer()],
    Storage: null,
    Workpieces: [{ Name: 'Võll', Priority: 1, Batch: 1,
                   Routes: [{ Priority: 1, Ops: [OneOp('treimine', 300, Dev), OneOp('freesimine', 200, Dev)] }] }],
    Sim: { Seed: 1, Duration, Kl, StallTime: 600, ...(Distribution ? { Distribution } : {}) },
  };
}

// ---------------------------------------------------------------------
// R0. Rikete väljad puuduvad või on 0 – tulemus on sama mis enne (vanad mudelid).
// ---------------------------------------------------------------------
test('R0: CrashMean = 0 või väli puudub – aruanne sama, rikkeid ega praaki pole', () => {
  const demo = ReadModel('demo.fms.json');
  const plain = SimRun(NetworkOf(demo), CHECKED);
  const zero = structuredClone(demo);
  zero.Machines.forEach(machine => Object.assign(machine, { CrashMean: 0, RepairMean: 300, RepairDev: 60 }));
  zero.Sim.Distribution = 'Uniform';
  const report = SimRun(NetworkOf(zero), CHECKED);
  assert.deepEqual(report.Finished, plain.Finished);
  assert.equal(report.Crashes, 0);
  assert.equal(report.Scrapped, 0);
  assert.ok(report.Machines.every(machine => machine.DownShare === 0));
});

// ---------------------------------------------------------------------
// R1. Käsitsi arvutatud: MT1 läheb rikki pärast 100 s töötlemist, remont 120 s.
//   t=48    WP0 MT1-s, töötlemine algab (H1); TimeToCrash 100 ≤ 300 -> Crash t=148
//   t=148   rike: WP0 praak, BUF2 broneering (ReserveNextBeforeStart) vabaneb; Repair t=268
//   t=268   remont läbi, praak puhvrisse -> t=278; OutSys -> SysOut (praak alati SysOut-i)
//   alus on BUF1-s t = 38 + 45k -> t=308 peale, t=318 sõidab; 400 cm = 20 s -> t=338 SysOut,
//   maha -> t=348: praak lahkub. MT1 olek: DOWN 120 s, PROCESSING 100 s.
// ---------------------------------------------------------------------
test('R1: rike töötlemise ajal – praak, remont ja väljasaatmine klapivad käsitsi arvutusega', () => {
  const network = NetworkOf(LayoutH({ MT1: { CrashMean: 0, RepairMean: 120, RepairDev: 0 }, Duration: 347 }));
  const before = SimRun(network, { ...CHECKED, CrashAfter: [[100]] });
  assert.equal(before.Scrapped, 0, 't=347 praak on veel rajal');
  assert.equal(before.InSystem, 1);
  const report = SimRun({ ...network, Sim: { ...network.Sim, Duration: 348 } }, { ...CHECKED, CrashAfter: [[100]] });
  assert.equal(report.Crashes, 1);
  assert.equal(report.Scrapped, 1);
  assert.equal(report.Completed, 0);
  assert.equal(report.Types[0].Scrapped, 1);
  const mt1 = report.Machines[0];
  assert.equal(mt1.Crashes, 1);
  assert.equal(mt1.StateTime.DOWN, 120);
  assert.equal(mt1.StateTime.PROCESSING, 100);
  assert.equal(mt1.OpsDone, 0);
  assert.equal(report.Machines[1].StateTime.PROCESSING ?? 0, 0, 'MT2 ei saanud praaki');
});

// R2. Pärast remonti töötab pink edasi (jätk R1-le). Praak lahkus t=348, alus seisab SysOut-is;
//   WP1 tuleb t=348 (Kl 0,1). Alus: 300 cm FromCS-i -> t=363 peale -> t=373; t=383 BUF1, maha -> t=393
//   t=403   MT1-s, töötlemine 300 s -> t=703, puhvrisse -> t=713
//   alus on BUF1-s t = 393 + 45k -> t=753 peale -> t=763; t=773 BUF2, maha -> t=783
//   t=793   MT2-s, 200 s -> t=993, puhvrisse -> t=1003; alus BUF2-s t = 783 + 45k -> t=1008 peale
//   -> t=1018; t=1028 SysOut, maha -> t=1038. Tsükliaeg 1038 − 348 = 690 s.
test('R2: pärast remonti on pink jälle kasutusel – järgmise detaili ajad käsitsi (TimeOut 1038)', () => {
  const network = NetworkOf(LayoutH({ MT1: { RepairMean: 120 }, Duration: 1040 }));
  const report = SimRun(network, { ...CHECKED, CrashAfter: [[100]] });
  assert.equal(report.Scrapped, 1);
  assert.equal(report.Completed, 1);
  const first = report.Finished[0];
  assert.deepEqual([first.Id, first.TimeIn, first.TimeOut], [1, 348, 1038]);
  assert.equal(first.Times.Process, 500);
  assert.equal(report.Machines[0].OpsDone, 1);
});

// R3. Rike teise operatsiooni pingis (MT2 pärast 50 s, remont 60 s); MT1 töö (300 s) läheb kaotsi.
//   t=438   WP0 MT2-s (H1), töötlemine algab -> Crash t=488; Repair t=548; puhvrisse -> t=558
//   alus on BUF2-s t = 428 + 45k -> t=563 peale -> t=573; t=583 SysOut, maha -> t=593.
test('R3: rike MT2-s – praak lahkub BUF2-st t=593, MT1 tehtud töö on praagi sees', () => {
  const network = NetworkOf(LayoutH({ MT2: { RepairMean: 60 }, Duration: 592 }));
  const before = SimRun(network, { ...CHECKED, CrashAfter: [[], [50]] });
  assert.equal(before.Scrapped, 0);
  const report = SimRun({ ...network, Sim: { ...network.Sim, Duration: 593 } }, { ...CHECKED, CrashAfter: [[], [50]] });
  assert.equal(report.Scrapped, 1);
  assert.equal(report.Machines[0].OpsDone, 1);
  assert.equal(report.Machines[1].OpsDone, 0);
  assert.equal(report.Machines[1].StateTime.DOWN, 60);
  assert.equal(report.Machines[1].StateTime.PROCESSING, 50);
});

// ---------------------------------------------------------------------
// R4. Pikk jooks: rikete arv vastab töötlemisajale (Poissoni protsess), remondiaeg täpselt.
//   Rikke kell käib ainult töötlemise ajal: rikkeid ≈ töötlemisaeg / CrashMean (± 4σ, σ = √n).
//   Remont Dev 0: DOWN aeg = rikked × RepairMean (viimane remont võib pooleli olla).
// ---------------------------------------------------------------------
test('R4: rikkeid töötlemisaja kohta nagu eksponentjaotusel, remondiaeg = rikked × keskmine', () => {
  const model = LayoutH({ MT1: { CrashMean: 1500, RepairMean: 200 }, MT2: { CrashMean: 1000, RepairMean: 100 },
                          Kl: 0.85, Duration: 200 * 3600 });
  model.Tracks[0].Carts = 3;
  const report = SimRun(NetworkOf(model), CHECKED);
  assert.equal(report.Deadlock, false);
  for (const [index, mean, repair] of [[0, 1500, 200], [1, 1000, 100]]) {
    const machine = report.Machines[index];
    const expected = machine.StateTime.PROCESSING / mean;
    assert.ok(Math.abs(machine.Crashes - expected) < 4 * Math.sqrt(expected),
      `${machine.Name}: rikkeid ${machine.Crashes}, oodatud ${expected.toFixed(1)}`);
    const down = machine.StateTime.DOWN;
    assert.ok(down <= machine.Crashes * repair && down > (machine.Crashes - 1) * repair, `${machine.Name}: DOWN ${down}`);
  }
  assert.equal(report.Created, report.Completed + report.Scrapped + report.InSystem);
  assert.ok(report.Scrapped <= report.Crashes && report.Scrapped >= report.Crashes - 2);
});

// R5. Korratavus: sama seeme sama tulemus ka riketega (eraldi juhuarvujada pingi kohta).
test('R5: korratavus riketega – sama seeme sama tulemus, teine seeme erinev', () => {
  const model = LayoutH({ MT1: { CrashMean: 2000, RepairMean: 300, RepairDev: 100 }, Kl: 0.85, Duration: 8 * 3600, Dev: 50 });
  model.Tracks[0].Carts = 3;
  const network = NetworkOf(model);
  assert.deepEqual(SimRun(network, CHECKED).Finished, SimRun(network, CHECKED).Finished);
  const other = SimRun({ ...network, Sim: { ...network.Sim, Seed: 2 } }, CHECKED);
  assert.notDeepEqual(other.Finished, SimRun(network, CHECKED).Finished);
});

// ---------------------------------------------------------------------
// R6. Stsenaariumid koormusega: näidis-PTS ja Näidis-AGV riketega, 5 seemet –
//   ummiku valehäireid ega invariandi vigu pole.
// ---------------------------------------------------------------------
for (const name of ['demo.fms.json', 'agv.fms.json']) {
  test(`R6: ${name} riketega, 5 seemet – 8 h ilma ummikuta`, () => {
    const model = ReadModel(name);
    model.Machines.forEach(machine => Object.assign(machine, { CrashMean: 3600, RepairMean: 600, RepairDev: 200 }));
    for (let seed = 1; seed <= 5; seed++) {
      model.Sim.Seed = seed;
      const report = SimRun(NetworkOf(model), CHECKED);
      assert.equal(report.Deadlock, false, `seeme ${seed}: ${report.DeadlockReason}`);
      assert.ok(report.Crashes > 0 && report.Completed > 0, `seeme ${seed}`);
      assert.equal(report.Created, report.Completed + report.Scrapped + report.InSystem);
    }
  });
}

// ---------------------------------------------------------------------
// R7. Kestuse jaotused: töötlemisaja keskmine ja dispersioon vastavad teooriale.
//   Mean 300, Dev 90: Uniform σ² = Dev²/3 = 2700, Triangular Dev²/6 = 1350,
//   Normal (σ = Dev, lõigatud ± 3σ) σ² ≈ 0,9733 · Dev² = 7884. Ümardamine lisab 1/12.
// ---------------------------------------------------------------------
for (const [distribution, variance] of [['Uniform', 2700], ['Triangular', 1350], ['Normal', 7884]]) {
  test(`R7: ${distribution} – keskmine ja dispersioon klapivad`, () => {
    const model = LayoutH({ Kl: 0.85, Duration: 150 * 3600, Distribution: distribution });
    model.Tracks[0].Carts = 3;
    model.Workpieces[0].Routes[0].Ops = [OneOp('treimine', 300, 90)];
    const report = SimRun(NetworkOf(model), {});
    const samples = report.Finished.map(item => item.Times.Process);
    const n = samples.length;
    const mean = samples.reduce((sum, value) => sum + value, 0) / n;
    const sampleVariance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1);
    assert.ok(n > 1000, `valimeid ${n}`);
    assert.ok(Math.abs(mean - 300) < 4 * Math.sqrt(variance / n), `${distribution}: keskmine ${mean.toFixed(1)}`);
    assert.ok(Math.abs(sampleVariance / variance - 1) < 0.12, `${distribution}: dispersioon ${sampleVariance.toFixed(0)}`);
    assert.ok(Math.min(...samples) >= 300 - (distribution === 'Normal' ? 270 : 90));
    assert.ok(Math.max(...samples) <= 300 + (distribution === 'Normal' ? 270 : 90));
  });
}

// ---------------------------------------------------------------------
// R8. Andmekontroll.
// ---------------------------------------------------------------------
test('R8: CheckModel – rikke väljad ja jaotus', () => {
  const model = LayoutH({ MT1: { CrashMean: -1, RepairMean: 10, RepairDev: 20 }, Distribution: 'Gauss' });
  const paths = CheckModel(model).map(error => error.Path);
  assert.deepEqual(paths.sort(), ['Machines[1].CrashMean', 'Machines[1].RepairDev', 'Sim.Distribution']);
});

// R9. Redaktor: pingi vormi rikke väljad lähevad läbi sama kontrolli (SubmitModelForm + CheckModel).
test('R9: redaktor – pingi rikke väljad ja jaotus vormist mudelisse', async () => {
  const { SubmitModelForm } = await import('../src/fms_ed_data.js');
  const model = LayoutH();
  const fields = (crash, repair, dev) => [
    { Key: 'CrashMean', Label: 'Rikete vahe, s', Kind: 'Number', Text: crash, Path: 'Machines[1].CrashMean' },
    { Key: 'RepairMean', Label: 'Remont, s', Kind: 'Number', Text: repair, Path: 'Machines[1].RepairMean' },
    { Key: 'RepairDev', Label: 'Remont ±, s', Kind: 'Number', Text: dev, Path: 'Machines[1].RepairDev' },
  ];
  const apply = (target, values) => Object.assign(target.Machines[0], values);
  const errors = SubmitModelForm(model, fields('3600', '300', '400'), apply, ['Machines[1]'], null);
  assert.deepEqual(errors.map(error => error.Key), ['RepairDev']);
  assert.equal(model.Machines[0].CrashMean, undefined, 'vigane vorm mudelit ei muuda');
  assert.deepEqual(SubmitModelForm(model, fields('3600', '300', '60'), apply, ['Machines[1]'], null), []);
  assert.deepEqual([model.Machines[0].CrashMean, model.Machines[0].RepairMean, model.Machines[0].RepairDev], [3600, 300, 60]);
  const distribution = [{ Key: 'Distribution', Label: 'Kõrvalekalle', Kind: 'Choice', Choices: ['ühtlane', 'kolmnurkne', 'normaalne'],
                          Values: ['Uniform', 'Triangular', 'Normal'], Value: 2, Path: 'Sim.Distribution' }];
  assert.deepEqual(SubmitModelForm(model, distribution, (target, values) => { target.Sim.Distribution = values.Distribution; }, ['Sim'], null), []);
  assert.equal(model.Sim.Distribution, 'Normal');
  assert.equal(SimRun(NetworkOf(model), CHECKED).Deadlock, false);
});
