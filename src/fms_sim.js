// FMSS – simulaator (operatiivtase).
// Vastab originaali moodulile FMS_SIM.PAS (+ SUPPORT.INC). Disain: DISAIN.md osad 1–7.
// Nimed ja tunnused [O]/[T]/[U]: DISAIN.md osa 12.
//
// Tekkis prototüübist (proto/fms_sim.js, etapp 2); loogika on sama, juurde tulid:
//  - Enumerate – mudelifaili ruudustikust simulatsiooni võrk (rajad, jaamad, seosed) ja
//    andmekontroll (DetectOpenCons, FindConflicts);
//  - statistika täiendus (olekute osakaalud, aegrida, tüüpide kaupa).
//
// Etapp 7a: mitu pidevat rada (silmus või avatud konveier), konnektorid radade vahel ja
// transporditee üle mitme raja (StationPaths).
//
// Piirangud (tulevad hiljem): diskreetseid radu pole (etapp 7b), alusel 1 detail (7c),
// rikkeid pole (etapp 8).
//
// Moodul ei kasuta brauserit, nii et seda saab testida Node'iga.

import { IconTypes, DIRECTIONS } from './fms_glb.js';
import { Texts, FormatText } from './fms_lng.js';

// =====================================================================
// Globaalsed andmed
// =====================================================================

let SYSTEM_TIME = 0;          // [O] simulatsiooni kell, sekundit algusest
let NO_EVENTS = true;         // [O] käesolevaks hetkeks pole rohkem sündmusi
let SIMULATION_DONE = false;  // [O] simulatsioon on läbi
let DEADLOCK = false;         // [U] ummik, mida ei õnnestunud lahendada

let FirstAtMoment = null;     // [O] viit Event Listi esimesele kirjele

let Model = null;             // [U] simulatsiooni võrk (Enumerate tulemus), sisendandmed
let Options = null;           // [U] käivitamise seaded (nt invariantide kontroll)
let Tracks = [];              // [O] rajad (siin: pidevad konveierid – silmus või avatud)
let StationArray = [];        // [U] jaamad, kus alused peatuvad ja laaditakse
let ConnectorArray = [];      // [O] konnektorid: radade ülekandekoht, mahutab 1 detaili
let TransportPaths = [];      // [U] lühimad teed jaamast jaama (StationPaths tulemus)
let MachineArray = [];        // [O] tööpingid
let BufferArray = [];         // [O] puhvrid
let Storage = null;           // [T] keskladu (ToCS); null, kui mudelis pole
let Workpieces = [];          // [O] detailitüübid
let SysWPArray = [];          // [O] süsteemi toodud konkreetsed detailid (indeks = Id)
let FromCSQueue = [];         // [T] FromCS jaamas ootavate detailide Id-d
let Stats = null;             // [T] kogutud statistika
let RandomState = 0;          // [U] juhuarvugeneraatori olek
let LastEventTime = 0;        // [U] viimase töödeldud sündmuse aeg (ummiku avastamiseks)
let TotalPlaces = 0;          // [O] Ntm + Nmt + Nbuf (lk 42)

const MAX_EVENTS_PER_STEP = 100000;  // [U] kaitse lõputu tsükli vastu
const PARKING_RESERVE = 2;           // [U] kesklao kohti, mis jäetakse ummiku lahendamiseks (5.3)
const SAMPLE_INTERVAL = 60;          // [U] aegrea (Stats.Timeline) samm vaikimisi, s
const ARC_LENGTH = Math.PI / 4;      // [T] kaare pikkus ikoonides (veerandring raadiusega 1/2)
const POSITION_DECIMALS = 1000;      // [U] asukohad ümardatakse 0,001 cm täpsuseni

// Detaili olekud ja statistika kategooria, kuhu olekus veedetud aeg läheb. [T]
const WP_STATE_CATEGORY = {
  ENTERING: 'Wait',      // InSys on planeeritud, detail pole veel FromCS-is
  WAIT_DEST: 'Wait',     // ootab, et Planner leiaks sihtkoha
  WAIT_PICKUP: 'Wait',   // sihtkoht broneeritud, ootab alust
  WAIT_MACHINE: 'Wait',  // puhvri sissetuleval kohal, ootab tööpinki
  PARKED: 'Wait',        // ajutiselt kesklaos (ummiku lahendus)
  LOADING: 'Load',       // peale- või mahalaadimine
  ON_PALLET: 'Transport',
  SETUP: 'Setup',
  PROCESSING: 'Process',
  GONE: 'Wait',
};

// =====================================================================
// Enumerate – simulatsiooni võrk ruudustikust (DISAIN.md 2)
// =====================================================================

// Tööpingi ikoon → kus on sissetulev ja väljaminev puhver (dy: -1 kohal, +1 all). [T]
const MACHINE_BUFFER_SIDES = {
  MachToolDown:     { In: 1, Out: 1 },
  MachToolUp:       { In: -1, Out: -1 },
  MachToolThruDown: { In: -1, Out: 1 },
  MachToolThruUp:   { In: 1, Out: -1 },
};
const IN_BUFFER_KINDS = ['InBuf', 'InOutBuf', 'TurnBuf'];    // [T] sobivad sissetulevaks puhvriks
const OUT_BUFFER_KINDS = ['OutBuf', 'InOutBuf', 'TurnBuf'];  // [T] sobivad väljaminevaks puhvriks

// [U] CellKey, CellPath, RoundPosition – lahtri võti; lahter veateate jaoks; asukoha ümardus.
const CellKey = (x, y) => `${x},${y}`;
const CellPath = cell => `Layout (${cell.X}, ${cell.Y})`;
const RoundPosition = value => Math.round(value * POSITION_DECIMALS) / POSITION_DECIMALS;

// [U] ObjectName – objekti nimi kasutajale: BUF1, MT1 (pingi nimi), FromCS …
function ObjectName(context, cell) {
  const kind = IconTypes[cell.T].Kind;
  if (kind === 'Buffer') return `BUF${cell.N}`;
  if (kind === 'Machine') return context.Model.Machines[cell.N - 1].Name;
  if (kind === 'Connector') return context.ConnectorNames.get(CellKey(cell.X, cell.Y)) ?? 'CON';
  return cell.T;
}

// [U] EnumError, EnumWarning – lisavad kontrolli tulemuse { Path, Message }.
function EnumError(context, path, template, values = {}) {
  context.Errors.push({ Path: path, Message: FormatText(template, values) });
}
function EnumWarning(context, path, template, values = {}) {
  context.Warnings.push({ Path: path, Message: FormatText(template, values) });
}

// [U] Neighbor – naaberlahter antud suunas või null (tühi / ruudustikust väljas).
function Neighbor(context, cell, direction) {
  const step = DIRECTIONS[direction];
  const neighbor = context.Grid.get(CellKey(cell.X + step.DX, cell.Y + step.DY));
  return neighbor && neighbor.T !== 'Empty' ? neighbor : null;
}

// [U] OtherPort – kaheküljelise ikooni teine külg.
function OtherPort(cell, port) {
  return IconTypes[cell.T].Ports.find(other => other !== port);
}

// [O nimi, U sisu] Enumerate – käib ruudustiku läbi ja koostab simulatsiooni võrgu: rada
//     (silmus, pikkus, ikoonide asukohad), lõigud, jaamad ning puhvrite ja tööpinkide seosed.
//     Samal ajal kontrollib andmeid (DetectOpenCons, FindConflicts; originaali vead 1–8).
//     Eeldab, et CheckModel on vigadeta. Tagastab { Network, Errors, Warnings };
//     kui Errors pole tühi, on Network null. Kutsub: fms.js (Simulate), testid. Sündmusi ei lisa.
export function Enumerate(model) {
  const context = { Model: model, Grid: new Map(), Errors: [], Warnings: [], DotsUsed: new Set(), BranchCells: new Set(),
                    ConnectorNames: new Map(), EdgeLengthsUsed: new Set() };
  for (const cell of model.Layout.Cells) context.Grid.set(CellKey(cell.X, cell.Y), cell);
  const cells = model.Layout.Cells.filter(cell => cell.T !== 'Empty');
  const trackCells = cells.filter(cell => IconTypes[cell.T].Kind === 'Track' && !cell.Dot);
  const result = () => ({ Network: null, Errors: context.Errors, Warnings: context.Warnings });

  // konnektorite nimed joonise järjekorras (ülevalt alla, vasakult paremale): CON1, CON2 …
  cells.filter(cell => IconTypes[cell.T].Kind === 'Connector')
    .sort((first, second) => first.Y - second.Y || first.X - second.X)
    .forEach((cell, i) => context.ConnectorNames.set(CellKey(cell.X, cell.Y), `CON${i + 1}`));

  // Mida see versioon veel ei toeta
  const usedTracks = [...new Set(trackCells.map(cell => cell.N - 1))].sort((a, b) => a - b);
  model.Tracks.forEach((track, trackIndex) => {
    if (!usedTracks.includes(trackIndex)) {
      EnumWarning(context, `Tracks[${trackIndex + 1}]`, Texts.EnumNotOnLayout, { Object: track.Name });
    }
  });
  if (usedTracks.length === 0) EnumError(context, 'Layout', Texts.EnumNoTrack);
  for (const trackIndex of usedTracks) {
    const track = model.Tracks[trackIndex];
    const path = `Tracks[${trackIndex + 1}]`;
    if (track.Mode !== 'Continuous') EnumError(context, `${path}.Mode`, Texts.EnumLater, { What: Texts.EnumLaterDiscrete, Stage: '7b' });
    if (track.PlacesPerCart > 1) EnumError(context, `${path}.PlacesPerCart`, Texts.EnumLater, { What: Texts.EnumLaterPlaces, Stage: '7c' });
  }
  if (context.Errors.length > 0) return result();

  // Rajad: suunanoole järgi silmus või avatud konveier; harudel ja otstes jaamad
  const traces = [];
  for (const trackIndex of usedTracks) {
    const trace = TraceTrack(context, trackIndex, trackCells);
    if (trace !== null) traces.push(trace);
  }
  if (context.Errors.length > 0) return result();   // katkine rada: muud vead oleksid selle tagajärg
  const links = traces.flatMap(trace => FindStations(context, trace));
  DetectOpenCons(context, cells, traces);
  const objects = CheckObjects(context, cells, links);
  const machineLinks = LinkMachines(context, cells);
  if (context.Errors.length > 0) return result();

  const geometries = traces.map(trace => MeasureTrack(context, trace, links.filter(link => link.Trace === trace)));
  (model.EdgeLengths || []).forEach((entry, i) => {
    if (!context.EdgeLengthsUsed.has(i)) EnumError(context, `EdgeLengths[${i + 1}]`, Texts.EnumEdgeNotFound);
  });
  if (context.Errors.length > 0) return result();
  const network = BuildNetwork(context, traces, geometries, links, objects, machineLinks);
  FindConflicts(context, network, traces);
  if (context.Errors.length > 0) return result();
  return { Network: network, Errors: context.Errors, Warnings: context.Warnings };
}

// [U] TraceTrack – käib pideva raja läbi suunanoole järgi: kõigepealt noole suunas, ja kui rada
//     ei sulgu (avatud konveier), ka vastuvoolu kuni algusesse. Tagastab { TrackIndex, Sequence,
//     Closed, StartEnd, FinishEnd, Unvisited }: ikoonide järjestus liikumissuunas
//     [{ Cell, Entry, Exit, Unit }] (Unit = pikkus ikoonides), kas silmus, avatud raja otsad
//     ({ Kind: 'Free' | 'Connector', Cell, Port, Connector }) ja raja ikoonid, mis rajale ei jäänud;
//     null, kui ikoonid ei sobi kokku või suunad on vastuolus.
//     Kontrollib: suund olemas ja kooskõlas (viga 5), ühendused (1), harud ja ristmikud (2).
//     Kutsub: Enumerate.
function TraceTrack(context, trackIndex, trackCells) {
  const name = context.Model.Tracks[trackIndex].Name;
  const ownCells = trackCells.filter(cell => cell.N - 1 === trackIndex);
  const arrowCells = ownCells.filter(cell => cell.Dir !== undefined);
  if (arrowCells.length === 0) {
    EnumError(context, `Tracks[${trackIndex + 1}]`, Texts.EnumNoDirection, { Track: name });
    return null;
  }
  const start = arrowCells[0];
  const first = { Cell: start, Entry: OtherPort(start, start.Dir), Exit: start.Dir, Unit: IconTypes[start.T].Arc ? ARC_LENGTH : 1 };
  const visited = new Set([CellKey(start.X, start.Y)]);
  const forward = WalkTrack(context, trackIndex, start, start.Dir, visited, first.Entry);
  if (forward === null) return null;
  let sequence = [first, ...forward.Items];
  const closed = forward.End.Kind === 'Closed';
  let startEnd = null;
  if (!closed) {
    const backward = WalkTrack(context, trackIndex, start, first.Entry, visited, null);
    if (backward === null) return null;
    const upstream = backward.Items.reverse().map(item => ({ ...item, Entry: item.Exit, Exit: item.Entry }));
    sequence = [...upstream, ...sequence];
    startEnd = backward.End;
  }

  const position = new Map(sequence.map((item, index) => [CellKey(item.Cell.X, item.Cell.Y), index]));
  for (const arrow of arrowCells) {
    const index = position.get(CellKey(arrow.X, arrow.Y));
    if (index !== undefined && sequence[index].Exit !== arrow.Dir) {
      EnumError(context, CellPath(arrow), Texts.EnumDirConflict, { Track: name, X: arrow.X, Y: arrow.Y });
    }
  }
  if (context.Errors.length > 0) return null;
  return {
    TrackIndex: trackIndex, Sequence: sequence, Closed: closed,
    StartEnd: startEnd, FinishEnd: closed ? null : forward.End,
    Unvisited: ownCells.filter(own => !position.has(CellKey(own.X, own.Y))),
  };
}

