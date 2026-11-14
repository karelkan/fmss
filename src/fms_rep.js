// FMSS – aruannete generaator: Static (algne seis ja lõppseis), Dynamic (tsükliaeg ja osakaalud,
// aegrida, sündmused); väljund ekraanile (kerimisega vaade) või faili (tekst).
// Vastab originaali moodulile FMS_REP1.PAS (originaal.md 8.3, ptk 6.5). Disain: DISAIN.md osa 18.
//
// Arvud tulevad SimReport-ist ja simulatsiooni lõppseisust (CaptureEndState); simulaatorit ei
// muudeta. Aruande koostamine ei kasuta brauserit (testid: test/report.test.js).
// Rida on kuni REPORT_WIDTH märki, et mahuks EGA 80 märgi laiusesse aknasse.

import { Texts, FormatText } from './fms_lng.js';
import { ROW_HEIGHT } from './fms_theme.js';
import { ClockText } from './anima.js';
import { PARKING_RESERVE } from './fms_sim.js';
import { SetDesktopView, GetDesktopView, RequestRedraw } from './windows.js';

// =====================================================================
// Globaalsed andmed
// =====================================================================

let LastReport = null;   // [U] viimane simulatsioon: { Report, End, ModelText, File }
let ReportView = null;   // [U] avatud aruande vaade: { Title, Lines, Top, Previous, OnFile, OnClose }

export const REPORT_WIDTH = 74;          // [U] aruande rea suurim laius märkides
export const STATIC_TOPICS = ['Model', 'Tracks', 'Machines', 'Buffers', 'Storage', 'Workpieces', 'Crashes'];  // [O] Static teemad
export const DYNAMIC_TOPICS = ['Cycle', 'Types', 'Timeline', 'Events'];  // [O] Dynamic teemad
const TIMELINE_MAX_ROWS = 100;           // [U] aegrea ridu aruandes kuni
const TIMELINE_STEPS = [60, 300, 600, 900, 1800, 3600, 7200, 14400];  // [U] aegrea sammu valikud, s
const BAR_WIDTH = 14;                    // [U] aegrea graafiku tulba suurim pikkus märkides
const SHARE_BAR_WIDTH = 25;              // [U] osakaalu tulba pikkus 100 % juures
const WHEEL_LINES = 3;                   // [U] hiire ratta üks samm, ridu

// =====================================================================
// Vormindamine
// =====================================================================

// [U] Percent, Decimal, Seconds – protsent, kümnendmurd komaga, sekundid täisarvuna.
export const Percent = (value) => `${Math.round(value * 100)} %`;
export const Decimal = (value, digits = 1) => value.toFixed(digits).replace('.', ',');
const Seconds = (value) => String(Math.round(value));
const SIM_SHOWN_OBJECTS = 6;   // [U] kokkuvõttes kõige rohkem nii mitu pinki / puhvrit (vähem, kui ei mahu)
const Bar = (length) => '▄'.repeat(Math.max(0, Math.round(length)));

// Aruande rida: string või { Text, Kind }; Kind: 'Section' (teema pealkiri), 'Sub' (algne seis /
// lõppseis), 'Head' (tabeli päis), 'Warning' (ummik, muudetud mudel).
const Section = (text) => ({ Text: text, Kind: 'Section' });
const Sub = (text) => ({ Text: text, Kind: 'Sub' });
const Warning = (text) => ({ Text: text, Kind: 'Warning' });

// [U] TableLines – tabel püsilaiusega veergudega: päis, joon, read (taandega 2).
//     columns: [{ Title, Width, Left }] – Left: tekst vasakule (muidu arv paremale).
export function TableLines(columns, rows) {
  const cell = (value, column) => {
    let text = String(value);
    if (text.length > column.Width) text = `${text.slice(0, column.Width - 1)}…`;
    return column.Left ? text.padEnd(column.Width) : text.padStart(column.Width);
  };
  const line = (values) => `  ${columns.map((column, i) => cell(values[i], column)).join(' ')}`.trimEnd();
  const width = columns.reduce((sum, column) => sum + column.Width, 0) + columns.length - 1;
  return [
    { Text: line(columns.map((column) => column.Title)), Kind: 'Head' },
    `  ${'─'.repeat(width)}`,
    ...rows.map(line),
  ];
}

// [U] WrapLines – loetelu ridadeks: esimene rida algab prefix-iga, järgmised taandega indent.
function WrapLines(prefix, items, indent, separator = ', ') {
  const lines = [];
  let current = prefix;
  items.forEach((item, i) => {
    const piece = item + (i < items.length - 1 ? separator.trimEnd() : '');
    const gap = current === prefix || current === indent ? '' : ' ';
    if (current.length + gap.length + piece.length > REPORT_WIDTH && current.trim() !== '' && current !== prefix) {
      lines.push(current);
      current = indent + piece;
    } else {
      current += gap + piece;
    }
  });
  lines.push(current);
  return lines;
}

// =====================================================================
// Viimane simulatsioon
// =====================================================================

// [U] WorkpieceLabel – detail kasutajale: „WP12 Võll“, praak „WP12 Võll ×“.
function WorkpieceLabel(state, id) {
  const workpiece = state.SysWPArray[id];
  return `WP${id} ${state.Workpieces[workpiece.Type].Name}${workpiece.Scrap ? ' ×' : ''}`;
}

// [U] CaptureEndState – simulatsiooni lõppseis (koopia SimState-ist): pinkide olek ja detail,
//     puhvrite sisu, alustel olevad detailid, konnektorid, keskladu, detailid asukoha ja tüübi
//     järgi. Kutsub: KeepReport, testid.
export function CaptureEndState(state) {
  const inSystem = state.SysWPArray.filter((workpiece) => workpiece.Location.Kind !== 'Gone');
  const where = { FromCS: 0, Pallet: 0, Buffer: 0, Machine: 0, Connector: 0, Storage: 0 };
  for (const workpiece of inSystem) {
    const kind = workpiece.Location.Kind === 'Entering' ? 'FromCS' : workpiece.Location.Kind;
    where[kind] = (where[kind] || 0) + 1;
  }
  return {
    Time: state.SYSTEM_TIME,
    Where: where,
    InSystemByType: state.Workpieces.map((type, typeIndex) => inSystem.filter((workpiece) => workpiece.Type === typeIndex).length),
    Machines: state.MachineArray.map((machine) => ({
      Name: machine.Name, State: machine.State, WP: machine.WP === null ? null : WorkpieceLabel(state, machine.WP),
    })),
    Buffers: state.BufferArray.map((buffer) => ({
      Name: buffer.Name,
      In: buffer.Entries.filter((entry) => entry.Dir === 'In').length,
      Out: buffer.Entries.filter((entry) => entry.Dir === 'Out').length,
      Reserved: buffer.Reserved,
    })),
    Tracks: state.Tracks.map((track) => ({
      Name: track.Name, Discrete: Boolean(track.Discrete), Stopped: !track.Discrete && track.StopCount > 0,
      OnPallets: track.Pallets.reduce((sum, pallet) => sum + pallet.Places.filter((place) => place !== null).length, 0),
      LoadedPallets: track.Pallets.filter((pallet) => pallet.Places.some((place) => place !== null)).length,
      Pallets: track.Pallets.length,
    })),
    Connectors: state.ConnectorArray.map((connector) => ({
      Name: connector.Name, WP: connector.WP === null ? null : WorkpieceLabel(state, connector.WP),
    })),
    Storage: state.Storage === null ? null : {
      Count: state.Storage.Count, Parked: state.Storage.Parked.length, Capacity: state.Storage.Capacity,
    },
  };
}

