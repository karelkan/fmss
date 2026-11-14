// FMSS – simulaatori testid (etapp 4): Enumerate, andmekontroll, simulatsioon mudelifailist.
// Käivitamine: npm test
// Simulatsioonid kontrollivad invariante igal sekundil (CheckInvariants: true).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CheckModel } from '../core/fms_glb.js';
import { Enumerate, SimRun } from '../core/fms_sim.js';
import { SimRun as ProtoSimRun } from './proto/fms_sim.js';
import { ScenarioA, ScenarioC } from './proto/scenarios.js';

const ROOT = new URL('../', import.meta.url);
const demoText = readFileSync(new URL('models/demo.fms.json', ROOT), 'utf8');
const demo = () => JSON.parse(demoText);
const CHECKED = { CheckInvariants: true };

// Lahtrite lühikirjutus: [X, Y, T, N?, lisaväljad?]
const Cells = rows => rows.map(([X, Y, T, N, extra]) => ({ X, Y, T, ...(N !== undefined && N !== null ? { N } : {}), ...extra }));
const DOT = { Dot: true };

// Mudel, mille korral Enumerate peab andma prototüübi stsenaariumi A võrgu:
//   konveier 2000 cm, FromCS 0, BUF1 500, SysOut 1000 (lõikude pikkused käsitsi, metrokaart).
//   Ülemine rada liigub paremale (nool lahtris (1, 3)).
function LayoutA() {
  const scenario = ScenarioA();
  return {
    Meta: { Name: 'A – üks tööpink', Version: 1 },
    Scale: 100,
    Layout: {
      Dim: { X: 7, Y: 7 },
      Cells: Cells([
        [3, 0, 'MachToolDown', 1],
        [3, 1, 'InOutBuf', 1],
        [3, 2, 'VertTr', null, DOT],
        [0, 3, 'ArcSE', 1], [1, 3, 'HorTr', 1, { Dir: 'E' }], [2, 3, 'HorTr', 1], [3, 3, 'TeeN', 1],
        [4, 3, 'HorTr', 1], [5, 3, 'HorTr', 1], [6, 3, 'ArcSW', 1],
        [0, 4, 'ArcNE', 1], [1, 4, 'TeeS', 1], [2, 4, 'HorTr', 1], [3, 4, 'HorTr', 1],
        [4, 4, 'HorTr', 1], [5, 4, 'TeeS', 1], [6, 4, 'ArcNW', 1],
        [1, 5, 'VertTr', null, DOT], [5, 5, 'VertTr', null, DOT],
        [1, 6, 'FromCS'], [5, 6, 'SysOut'],
      ]),
    },
    EdgeLengths: [
      { Cells: [[0, 4], [0, 3], [1, 3], [2, 3]], Length: 500 },
      { Cells: [[4, 3], [5, 3], [6, 3], [6, 4]], Length: 500 },
      { Cells: [[4, 4], [3, 4], [2, 4]], Length: 1000 },
    ],
    Tracks: [TrackOf(scenario)],
    Machines: [{ Name: 'MT1', Model: '', LoadTime: 10, SetupTime: 0, Ops: ['treimine'] }],
    Buffers: [{ Capacity: 2, Discipline: 'FIFO', LoadTime: 5 }],
    Storage: null,
    Workpieces: scenario.Workpieces,
    Sim: { ...scenario.Sim },
  };
}