// [U] WalkTrack – käib raja ikoone mööda lahtrist cell külje exit kaudu edasi, kuni rada sulgub
//     (jõutakse alguslahtrisse küljest closeEntry; closeEntry = null – ei sulgu), lõpeb (tühi
//     lahter, objekt või konnektor) või tuleb viga. visited – läbitud lahtrid (ühine mõlemas suunas).
//     Tagastab { Items, End } (Items ilma alguslahtrita) või null. Kutsub: TraceTrack.
function WalkTrack(context, trackIndex, cell, exit, visited, closeEntry) {
  const name = context.Model.Tracks[trackIndex].Name;
  const startCell = cell;
  const items = [];
  const badJoin = next => {
    EnumError(context, CellPath(next), Texts.EnumBadJoin, { X: cell.X, Y: cell.Y, X2: next.X, Y2: next.Y });
    return null;
  };
  for (;;) {
    const next = Neighbor(context, cell, exit);
    const nextEntry = DIRECTIONS[exit].Opposite;
    const free = { Items: items, End: { Kind: 'Free', Cell: cell, Port: exit, Connector: null } };
    if (next === null) return free;
    const icon = IconTypes[next.T];
    const faces = Boolean(icon.Ports) && icon.Ports.includes(nextEntry);
    if (icon.Kind === 'Connector') {
      if (!faces) return badJoin(next);
      return { Items: items, End: { Kind: 'Connector', Cell: cell, Port: exit, Connector: next } };
    }
    if (icon.Kind !== 'Track') return free;                       // objekt raja otsas
    if (next.Dot) return faces ? badJoin(next) : free;            // pidev rada ei lähe punktiiri
    if (next.N - 1 !== trackIndex) {
      if (!faces) return free;
      EnumError(context, CellPath(next), Texts.EnumTracksTouch,
        { Track: name, Track2: context.Model.Tracks[next.N - 1].Name, X: next.X, Y: next.Y });
      return null;
    }
    if (!faces) return badJoin(next);
    if (next === startCell && closeEntry !== null) {
      if (nextEntry !== closeEntry) return badJoin(next);
      return { Items: items, End: { Kind: 'Closed' } };
    }
    const key = CellKey(next.X, next.Y);
    if (visited.has(key)) {
      EnumError(context, CellPath(next), Texts.EnumCrossLoop, { Track: name, X: next.X, Y: next.Y });
      return null;
    }
    if (icon.Ports.length !== 2) {   // ristmik
      EnumError(context, CellPath(next), Texts.EnumBranch, { Track: name, X: next.X, Y: next.Y });
      return null;
    }
    visited.add(key);
    const nextExit = OtherPort(next, nextEntry);
    items.push({ Cell: next, Entry: nextEntry, Exit: nextExit, Unit: icon.Arc ? ARC_LENGTH : 1 });
    cell = next;
    exit = nextExit;
  }
}

// [U] FindStations – iga hargnemise (Tee*) haru peab olema punktiirühendus, mis viib puhvri,
//     lao, väljundi või konnektorini: seal tekib jaam (DISAIN.md 2). Pideval rajal muid harusid
//     ei tohi olla (viga 2). Avatud raja ots konnektori kõrval on samuti jaam (otsaikooni keskel).
//     Tagastab [{ Trace, SeqIndex, Object, Link, Side, AtEnd }] (Side – konnektori külg).
//     Kutsub: Enumerate.
function FindStations(context, trace) {
  const name = context.Model.Tracks[trace.TrackIndex].Name;
  const links = [];
  trace.Sequence.forEach((item, seqIndex) => {
    const branch = IconTypes[item.Cell.T].Branch;
    if (!branch) return;
    const first = Neighbor(context, item.Cell, branch);
    if (first !== null && IconTypes[first.T].Kind === 'Track' && !first.Dot) {
      context.BranchCells.add(first);
      EnumError(context, CellPath(item.Cell), Texts.EnumBranch, { Track: name, X: item.Cell.X, Y: item.Cell.Y });
      return;
    }
    const link = FollowDotLink(context, item.Cell, branch);
    if (link !== null) {
      links.push({ Trace: trace, SeqIndex: seqIndex, Object: link.Object, Link: link.Cells, Side: link.Side, AtEnd: false });
    }
  });
  if (!trace.Closed) {
    const lastIndex = trace.Sequence.length - 1;
    for (const [end, seqIndex] of [[trace.StartEnd, 0], [trace.FinishEnd, lastIndex]]) {
      if (end.Kind !== 'Connector') continue;
      links.push({ Trace: trace, SeqIndex: seqIndex, Object: end.Connector, Link: [],
                   Side: DIRECTIONS[end.Port].Opposite, AtEnd: true });
    }
  }
  return links;
}

// [T] FollowDotLink – järgib punktiirühendust (pikkus 0, lk 54) hargnemisest objektini.
//     Konnektorisse peab punktiir jõudma konnektori raja küljest. Tagastab { Object, Cells, Side }
//     või null (viga: ühendus ei vii objektini). Kutsub: FindStations.
function FollowDotLink(context, fromCell, port) {
  const cells = [];
  let cell = fromCell;
  for (let steps = 0; steps <= context.Grid.size; steps++) {
    const next = Neighbor(context, cell, port);
    if (next === null) break;
    const entry = DIRECTIONS[port].Opposite;
    const kind = IconTypes[next.T].Kind;
    if (kind === 'Buffer' || kind === 'Storage' || kind === 'Output') return { Object: next, Cells: cells, Side: null };
    if (kind === 'Connector') {
      if (!IconTypes[next.T].Ports.includes(entry)) break;
      return { Object: next, Cells: cells, Side: entry };
    }
    const icon = IconTypes[next.T];
    if (kind !== 'Track' || !next.Dot || icon.Ports.length !== 2 || !icon.Ports.includes(entry)) break;
    context.DotsUsed.add(CellKey(next.X, next.Y));
    cells.push([next.X, next.Y]);
    cell = next;
    port = OtherPort(next, entry);
  }
  EnumError(context, CellPath(fromCell), Texts.EnumDotDangling, { X: fromCell.X, Y: fromCell.Y });
  return null;
}

// [O] DetectOpenCons – vabad otsad: raja ikoonid, mis rajale ei jäänud (v.a harud, millest
//     FindStations juba teatas), ja punktiirühendused, mis pole rajaga ühendatud.
//     (Raja enda katkestused leiab TraceTrack.) Kutsub: Enumerate.
function DetectOpenCons(context, cells, traces) {
  for (const trace of traces) {
    const name = context.Model.Tracks[trace.TrackIndex].Name;
    for (const cell of trace.Unvisited) {
      if (!context.BranchCells.has(cell)) {
        EnumError(context, CellPath(cell), Texts.EnumNotConnected, { Track: name, X: cell.X, Y: cell.Y });
      }
    }
  }
  for (const cell of cells) {
    if (IconTypes[cell.T].Kind === 'Track' && cell.Dot && !context.DotsUsed.has(CellKey(cell.X, cell.Y))) {
      EnumError(context, CellPath(cell), Texts.EnumDotUnused, { X: cell.X, Y: cell.Y });
    }
  }
}

// [U] CheckObjects – puhvrid, keskladu ja väljund: iga objekt on joonisel üks kord ja
//     ühendatud rajaga täpselt ühe jaama kaudu; FromCS ja SysOut on olemas. Konnektor ühendab
//     kahte eri rada (mõlemal küljel üks). Tagastab { FromCS, ToCS, SysOut, Connectors }.
//     Kutsub: Enumerate.
function CheckObjects(context, cells, links) {
  const connectors = cells.filter(cell => IconTypes[cell.T].Kind === 'Connector');
  for (const cell of connectors) {
    const own = links.filter(link => link.Object === cell);
    const values = { Object: ObjectName(context, cell), X: cell.X, Y: cell.Y };
    if (own.length < 2) EnumError(context, CellPath(cell), Texts.EnumConnectorOpen, values);
    else if (own[0].Trace === own[1].Trace) {
      EnumError(context, CellPath(cell), Texts.EnumConnectorSameTrack,
        { ...values, Track: context.Model.Tracks[own[0].Trace.TrackIndex].Name });
    }
  }
  const model = context.Model;
  const linkCount = new Map();
  for (const link of links) {
    const key = CellKey(link.Object.X, link.Object.Y);
    linkCount.set(key, (linkCount.get(key) || 0) + 1);
  }
  const seenBuffers = new Set();
  const found = { FromCS: [], ToCS: [], SysOut: [] };
  for (const cell of cells) {
    const kind = IconTypes[cell.T].Kind;
    if (kind !== 'Buffer' && kind !== 'Storage' && kind !== 'Output') continue;
    const objectName = ObjectName(context, cell);
    if (kind === 'Buffer') {
      if (seenBuffers.has(cell.N)) EnumError(context, CellPath(cell), Texts.EnumIconTwice, { Object: objectName });
      seenBuffers.add(cell.N);
    } else {
      found[cell.T].push(cell);
    }
    const count = linkCount.get(CellKey(cell.X, cell.Y)) || 0;
    if (count === 0) EnumError(context, CellPath(cell), Texts.EnumObjectNotLinked, { Object: objectName });
    if (count > 1) EnumError(context, CellPath(cell), Texts.EnumObjectTwice, { Object: objectName });
  }
  model.Buffers.forEach((buffer, i) => {
    if (!seenBuffers.has(i + 1)) EnumWarning(context, `Buffers[${i + 1}]`, Texts.EnumNotOnLayout, { Object: `BUF${i + 1}` });
  });
  for (const name of ['FromCS', 'SysOut']) {
    if (found[name].length === 0) EnumError(context, 'Layout', Texts.EnumMissing, { Object: name });
  }
  for (const name of ['FromCS', 'ToCS', 'SysOut']) {
    if (found[name].length > 1) EnumError(context, CellPath(found[name][1]), Texts.EnumTooMany, { Object: name });
  }
  if (found.ToCS.length > 0 && model.Storage === null) EnumError(context, CellPath(found.ToCS[0]), Texts.EnumToCSNoStorage);
  return { FromCS: found.FromCS[0] || null, ToCS: found.ToCS[0] || null, SysOut: found.SysOut[0] || null,
           Connectors: connectors };
}

// [T] LinkMachines – tööpingi ja puhvri seos ruudustiku naabrusest: puhver on vahetult pingi
//     all või kohal vastavalt ikoonile (MACHINE_BUFFER_SIDES). Kontrollib vead 7 (puhvrid
//     järjestikku) ja 8 (puhver puudu). Tagastab [{ Cell, InCell, OutCell }]. Kutsub: Enumerate.
function LinkMachines(context, cells) {
  const machineLinks = [];
  const owner = new Map();   // puhvri lahter -> pingi lahter
  const seenMachines = new Set();
  const bufferAt = (x, y) => {
    const cell = context.Grid.get(CellKey(x, y));
    return cell && IconTypes[cell.T].Kind === 'Buffer' ? cell : null;
  };
  for (const cell of cells.filter(item => IconTypes[item.T].Kind === 'Machine')) {
    const machineName = ObjectName(context, cell);
    if (seenMachines.has(cell.N)) EnumError(context, CellPath(cell), Texts.EnumIconTwice, { Object: machineName });
    seenMachines.add(cell.N);
    const sides = MACHINE_BUFFER_SIDES[cell.T];
    const roles = [
      { Name: 'In', Dy: sides.In, Kinds: IN_BUFFER_KINDS, Text: Texts.EnumRoleIn },
      { Name: 'Out', Dy: sides.Out, Kinds: OUT_BUFFER_KINDS, Text: Texts.EnumRoleOut },
    ];
    const link = { Cell: cell, InCell: null, OutCell: null };
    for (const role of roles) {
      const buffer = bufferAt(cell.X, cell.Y + role.Dy);
      if (buffer === null) {
        EnumError(context, CellPath(cell), Texts.EnumMachineNoBuffer,
          { Machine: machineName, Side: role.Dy < 0 ? Texts.EnumSideAbove : Texts.EnumSideBelow });
        continue;
      }
      if (!role.Kinds.includes(buffer.T)) {
        EnumError(context, CellPath(buffer), Texts.EnumBufferKind,
          { Buffer: `BUF${buffer.N}`, Kind: buffer.T, Machine: machineName, Role: role.Text });
      }
      const key = CellKey(buffer.X, buffer.Y);
      if (owner.has(key) && owner.get(key) !== cell) {
        EnumError(context, CellPath(buffer), Texts.EnumBufferTwoMachines, { Buffer: `BUF${buffer.N}` });
      }
      owner.set(key, cell);
      link[`${role.Name}Cell`] = buffer;
    }
    machineLinks.push(link);
  }
  context.Model.Machines.forEach((machine, i) => {
    if (!seenMachines.has(i + 1)) EnumWarning(context, `Machines[${i + 1}]`, Texts.EnumNotOnLayout, { Object: machine.Name });
  });
  for (const cell of cells.filter(item => IconTypes[item.T].Kind === 'Buffer')) {
    if (!owner.has(CellKey(cell.X, cell.Y))) EnumError(context, CellPath(cell), Texts.EnumBufferNoMachine, { Buffer: `BUF${cell.N}` });
    const below = bufferAt(cell.X, cell.Y + 1);
    if (below !== null) EnumError(context, CellPath(cell), Texts.EnumBuffersInRow, { Buffer: `BUF${cell.N}`, Buffer2: `BUF${below.N}` });
  }
  return machineLinks;
}