// [U] KeepReport – jätab simulatsiooni tulemuse meelde aruannete jaoks (ka ummik ja katkestus).
//     modelText – mudel JSON-ina simulatsiooni alguses (muudatuse avastamiseks). Kutsub: fms.js.
export function KeepReport(report, state, modelText, fileName) {
  LastReport = { Report: report, End: CaptureEndState(state), ModelText: modelText, File: fileName };
  return LastReport;
}

// [U] LastSimulation – viimane simulatsioon või null.
export function LastSimulation() {
  return LastReport;
}

// [U] ForgetReport – unustab viimase simulatsiooni (testid).
export function ForgetReport() {
  LastReport = null;
}

// [U] StatusText – simulatsiooni olek: lõpuni, ummik või katkestatud; lõpurežiimis (11d) ka
//     „lõpetamine katkes“, „tellimus täidetud“ või „tellimus jäi pooleli“.
function StatusText(report) {
  if (report.Deadlock) return FormatText(Texts.RepStatusDeadlock, { Time: ClockText(report.Time) });
  if (!(report.Done ?? report.Time >= report.Duration)) return FormatText(Texts.RepStatusStopped, { Time: ClockText(report.Time) });
  if (report.Order) return report.Order.Done ? Texts.RepStatusOrderDone : Texts.RepStatusOrderLeft;
  if (report.Ending?.Capped) return Texts.RepStatusEndCapped;
  return Texts.RepStatusDone;
}

// [U] EndModeName, SequenceName – lõpurežiimi ja tüüpide järjekorra nimi liideses (11d).
const EndModeName = mode => Texts.FormEndModes[mode ?? 'Time'];
const SequenceName = sequence => Texts.FormOrderSequences[sequence ?? 'Mixed'];

// [U] FormatLines – mitmerealine mall (REPORT_WIDTH): iga rida FormatText-iga.
const FormatLines = (templates, values) => templates.map(template => FormatText(template, values));

// [U] EndingLines – lõpetamise (B–D) või tellimuse (E) read aruandesse (11d); A korral tühi.
function EndingLines(report) {
  if (report.Ending) {
    const ending = report.Ending;
    return FormatLines(ending.Capped ? Texts.RepEndingCapped : Texts.RepEnding, {
      Mode: EndModeName(report.EndMode), Duration: ClockText(ending.Duration), Completed: ending.CompletedAfter,
      Scrapped: ending.ScrappedAfter, Left: ending.LeftInSystem });
  }
  if (report.Order) {
    const order = report.Order;
    return FormatLines(order.Done ? Texts.RepOrderDone : Texts.RepOrderLeft, {
      Sequence: SequenceName(order.Sequence), Completed: order.Completed, Total: order.Total,
      Makespan: order.Makespan !== null ? ClockText(order.Makespan) : '' });
  }
  return [];
}

// [U] DeadlockLines – ummiku põhjus hoiatusena (murtud ridadeks); ummikuta tühi.
function DeadlockLines(report, indent) {
  if (!report.Deadlock) return [];
  return WrapLines(`${indent}${Texts.RepDeadlockReason}`, String(report.DeadlockReason).split(' '), `${indent}  `, ' ').map(Warning);
}

// [U] HeaderLines – aruande päis: mudel, simulatsioon, hoiatus muudetud mudeli kohta.
function HeaderLines(modelName, last, changed) {
  const lines = [FormatText(Texts.RepModel, { Name: modelName || Texts.DesktopUntitled })];
  if (last) {
    const report = last.Report;
    const status = FormatText(Texts.RepSimulation, {
      Time: ClockText(report.Time), Duration: ClockText(report.Duration), Seed: report.Seed, Status: StatusText(report),
    });
    lines.push(report.Deadlock ? Warning(status) : status, ...DeadlockLines(report, '  '));
    if (changed) lines.push(Warning(Texts.RepChanged));
  } else {
    lines.push(Texts.RepNoSimulationLine);
  }
  return lines;
}

// =====================================================================
// Static – algne seis (mudeli parameetrid) ja lõppseis
// =====================================================================

const DISTRIBUTION_NAMES = () => ({ Uniform: Texts.RepUniform, Triangular: Texts.RepTriangular, Normal: Texts.RepNormal });
const MACHINE_STATE_NAMES = () => ({
  IDLE: Texts.RepIdle, LOADING: Texts.RepLoading, SETUP: Texts.RepSetup, PROCESSING: Texts.RepProcessing,
  UNLOADING: Texts.RepUnloading, DOWN: Texts.RepDown,
});
const Dash = '—';

// [U] TrackKind – raja liik: pidev silmus, avatud konveier, AGV.
function TrackKind(track) {
  if (track.Mode === 'Discrete') return Texts.RepTrackAgv;
  return track.Closed === false ? Texts.RepTrackOpen : Texts.RepTrackLoop;
}