// Mudel stsenaariumi C jaoks (ristmarsruudid): FromCS 0, BUF1 500, BUF2 1000, ToCS 1500, SysOut 1700.
function LayoutC({ withStorage = true } = {}) {
  const scenario = ScenarioC({ withStorage });
  const cells = [
    [2, 0, 'MachToolDown', 1], [4, 0, 'MachToolDown', 2],
    [2, 1, 'InOutBuf', 1], [4, 1, 'InOutBuf', 2],
    [2, 2, 'VertTr', null, DOT], [4, 2, 'VertTr', null, DOT],
    [0, 3, 'ArcSE', 1], [1, 3, 'HorTr', 1, { Dir: 'E' }], [2, 3, 'TeeN', 1], [3, 3, 'HorTr', 1],
    [4, 3, 'TeeN', 1], [5, 3, 'HorTr', 1], [6, 3, 'ArcSW', 1],
    [0, 4, 'ArcNE', 1], [1, 4, 'TeeS', 1], [2, 4, 'HorTr', 1], [3, 4, 'TeeS', 1],
    [4, 4, 'HorTr', 1], [5, 4, withStorage ? 'TeeS' : 'HorTr', 1], [6, 4, 'ArcNW', 1],
    [1, 5, 'VertTr', null, DOT], [3, 5, 'VertTr', null, DOT],
    [1, 6, 'FromCS'], [3, 6, 'SysOut'],
  ];
  if (withStorage) cells.push([5, 5, 'VertTr', null, DOT], [5, 6, 'ToCS']);
  return {
    Meta: { Name: scenario.Name, Version: 1 },
    Scale: 100,
    Layout: { Dim: { X: 7, Y: 7 }, Cells: Cells(cells) },
    EdgeLengths: withStorage
      ? [
        { Cells: [[0, 4], [0, 3], [1, 3]], Length: 500 },
        { Cells: [[3, 3]], Length: 500 },
        { Cells: [[5, 3], [6, 3], [6, 4]], Length: 500 },
        { Cells: [[4, 4]], Length: 200 },
        { Cells: [[2, 4]], Length: 300 },
      ]
      : [
        { Cells: [[0, 4], [0, 3], [1, 3]], Length: 500 },
        { Cells: [[3, 3]], Length: 500 },
        { Cells: [[5, 3], [6, 3], [6, 4], [5, 4], [4, 4]], Length: 700 },
        { Cells: [[2, 4]], Length: 300 },
      ],
    Tracks: [TrackOf(scenario)],
    Machines: scenario.Machines.map(({ Name, LoadTime, SetupTime, Ops }) => ({ Name, Model: '', LoadTime, SetupTime, Ops })),
    Buffers: [{ Capacity: 1, Discipline: 'FIFO', LoadTime: 5 }, { Capacity: 1, Discipline: 'FIFO', LoadTime: 5 }],
    Storage: scenario.Storage,
    Workpieces: scenario.Workpieces,
    Sim: { ...scenario.Sim },
  };
}

// Enumerate peab õnnestuma; tagastab võrgu.
function NetworkOf(model) {
  assert.deepEqual(CheckModel(model), [], 'CheckModel');
  const result = Enumerate(model);
  assert.deepEqual(result.Errors, [], 'Enumerate');
  return result.Network;
}

// Kontrollib, et Enumerate leiab vea, mille tekst sisaldab antud lõiku.
function assertEnumError(model, fragment) {
  const result = Enumerate(model);
  assert.equal(result.Network, null);
  assert.ok(result.Errors.some(error => error.Message.includes(fragment)),
    `oodatud viga „${fragment}“, saadi: ${JSON.stringify(result.Errors)}`);
}

// Prototüübi raja kirje mudelifaili kujul (pikkus tuleb jooniselt).
function TrackOf(scenario) {
  const { Length, ...track } = scenario.Tracks[0];
  return { ...track, AccessTime: 0 };
}

const cellAt = (model, x, y) => model.Layout.Cells.find(cell => cell.X === x && cell.Y === y);

// ---------------------------------------------------------------------
// Enumerate: rajavõrk
// ---------------------------------------------------------------------