// [U] MeasureTrack – lõigud, pikkused ja asukohad (DISAIN.md 2). Lõik on rada kahe hargnemise
//     keskpunkti vahel (avatud rajal ka raja otsast esimese hargnemiseni ja viimasest otsani);
//     nominaalpikkus = ikoonide pikkuste summa × Scale (hargnemisest pool). EdgeLengths kirjutab
//     lõigu pikkuse üle ja see jaotub lõigu ikoonidele ühtlaselt (metrokaart).
//     Asukohtade nullpunkt: silmusel FromCS jaam (seal on alus 0 alguses), kui see on rajal, muidu
//     esimene konnektor; avatud rajal raja algus. Jaam on hargnemisikooni keskel, raja otsa
//     konnektori jaam otsaikooni keskel. Tagastab { Length, Cells, Edges, StationPositions }.
//     Kutsub: Enumerate.
function MeasureTrack(context, trace, links) {
  const model = context.Model;
  const sequence = trace.Sequence;
  const count = sequence.length;
  const nodes = sequence.map((item, index) => (IconTypes[item.Cell.T].Branch ? index : -1)).filter(index => index >= 0);

  // lõigud: silmusel nodes[k] -> nodes[k + 1] (tsükliliselt; hargnemiseta silmus on üks lõik),
  // avatud rajal algus -> nodes[0] -> … -> lõpp (From / To = -1 – raja ots)
  const edges = [];
  if (!trace.Closed) {
    let from = -1;
    let inner = [];
    sequence.forEach((item, index) => {
      if (nodes.includes(index)) {
        edges.push({ From: from, To: index, Inner: inner });
        from = index;
        inner = [];
      } else {
        inner.push(index);
      }
    });
    edges.push({ From: from, To: -1, Inner: inner });
  } else if (nodes.length === 0) {
    edges.push({ From: -1, To: -1, Inner: sequence.map((item, index) => index) });
  } else {
    nodes.forEach((from, k) => {
      const to = nodes[(k + 1) % nodes.length];
      const inner = [];
      for (let index = (from + 1) % count; index !== to; index = (index + 1) % count) inner.push(index);
      edges.push({ From: from, To: to, Inner: inner });
    });
  }
  for (const edge of edges) {
    const half = index => (index >= 0 ? sequence[index].Unit / 2 : 0);
    edge.Nominal = (half(edge.From) + edge.Inner.reduce((sum, index) => sum + sequence[index].Unit, 0) + half(edge.To)) * model.Scale;
    edge.Override = null;
  }

  // käsitsi antud pikkused (kirje, mille lahtrid on selle raja lõigus)
  const ownKeys = new Set(sequence.map(item => CellKey(item.Cell.X, item.Cell.Y)));
  (model.EdgeLengths || []).forEach((entry, i) => {
    const path = `EdgeLengths[${i + 1}]`;
    const keys = entry.Cells.every(pair => Array.isArray(pair) && pair.length === 2)
      ? entry.Cells.map(pair => CellKey(pair[0], pair[1])) : null;
    if (keys !== null && keys.length > 0 && !keys.some(key => ownKeys.has(key))) return;   // teise raja kirje
    const edge = keys !== null && keys.length > 0
      ? edges.find(candidate => {
        const innerKeys = new Set(candidate.Inner.map(index => CellKey(sequence[index].Cell.X, sequence[index].Cell.Y)));
        return keys.every(key => innerKeys.has(key));
      })
      : undefined;
    context.EdgeLengthsUsed.add(i);
    if (edge === undefined) { EnumError(context, path, Texts.EnumEdgeNotFound); return; }
    if (edge.Override !== null) { EnumError(context, path, Texts.EnumEdgeTwice); return; }
    edge.Override = entry.Length;
  });
  for (const edge of edges) edge.Factor = edge.Override !== null ? edge.Override / edge.Nominal : 1;

  // ikoonide pikkused (cm): hargnemise esimene pool kuulub eelmisele lõigule, teine järgmisele
  const pieces = sequence.map(item => ({ First: 0, Second: 0, Edge: -1, Item: item }));
  edges.forEach((edge, edgeIndex) => {
    for (const index of edge.Inner) {
      pieces[index].First = sequence[index].Unit * model.Scale * edge.Factor;
      pieces[index].Edge = edgeIndex;
    }
    if (edge.From >= 0) pieces[edge.From].Second = sequence[edge.From].Unit / 2 * model.Scale * edge.Factor;
    if (edge.To >= 0) pieces[edge.To].First = sequence[edge.To].Unit / 2 * model.Scale * edge.Factor;
  });
  let cumulative = 0;
  const starts = pieces.map(piece => { const start = cumulative; cumulative += piece.First + piece.Second; return start; });
  const length = RoundPosition(cumulative);
  const stationPosition = link => (link.AtEnd
    ? starts[link.SeqIndex] + pieces[link.SeqIndex].First / 2
    : starts[link.SeqIndex] + pieces[link.SeqIndex].First);

  // nullpunkt: silmusel FromCS jaam või esimene konnektor
  let origin = 0;
  if (trace.Closed) {
    const originLink = links.find(link => link.Object.T === 'FromCS')
      ?? links.find(link => IconTypes[link.Object.T].Kind === 'Connector');
    if (originLink) origin = stationPosition(originLink);
  }
  const shift = value => {
    const shifted = RoundPosition(((value - origin) % cumulative + cumulative) % cumulative);
    return shifted >= length ? 0 : shifted;
  };

  return {
    Length: length,
    Cells: pieces.map((piece, index) => ({
      X: piece.Item.Cell.X, Y: piece.Item.Cell.Y, T: piece.Item.Cell.T,
      Entry: piece.Item.Entry, Exit: piece.Item.Exit,
      Start: shift(starts[index]), Length: RoundPosition(piece.First + piece.Second),
    })),
    Edges: edges.map(edge => ({
      Cells: edge.Inner.map(index => [sequence[index].Cell.X, sequence[index].Cell.Y]),
      Length: RoundPosition(edge.Nominal * edge.Factor), Stretched: edge.Override !== null,
    })),
    StationPositions: links.map(link => shift(stationPosition(link))),
  };
}

// [U] BuildNetwork – koostab simulatsiooni võrgu (SimInit-i sisend): rajad (Closed – silmus või
//     avatud konveier), jaamad raja ja asukoha järjekorras, konnektorid (kaks jaama), puhvrid ja
//     pingid – ainult need, mis on joonisel (ModelIndex = indeks mudelifailis). Kutsub: Enumerate.
function BuildNetwork(context, traces, geometries, links, objects, machineLinks) {
  const model = context.Model;
  const bufferCells = model.Layout.Cells
    .filter(cell => IconTypes[cell.T].Kind === 'Buffer')
    .sort((first, second) => first.N - second.N);
  const bufferIndexOf = cell => bufferCells.indexOf(cell);
  const connectorCells = [...objects.Connectors].sort((first, second) => first.Y - second.Y || first.X - second.X);

  const stations = [];
  traces.forEach((trace, trackIndex) => {
    const geometry = geometries[trackIndex];
    const own = links.filter(link => link.Trace === trace);
    own.map((link, i) => ({ Link: link, Position: geometry.StationPositions[i] }))
      .sort((first, second) => first.Position - second.Position)
      .forEach(({ Link: link, Position: position }) => {
        const objectKind = IconTypes[link.Object.T].Kind;
        const station = {
          Name: ObjectName(context, link.Object), Track: trackIndex, Position: position,
          Kind: objectKind === 'Buffer' || objectKind === 'Connector' ? objectKind : link.Object.T,
          Cell: { X: link.Object.X, Y: link.Object.Y },
          Junction: { X: trace.Sequence[link.SeqIndex].Cell.X, Y: trace.Sequence[link.SeqIndex].Cell.Y },
          Link: link.Link,
        };
        if (objectKind === 'Buffer') station.Buffer = bufferIndexOf(link.Object);
        if (objectKind === 'Connector') station.Connector = connectorCells.indexOf(link.Object);
        stations.push(station);
      });
  });

  const machineCells = machineLinks.map(link => link.Cell).sort((first, second) => first.N - second.N);
  const buffers = bufferCells.map(cell => ({
    ...model.Buffers[cell.N - 1], Name: `BUF${cell.N}`, Kind: cell.T, ModelIndex: cell.N - 1,
    Cell: { X: cell.X, Y: cell.Y },
    Station: stations.findIndex(station => station.Buffer === bufferIndexOf(cell)),
    Machine: -1,
  }));
  const machines = machineCells.map((cell, machineIndex) => {
    const link = machineLinks.find(item => item.Cell === cell);
    const inBuffer = bufferIndexOf(link.InCell);
    const outBuffer = bufferIndexOf(link.OutCell);
    buffers[inBuffer].Machine = machineIndex;
    buffers[outBuffer].Machine = machineIndex;
    return { ...model.Machines[cell.N - 1], ModelIndex: cell.N - 1, Cell: { X: cell.X, Y: cell.Y },
             InBuffer: inBuffer, OutBuffer: outBuffer };
  });
  const connectors = connectorCells.map((cell, connectorIndex) => ({
    Name: ObjectName(context, cell), Cell: { X: cell.X, Y: cell.Y },
    Stations: stations.map((station, stationIndex) => (station.Connector === connectorIndex ? stationIndex : -1))
      .filter(stationIndex => stationIndex >= 0),
  }));

  return {
    Name: model.Meta.Name,
    Scale: model.Scale,
    Tracks: traces.map((trace, trackIndex) => {
      const modelTrack = model.Tracks[trace.TrackIndex];
      const geometry = geometries[trackIndex];
      return {
        Name: modelTrack.Name, Mode: modelTrack.Mode, Carts: modelTrack.Carts,
        PlacesPerCart: modelTrack.PlacesPerCart, Speed: modelTrack.Speed,
        LoadTime: modelTrack.LoadTime, AccessTime: modelTrack.AccessTime,
        ModelIndex: trace.TrackIndex, Closed: trace.Closed, Length: geometry.Length, Cells: geometry.Cells, Edges: geometry.Edges,
      };
    }),
    Stations: stations,
    Connectors: connectors,
    Buffers: buffers,
    Machines: machines,
    Storage: objects.ToCS !== null ? { ...model.Storage } : null,
    Workpieces: model.Workpieces.map(type => ({ ...type })),
    Sim: { ...model.Sim },
  };
}

// [O] FindConflicts – andmete kooskõla: detailitüübid ja pingid olemas, marsruudi operatsioone
//     teeb mõni joonisel olev pink (viga 4), raja kohti pole rohkem kui puhvrites (6),
//     kesklaos on ruumi (3); rada mööda saab igale marsruudi pingile ja välja (CheckReachability).
//     Kutsub: Enumerate.
function FindConflicts(context, network, traces) {
  if (network.Workpieces.length === 0) EnumError(context, 'Workpieces', Texts.EnumNoWorkpieces);
  if (network.Machines.length === 0) EnumError(context, 'Machines', Texts.EnumNoMachines);
  const placedOps = new Set(network.Machines.flatMap(machine => machine.Ops));
  network.Workpieces.forEach((type, i) => type.Routes.forEach((route, j) => route.Ops.forEach((operation, k) => {
    if (!placedOps.has(operation.Op)) {
      EnumError(context, `Workpieces[${i + 1}].Routes[${j + 1}].Ops[${k + 1}].Op`, Texts.EnumOpNotPlaced, { Op: operation.Op });
    }
  })));
  const bufferPlaces = network.Buffers.reduce((sum, buffer) => sum + buffer.Capacity, 0);
  for (const track of network.Tracks) {
    const places = track.Carts * track.PlacesPerCart;
    if (places > bufferPlaces) {
      EnumWarning(context, `Tracks[${track.ModelIndex + 1}].Carts`, Texts.EnumTooManyCarts,
        { Track: track.Name, Places: places, BufferPlaces: bufferPlaces });
    }
  }
  if (network.Storage !== null && network.Storage.Capacity <= PARKING_RESERVE) {
    EnumWarning(context, 'Storage.Capacity', Texts.EnumSmallStorage,
      { Capacity: network.Storage.Capacity, Reserve: PARKING_RESERVE });
  }
  CheckReachability(context, network, traces);
}