// [U] StaticModel … StaticCrashes – Static teemad: algne seis (parameetrid) ja endValid korral
//     lõppseis (viimane simulatsioon). Kutsub: StaticReport.
function StaticModel(model, network, last, endValid) {
  const sim = network.Sim;
  const lines = [Section(Texts.RepTopicModel), Sub(Texts.RepInitial),
    FormatText(Texts.RepGrid, { X: model.Layout.Dim.X, Y: model.Layout.Dim.Y, Scale: model.Scale }),
    FormatText(Texts.RepSimParams, { Duration: ClockText(sim.Duration), Seed: sim.Seed, Kl: Decimal(sim.Kl, 2), Stall: sim.StallTime }),
    FormatText(Texts.RepSimParams2, {
      Distribution: DISTRIBUTION_NAMES()[sim.Distribution ?? 'Uniform'], Sample: sim.SampleInterval ?? 60,
    }),
    ...FormatLines(sim.EndMode === 'Order' ? Texts.RepSimEndOrder : [Texts.RepSimEnd], {
      Mode: EndModeName(sim.EndMode), Sequence: SequenceName(sim.OrderSequence),
      Total: network.Workpieces.reduce((sum, type) => sum + (type.Batch ?? 1), 0),
    }),
    FormatText(Texts.RepObjects, {
      Tracks: network.Tracks.length, Machines: network.Machines.length, Buffers: network.Buffers.length,
      Connectors: network.Connectors.length, Storage: network.Storage ? Texts.RepYes : Texts.RepNo, Types: network.Workpieces.length,
    }),
  ];
  if (endValid) {
    const report = last.Report;
    lines.push(Sub(Texts.RepFinal),
      FormatText(Texts.RepFinalTime, { Time: ClockText(report.Time), Status: StatusText(report) }),
      ...DeadlockLines(report, '    '),
      ...EndingLines(report),
      FormatText(Texts.RepFinalCounts, report),
      ...WrapLines(Texts.RepWhere, [
        FormatText(Texts.RepWhereFromCS, last.End.Where), FormatText(Texts.RepWherePallet, last.End.Where),
        FormatText(Texts.RepWhereBuffer, last.End.Where), FormatText(Texts.RepWhereMachine, last.End.Where),
        FormatText(Texts.RepWhereConnector, last.End.Where), FormatText(Texts.RepWhereStorage, last.End.Where),
      ], '    '));
  }
  return lines;
}

function StaticTracks(network, last, endValid) {
  const lines = [Section(Texts.RepTopicTracks), Sub(Texts.RepInitial),
    ...TableLines([
      { Title: Texts.RepColTrack, Width: 12, Left: true }, { Title: Texts.RepColKind, Width: 15, Left: true },
      { Title: Texts.RepColLength, Width: 8 }, { Title: Texts.RepColSpeed, Width: 6 }, { Title: Texts.RepColCarts, Width: 9 },
      { Title: Texts.RepColPlaces, Width: 5 }, { Title: Texts.RepColLoad, Width: 7 },
    ], network.Tracks.map((track) => [
      track.Name, TrackKind(track), Decimal(track.Length / 100), track.Speed, track.Carts, track.PlacesPerCart, track.LoadTime,
    ])),
  ];
  if (network.Connectors.length > 0) {
    lines.push('', ...network.Connectors.map((connector) => FormatText(Texts.RepConnectorLine, {
      Name: connector.Name,
      Tracks: [...new Set(connector.Stations.map((stationIndex) => network.Tracks[network.Stations[stationIndex].Track].Name))].join(' ↔ '),
    })));
  }
  if (!endValid) return lines;
  const report = last.Report;
  const end = last.End;
  const continuous = report.Tracks.map((track, i) => ({ Track: track, End: end.Tracks[i] })).filter((item) => !item.Track.Discrete);
  const discrete = report.Tracks.map((track, i) => ({ Track: track, End: end.Tracks[i] })).filter((item) => item.Track.Discrete);
  lines.push(Sub(Texts.RepFinal));
  if (continuous.length > 0) {
    lines.push(...TableLines([
      { Title: Texts.RepColTrack, Width: 12, Left: true }, { Title: Texts.RepColMoving, Width: 6 }, { Title: Texts.RepColStops, Width: 7 },
      { Title: Texts.RepColNow, Width: 7, Left: true }, { Title: Texts.RepColOnPallets, Width: 8 },
      { Title: Texts.RepColAvgLoad, Width: 8 }, { Title: Texts.RepColMaxLoad, Width: 4 }, { Title: Texts.RepColPooled, Width: 7 },
    ], continuous.map(({ Track: track, End: trackEnd }) => [
      track.Name, Percent(track.MovingShare), track.Stops, trackEnd.Stopped ? Texts.RepStopped : Texts.RepMoves,
      `${trackEnd.OnPallets}/${trackEnd.Pallets}`, Decimal(track.AvgLoad, 2), track.MaxLoad, track.Pooled,
    ])));
  }
  if (discrete.length > 0) {
    if (continuous.length > 0) lines.push('');
    const average = (track, state) => track.Carts.reduce((sum, cart) => sum + cart[state], 0) / Math.max(1, track.Carts.length);
    lines.push(...TableLines([
      { Title: Texts.RepColTrack, Width: 12, Left: true }, { Title: Texts.RepColLoaded, Width: 7 }, { Title: Texts.RepColEmpty, Width: 7 },
      { Title: Texts.RepColLoading, Width: 6 }, { Title: Texts.RepColWaiting, Width: 6 }, { Title: Texts.RepColCollisions, Width: 9 },
      { Title: Texts.RepColDetours, Width: 8 }, { Title: Texts.RepColOnCarts, Width: 8 },
    ], discrete.map(({ Track: track, End: trackEnd }) => [
      track.Name, Percent(average(track, 'LOADED')), Percent(average(track, 'EMPTY')), Percent(average(track, 'LOADING')),
      Percent(average(track, 'WAIT_ZONE')), track.Collisions, track.Detours + track.Asides, `${trackEnd.OnPallets}/${trackEnd.Pallets}`,
    ])));
  }
  if (report.Connectors.length > 0) {
    lines.push('', ...TableLines([
      { Title: Texts.RepColConnector, Width: 12, Left: true }, { Title: Texts.RepColInside, Width: 24, Left: true },
      { Title: Texts.RepColTransfers, Width: 10 },
    ], report.Connectors.map((connector, i) => [connector.Name, end.Connectors[i].WP ?? Dash, connector.Transfers])));
  }
  return lines;
}

