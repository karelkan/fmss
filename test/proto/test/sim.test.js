// FMSS prototüüp – valideerimise testid (DISAIN.md osa 9).
// Käivitamine: npm test  (või: node --test proto/test/)
// Kõik jooksud kontrollivad invariante igal sekundil (CheckInvariants: true).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SimRun } from '../fms_sim.js';
import { ScenarioA, ScenarioB, ScenarioC } from '../scenarios.js';

const CHECKED = { CheckInvariants: true };

// A1. Üks detail korraga – tsükliaeg käsitsi arvutatud:
//   t=0     InSys, detail FromCS jaamas (0 cm). Alus 0 on täpselt jaamas, aga alles startis -> ei peatu.
//   t=25    alus 3 jõuab FromCS-i (500 cm / 20 cm/s), pealelaadimine 10 s
//   t=35    konveier jätkab; t=60 jõuab puhvrisse (500 cm), mahalaadimine 10 s
//   t=70    puhvris; pink vaba -> laadimine pinki 10 s
//   t=80    häälestus 0 s, töötlemine 300 s
//   t=380   mahalaadimine puhvrisse 10 s
//   t=390   valmis -> sihtkoht SysOut. Konveier liigub alates t=70; alus jõuab puhvrisse,
//           kui nihe on 500 kordne: t = 70 + 25k -> esimene pärast 390 on t=395
//   t=395   pealelaadimine 10 s; t=405 jätkab; t=430 SysOut-is (500 cm); mahalaadimine 10 s
//   t=440   detail lahkub.
test('A1: ühe detaili tsükliaeg klapib käsitsi arvutusega (440 s)', () => {
  const report = SimRun(ScenarioA({ Kl: 0.1, Duration: 1000 }), CHECKED);
  const first = report.Finished[0];
  assert.equal(first.TimeIn, 0);
  assert.equal(first.TimeOut, 440);
  assert.equal(first.Times.Process, 300);
  assert.equal(first.Times.Load, 60);   // 6 laadimist × 10 s
});

// A2. Püsiseisundis on pudelikael tööpink: 10 + 300 + 10 = 320 s detaili kohta -> 11,25 tk/h.
test('A2: läbilaskevõime püsiseisundis = 3600 / 320 tk/h', () => {
  const report = SimRun(ScenarioA(), CHECKED);
  const afterWarmup = report.Finished.filter(item => item.TimeOut > 7200).length;
  const expected = (28800 - 7200) / 320;   // 67,5
  assert.ok(Math.abs(afterWarmup - expected) <= 1.5, `valmis ${afterWarmup}, oodatud ~${expected}`);
  assert.equal(report.Deadlock, false);
});

test('B: näidis-PTS töötab 8 h ilma ummikuta', () => {
  const report = SimRun(ScenarioB(), CHECKED);
  assert.equal(report.Deadlock, false);
  assert.equal(report.Time, 28800);
  assert.ok(report.Completed > 60, `valmis ainult ${report.Completed}`);
  assert.ok(report.Machines.every(machine => machine.Utilization > 0.3));
});

test('C: ristmarsruudid keskladuga – ummikud välditakse/lahendatakse, töö jätkub 8 h', () => {
  const report = SimRun(ScenarioC({ withStorage: true }), CHECKED);
  assert.equal(report.Deadlock, false);
  assert.equal(report.Time, 28800);
  assert.ok(report.Completed > 30);
});

test('C0: ristmarsruudid ilma kesklaota – ummik tuvastatakse kohe', () => {
  const report = SimRun(ScenarioC({ withStorage: false }), CHECKED);
  assert.equal(report.Deadlock, true);
  assert.match(report.DeadlockReason, /ringootamine/);
  assert.ok(report.Time < 1000, `tuvastati alles t=${report.Time}`);
});

test('C ilma ummiku vältimiseta – lahendamine parkimisega töötab, kuni kesklaos on ruumi', () => {
  const model = ScenarioC({ withStorage: true });
  model.Sim.ReserveNextBeforeStart = false;
  model.Storage.Capacity = 50;
  const report = SimRun(model, CHECKED);
  assert.equal(report.Deadlock, false);
  assert.ok(report.Parked > 10, 'ilma vältimiseta peaks parkimist olema palju');
  assert.equal(report.Parked - report.Unparked <= model.Storage.Capacity, true);
});

test('D: sama seeme annab sama tulemuse, teine seeme erineva', () => {
  const first = SimRun(ScenarioB({ Seed: 1 }), CHECKED);
  const second = SimRun(ScenarioB({ Seed: 1 }), CHECKED);
  const other = SimRun(ScenarioB({ Seed: 2 }), CHECKED);
  assert.deepEqual(first, second);
  assert.notDeepEqual(first.Finished, other.Finished);
});