// [U] CheckReachability – kas rada mööda (ka konnektorite kaudu, avatud konveieril ainult
//     allavoolu) saab: igast puhvrist SysOut-i ja ToCS-i (valmis ja ummikus detailid) ning
//     marsruudi igast võimalikust kohast järgmise operatsiooni mõnele pingile. Pargitud detail
//     tuleb tagasi FromCS kaudu, seepärast loetakse kesklao korral FromCS samuti võimalikuks kohaks.
//     Kutsub: FindConflicts.
function CheckReachability(context, network, traces) {
  const paths = StationPaths(network);
  const reach = (from, to) => paths[from][to] !== null;
  const stationOf = kind => network.Stations.findIndex(station => station.Kind === kind);
  const fromCS = stationOf('FromCS');
  const toCS = stationOf('ToCS');
  const sysOut = stationOf('SysOut');
  const open = traces.find(trace => !trace.Closed);
  const hint = open
    ? FormatText(Texts.EnumOpenHint, {
      Track: context.Model.Tracks[open.TrackIndex].Name,
      X: open.Sequence[0].Cell.X, Y: open.Sequence[0].Cell.Y,
      X2: open.Sequence.at(-1).Cell.X, Y2: open.Sequence.at(-1).Cell.Y,
    })
    : '';

  for (const buffer of network.Buffers) {
    const path = `Buffers[${buffer.ModelIndex + 1}]`;
    if (!reach(buffer.Station, sysOut)) EnumError(context, path, Texts.EnumNoWayTo, { Object: buffer.Name, Target: 'SysOut', Hint: hint });
    if (toCS >= 0 && !reach(buffer.Station, toCS)) EnumError(context, path, Texts.EnumNoWayTo, { Object: buffer.Name, Target: 'ToCS', Hint: hint });
  }

  network.Workpieces.forEach((type, i) => type.Routes.forEach((route, j) => {
    // võimalikud kohad: { Station, Machine } – detail on pingi väljaminevas puhvris (või FromCS-is)
    let places = [{ Station: fromCS, Machine: -1 }];
    for (let k = 0; k < route.Ops.length; k++) {
      const operation = route.Ops[k].Op;
      const machines = network.Machines.map((machine, machineIndex) => ({ Machine: machine, Index: machineIndex }))
        .filter(item => item.Machine.Ops.includes(operation));
      if (machines.length === 0) return;   // EnumOpNotPlaced
      if (toCS >= 0 && !places.some(place => place.Machine < 0)) places.push({ Station: fromCS, Machine: -1 });
      const next = new Map();
      for (const place of places) {
        const reachable = machines.filter(item => item.Index === place.Machine
          || reach(place.Station, network.Buffers[item.Machine.InBuffer].Station));
        if (reachable.length === 0) {
          EnumError(context, `Workpieces[${i + 1}].Routes[${j + 1}].Ops[${k + 1}].Op`, Texts.EnumOpUnreachable,
            { Op: operation, Object: network.Stations[place.Station].Name, Hint: hint });
          return;
        }
        for (const item of reachable) {
          next.set(item.Index, { Station: network.Buffers[item.Machine.OutBuffer].Station, Machine: item.Index });
        }
      }
      places = [...next.values()];
    }
  }));
}

// [U] StationPaths – lühimad transporditeed jaamade vahel (Dijkstra): rada mööda liikumissuunas,
//     radade vahel konnektori kaudu (konnektori kaks jaama, pikkus 0). Silmusel saab igast jaamast
//     igasse, avatud konveieril ainult allavoolu. Viigi korral vähem sõlmi.
//     Tagastab Paths[from][to] = { Length, Legs: [{ Track, From, To }] } või null (teed pole);
//     Legs – rada mööda sõidud (alus viib From-jaamast To-jaama), nende vahel konnektorid.
//     Kutsub: CheckReachability, SimInit, testid. Sündmusi ei lisa.
export function StationPaths(network) {
  const stations = network.Stations;
  const count = stations.length;
  const closed = trackIndex => network.Tracks[trackIndex].Closed !== false;
  const along = (from, to) => {   // sõit rada mööda jaamast from jaama to, cm või null
    const first = stations[from];
    const second = stations[to];
    if (first.Track !== second.Track || from === to) return null;
    const length = network.Tracks[first.Track].Length;
    if (closed(first.Track)) return ((second.Position - first.Position) % length + length) % length;
    return second.Position > first.Position ? second.Position - first.Position : null;
  };
  const partners = stationIndex => {
    const station = stations[stationIndex];
    if (station.Kind !== 'Connector') return [];
    return network.Connectors[station.Connector].Stations.filter(other => other !== stationIndex);
  };

  const paths = [];
  for (let source = 0; source < count; source++) {
    const best = Array.from({ length: count }, () => null);   // { Length, Hops, Previous, Cross }
    const done = new Array(count).fill(false);
    best[source] = { Length: 0, Hops: 0, Previous: -1, Cross: false };
    for (;;) {
      let current = -1;
      for (let i = 0; i < count; i++) {
        if (done[i] || best[i] === null) continue;
        if (current < 0 || CompareScores([best[i].Length, best[i].Hops], [best[current].Length, best[current].Hops]) < 0) current = i;
      }
      if (current < 0) break;
      done[current] = true;
      const relax = (next, length, cross) => {
        const candidate = { Length: RoundPosition(best[current].Length + length), Hops: best[current].Hops + 1, Previous: current, Cross: cross };
        if (best[next] === null || CompareScores([candidate.Length, candidate.Hops], [best[next].Length, best[next].Hops]) < 0) best[next] = candidate;
      };
      for (let next = 0; next < count; next++) {
        const length = along(current, next);
        if (length !== null && !done[next]) relax(next, length, false);
      }
      for (const next of partners(current)) if (!done[next]) relax(next, 0, true);
    }
    paths.push(best.map((entry, target) => {
      if (target === source) {
        return closed(stations[source].Track)
          ? { Length: 0, Legs: [{ Track: stations[source].Track, From: source, To: source }] }
          : null;
      }
      if (entry === null) return null;
      const legs = [];
      for (let node = target; best[node].Previous >= 0; node = best[node].Previous) {
        if (!best[node].Cross) legs.unshift({ Track: stations[node].Track, From: best[node].Previous, To: node });
      }
      return { Length: entry.Length, Legs: legs };
    }));
  }
  return paths;
}

// =====================================================================
// Juhuarvud
// =====================================================================

// [U] Random – seemnega juhuarv vahemikus [0, 1) (mulberry32).
//     Kutsub: SampleDuration, OrderByDiscipline. Sündmusi ei lisa.
function Random() {
  RandomState = (RandomState + 0x6D2B79F5) | 0;
  let mixed = RandomState;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
}

// [T] SampleDuration – operatsiooni kestus: ühtlane jaotus Mean ± Dev, täissekundid, vähemalt 1.
//     Kutsub: TurnProc. Sündmusi ei lisa.
function SampleDuration(operation) {
  const duration = operation.Mean - operation.Dev + Random() * 2 * operation.Dev;
  return Math.max(1, Math.round(duration));
}

// =====================================================================
// Event List
// =====================================================================

// [O] PutEvent – lisab sündmuse listi aja järgi; sama aja korral hiljem lisatu läheb taha.
//     Kutsuvad: EventHandlerid, Planner, MinuteMan.
function PutEvent(fields) {
  const newEvent = {
    Event: null, WP: null, ObjType: null, ObjCode: null, Track: null, Time: SYSTEM_TIME,
    SrcType: null, SrcCode: null, Pal: null, Next: null,  // SrcType, SrcCode, Pal: [U]
    ...fields,
  };
  if (newEvent.Time < SYSTEM_TIME) {
    throw new Error(`PutEvent: sündmus ${newEvent.Event} minevikku (${newEvent.Time} < ${SYSTEM_TIME})`);
  }
  if (FirstAtMoment === null || FirstAtMoment.Time > newEvent.Time) {
    newEvent.Next = FirstAtMoment;
    FirstAtMoment = newEvent;
    return newEvent;
  }
  let previous = FirstAtMoment;
  while (previous.Next !== null && previous.Next.Time <= newEvent.Time) previous = previous.Next;
  newEvent.Next = previous.Next;
  previous.Next = newEvent;
  return newEvent;
}

// [O/T] GetEvent – võtab listist esimese sündmuse, mille Time <= SYSTEM_TIME; muidu null.
//     Kutsub: ProcEvent.
function GetEvent() {
  if (FirstAtMoment === null || FirstAtMoment.Time > SYSTEM_TIME) return null;
  const currentEvent = FirstAtMoment;
  FirstAtMoment = currentEvent.Next;
  currentEvent.Next = null;
  return currentEvent;
}

// [O] ProcEvent – töötleb ühe sündmuse: kutsub selle käsitleja (EventHandlers).
//     Kutsub: ProcAllEvents.
function ProcEvent() {
  const currentEvent = GetEvent();
  if (currentEvent === null) { NO_EVENTS = true; return; }
  NO_EVENTS = false;
  const handler = EventHandlers[currentEvent.Event];
  if (!handler) throw new Error(`ProcEvent: tundmatu sündmus ${currentEvent.Event}`);
  handler(currentEvent);
  LastEventTime = SYSTEM_TIME;
  Stats.EventCount++;
  Stats.EventCountByType[currentEvent.Event] = (Stats.EventCountByType[currentEvent.Event] || 0) + 1;
}

// [U] ProcAllEvents – töötleb kõik käesoleva hetke sündmused (sisetsükkel).
//     Kutsub: SimStep, SimInit.
function ProcAllEvents() {
  let eventsThisStep = 0;
  do {
    ProcEvent();
    if (++eventsThisStep > MAX_EVENTS_PER_STEP) {
      throw new Error(`ProcAllEvents: üle ${MAX_EVENTS_PER_STEP} sündmuse ühel hetkel (t=${SYSTEM_TIME})`);
    }
  } while (!NO_EVENTS);
}

// =====================================================================
// Abiprotseduurid
// =====================================================================

// [T] SetWPState – muudab detaili olekut ja lisab eelmises olekus veedetud aja statistikasse.
function SetWPState(workpiece, newState) {
  const category = WP_STATE_CATEGORY[workpiece.State];
  workpiece.Times[category] += SYSTEM_TIME - workpiece.StateSince;
  workpiece.State = newState;
  workpiece.StateSince = SYSTEM_TIME;
}

// [T] SetMachState – muudab tööpingi olekut ja arvestab olekus veedetud aja.
function SetMachState(machine, newState) {
  machine.StateTime[machine.State] = (machine.StateTime[machine.State] || 0) + SYSTEM_TIME - machine.StateSince;
  machine.State = newState;
  machine.StateSince = SYSTEM_TIME;
}

// [T] CurrentOp – detaili järgmine (tegemata) operatsioon või null, kui kõik on tehtud.
function CurrentOp(workpiece) {
  const route = Workpieces[workpiece.Type].Routes[workpiece.Route];
  return workpiece.OpIndex < route.Ops.length ? route.Ops[workpiece.OpIndex] : null;
}

// [U] CanReserveSlot – kas puhvris on vaba (broneerimata) koht.
function CanReserveSlot(buffer) {
  return buffer.Entries.length + buffer.Reserved < buffer.Capacity;
}

// [U] ReserveSlot / ReleaseSlot – puhvri koha broneerimine ja broneeringu vabastamine.
function ReserveSlot(buffer) {
  if (!CanReserveSlot(buffer)) throw new Error(`ReserveSlot: puhver ${buffer.Name} on täis`);
  buffer.Reserved++;
}
function ReleaseSlot(buffer) {
  if (buffer.Reserved <= 0) throw new Error(`ReleaseSlot: puhvril ${buffer.Name} pole broneeringut`);
  buffer.Reserved--;
}

// [U] StorageFree – kas kesklaos on vaba koht (valmis + pargitud + broneeritud < mahutavus).
//     keepFree: mitu kohta peab vabaks jääma (valmis detailid jätavad varu parkimiseks).
function StorageFree(keepFree = 0) {
  return Storage !== null
    && Storage.Count + Storage.Parked.length + Storage.Reserved < Storage.Capacity - keepFree;
}