function StaticMachines(network, last, endValid) {
  const bufferName = (index) => (index === null || index === undefined || index < 0 ? Dash : network.Buffers[index].Name);
  const lines = [Section(Texts.RepTopicMachines), Sub(Texts.RepInitial),
    ...TableLines([
      { Title: Texts.RepColMachine, Width: 10, Left: true }, { Title: Texts.RepColLoad, Width: 7 }, { Title: Texts.RepColSetup, Width: 10 },
      { Title: Texts.RepColCrashMean, Width: 12 }, { Title: Texts.RepColRepair, Width: 10 }, { Title: Texts.RepColBuffers, Width: 11, Left: true },
    ], network.Machines.map((machine) => [
      machine.Name, machine.LoadTime, machine.SetupTime,
      machine.CrashMean > 0 ? machine.CrashMean : Dash,
      machine.CrashMean > 0 ? `${machine.RepairMean ?? 0}±${machine.RepairDev ?? 0}` : Dash,
      machine.InBuffer === machine.OutBuffer ? bufferName(machine.InBuffer) : `${bufferName(machine.InBuffer)}/${bufferName(machine.OutBuffer)}`,
    ])),
    '', Texts.RepOperations,
    ...network.Machines.flatMap((machine) => WrapLines(`    ${machine.Name}: `, machine.Ops, '      ')),
  ];
  if (!endValid) return lines;
  const report = last.Report;
  const states = MACHINE_STATE_NAMES();
  lines.push(Sub(Texts.RepFinal),
    ...TableLines([
      { Title: Texts.RepColMachine, Width: 10, Left: true }, { Title: Texts.RepColState, Width: 13, Left: true },
      { Title: Texts.RepColWorkpiece, Width: 22, Left: true }, { Title: Texts.RepColOps, Width: 12 }, { Title: Texts.RepColCrashes, Width: 7 },
    ], report.Machines.map((machine, i) => [
      machine.Name, states[last.End.Machines[i].State] ?? last.End.Machines[i].State, last.End.Machines[i].WP ?? Dash,
      machine.OpsDone, machine.Crashes,
    ])),
    '', Texts.RepMachineShares,
    ...TableLines([
      { Title: Texts.RepColMachine, Width: 10, Left: true }, { Title: Texts.RepColUtilization, Width: 9 },
      { Title: Texts.RepColProcessing, Width: 9 }, { Title: Texts.RepColSetupShare, Width: 9 }, { Title: Texts.RepColLoadShare, Width: 9 },
      { Title: Texts.RepColIdle, Width: 7 }, { Title: Texts.RepColDown, Width: 7 },
    ], report.Machines.map((machine) => [
      machine.Name, Percent(machine.Utilization), Percent(machine.ProcessingShare), Percent(machine.SetupShare),
      Percent(machine.LoadShare), Percent(machine.IdleShare), Percent(machine.DownShare),
    ])));
  return lines;
}

function StaticBuffers(network, last, endValid) {
  const buffers = network.Buffers;
  const lines = [Section(Texts.RepTopicBuffers), Sub(Texts.RepInitial),
    ...TableLines([
      { Title: Texts.RepColBuffer, Width: 8, Left: true }, { Title: Texts.RepColKind, Width: 10, Left: true },
      { Title: Texts.RepColMachine, Width: 10, Left: true }, { Title: Texts.RepColCapacity, Width: 10 },
      { Title: Texts.RepColDiscipline, Width: 10, Left: true }, { Title: Texts.RepColLoad, Width: 7 },
    ], buffers.map((buffer) => [
      buffer.Name, buffer.Kind, buffer.Machine >= 0 ? network.Machines[buffer.Machine].Name : Dash, buffer.Capacity,
      buffer.Discipline, buffer.LoadTime,
    ])),
  ];
  if (!endValid) return lines;
  const report = last.Report;
  lines.push(Sub(Texts.RepFinal),
    ...TableLines([
      { Title: Texts.RepColBuffer, Width: 8, Left: true }, { Title: Texts.RepColIncoming, Width: 11 }, { Title: Texts.RepColOutgoing, Width: 11 },
      { Title: Texts.RepColReserved, Width: 11 }, { Title: Texts.RepColAvgFill, Width: 10 }, { Title: Texts.RepColMaxFill, Width: 5 },
    ], report.Buffers.map((buffer, i) => [
      buffer.Name, last.End.Buffers[i].In, last.End.Buffers[i].Out, last.End.Buffers[i].Reserved,
      `${Decimal(buffer.AvgFill, 2)}/${buffer.Capacity}`, buffer.MaxFill,
    ])));
  return lines;
}

function StaticStorage(network, last, endValid) {
  const storage = network.Storage;
  const lines = [Section(Texts.RepTopicStorage), Sub(Texts.RepInitial),
    storage ? FormatText(Texts.RepStorageParams, { Capacity: storage.Capacity, Load: storage.LoadTime, Reserve: storage.ParkingReserve ?? PARKING_RESERVE }) : Texts.RepNoStorage];
  if (!endValid || !last.End.Storage) return lines;
  const report = last.Report;
  const end = last.End.Storage;
  lines.push(Sub(Texts.RepFinal),
    FormatText(Texts.RepStorageFinal, { Count: end.Count, Parked: end.Parked, Used: end.Count + end.Parked, Capacity: end.Capacity }),
    FormatText(Texts.RepStorageParked, { Parked: report.Parked, Unparked: report.Unparked, Max: report.StorageMaxParked }));
  return lines;
}

function StaticWorkpieces(network, last, endValid) {
  const lines = [Section(Texts.RepTopicWorkpieces), Sub(Texts.RepInitial)];
  network.Workpieces.forEach((type) => {
    lines.push(FormatText(Texts.RepTypeLine, { Name: type.Name, Priority: type.Priority, Batch: type.Batch ?? 1 }));
    type.Routes.forEach((route, routeIndex) => {
      lines.push(...WrapLines(FormatText(Texts.RepRouteLine, { N: routeIndex + 1, Priority: route.Priority }),
        route.Ops.map((operation) => `${operation.Op} ${operation.Mean}±${operation.Dev}`), '      ', ' → '));
    });
  });
  if (!endValid) return lines;
  const report = last.Report;
  lines.push(Sub(Texts.RepFinal),
    ...TableLines([
      { Title: Texts.RepColType, Width: 16, Left: true }, { Title: Texts.RepColStarted, Width: 6 }, { Title: Texts.RepColCompleted, Width: 6 },
      { Title: Texts.RepColScrapped, Width: 5 }, { Title: Texts.RepColInSystem, Width: 9 }, { Title: Texts.RepColCycle, Width: 13 },
    ], report.Types.map((type, i) => [
      type.Name, type.Started, type.Completed, type.Scrapped, last.End.InSystemByType[i],
      type.Completed > 0 ? ClockText(Math.round(type.AvgCycleTime)) : Dash,
    ])));
  return lines;
}