test('Enumerate: näidismudeli silmus, pikkus ja jaamad (käsitsi arvutatud)', () => {
  const network = NetworkOf(demo());
  const track = network.Tracks[0];
  // 18 sirget + 4 kaart (π/4) ikooni × 100 cm
  assert.equal(track.Length, Math.round((18 + Math.PI) * 100 * 1000) / 1000);
  // nool alumisel lõigul paremale: FromCS -> ToCS -> SysOut -> (üles) -> BUF2 -> BUF1 -> FromCS
  const arc = Math.PI / 4 * 100;
  const expected = [
    ['FromCS', 0], ['ToCS', 700], ['SysOut', 800],
    ['BUF2', 800 + 50 + 2 * arc + 300 + 50], ['BUF1', 800 + 50 + 2 * arc + 300 + 50 + 400],
  ];
  assert.deepEqual(network.Stations.map(station => station.Name), expected.map(([name]) => name));
  network.Stations.forEach((station, i) => assert.ok(Math.abs(station.Position - expected[i][1]) < 0.001, station.Name));
  assert.equal(network.Tracks[0].Cells.length, 22);
});

test('Enumerate: tööpingid ja puhvrid seotakse naabrusest', () => {
  const network = NetworkOf(demo());
  assert.deepEqual(network.Machines.map(machine => [machine.Name, machine.InBuffer, machine.OutBuffer]),
    [['MT1', 0, 0], ['MT2', 1, 1]]);
  assert.deepEqual(network.Buffers.map(buffer => [buffer.Name, buffer.Kind, buffer.Machine, network.Stations[buffer.Station].Name]),
    [['BUF1', 'InOutBuf', 0, 'BUF1'], ['BUF2', 'TurnBuf', 1, 'BUF2']]);
});

test('Enumerate: lõigu pikkus käsitsi (metrokaart) nihutab jaamu', () => {
  const model = demo();
  // lõik SysOut -> BUF2: (11,4), (11,3), (10,3), (9,3), (8,3) – nominaalselt 557,08 cm
  model.EdgeLengths = [{ Cells: [[11, 4], [8, 3]], Length: 1000 }];
  const network = NetworkOf(model);
  const position = name => network.Stations.find(station => station.Name === name).Position;
  assert.equal(position('BUF2'), 1800);
  assert.equal(position('BUF1'), 2200);
  assert.ok(network.Tracks[0].Edges.some(edge => edge.Stretched && edge.Length === 1000));
});

test('Enumerate: nool vastassuunas pöörab liikumise ümber', () => {
  const model = demo();
  cellAt(model, 5, 4).Dir = 'W';
  const network = NetworkOf(model);
  assert.deepEqual(network.Stations.map(station => station.Name), ['FromCS', 'BUF1', 'BUF2', 'SysOut', 'ToCS']);
});

test('Enumerate: mitu kooskõlas noolt on lubatud, vastuolulised mitte', () => {
  const model = demo();
  cellAt(model, 6, 3).Dir = 'W';     // ülemine lõik vasakule – sama ringi suund
  NetworkOf(model);
  cellAt(model, 6, 3).Dir = 'E';
  assertEnumError(model, 'vastuolus');
});

// ---------------------------------------------------------------------
// Enumerate: andmekontroll (originaali vead 1–8)
// ---------------------------------------------------------------------

test('Kontroll 5: pideval rajal pole suunda', () => {
  const model = demo();
  delete cellAt(model, 5, 4).Dir;
  assertEnumError(model, 'pole liikumissuunda');
});

// Etapist 7a on katkine silmus avatud konveier (DISAIN.md 10.1). Viga tuleb sellest, et osa
// objekte jääb FromCS-ist vastuvoolu; teade ütleb, et konveier on avatud ja kus on otsad.
test('Kontroll 1: rada pole suletud → avatud konveier, objektid vastuvoolu', () => {
  const model = demo();
  model.Layout.Cells = model.Layout.Cells.filter(cell => !(cell.X === 6 && cell.Y === 3));
  assertEnumError(model, 'avatud: algus (5, 3), lõpp (7, 3)');
});

test('Kontroll 1: ikoonid ei sobi kokku', () => {
  const model = demo();
  cellAt(model, 6, 3).T = 'VertTr';
  assertEnumError(model, 'ei sobi kokku');
});