// [U] CountWorkpiecesInSystem – Ndet: süsteemis olevad detailid (ka sisenevad ja pargitud).
function CountWorkpiecesInSystem() {
  return Stats.Created - Stats.Completed;
}

// [U] CurrentStationOf – jaam, kus detail parasjagu on (transpordi lähtekoht), või -1.
function CurrentStationOf(workpiece) {
  switch (workpiece.Location.Kind) {
    case 'FromCS': return Model.FromCSStation;
    case 'Storage': return Model.FromCSStation;   // pargitud detail lahkub FromCS kaudu
    case 'Buffer': return BufferArray[workpiece.Location.Index].Station;
    case 'Connector': return workpiece.Path !== null ? workpiece.Path[0].From : -1;
    default: return -1;
  }
}

// [T] StationLoadTime – laadimise kestus rada <-> jaam: keskladu kasutab lao aega, muu raja aega.
function StationLoadTime(trackIndex, stationIndex) {
  const station = StationArray[stationIndex];
  if ((station.Kind === 'FromCS' || station.Kind === 'ToCS') && Storage !== null) return Storage.LoadTime;
  return Tracks[trackIndex].LoadTime;
}

// [U] DestinationObject – sihtkoha objekt sündmuse kirje jaoks (ObjType, ObjCode).
function DestinationObject(destination) {
  if (destination.Kind === 'Buffer') return { ObjType: 'Buffer', ObjCode: destination.Index };
  return { ObjType: 'SysOutput', ObjCode: destination.Station };
}

// =====================================================================
// Transporditee üle konnektorite (etapp 7a)
// =====================================================================

// [U] CanReserveConnector – kas konnektor on vaba (detaili pole ega broneeringut; mahutab 1).
function CanReserveConnector(connector) {
  return connector.WP === null && connector.Reserved === 0;
}

// [U] PathConnectors – konnektorid, mille kaudu tee läheb (iga sõidu lõpp, v.a viimane).
function PathConnectors(path) {
  return path.Legs.slice(0, -1).map(leg => ConnectorArray[StationArray[leg.To].Connector]);
}

// [U] PathFree – kas jaamast from jaama to on tee ja selle konnektorid on vabad.
function PathFree(fromStation, toStation) {
  const path = TransportPaths[fromStation][toStation];
  return path !== null && PathConnectors(path).every(CanReserveConnector);
}

// [U] Depart – detailil on sihtkoht broneeritud: broneerib tee konnektorid (kõik korraga, nii
//     ei jää detail konnektoris järgmist ootama) ja detail hakkab alust ootama (WAIT_PICKUP).
//     Kui mõni konnektor on kinni, ootab detail oma kohal (WAIT_DEST, sihtkoht jääb) ja Planner
//     proovib uuesti. Tagastab, kas õnnestus. Kutsuvad: Planner, OutSysProc, LoadProc, DetectDeadlock.
function Depart(workpiece) {
  const path = TransportPaths[CurrentStationOf(workpiece)][workpiece.Destination.Station];
  if (path === null) throw new Error(`Depart: WP${workpiece.Id} sihtkohta pole teed`);
  const connectors = PathConnectors(path);
  if (!connectors.every(CanReserveConnector)) {
    if (workpiece.State !== 'WAIT_DEST') SetWPState(workpiece, 'WAIT_DEST');
    return false;
  }
  for (const connector of connectors) connector.Reserved++;
  workpiece.Path = path.Legs.map(leg => ({ ...leg }));
  SetWPState(workpiece, 'WAIT_PICKUP');
  return true;
}

// =====================================================================
// Pikapi (alusele laadimise) kandidaadid
// =====================================================================

// [U] PickupCandidate – vanim detail jaamas, millel on sihtkoht broneeritud ja mis ootab alust
//     (tee järgmine sõit algab sellest jaamast). Kutsuvad: MinuteMan (NeedsStop), StopMovProc,
//     AfterPalletAtStation.
function PickupCandidate(stationIndex) {
  const station = StationArray[stationIndex];
  let candidateIds = [];
  if (station.Kind === 'FromCS') {
    candidateIds = FromCSQueue;
  } else if (station.Kind === 'Buffer') {
    // tavaliselt väljaminevad; pargitav sissetulev detail (ummik) on samuti WAIT_PICKUP
    candidateIds = BufferArray[station.Buffer].Entries.map(entry => entry.WP);
  } else if (station.Kind === 'Connector') {
    const connector = ConnectorArray[station.Connector];
    if (connector.WP !== null) candidateIds = [connector.WP];
  }
  let best = null;
  for (const workpieceId of candidateIds) {
    const workpiece = SysWPArray[workpieceId];
    if (workpiece.State !== 'WAIT_PICKUP' || workpiece.Path[0].From !== stationIndex) continue;
    if (best === null || workpiece.StateSince < best.StateSince
        || (workpiece.StateSince === best.StateSince && workpiece.Id < best.Id)) best = workpiece;
  }
  return best;
}

// =====================================================================
// MinuteMan – konveierite liigutamine
// =====================================================================

// [T] NeedsStop – kas alus peab jaamas peatuma: mahalaadimine (detaili sõidu lõpp – sihtkoht
//     või konnektor) või pealelaadimine (alus tühi, jaamas ootab detail).
function NeedsStop(track, palletIndex, stationIndex) {
  const pallet = track.Pallets[palletIndex];
  if (pallet.WP !== null) return SysWPArray[pallet.WP].Path[0].To === stationIndex;
  return PickupCandidate(stationIndex) !== null;
}

// [O] MinuteMan – liigutab iga liikuvat konveierit ühe sekundi võrra. Kui mõni alus ületab
//     jaama, kus tal on tegevus, peatab konveieri täpselt seal (lähim ületus) ja lisab StopMov.
//     Kutsub: SimStep. Lisab: StopMov.
function MinuteMan() {
  const EPSILON = 1e-6;
  Tracks.forEach((track, trackIndex) => {
    if (track.StopCount > 0) return;
    const stepLength = track.Speed * 1;
    const spacing = track.Length / track.Carts;
    let bestStop = null;
    for (let palletIndex = 0; palletIndex < track.Carts; palletIndex++) {
      const position = (track.Offset + palletIndex * spacing) % track.Length;
      for (const stationIndex of track.Stations) {
        let delta = ((StationArray[stationIndex].Position - position) % track.Length + track.Length) % track.Length;
        if (delta < EPSILON || track.Length - delta < EPSILON) delta = 0;
        if (delta <= 0 || delta > stepLength + EPSILON) continue;
        if (!NeedsStop(track, palletIndex, stationIndex)) continue;
        if (bestStop === null || delta < bestStop.delta) bestStop = { palletIndex, stationIndex, delta };
      }
    }
    if (bestStop === null) {
      track.Offset = (track.Offset + stepLength) % track.Length;
      return;
    }
    track.Offset = (track.Offset + bestStop.delta) % track.Length;
    track.StopCount++;
    track.Stops++;
    PutEvent({ Event: 'StopMov', Track: trackIndex, Pal: bestStop.palletIndex,
               ObjType: 'Station', ObjCode: bestStop.stationIndex });
  });
}

// =====================================================================
// EventHandlerid
// =====================================================================

// [O] DoNothingProc – tühi sündmus (testimiseks).
function DoNothingProc() {}

// [O] InSysProc – uus detail jõuab FromCS jaama; valitakse marsruut.
//     Lisab (Planneri kaudu): Load, OutSys, InSys.
function InSysProc(currentEvent) {
  const workpiece = SysWPArray[currentEvent.WP];
  workpiece.Location = { Kind: 'FromCS' };
  workpiece.TimeIn = SYSTEM_TIME;
  workpiece.Route = ChooseRoute(workpiece);
  FromCSQueue.push(workpiece.Id);
  SetWPState(workpiece, 'WAIT_DEST');
  Planner('InSys');
}

// [O] MoveZProc – konveier võib edasi liikuda (üks peatus vähem).
function MoveZProc(currentEvent) {
  const track = Tracks[currentEvent.Track];
  track.StopCount--;
  if (track.StopCount < 0) throw new Error(`MoveZProc: StopCount < 0 rajal ${track.Name}`);
}

// [O] StopMovProc – alus seisab jaamas: alustab maha- või pealelaadimist.
//     Lisab: Load või MoveZ.
function StopMovProc(currentEvent) {
  const track = Tracks[currentEvent.Track];
  const pallet = track.Pallets[currentEvent.Pal];
  const stationIndex = currentEvent.ObjCode;
  if (pallet.WP !== null) {
    if (SysWPArray[pallet.WP].Path[0].To === stationIndex) {
      BeginUnloadFromPallet(currentEvent.Track, currentEvent.Pal, stationIndex);
      return;
    }
  } else {
    const candidate = PickupCandidate(stationIndex);
    if (candidate !== null) {
      BeginPickup(currentEvent.Track, currentEvent.Pal, stationIndex, candidate);
      return;
    }
  }
  PutEvent({ Event: 'MoveZ', Track: currentEvent.Track });  // tegevus kadus vahepeal
}

// [U] BeginUnloadFromPallet – alustab detaili mahalaadimist aluselt jaama objekti: sihtkohta
//     või (tee keskel) konnektorisse.
function BeginUnloadFromPallet(trackIndex, palletIndex, stationIndex) {
  const workpiece = SysWPArray[Tracks[trackIndex].Pallets[palletIndex].WP];
  const target = workpiece.Path.length > 1
    ? { ObjType: 'Connector', ObjCode: StationArray[stationIndex].Connector }
    : DestinationObject(workpiece.Destination);
  SetWPState(workpiece, 'LOADING');
  PutEvent({
    Event: 'Load', WP: workpiece.Id, Track: trackIndex, Pal: palletIndex,
    SrcType: 'Pallette', SrcCode: palletIndex,
    ...target,
    Time: SYSTEM_TIME + StationLoadTime(trackIndex, stationIndex),
  });
}

// [U] BeginPickup – alustab detaili pealelaadimist jaamast (FromCS, puhver, konnektor) alusele.
const PICKUP_SOURCE = { FromCS: 'SysInput', Buffer: 'Buffer', Connector: 'Connector' };   // [U]
function BeginPickup(trackIndex, palletIndex, stationIndex, workpiece) {
  const station = StationArray[stationIndex];
  Tracks[trackIndex].Pallets[palletIndex].ReservedWP = workpiece.Id;
  SetWPState(workpiece, 'LOADING');
  PutEvent({
    Event: 'Load', WP: workpiece.Id, Track: trackIndex, Pal: palletIndex,
    SrcType: PICKUP_SOURCE[station.Kind],
    SrcCode: station.Kind === 'FromCS' ? stationIndex : station.Kind === 'Buffer' ? station.Buffer : station.Connector,
    ObjType: 'Pallette', ObjCode: palletIndex,
    Time: SYSTEM_TIME + StationLoadTime(trackIndex, stationIndex),
  });
}

// [U] AfterPalletAtStation – pärast mahalaadimist: kui samas jaamas ootab detail, laadi kohe
//     peale (konveier seisab edasi), muidu konveier jätkab.
function AfterPalletAtStation(trackIndex, palletIndex, stationIndex) {
  Planner('PalletUnloaded');
  const candidate = PickupCandidate(stationIndex);
  if (candidate !== null) {
    BeginPickup(trackIndex, palletIndex, stationIndex, candidate);
  } else {
    PutEvent({ Event: 'MoveZ', Track: trackIndex });
  }
}