function StaticCrashes(network, last, endValid) {
  const crashing = network.Machines.filter((machine) => machine.CrashMean > 0);
  const lines = [Section(Texts.RepTopicCrashes), Sub(Texts.RepInitial),
    FormatText(Texts.RepDistribution, { Distribution: DISTRIBUTION_NAMES()[network.Sim.Distribution ?? 'Uniform'] })];
  if (crashing.length === 0) lines.push(Texts.RepNoCrashes);
  else {
    lines.push(...crashing.map((machine) => FormatText(Texts.RepCrashParams, {
      Name: machine.Name, Mean: machine.CrashMean, Repair: machine.RepairMean ?? 0, Dev: machine.RepairDev ?? 0,
    })));
  }
  if (!endValid) return lines;
  const report = last.Report;
  lines.push(Sub(Texts.RepFinal), FormatText(Texts.RepCrashTotals, report));
  if (crashing.length > 0) {
    lines.push(...TableLines([
      { Title: Texts.RepColMachine, Width: 10, Left: true }, { Title: Texts.RepColCrashes, Width: 7 },
      { Title: Texts.RepColDown, Width: 7 }, { Title: Texts.RepColNow, Width: 10, Left: true },
    ], report.Machines.map((machine, i) => [
      machine.Name, machine.Crashes, Percent(machine.DownShare), last.End.Machines[i].State === 'DOWN' ? Texts.RepDown : Dash,
    ])));
  }
  if (report.Scrapped > 0) {
    lines.push(...WrapLines(Texts.RepScrapByType,
      report.Types.filter((type) => type.Scrapped > 0).map((type) => `${type.Name} ${type.Scrapped}`), '    '));
  }
  return lines;
}

const STATIC_BUILDERS = {
  Model: StaticModel, Tracks: (model, ...rest) => StaticTracks(...rest), Machines: (model, ...rest) => StaticMachines(...rest),
  Buffers: (model, ...rest) => StaticBuffers(...rest), Storage: (model, ...rest) => StaticStorage(...rest),
  Workpieces: (model, ...rest) => StaticWorkpieces(...rest), Crashes: (model, ...rest) => StaticCrashes(...rest),
};

// [O] StaticReport – Static aruanne: valitud teemade kaupa algne seis (komponentide parameetrid,
//     mudelist ja Enumerate võrgust) ja lõppseis (viimasest simulatsioonist, kui mudel pole pärast
//     seda muutunud). model – mudelifail, network – Enumerate tulemus, last – LastSimulation().
//     Kutsub: fms.js (Report → Static), testid.
export function StaticReport(model, network, last, topics = STATIC_TOPICS) {
  const changed = last !== null && last.ModelText !== JSON.stringify(model);
  const endValid = last !== null && !changed;
  const lines = HeaderLines(model.Meta?.Name, last, changed);
  if (!endValid) lines.push(last === null ? Texts.RepFinalMissing : Texts.RepFinalChanged);
  for (const topic of STATIC_TOPICS.filter((key) => topics.includes(key))) {
    lines.push('', ...STATIC_BUILDERS[topic](model, network, last, endValid));
  }
  return lines;
}

// =====================================================================
// Dynamic – simulatsiooni käigus kogutud statistika
// =====================================================================

const SHARE_KEYS = ['Process', 'Setup', 'Load', 'Transport', 'Wait'];

// [U] CycleStats – valmis detailide tsükliaeg ja selle osad (originaali ptk 8.5): keskmine,
//     min, max ja komponentide keskmised sekundites. Kutsub: DynamicCycle, DynamicTypes, testid.
export function CycleStats(finished) {
  const cycles = finished.map((item) => item.TimeOut - item.TimeIn);
  const total = cycles.reduce((sum, value) => sum + value, 0);
  const parts = Object.fromEntries(SHARE_KEYS.map((key) => [key, finished.reduce((sum, item) => sum + item.Times[key], 0)]));
  return {
    Count: finished.length,
    Avg: finished.length > 0 ? total / finished.length : 0,
    Min: finished.length > 0 ? Math.min(...cycles) : 0,
    Max: finished.length > 0 ? Math.max(...cycles) : 0,
    AvgParts: Object.fromEntries(SHARE_KEYS.map((key) => [key, finished.length > 0 ? parts[key] / finished.length : 0])),
    Shares: Object.fromEntries(SHARE_KEYS.map((key) => [key, total > 0 ? parts[key] / total : 0])),
  };
}

// [O] DynamicCycle – tsükliaeg Tts ja osakaalud (originaali ptk 8.5): valem, osade tabel
//     tulpadega, suhtarvud. DynamicTypes, DynamicTimeline, DynamicEvents – teised Dynamic
//     teemad. Kutsub: DynamicReport.
function DynamicCycle(report) {
  const stats = CycleStats(report.Finished);
  // lõpurežiim B–D (11d): läbilaskevõime ja rakendatus perioodi 0…T järgi, lõpetamine eraldi real
  const lines = [Section(Texts.RepTopicCycle),
    ...(report.Ending
      ? FormatLines(Texts.RepThroughputPeriod, { Throughput: Decimal(report.ThroughputPerHour), Completed: report.Ending.PeriodCompleted,
        Time: ClockText(report.Ending.Start) })
      : [FormatText(Texts.RepThroughput, { Throughput: Decimal(report.ThroughputPerHour), Completed: report.Completed, Time: ClockText(report.Time) })]),
    ...EndingLines(report),
    FormatText(Texts.RepWip, { Avg: Decimal(report.AvgWip), Max: report.MaxWip }),
  ];
  if (stats.Count === 0) { lines.push(Texts.RepNoFinished); return lines; }
  const names = { Process: Texts.RepPartProcess, Setup: Texts.RepPartSetup, Load: Texts.RepPartLoad, Transport: Texts.RepPartTransport, Wait: Texts.RepPartWait };
  lines.push(
    FormatText(Texts.RepCycle, { Avg: ClockText(Math.round(stats.Avg)), Min: ClockText(stats.Min), Max: ClockText(stats.Max) }),
    '', Texts.RepFormula1, Texts.RepFormula2, '',
    ...TableLines([
      { Title: Texts.RepColPart, Width: 22, Left: true }, { Title: Texts.RepColAvgSeconds, Width: 9 },
      { Title: Texts.RepColShare, Width: 7 }, { Title: '', Width: SHARE_BAR_WIDTH, Left: true },
    ], [
      ...SHARE_KEYS.map((key) => [names[key], Seconds(stats.AvgParts[key]), Percent(report.Shares[key]), Bar(report.Shares[key] * SHARE_BAR_WIDTH)]),
      [Texts.RepPartTotal, Seconds(stats.Avg), Percent(SHARE_KEYS.reduce((sum, key) => sum + report.Shares[key], 0)), ''],
    ]),
    '', FormatText(Texts.RepRatios, {
      Process: Percent(report.Shares.Process + report.Shares.Setup), Wait: Percent(report.Shares.Wait), Transport: Percent(report.Shares.Transport),
    }));
  return lines;
}