test('Kontroll 2: pideval rajal on haru', () => {
  const model = demo();
  // BUF1 punktiirühendus asendatakse päris rajaga
  delete cellAt(model, 3, 2).Dot;
  cellAt(model, 3, 2).N = 1;
  assertEnumError(model, 'on haru');
});

test('Kontroll 8: tööpingil puudub puhver', () => {
  const model = demo();
  cellAt(model, 3, 0).T = 'MachToolUp';
  assertEnumError(model, 'puudub puhver');
});

test('Kontroll 7: puhvrid järjestikku', () => {
  const model = demo();
  model.Layout.Dim.Y = 8;
  for (const cell of model.Layout.Cells) cell.Y += 1;   // kõik rea võrra alla
  cellAt(model, 3, 1).Y = 0;                            // MT1 tagasi üles, vahele uus puhver
  model.Buffers.push({ Capacity: 1, Discipline: 'FIFO', LoadTime: 5 });
  model.Layout.Cells.push({ X: 3, Y: 1, T: 'InOutBuf', N: 3 });
  assertEnumError(model, 'järjestikku');
});

test('Puhvri liik ei sobi pingi rolliga', () => {
  const model = demo();
  cellAt(model, 3, 1).T = 'InBuf';   // MachToolDown vajab ka väljaminevat puhvrit
  assertEnumError(model, 'väljaminevaks');
});

test('Punktiirühendus ei vii objektini / pole rajaga ühendatud', () => {
  const model = demo();
  model.Layout.Cells = model.Layout.Cells.filter(cell => !(cell.X === 9 && cell.Y === 6));  // ToCS ära
  assertEnumError(model, 'ei vii');
  const other = demo();
  other.Layout.Cells.push({ X: 0, Y: 0, T: 'VertTr', Dot: true });
  assertEnumError(other, 'pole rajaga ühendatud');
});

test('Kontroll 4: operatsiooni teeb ainult joonisel puuduv pink', () => {
  const model = demo();
  model.Machines.push({ Name: 'MT3', Model: '', LoadTime: 10, SetupTime: 0, Ops: ['lihvimine'] });
  model.Workpieces[1].Routes[0].Ops.push({ Op: 'lihvimine', Mean: 100, Dev: 0 });
  const result = Enumerate(model);
  assert.ok(result.Warnings.some(warning => warning.Message.includes('MT3')));
  assertEnumError(model, 'lihvimine');
});

test('Kontrollid 3 ja 6 on hoiatused', () => {
  const model = demo();
  model.Storage.Capacity = 2;
  model.Tracks[0].Carts = 10;
  const result = Enumerate(model);
  assert.notEqual(result.Network, null);
  assert.ok(result.Warnings.some(warning => warning.Message.includes('keskladu')));
  assert.ok(result.Warnings.some(warning => warning.Message.includes('rohkem kohti')));
});

test('Mitu detaili alusel (7c): näidismudel kahe kohaga – 8 h ilma ummikuta, alusel kuni 2 detaili', () => {
  const places = demo();
  places.Tracks[0].PlacesPerCart = 2;
  const result = Enumerate(places);
  assert.deepEqual(result.Errors, []);
  const report = SimRun(result.Network, { CheckInvariants: true });
  assert.equal(report.Deadlock, false);
  assert.equal(report.Tracks[0].MaxLoad, 2);
  assert.ok(report.Tracks[0].Pooled > 0);
});

test('EdgeLengths: lahtrid peavad olema ühe lõigu sees', () => {
  const model = demo();
  model.EdgeLengths = [{ Cells: [[4, 4], [4, 3]], Length: 500 }];
  assertEnumError(model, 'ühe lõigu');
});

// ---------------------------------------------------------------------
// Simulatsioon mudelifailist
// ---------------------------------------------------------------------