// [O] LoadProc – laadimine on lõppenud: detail viiakse lähtekohast sihtkohta.
//     Peale- ja mahalaadimine on üks sündmus (lk 45); suund tuleneb SrcType/ObjType-st.
//     Lisab: MoveZ, Load, Turn (ja Planneri kaudu teisi).
function LoadProc(currentEvent) {
  const workpiece = SysWPArray[currentEvent.WP];
  const source = currentEvent.SrcType;
  const target = currentEvent.ObjType;
  Stats.LastProgressTime = SYSTEM_TIME;

  if (source === 'Pallette' && target === 'Buffer') {
    // rajalt puhvri sissetulevale kohale
    const pallet = Tracks[currentEvent.Track].Pallets[currentEvent.Pal];
    const buffer = BufferArray[currentEvent.ObjCode];
    pallet.WP = null;
    ReleaseSlot(buffer);
    buffer.Entries.push({ WP: workpiece.Id, Dir: 'In', Since: SYSTEM_TIME });
    workpiece.Location = { Kind: 'Buffer', Index: currentEvent.ObjCode, Dir: 'In' };
    workpiece.Destination = null;
    workpiece.Path = null;
    SetWPState(workpiece, 'WAIT_MACHINE');
    AfterPalletAtStation(currentEvent.Track, currentEvent.Pal, buffer.Station);

  } else if (source === 'Pallette' && target === 'SysOutput') {
    // rajalt kesklattu või süsteemist välja
    const pallet = Tracks[currentEvent.Track].Pallets[currentEvent.Pal];
    const destination = workpiece.Destination;
    pallet.WP = null;
    workpiece.Destination = null;
    workpiece.Path = null;
    if (destination.Kind === 'ToCS') {
      Storage.Reserved--;
      if (destination.Park) {
        Storage.Parked.push(workpiece.Id);
        workpiece.Location = { Kind: 'Storage' };
        SetWPState(workpiece, 'PARKED');
      } else {
        Storage.Count++;
        WorkpieceLeaves(workpiece);
      }
    } else {
      WorkpieceLeaves(workpiece);
    }
    AfterPalletAtStation(currentEvent.Track, currentEvent.Pal, destination.Station);

  } else if (source === 'Pallette' && target === 'Connector') {
    // rajalt konnektorisse: detail jääb teisele rajale üleandmist ootama (järgmine sõit)
    const pallet = Tracks[currentEvent.Track].Pallets[currentEvent.Pal];
    const connector = ConnectorArray[currentEvent.ObjCode];
    const stationIndex = workpiece.Path.shift().To;
    pallet.WP = null;
    connector.Reserved--;
    connector.WP = workpiece.Id;
    connector.Transfers++;
    workpiece.Location = { Kind: 'Connector', Index: connector.Index };
    SetWPState(workpiece, 'WAIT_PICKUP');
    AfterPalletAtStation(currentEvent.Track, currentEvent.Pal, stationIndex);

  } else if (target === 'Pallette') {
    // jaamast (puhvri väljaminev koht, FromCS või konnektor) alusele
    const pallet = Tracks[currentEvent.Track].Pallets[currentEvent.Pal];
    if (source === 'Buffer') {
      const buffer = BufferArray[currentEvent.SrcCode];
      buffer.Entries = buffer.Entries.filter(entry => entry.WP !== workpiece.Id);
    } else if (source === 'Connector') {
      ConnectorArray[currentEvent.SrcCode].WP = null;
    } else {
      FromCSQueue = FromCSQueue.filter(workpieceId => workpieceId !== workpiece.Id);
    }
    pallet.ReservedWP = null;
    pallet.WP = workpiece.Id;
    workpiece.Location = { Kind: 'Pallet', Track: currentEvent.Track, Pal: currentEvent.Pal };
    SetWPState(workpiece, 'ON_PALLET');
    PutEvent({ Event: 'MoveZ', Track: currentEvent.Track });
    Planner('BufferFreed');

  } else if (source === 'Buffer' && target === 'Machine') {
    // puhvrist tööpinki (detail on juba laadimise alguses pingi juures) -> häälestus
    const machine = MachineArray[currentEvent.ObjCode];
    BeginSetup(machine, workpiece);
    Planner('MachineLoaded');

  } else if (source === 'Machine' && target === 'Buffer') {
    // tööpingist puhvri väljaminevale kohale (koht broneeriti laadimise alguses)
    const machine = MachineArray[currentEvent.SrcCode];
    const buffer = BufferArray[currentEvent.ObjCode];
    machine.WP = null;
    SetMachState(machine, 'IDLE');
    ReleaseSlot(buffer);
    buffer.Entries.push({ WP: workpiece.Id, Dir: 'Out', Since: SYSTEM_TIME });
    workpiece.Location = { Kind: 'Buffer', Index: currentEvent.ObjCode, Dir: 'Out' };
    if (workpiece.PlannedDestination) {
      // sihtkoht broneeriti juba enne töötlemist (ReserveNextBeforeStart)
      workpiece.Destination = workpiece.PlannedDestination;
      workpiece.PlannedDestination = null;
      Depart(workpiece);
    } else {
      SetWPState(workpiece, 'WAIT_DEST');
    }
    Planner('MachineFree');

  } else {
    throw new Error(`LoadProc: tundmatu suund ${source} -> ${target}`);
  }
}

// [T] BeginSetup – tööpink häälestub detaili järgmisele operatsioonile (0 s, kui sama operatsioon).
//     Lisab: Turn.
function BeginSetup(machine, workpiece) {
  const operation = CurrentOp(workpiece);
  const setupTime = machine.LastOp === operation.Op ? 0 : machine.SetupTime;
  SetMachState(machine, 'SETUP');
  SetWPState(workpiece, 'SETUP');
  PutEvent({ Event: 'Turn', WP: workpiece.Id, ObjType: 'Machine', ObjCode: machine.Index,
             Time: SYSTEM_TIME + setupTime });
}

// [O] TurnProc – häälestus on läbi, algab töötlemine.
//     Lisab: Process.
function TurnProc(currentEvent) {
  const machine = MachineArray[currentEvent.ObjCode];
  const workpiece = SysWPArray[currentEvent.WP];
  const operation = CurrentOp(workpiece);
  machine.LastOp = operation.Op;
  SetMachState(machine, 'PROCESSING');
  SetWPState(workpiece, 'PROCESSING');
  PutEvent({ Event: 'Process', WP: workpiece.Id, ObjType: 'Machine', ObjCode: machine.Index,
             Time: SYSTEM_TIME + SampleDuration(operation) });
}

// [O] ProcessProc – operatsioon on tehtud. Kui järgmist saab teha samas pingis, häälestub
//     pink uuesti (Turn), muidu laaditakse detail puhvri väljaminevale kohale (Load).
//     Lisab: Turn või Load.
function ProcessProc(currentEvent) {
  const machine = MachineArray[currentEvent.ObjCode];
  const workpiece = SysWPArray[currentEvent.WP];
  workpiece.OpIndex++;
  machine.OpsDone++;
  Stats.LastProgressTime = SYSTEM_TIME;
  const nextOperation = CurrentOp(workpiece);
  if (nextOperation !== null && machine.Ops.includes(nextOperation.Op)) {
    BeginSetup(machine, workpiece);
    return;
  }
  SetMachState(machine, 'UNLOADING');
  SetWPState(workpiece, 'LOADING');
  PutEvent({ Event: 'Load', WP: workpiece.Id, SrcType: 'Machine', SrcCode: machine.Index,
             ObjType: 'Buffer', ObjCode: machine.OutBuffer, Time: SYSTEM_TIME + machine.LoadTime });
}

// [O] OutSysProc – detaili kõik operatsioonid on tehtud: sihtkohaks ToCS (kui ruumi) või SysOut.
function OutSysProc(currentEvent) {
  const workpiece = SysWPArray[currentEvent.WP];
  if (StorageFree(Storage !== null ? Storage.ParkingReserve : 0)) {  // varu jääb parkimiseks
    Storage.Reserved++;
    workpiece.Destination = { Kind: 'ToCS', Station: Storage.Station, Park: false };
  } else {
    workpiece.Destination = { Kind: 'SysOut', Station: Model.SysOutStation };
  }
  workpiece.OutSysPlanned = false;
  Depart(workpiece);
}

// [T] WorkpieceLeaves – detail lahkub süsteemist: aeg ja statistika.
function WorkpieceLeaves(workpiece) {
  workpiece.Location = { Kind: 'Gone' };
  workpiece.TimeOut = SYSTEM_TIME;
  SetWPState(workpiece, 'GONE');
  Stats.Completed++;
  Workpieces[workpiece.Type].Completed++;
  Stats.Finished.push({
    Id: workpiece.Id, Type: workpiece.Type, TimeIn: workpiece.TimeIn, TimeOut: workpiece.TimeOut,
    Times: { ...workpiece.Times },
  });
}

// [O] EventHandlers – sündmuse tüüp -> käsitleja.
const EventHandlers = {
  DoNothing: DoNothingProc,
  InSys: InSysProc,
  OutSys: OutSysProc,
  Load: LoadProc,
  MoveZ: MoveZProc,
  StopMov: StopMovProc,
  Turn: TurnProc,
  Process: ProcessProc,
};

// =====================================================================
// Planner
// =====================================================================

// [O nimi, T sisu] Planner – operatiivtaseme otsused. Teeb igal kutsel täieliku ülevaatuse:
//     1) laadib vabad tööpingid puhvrist, 2) leiab ootavatele detailidele sihtkoha ja
//     broneerib selle, 3) toob süsteemi uusi detaile.
//     Kutsuvad: EventHandlerid, SimInit. Lisab: Load, OutSys, InSys.
function Planner(reason) {
  Stats.PlannerCalls++;
  LoadMachines();
  AssignDestinations();
  AdmitWorkpieces();
}

// [O/U] LoadMachines – vaba pink võtab puhvrist detaili distsipliini järgi. Pink alustab ainult
//     siis, kui töödeldud detailile saab broneerida väljamineva koha (pink ei jää kinni).
function LoadMachines() {
  for (const machine of MachineArray) {
    if (machine.State !== 'IDLE' || machine.WP !== null) continue;
    const inBuffer = BufferArray[machine.InBuffer];
    const waiting = inBuffer.Entries.filter(entry => entry.Dir === 'In' && SysWPArray[entry.WP].State === 'WAIT_MACHINE');
    if (waiting.length === 0) continue;
    const outBuffer = BufferArray[machine.OutBuffer];
    const outPossible = outBuffer === inBuffer ? true : CanReserveSlot(outBuffer);
    if (!outPossible) continue;
    // distsipliini järjekorras esimene detail, millega saab alustada
    let chosen = null;
    let plannedDestination = null;
    for (const entry of OrderByDiscipline(waiting, inBuffer.Discipline)) {
      if (!Model.Sim.ReserveNextBeforeStart) { chosen = entry; break; }
      // ummiku vältimine: järgmise pingi koht broneeritakse enne töötlemise algust
      const nextOperation = NextOpElsewhere(SysWPArray[entry.WP], machine);
      if (nextOperation === null) { chosen = entry; break; }
      const nextMachineIndex = FindMach(SysWPArray[entry.WP], nextOperation, machine.Index);
      if (nextMachineIndex < 0) continue;
      const nextBuffer = BufferArray[MachineArray[nextMachineIndex].InBuffer];
      chosen = entry;
      plannedDestination = { Kind: 'Buffer', Index: nextBuffer.Index, Station: nextBuffer.Station };
      break;
    }
    if (chosen === null) continue;
    const workpiece = SysWPArray[chosen.WP];
    if (plannedDestination !== null) {
      ReserveSlot(BufferArray[plannedDestination.Index]);
      workpiece.PlannedDestination = plannedDestination;
    }
    inBuffer.Entries = inBuffer.Entries.filter(entry => entry !== chosen);
    ReserveSlot(outBuffer);
    machine.WP = workpiece.Id;
    workpiece.Location = { Kind: 'Machine', Index: machine.Index };
    SetMachState(machine, 'LOADING');
    SetWPState(workpiece, 'LOADING');
    PutEvent({ Event: 'Load', WP: workpiece.Id, SrcType: 'Buffer', SrcCode: machine.InBuffer,
               ObjType: 'Machine', ObjCode: machine.Index, Time: SYSTEM_TIME + machine.LoadTime });
  }
}

// [U] NextOpElsewhere – esimene operatsioon pärast neid, mida pink teeb järjest (samas pingis);
//     null, kui pärast seda pinki operatsioone pole.
function NextOpElsewhere(workpiece, machine) {
  const operations = Workpieces[workpiece.Type].Routes[workpiece.Route].Ops;
  let index = workpiece.OpIndex;
  while (index < operations.length && machine.Ops.includes(operations[index].Op)) index++;
  return index < operations.length ? operations[index] : null;
}