function DynamicTypes(report) {
  const lines = [Section(Texts.RepTopicTypes)];
  const rows = report.Types.map((type, typeIndex) => {
    const stats = CycleStats(report.Finished.filter((item) => item.Type === typeIndex));
    if (stats.Count === 0) return [type.Name, 0, Dash, Dash, Dash, Dash, Dash, Dash];
    return [type.Name, stats.Count, ClockText(Math.round(stats.Avg)), ClockText(stats.Min), ClockText(stats.Max),
      Percent(stats.Shares.Process + stats.Shares.Setup), Percent(stats.Shares.Transport), Percent(stats.Shares.Wait)];
  });
  lines.push(...TableLines([
    { Title: Texts.RepColType, Width: 14, Left: true }, { Title: Texts.RepColCompleted, Width: 6 }, { Title: Texts.RepColAvg, Width: 8 },
    { Title: Texts.RepColMin, Width: 8 }, { Title: Texts.RepColMax, Width: 8 }, { Title: Texts.RepColProcessing, Width: 7 },
    { Title: Texts.RepColTransport, Width: 7 }, { Title: Texts.RepColWait, Width: 7 },
  ], rows));
  return lines;
}

// [U] TimelineStep – aegrea samm aruandes: väikseim TIMELINE_STEPS-ist, mis on proovivõtu sammu
//     kordne ja annab kuni TIMELINE_MAX_ROWS rida.
export function TimelineStep(duration, sampleInterval) {
  const steps = TIMELINE_STEPS.filter((step) => step % sampleInterval === 0);
  return steps.find((step) => Math.ceil(duration / step) + 1 <= TIMELINE_MAX_ROWS) ?? steps.at(-1) ?? sampleInterval;
}

// [U] TimelineRows – aegrea punktid aruande jaoks: iga step sekundi järel ja viimane punkt.
export function TimelineRows(timeline, step) {
  return timeline.filter((point, i) => point.Time % step === 0 || i === timeline.length - 1);
}

function DynamicTimeline(report) {
  const timeline = report.Timeline;
  const sample = timeline.length > 1 ? timeline[1].Time - timeline[0].Time : 60;
  const step = TimelineStep(Math.max(report.Time, 1), Math.max(1, sample));
  const rows = TimelineRows(timeline, step);
  const maxCompleted = Math.max(1, ...rows.map((point) => point.Completed));
  let previousCompleted = 0;
  const lines = [Section(Texts.RepTopicTimeline),
    FormatText(Texts.RepTimelineStep, { Step: ClockText(step), Max: maxCompleted }),
    ...TableLines([
      { Title: Texts.RepColTime, Width: 8 }, { Title: Texts.RepColInSystem, Width: 9 }, { Title: Texts.RepColCompleted, Width: 6 },
      { Title: Texts.RepColInterval, Width: 9 }, { Title: Texts.RepColBusy, Width: 4 }, { Title: Texts.RepColDown, Width: 6 },
      { Title: Texts.RepColInBuffers, Width: 9 }, { Title: Texts.RepColGraph, Width: BAR_WIDTH, Left: true },
    ], rows.map((point) => {
      const interval = point.Completed - previousCompleted;
      previousCompleted = point.Completed;
      return [ClockText(point.Time), point.InSystem, point.Completed, interval, point.BusyMachines, point.DownMachines,
        point.BufferFill.reduce((sum, value) => sum + value, 0), Bar(point.Completed / maxCompleted * BAR_WIDTH)];
    })),
  ];
  return lines;
}

function DynamicEvents(report) {
  const entries = Object.entries(report.EventCountByType).sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]));
  return [Section(Texts.RepTopicEvents),
    ...TableLines([
      { Title: Texts.RepColEvent, Width: 14, Left: true }, { Title: Texts.RepColCount, Width: 9 }, { Title: Texts.RepColShare, Width: 7 },
    ], [
      ...entries.map(([name, count]) => [name, count, Percent(count / Math.max(1, report.EventCount))]),
      [Texts.RepPartTotal, report.EventCount, Percent(1)],
    ])];
}

const DYNAMIC_BUILDERS = { Cycle: DynamicCycle, Types: DynamicTypes, Timeline: DynamicTimeline, Events: DynamicEvents };

// [O] DynamicReport – Dynamic aruanne: simulatsiooni käigus kogutud statistika valitud teemade
//     kaupa (tsükliaeg ja osakaalud – originaali ptk 8.5, tüüpide kaupa, aegrida, sündmused).
//     model – praegune mudelifail (muudatuse hoiatuseks) või null; Header: false – ilma päiseta
//     (Static järel samas aruandes). Kutsub: fms.js, testid.
export function DynamicReport(last, model, topics = DYNAMIC_TOPICS, { Header = true } = {}) {
  const changed = model !== null && last.ModelText !== JSON.stringify(model);
  const lines = Header ? HeaderLines(last.Report.Model, last, changed) : [];
  for (const topic of DYNAMIC_TOPICS.filter((key) => topics.includes(key))) {
    lines.push('', ...DYNAMIC_BUILDERS[topic](last.Report));
  }
  return lines;
}

// =====================================================================
// Väljund: fail ja ekraan
// =====================================================================

// [U] LineText – aruande rea tekst.
export function LineText(line) {
  return typeof line === 'string' ? line : line.Text;
}

// [O] ReportText – aruanne tekstifailiks: pealkiri, koostamise aeg, read; teema pealkiri
//     joonitakse alla. Kutsub: fms.js (Output → File, F aruande vaates), testid.
export function ReportText(title, lines, createdText) {
  const out = [`FMSS – ${title}`, FormatText(Texts.RepCreated, { Created: createdText }), ''];
  for (const line of lines) {
    const text = LineText(line);
    out.push(text);
    if (typeof line !== 'string' && line.Kind === 'Section') out.push('═'.repeat(text.length));
  }
  return `${out.join('\n')}\n`;
}