test('A: mudelifailist ehitatud võrk annab prototüübiga sama tulemuse (tsükliaeg 440 s)', () => {
  const network = NetworkOf(LayoutA());
  assert.equal(network.Tracks[0].Length, 2000);
  assert.deepEqual(network.Stations.map(station => [station.Name, station.Position]),
    [['FromCS', 0], ['BUF1', 500], ['SysOut', 1000]]);
  const short = { ...network, Sim: { ...network.Sim, Kl: 0.1, Duration: 1000 } };
  const report = SimRun(short, CHECKED);
  assert.equal(report.Finished[0].TimeOut, 440);
  // Etapp 8, leid 1: alus, mis jõuab jaama samal hetkel, kui konveier peatub teise aluse pärast,
  // peatub nüüd seal (prototüübis sõitis ta mööda ja tegi lisaringi). A-s on alused ja jaamad
  // 500 cm vahedega, nii et see juhtub sageli: valmis sama palju, tsükliaeg veidi lühem.
  const full = SimRun(network, CHECKED);
  const proto = ProtoSimRun(ScenarioA(), CHECKED);
  assert.equal(full.Completed, proto.Completed);
  assert.ok(full.AvgCycleTime <= proto.AvgCycleTime && full.AvgCycleTime > 0.99 * proto.AvgCycleTime,
    `tsükliaeg ${full.AvgCycleTime} vs prototüüp ${proto.AvgCycleTime}`);
});

test('C: ristmarsruudid mudelifailist – sama tulemus mis prototüübil', () => {
  const network = NetworkOf(LayoutC());
  const report = SimRun(network, CHECKED);
  const proto = ProtoSimRun(ScenarioC(), CHECKED);
  assert.equal(report.Deadlock, false);
  assert.deepEqual(report.Finished, proto.Finished);
  assert.equal(report.Parked, proto.Parked);
});

test('C0: ilma kesklaota tuvastatakse ummik', () => {
  const report = SimRun(NetworkOf(LayoutC({ withStorage: false })), CHECKED);
  assert.equal(report.Deadlock, true);
  assert.match(report.DeadlockReason, /ringootamine/);
});

test('Näidis-PTS: 8 h ilma ummikuta, mõistlik statistika', () => {
  const report = SimRun(NetworkOf(demo()), CHECKED);
  assert.equal(report.Deadlock, false);
  assert.equal(report.Time, 28800);
  assert.ok(report.ThroughputPerHour > 8, `läbilaskevõime ${report.ThroughputPerHour}`);
  assert.ok(report.Machines.every(machine => machine.Utilization > 0.3 && machine.Utilization <= 1));
  // olekute osakaalud kokku 1
  for (const machine of report.Machines) {
    const total = machine.Utilization + machine.IdleShare;
    assert.ok(Math.abs(total - 1) < 1e-9, `${machine.Name}: ${total}`);
  }
  const track = report.Tracks[0];
  assert.ok(Math.abs(track.MovingShare + track.StoppedShare - 1) < 1e-9);
  assert.equal(report.Types.reduce((sum, type) => sum + type.Completed, 0), report.Completed);
  assert.equal(report.Machines.reduce((sum, machine) => sum + machine.OpsDone, 0) >= report.Completed * 2, true);
});

test('Aegrida: punkt iga 60 s järel, algus ja lõpp kaasa arvatud', () => {
  const report = SimRun(NetworkOf(demo()));
  assert.equal(report.Timeline.length, 28800 / 60 + 1);
  assert.equal(report.Timeline[0].Time, 0);
  assert.equal(report.Timeline.at(-1).Time, 28800);
  assert.equal(report.Timeline.at(-1).Completed, report.Completed);
  assert.ok(report.Timeline.every(point => point.BufferFill.length === 2));
});

test('Korratavus: sama seeme sama tulemus, teine seeme erinev', () => {
  const network = NetworkOf(demo());
  const first = SimRun(network);
  assert.deepEqual(SimRun(network), first);
  const other = SimRun({ ...network, Sim: { ...network.Sim, Seed: 2 } });
  assert.notDeepEqual(other.Finished, first.Finished);
});