// [O] OrderByDiscipline – puhvri detailid FIFO, FILO või RANDOM järjekorras (tabel 4.3).
function OrderByDiscipline(entries, discipline) {
  if (discipline === 'FILO') return [...entries].reverse();
  if (discipline === 'RANDOM') {
    const shuffled = [...entries];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  return entries;
}

// [T/U] AssignDestinations – ootavatele detailidele (vanim enne) sihtkoht ja broneering.
//     Detail läheb teele ainult broneeritud sihtkohta (DISAIN.md 5.2 p 3).
function AssignDestinations() {
  const waiting = SysWPArray
    .filter(workpiece => workpiece.State === 'WAIT_DEST' || workpiece.State === 'PARKED')
    .filter(workpiece => !workpiece.OutSysPlanned)
    .sort((first, second) => first.StateSince - second.StateSince || first.Id - second.Id);
  for (const workpiece of waiting) {
    if (workpiece.Destination !== null) {   // sihtkoht on, tee konnektor oli kinni
      Depart(workpiece);
      continue;
    }
    const operation = CurrentOp(workpiece);
    if (operation === null) {
      workpiece.OutSysPlanned = true;
      PutEvent({ Event: 'OutSys', WP: workpiece.Id });
      continue;
    }
    const machineIndex = FindMach(workpiece, operation);
    if (machineIndex < 0) continue;
    const buffer = BufferArray[MachineArray[machineIndex].InBuffer];
    ReserveSlot(buffer);
    workpiece.Destination = { Kind: 'Buffer', Index: buffer.Index, Station: buffer.Station };
    if (workpiece.Location.Kind === 'Storage') {
      // pargitud detail tuuakse kesklaost FromCS jaama
      Storage.Parked = Storage.Parked.filter(workpieceId => workpieceId !== workpiece.Id);
      workpiece.Location = { Kind: 'FromCS' };
      FromCSQueue.push(workpiece.Id);
      Stats.Unparked++;
    }
    Depart(workpiece);
  }
}

// [O nimi, T sisu] FindMach – sobivaim tööpink operatsioonile, mille puhvris on vaba koht ja
//     kuhu rada mööda saab (StationPaths). Eelistus: vaba ja tühja järjekorraga pink -> lühim
//     järjekord -> lähim (tee pikkus). Tagastab pingi indeksi või -1.
function FindMach(workpiece, operation, excludeMachine = -1) {
  const fromStation = excludeMachine >= 0
    ? BufferArray[MachineArray[excludeMachine].OutBuffer].Station
    : CurrentStationOf(workpiece);
  let best = -1;
  let bestScore = null;
  for (const machine of MachineArray) {
    if (machine.Index === excludeMachine || !machine.Ops.includes(operation.Op)) continue;
    const buffer = BufferArray[machine.InBuffer];
    if (!CanReserveSlot(buffer)) continue;
    const path = fromStation >= 0 ? TransportPaths[fromStation][buffer.Station] : null;
    if (fromStation >= 0 && path === null) continue;
    const queueLength = buffer.Entries.filter(entry => entry.Dir === 'In').length + buffer.Reserved;
    const busy = machine.State === 'IDLE' ? 0 : 1;
    const score = [
      busy === 0 && queueLength === 0 ? 0 : 1,
      queueLength + busy,
      path !== null ? path.Length : 0,
    ];
    if (bestScore === null || CompareScores(score, bestScore) < 0) { best = machine.Index; bestScore = score; }
  }
  return best;
}

// [U] CompareScores – kahe kriteeriumide loendi võrdlus (leksikograafiliselt, väiksem parem).
function CompareScores(first, second) {
  for (let i = 0; i < first.length; i++) if (first[i] !== second[i]) return first[i] - second[i];
  return 0;
}

// [O nimi, T sisu] ChooseRoute – marsruut, millel on enim hetkel vabade pinkide operatsioone;
//     viigi korral väiksem Priority (1 = kõrgeim).
function ChooseRoute(workpiece) {
  const routes = Workpieces[workpiece.Type].Routes;
  let best = 0;
  let bestScore = null;
  routes.forEach((route, routeIndex) => {
    const freeOps = route.Ops.filter(operation =>
      MachineArray.some(machine => machine.State === 'IDLE' && machine.Ops.includes(operation.Op))).length;
    const score = [-freeOps, route.Priority];
    if (bestScore === null || CompareScores(score, bestScore) < 0) { best = routeIndex; bestScore = score; }
  });
  return best;
}

// [O] AdmitWorkpieces – süsteemi koormamine: uus detail, kui Ndet / (Ntm + Nmt + Nbuf) < Kl.
//     Tüüp: kõige vähem süsteemi toodud tüüp. Lisab: InSys.
function AdmitWorkpieces() {
  while (CountWorkpiecesInSystem() / TotalPlaces < Model.Sim.Kl) {
    let typeIndex = 0;
    Workpieces.forEach((type, index) => { if (type.Started < Workpieces[typeIndex].Started) typeIndex = index; });
    Workpieces[typeIndex].Started++;
    const workpiece = {
      Id: SysWPArray.length, Type: typeIndex, Route: 0, OpIndex: 0,
      Location: { Kind: 'Entering' }, Destination: null, Path: null, OutSysPlanned: false,
      State: 'ENTERING', StateSince: SYSTEM_TIME, TimeIn: SYSTEM_TIME, TimeOut: null,
      Times: { Process: 0, Setup: 0, Load: 0, Transport: 0, Wait: 0 },
    };
    SysWPArray.push(workpiece);
    Stats.Created++;
    PutEvent({ Event: 'InSys', WP: workpiece.Id, ObjType: 'SysInput', ObjCode: Model.FromCSStation });
  }
}

// =====================================================================
// Ummikud
// =====================================================================

// [U] FindDeadlockedWorkpieces – ummikus olevad detailid: puhvri väljaminevas kohas ootavad
//     detailid, mis ei saa kunagi sihtkohta. Puhver "saab edasi liikuda", kui sinna on detail
//     teel (broneering), tema pink töötab, või mõni tema detail saab liikuda: sissetuleva detaili
//     saab pink võtta, väljamineval on sihtkoht või mõni sobiv puhver on vaba / saab edasi liikuda.
//     Ülejäänud täis puhvrid on ummikus (ringootamine). Arvutatakse püsipunktini.
function FindDeadlockedWorkpieces() {
  const progressable = new Set();
  const slotObtainable = buffer => CanReserveSlot(buffer) || progressable.has(buffer.Index);
  const reachable = (fromBuffer, machine) =>
    TransportPaths[fromBuffer.Station][BufferArray[machine.InBuffer].Station] !== null;
  const bufferCanProgress = buffer => {
    if (buffer.Entries.length < buffer.Capacity || buffer.Reserved > 0) return true;
    const machine = MachineArray[buffer.Machine];
    if (machine.State !== 'IDLE') return true;
    for (const entry of buffer.Entries) {
      const workpiece = SysWPArray[entry.WP];
      if (entry.Dir === 'In') {
        if (workpiece.State !== 'WAIT_MACHINE') return true;
        const outBuffer = BufferArray[machine.OutBuffer];
        if (outBuffer !== buffer && !slotObtainable(outBuffer)) continue;
        if (!Model.Sim.ReserveNextBeforeStart) return true;
        // ummiku vältimise korral peab saama broneerida ka järgmise pingi koha
        const nextOperation = NextOpElsewhere(workpiece, machine);
        if (nextOperation === null) return true;
        const outOfMachine = BufferArray[machine.OutBuffer];
        if (MachineArray.some(candidate => candidate !== machine && candidate.Ops.includes(nextOperation.Op)
            && reachable(outOfMachine, candidate) && slotObtainable(BufferArray[candidate.InBuffer]))) return true;
        continue;
      }
      if (workpiece.State !== 'WAIT_DEST' || workpiece.Destination !== null) return true;   // teel või tee ootel
      const operation = CurrentOp(workpiece);
      if (operation === null) return true;
      for (const candidate of MachineArray) {
        if (candidate.Ops.includes(operation.Op) && reachable(buffer, candidate)
            && slotObtainable(BufferArray[candidate.InBuffer])) return true;
      }
    }
    return false;
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const buffer of BufferArray) {
      if (!progressable.has(buffer.Index) && bufferCanProgress(buffer)) { progressable.add(buffer.Index); changed = true; }
    }
  }
  return BufferArray
    .filter(buffer => !progressable.has(buffer.Index))
    .flatMap(buffer => buffer.Entries.map(entry => SysWPArray[entry.WP]))
    .filter(workpiece => workpiece.State === 'WAIT_DEST' || workpiece.State === 'WAIT_MACHINE')
    .sort((first, second) => first.StateSince - second.StateSince || first.Id - second.Id);
}

// [U] DetectDeadlock – kui leidub ummikus detaile, saadetakse kauem oodanu ajutiselt kesklattu
//     (pargitakse). Kui kesklattu ei saa, on ummik lahendamatu -> simulatsioon peatub. Kui tee
//     kesklattu on hetkel kinni (konnektor), proovitakse järgmisel sekundil uuesti.
//     Varukontroll: kui midagi ei toimu üle StallTime ja süsteemis on detaile -> peatub.
//     Kutsub: SimStep.
function DetectDeadlock() {
  const deadlocked = FindDeadlockedWorkpieces();
  if (deadlocked.length > 0) {
    if (StorageFree()) {
      const workpiece = deadlocked[0];
      if (PathFree(CurrentStationOf(workpiece), Storage.Station)) {
        Storage.Reserved++;
        workpiece.Destination = { Kind: 'ToCS', Station: Storage.Station, Park: true };
        Depart(workpiece);
        Stats.Parked++;
      }
    } else {
      DEADLOCK = true;
      Stats.DeadlockReason = FormatText(Texts.SimDeadlockCycle,
        { List: deadlocked.map(workpiece => `WP${workpiece.Id}`).join(', ') });
      SIMULATION_DONE = true;
      return;
    }
  }
  const nothingMoving = FirstAtMoment === null
    && MachineArray.every(machine => machine.State === 'IDLE')
    && Tracks.every(track => track.Pallets.every(pallet => pallet.WP === null && pallet.ReservedWP === null));
  const anyoneWaitingForPickup = SysWPArray.some(workpiece => workpiece.State === 'WAIT_PICKUP');
  if (nothingMoving && !anyoneWaitingForPickup && CountWorkpiecesInSystem() > 0
      && SYSTEM_TIME - LastEventTime > Model.Sim.StallTime) {
    DEADLOCK = true;
    Stats.DeadlockReason = FormatText(Texts.SimDeadlockStall, { Seconds: Model.Sim.StallTime });
    SIMULATION_DONE = true;
  }
}

// =====================================================================
// Invariandid (testides)
// =====================================================================

// [U] CheckInvariants – kontrollib, et andmed on kooskõlas (DISAIN.md 9). Viga -> Error.
function CheckInvariants() {
  const fail = message => { throw new Error(`Invariant (t=${SYSTEM_TIME}): ${message}`); };

  // detailid ei teki ega kao
  const alive = SysWPArray.filter(workpiece => workpiece.Location.Kind !== 'Gone');
  if (alive.length !== Stats.Created - Stats.Completed) fail('detailide arv ei klapi');

  // iga detaili asukoht on kooskõlas struktuuridega
  for (const workpiece of alive) {
    const location = workpiece.Location;
    switch (location.Kind) {
      case 'Entering': break;
      case 'FromCS': if (!FromCSQueue.includes(workpiece.Id)) fail(`WP${workpiece.Id} pole FromCS järjekorras`); break;
      case 'Storage': if (!Storage.Parked.includes(workpiece.Id)) fail(`WP${workpiece.Id} pole kesklaos`); break;
      case 'Pallet': if (Tracks[location.Track].Pallets[location.Pal].WP !== workpiece.Id) fail(`WP${workpiece.Id} pole alusel`); break;
      case 'Buffer': if (!BufferArray[location.Index].Entries.some(entry => entry.WP === workpiece.Id)) fail(`WP${workpiece.Id} pole puhvris`); break;
      case 'Machine': if (MachineArray[location.Index].WP !== workpiece.Id) fail(`WP${workpiece.Id} pole pingis`); break;
      case 'Connector': if (ConnectorArray[location.Index].WP !== workpiece.Id) fail(`WP${workpiece.Id} pole konnektoris`); break;
      default: fail(`WP${workpiece.Id} tundmatu asukoht ${location.Kind}`);
    }
    // teel olev detail: tee on olemas ja praegune sõit on sellel rajal
    if (location.Kind === 'Pallet' && (workpiece.Path === null || workpiece.Path[0].Track !== location.Track)) {
      fail(`WP${workpiece.Id} alusel ilma selle raja sõiduta`);
    }
    if (workpiece.State === 'WAIT_PICKUP' && (workpiece.Path === null || workpiece.Path[0].From !== CurrentStationOf(workpiece))) {
      fail(`WP${workpiece.Id} ootab alust, aga tee ei alga tema jaamast`);
    }
  }
  for (const connector of ConnectorArray) {
    if (connector.Reserved < 0 || connector.Reserved + (connector.WP !== null ? 1 : 0) > 1) fail(`konnektor ${connector.Name} ületäis`);
    if (connector.WP !== null) {
      const location = SysWPArray[connector.WP].Location;
      if (location.Kind !== 'Connector' || location.Index !== connector.Index) fail(`konnektori ${connector.Name} detail vale asukohaga`);
    }
  }
  const reservedConnectors = new Map();   // konnektor -> broneerinud detailide arv (teel olevad detailid)
  for (const workpiece of alive) {
    if (workpiece.Path === null) continue;
    for (const connector of PathConnectors({ Legs: workpiece.Path })) {
      reservedConnectors.set(connector.Index, (reservedConnectors.get(connector.Index) || 0) + 1);
    }
  }
  for (const connector of ConnectorArray) {
    if ((reservedConnectors.get(connector.Index) || 0) !== connector.Reserved) fail(`konnektori ${connector.Name} broneeringud ei klapi`);
  }
  // tagurpidi: struktuuris olev detail viitab samale kohale; mahutavused
  for (const buffer of BufferArray) {
    if (buffer.Entries.length + buffer.Reserved > buffer.Capacity) fail(`puhver ${buffer.Name} ületäis`);
    if (buffer.Reserved < 0) fail(`puhver ${buffer.Name} Reserved < 0`);
    for (const entry of buffer.Entries) {
      const location = SysWPArray[entry.WP].Location;
      if (location.Kind !== 'Buffer' || location.Index !== buffer.Index) fail(`puhvri ${buffer.Name} kirje WP${entry.WP} vale asukohaga`);
    }
  }
  for (const machine of MachineArray) {
    if (machine.WP !== null) {
      const location = SysWPArray[machine.WP].Location;
      if (location.Kind !== 'Machine' || location.Index !== machine.Index) fail(`pingi ${machine.Name} detail vale asukohaga`);
    }
    if ((machine.State === 'IDLE') !== (machine.WP === null)) fail(`pingi ${machine.Name} olek ${machine.State} ei klapi detailiga`);
  }
  Tracks.forEach((track, trackIndex) => {
    if (track.StopCount < 0) fail(`rada ${track.Name} StopCount < 0`);
    track.Pallets.forEach((pallet, palletIndex) => {
      const position = (track.Offset + palletIndex * track.Length / track.Carts) % track.Length;
      if (pallet.WP !== null) {
        const location = SysWPArray[pallet.WP].Location;
        if (location.Kind !== 'Pallet' || location.Track !== trackIndex || location.Pal !== palletIndex) fail(`alus ${palletIndex} detail vale asukohaga`);
        // avatud konveier: koormaga alus ei jõua raja lõppu (ei hüppa algusesse)
        if (!track.Closed && pallet.CheckedWP === pallet.WP && position < pallet.CheckedPosition - 1e-6) {
          fail(`rada ${track.Name}: koormaga alus ${palletIndex} läbis avatud konveieri lõpu`);
        }
      }
      pallet.CheckedWP = pallet.WP;
      pallet.CheckedPosition = position;
    });
    if (track.StopCount > 0) {
      // seisev konveier ainult siis, kui mõni laadimine või peatus on pooleli
      let pending = false;
      for (let item = FirstAtMoment; item !== null; item = item.Next) {
        if (item.Track === trackIndex && (item.Event === 'Load' || item.Event === 'MoveZ' || item.Event === 'StopMov')) pending = true;
      }
      if (!pending) fail(`rada ${track.Name} seisab ilma põhjuseta`);
    }
  });
  if (Storage !== null && Storage.Count + Storage.Parked.length + Storage.Reserved > Storage.Capacity) fail('keskladu ületäis');

  // Event List on järjestatud ja käesoleva hetke sündmused on töödeldud
  for (let item = FirstAtMoment; item !== null; item = item.Next) {
    if (item.Time <= SYSTEM_TIME) fail(`töötlemata sündmus ${item.Event} t=${item.Time}`);
    if (item.Next !== null && item.Next.Time < item.Time) fail('Event List pole järjestatud');
  }
}