// [U] ReportFileName – aruande failinimi: 'demo.fms.json' + 'static' → 'demo-static.txt'.
export function ReportFileName(modelFile, modelName, kind) {
  const base = (modelFile || modelName || Texts.DesktopUntitled).replace(/\.fms\.json$|\.json$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_');
  return `${base}-${kind}.txt`;
}

// [O] ShowReport – aruanne ekraanile: töölaual kerimisega aken (nooled, PgUp/PgDn, Home/End,
//     hiire ratas, kerimisriba). Esc sulgeb ja taastab eelmise vaate (nt animaator); F – faili.
//     options: OnFile() – faili salvestamine, OnClose(). Kutsub: fms.js.
export function ShowReport(title, lines, { OnFile = null, OnClose = null } = {}) {
  const previous = ReportActive() ? ReportView.Previous : GetDesktopView();
  const desktopView = { Painter: ReportPainter, Input: ReportInput, StatusKeys: () => Texts.RepStatusKeys };
  ReportView = { Title: title, Lines: lines, Top: 0, Previous: previous, OnFile, OnClose, Rows: 1, Layout: null, DesktopView: desktopView };
  SetDesktopView(desktopView);
}

// [U] ReportActive – kas aruande vaade on töölaual (mitte asendatud nt redaktoriga).
export function ReportActive() {
  return ReportView !== null && GetDesktopView() === ReportView.DesktopView;
}

// [U] CloseReport – sulgeb aruande vaate ja taastab eelmise (nt animaator). Kutsub: Esc,
//     fms.js (uus mudel, redaktor, Quit).
export function CloseReport() {
  if (!ReportView) return;
  const view = ReportView;
  const active = ReportActive();
  ReportView = null;
  if (active) SetDesktopView(view.Previous);
  if (view.OnClose) view.OnClose();
}

// [U] ReportLayout – aruande akna osad: aken, tekstiala, nähtavate ridade arv, kerimisriba.
function ReportLayout(theme, desktop) {
  const egaLike = theme.Name === 'EGA';
  const textWidth = theme.TextWidth('M'.repeat(REPORT_WIDTH), { Mono: true });
  const width = egaLike ? desktop.Width - 8 : Math.min(desktop.Width - 16, Math.ceil(textWidth + 56));
  const height = desktop.Height - (egaLike ? 7 : 8);
  const x = egaLike ? desktop.X : Math.round(desktop.X + (desktop.Width - width) / 2);
  const y = egaLike ? desktop.Y : desktop.Y + 4;
  const textY = y + ROW_HEIGHT + 4;
  const rows = Math.max(1, Math.floor((height - 2 * ROW_HEIGHT - 8) / ROW_HEIGHT));
  return {
    X: x, Y: y, Width: width, Height: height, TextX: x + 16, TextY: textY, Rows: rows,
    Bar: { X: x + width - 16, Y: textY, Width: egaLike ? 8 : 5, Height: rows * ROW_HEIGHT },
    FooterY: y + height - ROW_HEIGHT - 4,
  };
}

// Rea liik → teema roll (värv).
const ROLE_OF_KIND = { Section: 'WindowText', Sub: 'WindowLabel', Head: 'WindowLabel', Warning: 'Error' };

// [U] ClampTop, ScrollReport – esimene nähtav rida lubatud piirides; kerimine.
function ClampTop(view) {
  view.Top = Math.max(0, Math.min(view.Top, view.Lines.length - view.Rows));
}

// [U] ReportPainter – aruande vaate joonistaja (töölaua vaade): aken, read, kerimisriba, asukoht.
function ReportPainter(theme, desktop) {
  const view = ReportView;
  if (!view) return;
  const layout = ReportLayout(theme, desktop);
  view.Layout = layout;
  view.Rows = layout.Rows;
  ClampTop(view);
  theme.Panel(layout.X, layout.Y, layout.Width, layout.Height, 'Window');
  theme.WindowTitle(layout.X, layout.Y + 2, layout.Width, view.Title);
  for (let row = 0; row < layout.Rows && view.Top + row < view.Lines.length; row++) {
    DrawReportLine(theme, layout.TextX, layout.TextY + row * ROW_HEIGHT, view.Lines[view.Top + row]);
  }
  // kerimisriba: rada ja liugur (nähtava osa suurus ja koht)
  const bar = layout.Bar;
  theme.FillRect(bar.X, bar.Y, bar.Width, bar.Height, 'MenuDisabled');
  const total = Math.max(view.Lines.length, layout.Rows);
  const thumbHeight = Math.max(ROW_HEIGHT / 2, bar.Height * layout.Rows / total);
  const thumbY = bar.Y + (bar.Height - thumbHeight) * (total > layout.Rows ? view.Top / (total - layout.Rows) : 0);
  theme.FillRect(bar.X, thumbY, bar.Width, thumbHeight, 'MenuSelected');
  const position = FormatText(Texts.RepPosition, {
    From: Math.min(view.Lines.length, view.Top + 1), To: Math.min(view.Lines.length, view.Top + layout.Rows), Total: view.Lines.length,
  });
  theme.Text(layout.X + layout.Width - 16 - theme.TextWidth(position), layout.FooterY, position, 'WindowLabel');
}

// [U] DrawReportLine – aruande rida püsilaiusega kirjas. EGA-s märgid nagu tekstiekraanil
//     (─ ja ▄ fondist); kaasaegses on tabeli joon ja tulbad ristkülikud (─ ja ▄ pole igas
//     püsilaiusega fondis sama laiad), tulbad aktsendivärviga.
function DrawReportLine(theme, x, y, line) {
  const kind = typeof line === 'string' ? null : line.Kind;
  const role = ROLE_OF_KIND[kind] ?? 'WindowText';
  let text = LineText(line);
  if (theme.Name !== 'EGA') {
    const charWidth = theme.TextWidth('M', { Mono: true });
    const rule = text.match(/^( *)(─+)$/);
    if (rule) {
      theme.FillRect(x + rule[1].length * charWidth, y + ROW_HEIGHT / 2, rule[2].length * charWidth, 0.75, 'WindowLabel');
      return;
    }
    const bar = text.match(/▄+$/);
    if (bar) {
      text = text.slice(0, bar.index);
      theme.FillRect(x + bar.index * charWidth, y + 4, bar[0].length * charWidth, ROW_HEIGHT - 7, 'MenuSelected');
    }
  }
  theme.Text(x, y, text, role, { Mono: true, Bold: kind === 'Section' });
}

function ScrollReport(view, delta) {
  view.Top += delta;
  ClampTop(view);
  RequestRedraw();
}

// [U] ReportInput – klahvid (nooled, PgUp/PgDn, tühik, Home/End, F, Esc/Enter), hiire ratas,
//     klõps kerimisribal.
function ReportInput(input) {
  const view = ReportView;
  if (!view) return false;
  if (input.Kind === 'key') {
    const page = Math.max(1, view.Rows - 1);
    switch (input.Name) {
      case 'ArrowDown': ScrollReport(view, 1); return true;
      case 'ArrowUp': ScrollReport(view, -1); return true;
      case 'PageDown': case ' ': ScrollReport(view, page); return true;
      case 'PageUp': ScrollReport(view, -page); return true;
      case 'Home': ScrollReport(view, -view.Lines.length); return true;
      case 'End': ScrollReport(view, view.Lines.length); return true;
      case 'f': case 'F': if (view.OnFile) view.OnFile(); return true;
      case 'Escape': case 'Enter': CloseReport(); return true;
      default: return false;
    }
  }
  if (input.Kind === 'wheel') {
    // tavaline hiire ratas annab ~100 pikslit sammu kohta (3 rida); puuteplaat väiksemaid samme
    ScrollReport(view, Math.sign(input.Delta) * Math.max(1, Math.round(Math.abs(input.Delta) / 100 * WHEEL_LINES)));
    return true;
  }
  if (input.Kind === 'down') {
    // klõps kerimisribal: liugur sellesse kohta (paigutus viimasest joonistamisest)
    const bar = view.Layout?.Bar;
    if (bar && input.Point.X >= bar.X - 4 && input.Point.X < bar.X + bar.Width + 4 && input.Point.Y >= bar.Y && input.Point.Y < bar.Y + bar.Height) {
      const part = (input.Point.Y - bar.Y) / bar.Height;
      view.Top = Math.round(part * Math.max(0, view.Lines.length - view.Rows));
      ClampTop(view);
      RequestRedraw();
    }
    return true;
  }
  return false;
}

// =====================================================================
// Simulatsiooni kokkuvõte (Simulate)
// =====================================================================

// [U] SimSummaryLines – simulatsiooni kokkuvõte dialoogi ridadeks (Simulate, fms.js). Pinke ja puhvreid
//     näidatakse kuni SIM_SHOWN_OBJECTS, aga vähem, kui muidu ei mahuks maxLines reale (EGA-s 19 rida –
//     suures mudelis jäid nupud ekraani alla, etapp 11c leid 6); ülejäänud „… ja veel n“, täielik info aruandes.
export function SimSummaryLines(report, warnings, maxLines = Infinity) {
  let lines = [];
  for (let shown = SIM_SHOWN_OBJECTS; shown >= 1; shown--) {
    lines = SummaryLinesShown(report, warnings, shown);
    if (lines.length <= maxLines) break;
  }
  return lines;
}

// Kokkuvõtte read, kui pinke ja puhvreid näidatakse kuni shown tükki.
function SummaryLinesShown(report, warnings, shown) {
  const limited = (items, format) => {
    const lines = items.slice(0, shown).map(format);
    if (items.length > shown) lines.push(FormatText(Texts.SimMore, { Count: items.length - shown }));
    return lines;
  };
  const lines = [
    FormatText(Texts.SimHeader, { Name: report.Model || Texts.DesktopUntitled, Time: ClockText(report.Time), Seed: report.Seed }),
  ];
  if (report.Deadlock) {
    lines.push({ Text: FormatText(Texts.SimDeadlock, { Time: ClockText(report.Time), Reason: report.DeadlockReason }), Role: 'Error' });
  }
  // lõpurežiim (11d): lõpetamine (B–D) või tellimus (E); A korral rida pole (nagu enne)
  const ending = report.Ending ?? null;
  if (ending !== null) {
    lines.push(FormatText(ending.Capped ? Texts.SimEndingCapped : Texts.SimEnding, {
      Mode: EndModeName(report.EndMode), Duration: ClockText(ending.Duration), Completed: ending.CompletedAfter,
      Time: ClockText(report.Time), Left: ending.LeftInSystem }));
  } else if (report.Order) {
    lines.push(FormatText(report.Order.Done ? Texts.SimOrderDone : Texts.SimOrderLeft, {
      Sequence: SequenceName(report.Order.Sequence), Completed: report.Order.Completed, Total: report.Order.Total,
      Makespan: report.Order.Makespan !== null ? ClockText(report.Order.Makespan) : '' }));
  }
  const cycle = ClockText(Math.round(report.AvgCycleTime));
  lines.push(
    FormatText(Texts.SimCounts, report),
    ...(report.Crashes > 0 ? [FormatText(Texts.SimCrashes, report)] : []),
    ending !== null
      ? FormatText(Texts.SimThroughputPeriod, { Throughput: Decimal(report.ThroughputPerHour), Cycle: cycle, Duration: ClockText(ending.Start) })
      : FormatText(Texts.SimThroughput, { Throughput: Decimal(report.ThroughputPerHour), Cycle: cycle }),
    FormatText(Texts.SimShares1, { Process: Percent(report.Shares.Process), Setup: Percent(report.Shares.Setup), Load: Percent(report.Shares.Load) }),
    FormatText(Texts.SimShares2, { Transport: Percent(report.Shares.Transport), Wait: Percent(report.Shares.Wait) }),
    ...limited(report.Machines, (machine) => FormatText(machine.Crashes > 0 ? Texts.SimMachineDown : Texts.SimMachine, {
      Name: machine.Name, Utilization: Percent(machine.Utilization), Processing: Percent(machine.ProcessingShare), Ops: machine.OpsDone,
      Down: Percent(machine.DownShare), Crashes: machine.Crashes,
    })),
    ...limited(report.Buffers, (buffer) => FormatText(Texts.SimBuffer, {
      Name: buffer.Name, Avg: Decimal(buffer.AvgFill), Capacity: buffer.Capacity, Max: buffer.MaxFill,
    })),
    ...report.Tracks.flatMap((track) => {
      // mitu kohta alusel (7c): täituvus ja kogumissõidud
      const places = track.Places > 1
        ? [FormatText(Texts.SimPlaces, { Places: track.Places, Avg: Decimal(track.AvgLoad), Max: track.MaxLoad, Pooled: track.Pooled })]
        : [];
      if (!track.Discrete) return [FormatText(Texts.SimTrack, { Name: track.Name, Moving: Percent(track.MovingShare), Stops: track.Stops }), ...places];
      const average = (state) => track.Carts.reduce((sum, cart) => sum + cart[state], 0) / track.Carts.length;
      return [
        FormatText(Texts.SimCarts, { Name: track.Name, Count: track.Carts.length, Collisions: track.Collisions }),
        FormatText(Texts.SimCartsShares, {
          Loaded: Percent(average('LOADED')), Empty: Percent(average('EMPTY')),
          Loading: Percent(average('LOADING')), Waiting: Percent(average('WAIT_ZONE')),
        }),
        ...places,
      ];
    }),
    ...report.Connectors.map((connector) => FormatText(Texts.SimConnector, connector)),
  );
  if (report.StorageCount !== null) lines.push(FormatText(Texts.SimStorage, { Count: report.StorageCount, Parked: report.Parked }));
  for (const warning of warnings) lines.push({ Text: FormatText(Texts.SimWarning, { Message: warning.Message }), Role: 'Error' });
  lines.push('', Texts.SimReportHint);
  return lines;
}