// =====================================================================
// Statistika
// =====================================================================

// [T] CollectStats – kogub iga sekundi lõpus: puhvrite täituvus, konveieri liikumine,
//     detailide arv; iga SampleInterval sekundi järel aegrea punkt (Stats.Timeline).
//     Kutsub: SimStep, SimInit (aegrea algpunkt).
function CollectStats() {
  for (const buffer of BufferArray) {
    buffer.FillIntegral += buffer.Entries.length;
    buffer.MaxFill = Math.max(buffer.MaxFill, buffer.Entries.length);
  }
  for (const track of Tracks) {
    if (track.StopCount > 0) track.StoppedTime++; else track.MovingTime++;
  }
  Stats.WipIntegral += CountWorkpiecesInSystem();
  Stats.MaxWip = Math.max(Stats.MaxWip, CountWorkpiecesInSystem());
  if (Storage !== null) Storage.MaxParked = Math.max(Storage.MaxParked, Storage.Parked.length);
  if (SYSTEM_TIME % Model.Sim.SampleInterval === 0 || SIMULATION_DONE || SYSTEM_TIME >= Model.Sim.Duration) {
    TimelinePoint();
  }
}

// [U] TimelinePoint – aegrea punkt Dynamic-aruande jaoks (etapp 9): detailid süsteemis,
//     valmis, hõivatud pingid, puhvrite täituvus. Kutsub: CollectStats.
function TimelinePoint() {
  const last = Stats.Timeline[Stats.Timeline.length - 1];
  if (last && last.Time === SYSTEM_TIME) return;
  Stats.Timeline.push({
    Time: SYSTEM_TIME,
    InSystem: CountWorkpiecesInSystem(),
    Completed: Stats.Completed,
    BusyMachines: MachineArray.filter(machine => machine.State !== 'IDLE').length,
    BufferFill: BufferArray.map(buffer => buffer.Entries.length),
  });
}

// [T] SimReport – kokkuvõte: läbilaskevõime, tsükliaeg ja osakaalud (originaali ptk 8.5),
//     pinkide olekud, puhvrite täituvus, konveieri liikumine, tüüpide kaupa, aegrida.
//     Kutsub: SimRun, fms.js, testid.
export function SimReport() {
  const time = Math.max(1, SYSTEM_TIME);
  const finished = Stats.Finished;
  const timeKeys = ['Process', 'Setup', 'Load', 'Transport', 'Wait'];
  const sum = Object.fromEntries(timeKeys.map(key => [key, 0]));
  let cycleSum = 0;
  for (const item of finished) {
    cycleSum += item.TimeOut - item.TimeIn;
    for (const key of timeKeys) sum[key] += item.Times[key];
  }
  const share = key => (cycleSum > 0 ? sum[key] / cycleSum : 0);
  return {
    Model: Model.Name,
    Seed: Model.Sim.Seed,
    Time: SYSTEM_TIME,
    Duration: Model.Sim.Duration,
    Deadlock: DEADLOCK,
    DeadlockReason: Stats.DeadlockReason || null,
    Created: Stats.Created,
    Completed: Stats.Completed,
    InSystem: CountWorkpiecesInSystem(),
    Parked: Stats.Parked,
    Unparked: Stats.Unparked,
    ThroughputPerHour: Stats.Completed / (time / 3600),
    AvgCycleTime: finished.length > 0 ? cycleSum / finished.length : 0,
    AvgWip: Stats.WipIntegral / time,
    MaxWip: Stats.MaxWip,
    Shares: Object.fromEntries(timeKeys.map(key => [key, share(key)])),
    Types: Workpieces.map((type, typeIndex) => {
      const own = finished.filter(item => item.Type === typeIndex);
      const ownCycle = own.reduce((total, item) => total + item.TimeOut - item.TimeIn, 0);
      return { Name: type.Name, Started: type.Started, Completed: type.Completed,
               AvgCycleTime: own.length > 0 ? ownCycle / own.length : 0 };
    }),
    Machines: MachineArray.map(machine => {
      const stateTime = { ...machine.StateTime };
      stateTime[machine.State] = (stateTime[machine.State] || 0) + SYSTEM_TIME - machine.StateSince;
      const part = state => (stateTime[state] || 0) / time;
      return {
        Name: machine.Name,
        Utilization: part('LOADING') + part('SETUP') + part('PROCESSING') + part('UNLOADING'),
        ProcessingShare: part('PROCESSING'), SetupShare: part('SETUP'),
        LoadShare: part('LOADING') + part('UNLOADING'), IdleShare: part('IDLE'),
        OpsDone: machine.OpsDone, StateTime: stateTime,
      };
    }),
    Buffers: BufferArray.map(buffer => ({ Name: buffer.Name, Capacity: buffer.Capacity,
                                          AvgFill: buffer.FillIntegral / time, MaxFill: buffer.MaxFill })),
    Tracks: Tracks.map(track => ({ Name: track.Name, Closed: track.Closed, MovingShare: track.MovingTime / time,
                                   StoppedShare: track.StoppedTime / time, Stops: track.Stops })),
    Connectors: ConnectorArray.map(connector => ({ Name: connector.Name, Transfers: connector.Transfers })),
    StorageCount: Storage !== null ? Storage.Count : null,
    StorageMaxParked: Storage !== null ? Storage.MaxParked : null,
    EventCount: Stats.EventCount,
    EventCountByType: Stats.EventCountByType,
    Timeline: Stats.Timeline,
    Finished: finished,
  };
}

// =====================================================================
// Käivitamine
// =====================================================================

// [O] SimInit – loeb võrgu (Enumerate tulemus), eraldab andmestruktuurid, seab algväärtused ja
//     töötleb hetke 0. Kutsub: SimRun, animaator (etapp 5).
export function SimInit(network, inputOptions = {}) {
  Model = structuredClone(network);
  Model.Sim = { ReserveNextBeforeStart: true, SampleInterval: SAMPLE_INTERVAL, ...Model.Sim };
  Options = { CheckInvariants: false, ...inputOptions };
  SYSTEM_TIME = 0;
  NO_EVENTS = true;
  SIMULATION_DONE = false;
  DEADLOCK = false;
  FirstAtMoment = null;
  RandomState = Model.Sim.Seed | 0;
  LastEventTime = 0;
  FromCSQueue = [];
  SysWPArray = [];
  Stats = { Created: 0, Completed: 0, Parked: 0, Unparked: 0, EventCount: 0, EventCountByType: {},
            PlannerCalls: 0, LastProgressTime: 0, WipIntegral: 0, MaxWip: 0, Timeline: [], Finished: [] };

  Tracks = Model.Tracks.map((track, trackIndex) => {
    if (track.Mode !== 'Continuous') throw new Error(`SimInit: rada ${track.Name} pole pidev`);
    return {
      ...track, Closed: track.Closed !== false,
      Index: trackIndex, Offset: 0, StopCount: 0, MovingTime: 0, StoppedTime: 0, Stops: 0, Stations: [],
      Pallets: Array.from({ length: track.Carts }, (unused, palletIndex) => ({ Index: palletIndex, WP: null, ReservedWP: null })),
    };
  });
  StationArray = Model.Stations.map((station, stationIndex) => ({ ...station, Index: stationIndex }));
  StationArray.forEach(station => Tracks[station.Track].Stations.push(station.Index));
  ConnectorArray = (Model.Connectors || []).map((connector, connectorIndex) => ({
    ...connector, Index: connectorIndex, WP: null, Reserved: 0, Transfers: 0,
  }));
  TransportPaths = StationPaths(Model);
  BufferArray = Model.Buffers.map((buffer, bufferIndex) => ({
    ...buffer, Index: bufferIndex, Entries: [], Reserved: 0, FillIntegral: 0, MaxFill: 0,
  }));
  MachineArray = Model.Machines.map((machine, machineIndex) => ({
    ...machine, Index: machineIndex, State: 'IDLE', StateSince: 0, StateTime: {}, WP: null, LastOp: null, OpsDone: 0,
  }));
  Workpieces = Model.Workpieces.map(type => ({ ...type, Started: 0, Completed: 0 }));

  Model.FromCSStation = StationArray.findIndex(station => station.Kind === 'FromCS');
  Model.SysOutStation = StationArray.findIndex(station => station.Kind === 'SysOut');
  const toCSStation = StationArray.findIndex(station => station.Kind === 'ToCS');
  if (Model.FromCSStation < 0) throw new Error('SimInit: võrgus pole FromCS jaama');
  if (Model.SysOutStation < 0) throw new Error('SimInit: võrgus pole SysOut jaama');
  Storage = Model.Storage && toCSStation >= 0
    ? { ParkingReserve: PARKING_RESERVE, ...Model.Storage, Station: toCSStation, Count: 0, Parked: [], Reserved: 0, MaxParked: 0 }
    : null;

  TotalPlaces = Tracks.reduce((sum, track) => sum + track.Carts * track.PlacesPerCart, 0)
    + MachineArray.length
    + BufferArray.reduce((sum, buffer) => sum + buffer.Capacity, 0)
    + ConnectorArray.length;

  Planner('Init');
  ProcAllEvents();
  if (Options.CheckInvariants) CheckInvariants();
  TimelinePoint();
}

// [O] SimStep – üks sekund: kell edasi, MinuteMan, kõik selle hetke sündmused, ummiku kontroll.
//     Järjekord erineb originaalist (joon. 5.3): MinuteMan enne sündmusi (DISAIN.md 1).
//     Kutsub: SimRun, animaator (etapp 5).
export function SimStep() {
  SYSTEM_TIME++;
  MinuteMan();
  ProcAllEvents();
  DetectDeadlock();
  if (Options.CheckInvariants) CheckInvariants();
  if (SYSTEM_TIME >= Model.Sim.Duration) SIMULATION_DONE = true;
  CollectStats();
}

// [U] SimRun – käivitab simulatsiooni lõpuni ja tagastab aruande. Kutsub: fms.js, testid.
export function SimRun(network, inputOptions = {}) {
  SimInit(network, inputOptions);
  while (!SIMULATION_DONE) SimStep();
  return SimReport();
}

// [U] SimState – sisemine olek testidele ja animaatorile (ainult lugemiseks).
export function SimState() {
  return { SYSTEM_TIME, SIMULATION_DONE, DEADLOCK, Network: Model, Tracks, StationArray, ConnectorArray, MachineArray,
           BufferArray, Storage, Workpieces, SysWPArray, FromCSQueue, FirstAtMoment, Stats };
}
