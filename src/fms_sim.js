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
// Etapp 7b: diskreetsed rajad (AGV-d) – raja graaf (TraceGraph), kärud, tsoonid ja plokid
// (CartBlock), ProgTM, FindPal, Collision (DISAIN.md osa 11); paralleelsed konnektorid (FreePath).
//
// Piirangud (tulevad hiljem): alusel / kärul 1 detail (7c), rikkeid pole (etapp 8).
//
// Moodul ei kasuta brauserit, nii et seda saab testida Node'iga.

import { IconTypes, DIRECTIONS, CellTrack } from './fms_glb.js';
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
// [O] BUFFER_FLOW – puhvri liik → suunad joonisel, kuhu detailid temast läbi liiguvad (joon. 5.4):
//     InBuf üles, OutBuf alla, InOutBuf ja TurnBuf mõlemat pidi. N – üles, S – alla.
const BUFFER_FLOW = { InBuf: ['N'], OutBuf: ['S'], InOutBuf: ['N', 'S'], TurnBuf: ['N', 'S'] };

// [T] RoleFlow – kuhu detail joonisel liigub, kui puhver on pingi suhtes dy (-1 kohal, +1 all):
//     sissetulev liigub rajalt pingi poole, väljaminev pingilt raja poole.
function RoleFlow(role, dy) {
  const towardMachine = dy > 0 ? 'N' : 'S';
  return role === 'In' ? towardMachine : DIRECTIONS[towardMachine].Opposite;
}

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

// [U] OtherPort – kaheküljelise ikooni teine külg; sillal (CrossOver) vastaskülg.
function OtherPort(cell, port) {
  if (IconTypes[cell.T].CrossOver) return DIRECTIONS[port].Opposite;
  return IconTypes[cell.T].Ports.find(other => other !== port);
}

// [U] PartKey – raja osa võti: lahter, sillal lahter + telg (W–E või N–S), sest sillast läheb
//     läbi kaks rada (või sama rada kaks korda).
function PartKey(cell, port) {
  if (!IconTypes[cell.T].CrossOver) return CellKey(cell.X, cell.Y);
  return `${CellKey(cell.X, cell.Y)},${port === 'N' || port === 'S' ? 'NS' : 'WE'}`;
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
  const usedTracks = [...new Set(trackCells.flatMap(cell => (cell.N2 !== undefined ? [cell.N - 1, cell.N2 - 1] : [cell.N - 1])))]
    .sort((a, b) => a - b);
  model.Tracks.forEach((track, trackIndex) => {
    if (!usedTracks.includes(trackIndex)) {
      EnumWarning(context, `Tracks[${trackIndex + 1}]`, Texts.EnumNotOnLayout, { Object: track.Name });
    }
  });
  if (usedTracks.length === 0) EnumError(context, 'Layout', Texts.EnumNoTrack);
  for (const trackIndex of usedTracks) {
    const track = model.Tracks[trackIndex];
    const path = `Tracks[${trackIndex + 1}]`;
    if (track.PlacesPerCart > 1) EnumError(context, `${path}.PlacesPerCart`, Texts.EnumLater, { What: Texts.EnumLaterPlaces, Stage: '7c' });
  }
  if (context.Errors.length > 0) return result();

  // Rajad: suunanoole järgi silmus või avatud konveier; harudel ja otstes jaamad
  const traces = [];
  for (const trackIndex of usedTracks) {
    const trace = model.Tracks[trackIndex].Mode === 'Discrete'
      ? TraceGraph(context, trackIndex, trackCells)
      : TraceTrack(context, trackIndex, trackCells);
    if (trace !== null) traces.push(trace);
  }
  if (context.Errors.length > 0) return result();   // katkine rada: muud vead oleksid selle tagajärg
  const links = traces.flatMap(trace => (trace.Discrete ? FindGraphStations(context, trace) : FindStations(context, trace)));
  DetectOpenCons(context, cells, traces);
  const objects = CheckObjects(context, cells, links);
  const machineLinks = LinkMachines(context, cells);
  if (context.Errors.length > 0) return result();

  const geometries = traces.map(trace => (trace.Discrete
    ? MeasureGraph(context, trace, links.filter(link => link.Trace === trace))
    : MeasureTrack(context, trace, links.filter(link => link.Trace === trace))));
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
  // oma osad: lahtrid, sillal ainult selle raja telg
  const ownParts = cell => (IconTypes[cell.T].CrossOver
    ? ['E', 'S'].filter(port => CellTrack(cell, port) - 1 === trackIndex).map(port => PartKey(cell, port))
    : (cell.N - 1 === trackIndex ? [PartKey(cell, null)] : []));
  const ownCells = trackCells.filter(cell => ownParts(cell).length > 0);
  const arrowCells = ownCells.filter(cell => cell.Dir !== undefined);
  if (arrowCells.length === 0) {
    EnumError(context, `Tracks[${trackIndex + 1}]`, Texts.EnumNoDirection, { Track: name });
    return null;
  }
  const start = arrowCells[0];
  const first = { Cell: start, Entry: OtherPort(start, start.Dir), Exit: start.Dir, Unit: IconTypes[start.T].Arc ? ARC_LENGTH : 1 };
  const visited = new Set([PartKey(start, start.Dir)]);
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
    Unvisited: ownCells.filter(own => ownParts(own).some(key => !visited.has(key))),
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
    const nextTrack = CellTrack(next, nextEntry);
    if (nextTrack - 1 !== trackIndex) {
      if (!faces) return free;
      EnumError(context, CellPath(next), Texts.EnumTracksTouch,
        { Track: name, Track2: context.Model.Tracks[nextTrack - 1].Name, X: next.X, Y: next.Y });
      return null;
    }
    if (!faces) return badJoin(next);
    if (next === startCell && closeEntry !== null) {
      if (nextEntry !== closeEntry) return badJoin(next);
      return { Items: items, End: { Kind: 'Closed' } };
    }
    const key = PartKey(next, nextEntry);
    if (visited.has(key)) {
      EnumError(context, CellPath(next), Texts.EnumCrossLoop, { Track: name, X: next.X, Y: next.Y });
      return null;
    }
    if (icon.Ports.length !== 2 && !icon.CrossOver) {   // ristmik (sild ei ühenda – sealt minnakse otse läbi)
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

// [U] OwnPorts – raja trackIndex küljed lahtris: sillal ainult selle raja telg (või mõlemad, kui
//     sama rada ristub iseendaga), muidu ikooni küljed. Kutsub: TraceGraph.
function OwnPorts(cell, trackIndex) {
  if (!IconTypes[cell.T].CrossOver) return cell.N - 1 === trackIndex ? AllPorts(cell) : [];
  return ['N', 'E', 'S', 'W'].filter(port => CellTrack(cell, port) - 1 === trackIndex);
}

// [U] AllPorts – raja ikooni kõik küljed koos hargnemise haruga (Ports + Branch).
function AllPorts(cell) {
  const icon = IconTypes[cell.T];
  return icon.Branch ? [...icon.Ports, icon.Branch] : icon.Ports;
}

// [U] PortNeighbor – mis on diskreetse raja lahtri külje port taga: oma raja ikoon, mis on selle
//     poole pööratud ({ Kind: 'Track', Cell, Entry }), konnektor ({ Kind: 'Connector', Cell }),
//     vaba ots ({ Kind: 'Free' }) või viga ({ Kind: 'Error' }, teatatud). Kutsub: TraceGraph.
function PortNeighbor(context, trackIndex, cell, port) {
  const next = Neighbor(context, cell, port);
  if (next === null) return { Kind: 'Free' };
  const entry = DIRECTIONS[port].Opposite;
  const icon = IconTypes[next.T];
  const faces = Boolean(icon.Ports) && (icon.Kind === 'Track' ? AllPorts(next) : icon.Ports).includes(entry);
  const badJoin = () => {
    EnumError(context, CellPath(next), Texts.EnumBadJoin, { X: cell.X, Y: cell.Y, X2: next.X, Y2: next.Y });
    return { Kind: 'Error' };
  };
  if (icon.Kind === 'Connector') return faces ? { Kind: 'Connector', Cell: next } : badJoin();
  if (icon.Kind !== 'Track') return { Kind: 'Free' };              // objekt raja otsas
  if (next.Dot) return faces ? badJoin() : { Kind: 'Free' };        // rada ei lähe punktiiri
  if (!faces) return CellTrack(next, entry) - 1 === trackIndex ? badJoin() : { Kind: 'Free' };
  if (CellTrack(next, entry) - 1 !== trackIndex) {
    EnumError(context, CellPath(next), Texts.EnumTracksTouch, {
      Track: context.Model.Tracks[trackIndex].Name, Track2: context.Model.Tracks[CellTrack(next, entry) - 1].Name, X: next.X, Y: next.Y,
    });
    return { Kind: 'Error' };
  }
  return { Kind: 'Track', Cell: next, Entry: entry };
}

// [U] TraceGraph – diskreetse raja graaf (DISAIN.md 11): sõlmed on hargnemised (Tee*), ristmikud
//     (Cruise) ja raja otsad (ka ots konnektori kõrval); lõik on rada kahe sõlme vahel (sild läbib
//     otse). Hargnemise haru on kas rada (raja-haru, ristmik) või punktiir (jaam, FindGraphStations).
//     Lõik on kahesuunaline; suunanool lõigu ikoonil teeb selle ühesuunaliseks (vastuolu – viga).
//     Rada peab olema sidus (üks kärupark). Tagastab { TrackIndex, Discrete, Closed: true, Nodes,
//     Edges, Unvisited } või null. Nodes: [{ Cell, Ports: { külg: haru tüüp } }], Edges: [{ From, To,
//     FromPort, ToPort, Inner: [{ Cell, Entry, Exit, Unit }], OneWay }] (OneWay: 0 mõlemat pidi,
//     1 ainult From → To, -1 ainult To → From). Kutsub: Enumerate.
function TraceGraph(context, trackIndex, trackCells) {
  const name = context.Model.Tracks[trackIndex].Name;
  const errorsBefore = context.Errors.length;
  const ownCells = trackCells.filter(cell => OwnPorts(cell, trackIndex).length > 0);
  const neighbors = new Map();   // lahter + külg -> PortNeighbor
  const neighborOf = (cell, port) => {
    const key = `${CellKey(cell.X, cell.Y)},${port}`;
    if (!neighbors.has(key)) neighbors.set(key, PortNeighbor(context, trackIndex, cell, port));
    return neighbors.get(key);
  };

  // sõlmed: hargnemine, ristmik, ots (külg pole oma rajaga ühendatud)
  const nodes = [];
  const nodeAt = new Map();
  for (const cell of ownCells) {
    const icon = IconTypes[cell.T];
    if (icon.CrossOver) continue;
    const ports = {};
    for (const port of AllPorts(cell)) {
      if (port === icon.Branch) {
        const first = Neighbor(context, cell, port);
        const isTrack = first !== null && IconTypes[first.T].Kind === 'Track' && !first.Dot;
        ports[port] = isTrack ? neighborOf(cell, port).Kind : 'Station';
      } else {
        ports[port] = neighborOf(cell, port).Kind;
      }
    }
    const kinds = Object.values(ports);
    if (AllPorts(cell).length > 2 || kinds.some(kind => kind !== 'Track')) {
      nodeAt.set(CellKey(cell.X, cell.Y), nodes.length);
      nodes.push({ Cell: cell, Ports: ports });
    }
  }
  if (context.Errors.length > errorsBefore) return null;
  for (const node of nodes) {
    if (AllPorts(node.Cell).length > 2 && Object.values(node.Ports).includes('Connector')) {
      EnumError(context, CellPath(node.Cell), Texts.EnumBadJoin, { X: node.Cell.X, Y: node.Cell.Y, X2: node.Cell.X, Y2: node.Cell.Y });
    }
  }

  // lõigud: igast sõlmest iga raja külje kaudu järgmise sõlmeni
  const edges = [];
  const usedPorts = new Set();
  const visited = new Set(nodes.map(node => PartKey(node.Cell, null)));
  const arrowSide = (cell, entry, exit) => {   // 1 – nool liikumise suunas, -1 vastu, 0 – noolt pole
    if (cell.Dir === undefined) return 0;
    if (cell.Dir === exit) return 1;
    if (cell.Dir === entry) return -1;
    return 0;
  };
  nodes.forEach((node, nodeIndex) => {
    for (const [port, kind] of Object.entries(node.Ports)) {
      if (kind !== 'Track' || usedPorts.has(`${nodeIndex},${port}`)) continue;
      usedPorts.add(`${nodeIndex},${port}`);
      const inner = [];
      const arrows = [];
      let cell = node.Cell;
      let exit = port;
      if (AllPorts(node.Cell).length === 2) arrows.push({ Cell: node.Cell, Side: arrowSide(node.Cell, OtherPort(node.Cell, port), port) });
      for (;;) {
        const next = neighborOf(cell, exit);
        const nextIndex = nodeAt.get(CellKey(next.Cell.X, next.Cell.Y));
        if (nextIndex !== undefined && !IconTypes[next.Cell.T].CrossOver) {
          usedPorts.add(`${nextIndex},${next.Entry}`);
          if (AllPorts(next.Cell).length === 2) {
            arrows.push({ Cell: next.Cell, Side: arrowSide(next.Cell, next.Entry, OtherPort(next.Cell, next.Entry)) });
          }
          const sides = new Set(arrows.map(arrow => arrow.Side).filter(side => side !== 0));
          if (sides.size > 1) {
            const arrow = arrows.find(item => item.Side !== 0);
            EnumError(context, CellPath(arrow.Cell), Texts.EnumDirConflict, { Track: name, X: arrow.Cell.X, Y: arrow.Cell.Y });
          }
          edges.push({ From: nodeIndex, To: nextIndex, FromPort: port, ToPort: next.Entry, Inner: inner,
                       OneWay: sides.size === 1 ? [...sides][0] : 0 });
          break;
        }
        const key = PartKey(next.Cell, next.Entry);
        if (visited.has(key)) {
          EnumError(context, CellPath(next.Cell), Texts.EnumCrossLoop, { Track: name, X: next.Cell.X, Y: next.Cell.Y });
          return;
        }
        visited.add(key);
        const nextExit = OtherPort(next.Cell, next.Entry);
        inner.push({ Cell: next.Cell, Entry: next.Entry, Exit: nextExit, Unit: IconTypes[next.Cell.T].Arc ? ARC_LENGTH : 1 });
        arrows.push({ Cell: next.Cell, Side: arrowSide(next.Cell, next.Entry, nextExit) });
        cell = next.Cell;
        exit = nextExit;
      }
    }
  });
  if (context.Errors.length > errorsBefore) return null;

  // sidusus: kõik sõlmed ühes tükis
  if (nodes.length > 0) {
    const seen = new Set([0]);
    const queue = [0];
    while (queue.length > 0) {
      const current = queue.shift();
      for (const edge of edges) {
        for (const [a, b] of [[edge.From, edge.To], [edge.To, edge.From]]) {
          if (a === current && !seen.has(b)) { seen.add(b); queue.push(b); }
        }
      }
    }
    const apart = nodes.findIndex((node, nodeIndex) => !seen.has(nodeIndex));
    if (apart >= 0) {
      const cell = nodes[apart].Cell;
      EnumError(context, CellPath(cell), Texts.EnumGraphSplit, { Track: name, X: cell.X, Y: cell.Y });
      return null;
    }
  } else {
    EnumError(context, `Tracks[${trackIndex + 1}]`, Texts.EnumGraphNoNodes, { Track: name });
    return null;
  }
  return {
    TrackIndex: trackIndex, Discrete: true, Closed: true, Nodes: nodes, Edges: edges,
    Unvisited: ownCells.filter(own => OwnPorts(own, trackIndex).some(port => !visited.has(PartKey(own, port)))),
  };
}

// [U] FindGraphStations – diskreetse raja jaamad: hargnemise haru, mis on punktiirühendus (või
//     kohe objekt), ja raja ots konnektori kõrval. Jaam on sõlme lahtri keskel.
//     Tagastab [{ Trace, Node, Object, Link, Side, AtEnd }]. Kutsub: Enumerate.
function FindGraphStations(context, trace) {
  const links = [];
  trace.Nodes.forEach((node, nodeIndex) => {
    for (const [port, kind] of Object.entries(node.Ports)) {
      if (kind === 'Station') {
        const link = FollowDotLink(context, node.Cell, port);
        if (link !== null) links.push({ Trace: trace, Node: nodeIndex, Object: link.Object, Link: link.Cells, Side: link.Side, AtEnd: false });
      } else if (kind === 'Connector') {
        links.push({ Trace: trace, Node: nodeIndex, Object: Neighbor(context, node.Cell, port), Link: [],
                     Side: DIRECTIONS[port].Opposite, AtEnd: true });
      }
    }
  });
  return links;
}

// [U] MeasureGraph – diskreetse raja lõikude pikkused ja geomeetria. Lõik algab ja lõpeb sõlme
//     lahtri keskel (sõlme ikoonist pool kummalegi lõigule); pikkus = ikoonide pikkus × Scale,
//     EdgeLengths kirjutab üle (metrokaart, nagu MeasureTrack). Lõigu Cells: [{ X, Y, T, Entry,
//     Exit, F0, F1, Start, Length }] – ikoonid From-sõlmest To-sõlme, F0 … F1 osa ikoonist
//     (CellPathPoint), Start – kaugus lõigu algusest. Tagastab { Nodes, Edges, StationNodes }.
//     Kutsub: Enumerate.
function MeasureGraph(context, trace, links) {
  const model = context.Model;
  const nodeUnit = cell => (IconTypes[cell.T].Arc ? ARC_LENGTH : 1);
  const ownKeys = new Set();
  trace.Nodes.forEach(node => ownKeys.add(CellKey(node.Cell.X, node.Cell.Y)));
  trace.Edges.forEach(edge => edge.Inner.forEach(item => ownKeys.add(CellKey(item.Cell.X, item.Cell.Y))));
  const edges = trace.Edges.map(edge => {
    const fromCell = trace.Nodes[edge.From].Cell;
    const toCell = trace.Nodes[edge.To].Cell;
    const fromTwo = AllPorts(fromCell).length === 2;
    const toTwo = AllPorts(toCell).length === 2;
    const pieces = [
      { Cell: fromCell, Entry: fromTwo ? OtherPort(fromCell, edge.FromPort) : DIRECTIONS[edge.FromPort].Opposite,
        Exit: edge.FromPort, F0: 0.5, F1: 1, Unit: nodeUnit(fromCell) / 2 },
      ...edge.Inner.map(item => ({ Cell: item.Cell, Entry: item.Entry, Exit: item.Exit, F0: 0, F1: 1, Unit: item.Unit })),
      { Cell: toCell, Entry: edge.ToPort, Exit: toTwo ? OtherPort(toCell, edge.ToPort) : DIRECTIONS[edge.ToPort].Opposite,
        F0: 0, F1: 0.5, Unit: nodeUnit(toCell) / 2 },
    ];
    const nominal = pieces.reduce((sum, piece) => sum + piece.Unit, 0) * model.Scale;
    return { Edge: edge, Pieces: pieces, Nominal: nominal, Override: null };
  });

  (model.EdgeLengths || []).forEach((entry, i) => {
    const path = `EdgeLengths[${i + 1}]`;
    const keys = entry.Cells.every(pair => Array.isArray(pair) && pair.length === 2)
      ? entry.Cells.map(pair => CellKey(pair[0], pair[1])) : null;
    if (keys !== null && keys.length > 0 && !keys.every(key => ownKeys.has(key))) return;   // teise raja kirje
    // lõigu lahtrid: sisemised ja raja otsa sõlm (kahe küljega ikoon – redaktori SegmentCells loeb selle lõiku)
    const edgeKeys = candidate => {
      const result = new Set(candidate.Edge.Inner.map(item => CellKey(item.Cell.X, item.Cell.Y)));
      for (const node of [trace.Nodes[candidate.Edge.From], trace.Nodes[candidate.Edge.To]]) {
        if (AllPorts(node.Cell).length === 2) result.add(CellKey(node.Cell.X, node.Cell.Y));
      }
      return result;
    };
    const found = keys !== null && keys.length > 0
      ? edges.find(candidate => keys.every(key => edgeKeys(candidate).has(key)))
      : undefined;
    context.EdgeLengthsUsed.add(i);
    if (found === undefined) { EnumError(context, path, Texts.EnumEdgeNotFound); return; }
    if (found.Override !== null) { EnumError(context, path, Texts.EnumEdgeTwice); return; }
    found.Override = entry.Length;
  });

  return {
    Nodes: trace.Nodes.map((node, nodeIndex) => {
      const ports = AllPorts(node.Cell);
      const degree = trace.Edges.reduce((sum, edge) => sum + (edge.From === nodeIndex) + (edge.To === nodeIndex), 0);
      // Entry, Exit: sõlme punkt on CellPathPoint(sõlm, 0,5) – kaare otsal kaare keskel
      return { X: node.Cell.X, Y: node.Cell.Y, T: node.Cell.T, Entry: ports.length === 2 ? ports[0] : 'W',
               Exit: ports.length === 2 ? ports[1] : 'E', Degree: degree, Junction: degree >= 3 };
    }),
    Edges: edges.map(({ Edge: edge, Pieces: pieces, Nominal: nominal, Override: override }) => {
      const factor = override !== null ? override / nominal : 1;
      let start = 0;
      const cells = pieces.map(piece => {
        const length = piece.Unit * model.Scale * factor;
        const item = { X: piece.Cell.X, Y: piece.Cell.Y, T: piece.Cell.T, Entry: piece.Entry, Exit: piece.Exit,
                       F0: piece.F0, F1: piece.F1, Start: RoundPosition(start), Length: RoundPosition(length) };
        start += length;
        return item;
      });
      return {
        From: edge.From, To: edge.To, OneWay: edge.OneWay, Length: RoundPosition(nominal * factor), Stretched: override !== null,
        Cells: cells, Inner: edge.Inner.map(item => [item.Cell.X, item.Cell.Y]),
      };
    }),
    StationNodes: links.map(link => link.Node),
  };
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
      { Name: 'In', Dy: sides.In, Text: Texts.EnumRoleIn },
      { Name: 'Out', Dy: sides.Out, Text: Texts.EnumRoleOut },
    ];
    const link = { Cell: cell, InCell: null, OutCell: null };
    for (const role of roles) {
      const buffer = bufferAt(cell.X, cell.Y + role.Dy);
      if (buffer === null) {
        EnumError(context, CellPath(cell), Texts.EnumMachineNoBuffer,
          { Machine: machineName, Side: role.Dy < 0 ? Texts.EnumSideAbove : Texts.EnumSideBelow });
        continue;
      }
      const flow = RoleFlow(role.Name, role.Dy);   // [O] puhvri liik = liikumissuund joonisel
      if (!BUFFER_FLOW[buffer.T].includes(flow)) {
        EnumError(context, CellPath(buffer), Texts.EnumBufferKind,
          { Buffer: `BUF${buffer.N}`, Kind: buffer.T, Machine: machineName, Role: role.Text,
            Flow: flow === 'N' ? Texts.EnumFlowUp : Texts.EnumFlowDown });
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
    if (keys !== null && keys.length > 0 && !keys.every(key => ownKeys.has(key))) return;   // teise raja kirje
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
    own.map((link, i) => ({ Link: link, Position: trace.Discrete ? link.Node : geometry.StationPositions[i] }))
      .sort((first, second) => first.Position - second.Position)
      .forEach(({ Link: link, Position: position }) => {
        const objectKind = IconTypes[link.Object.T].Kind;
        const junctionCell = trace.Discrete ? trace.Nodes[link.Node].Cell : trace.Sequence[link.SeqIndex].Cell;
        const station = {
          Name: ObjectName(context, link.Object), Track: trackIndex, Position: trace.Discrete ? null : position,
          Kind: objectKind === 'Buffer' || objectKind === 'Connector' ? objectKind : link.Object.T,
          Cell: { X: link.Object.X, Y: link.Object.Y },
          Junction: { X: junctionCell.X, Y: junctionCell.Y },
          Link: link.Link,
        };
        if (trace.Discrete) station.Node = link.Node;
        if (objectKind === 'Buffer') station.Buffer = bufferIndexOf(link.Object);
        if (objectKind === 'Connector') station.Connector = connectorCells.indexOf(link.Object);
        stations.push(station);
      });
  });

  const machineCells = machineLinks.map(link => link.Cell).sort((first, second) => first.N - second.N);
  const buffers = bufferCells.map(cell => ({
    ...model.Buffers[cell.N - 1], Name: `BUF${cell.N}`, Kind: cell.T, ModelIndex: cell.N - 1,
    OneWay: BUFFER_FLOW[cell.T].length === 1,
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
      const common = {
        Name: modelTrack.Name, Mode: modelTrack.Mode, Carts: modelTrack.Carts,
        PlacesPerCart: modelTrack.PlacesPerCart, Speed: modelTrack.Speed,
        LoadTime: modelTrack.LoadTime, AccessTime: modelTrack.AccessTime, ModelIndex: trace.TrackIndex,
      };
      if (trace.Discrete) {
        return { ...common, Closed: null, Nodes: geometry.Nodes, Edges: geometry.Edges,
                 Length: RoundPosition(geometry.Edges.reduce((sum, edge) => sum + edge.Length, 0)) };
      }
      return { ...common, Closed: trace.Closed, Length: geometry.Length, Cells: geometry.Cells, Edges: geometry.Edges };
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
    if (track.Mode === 'Discrete' && track.Carts > track.Nodes.length) {
      EnumError(context, `Tracks[${track.ModelIndex + 1}].Carts`, Texts.EnumGraphTooManyCarts,
        { Track: track.Name, Carts: track.Carts, Nodes: track.Nodes.length });
    }
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

// [U] StationPaths – lühimad (kiireimad) transporditeed jaamade vahel (Dijkstra, kaal = aeg =
//     pikkus / kiirus, viigi korral vähem sõlmi): pideval rajal liikumissuunas, diskreetsel rajal
//     raja graafis (GraphSearch), radade vahel konnektori kaudu (konnektori kaks jaama, aeg 0).
//     Silmusel saab igast jaamast igasse, avatud konveieril ainult allavoolu, diskreetsel rajal
//     jaamast teise (samasse mitte).
//     Tagastab Paths[from][to] = { Length, Time, Legs: [{ Track, From, To }] } või null (teed pole);
//     Legs – rada mööda sõidud (alus / käru viib From-jaamast To-jaama), nende vahel konnektorid.
//     Kutsub: CheckReachability, SimInit, testid. Sündmusi ei lisa.
export function StationPaths(network) {
  return network.Stations.map((station, source) => ShortestPaths(network, source));
}

// [U] ShortestPaths – lühimad teed ühest jaamast kõigisse (Dijkstra, vt StationPaths).
//     connectorOpen(konnektori indeks) – kas konnektorit võib läbida (vaikimisi kõiki); nii
//     leiab Depart lühima vaba tee (paralleelsed konnektorid). Tagastab Paths[to].
//     Kutsuvad: StationPaths, FreePath, testid. Sündmusi ei lisa.
export function ShortestPaths(network, source, connectorOpen = () => true) {
  const stations = network.Stations;
  const count = stations.length;
  const discrete = trackIndex => network.Tracks[trackIndex].Mode === 'Discrete';
  const closed = trackIndex => network.Tracks[trackIndex].Closed !== false;
  const along = (from, to) => {   // sõit rada mööda jaamast from jaama to: { Length, Time } või null
    const first = stations[from];
    const second = stations[to];
    if (first.Track !== second.Track || from === to) return null;
    const track = network.Tracks[first.Track];
    if (discrete(first.Track)) return NodeDistances(track)[first.Node][second.Node];
    const length = track.Length;
    let distance;
    if (closed(first.Track)) distance = ((second.Position - first.Position) % length + length) % length;
    else if (second.Position > first.Position) distance = second.Position - first.Position;
    else return null;
    return { Length: distance, Time: distance / track.Speed };
  };
  const partners = stationIndex => {
    const station = stations[stationIndex];
    if (station.Kind !== 'Connector' || !connectorOpen(station.Connector)) return [];
    return network.Connectors[station.Connector].Stations.filter(other => other !== stationIndex);
  };

  const best = Array.from({ length: count }, () => null);   // { Length, Time, Hops, Previous, Cross }
  const done = new Array(count).fill(false);
  best[source] = { Length: 0, Time: 0, Hops: 0, Previous: -1, Cross: false };
  const key = entry => [entry.Time, entry.Hops];
  for (;;) {
    let current = -1;
    for (let i = 0; i < count; i++) {
      if (done[i] || best[i] === null) continue;
      if (current < 0 || CompareScores(key(best[i]), key(best[current])) < 0) current = i;
    }
    if (current < 0) break;
    done[current] = true;
    const relax = (next, step, cross) => {
      const candidate = {
        Length: RoundPosition(best[current].Length + step.Length), Time: RoundPosition(best[current].Time + step.Time),
        Hops: best[current].Hops + 1, Previous: current, Cross: cross,
      };
      if (best[next] === null || CompareScores(key(candidate), key(best[next])) < 0) best[next] = candidate;
    };
    for (let next = 0; next < count; next++) {
      if (done[next]) continue;
      const step = along(current, next);
      if (step !== null) relax(next, step, false);
    }
    for (const next of partners(current)) if (!done[next]) relax(next, { Length: 0, Time: 0 }, true);
  }
  return best.map((entry, target) => {
    if (target === source) {
      return !discrete(stations[source].Track) && closed(stations[source].Track)
        ? { Length: 0, Time: 0, Legs: [{ Track: stations[source].Track, From: source, To: source }] }
        : null;
    }
    if (entry === null) return null;
    const legs = [];
    for (let node = target; best[node].Previous >= 0; node = best[node].Previous) {
      if (!best[node].Cross) legs.unshift({ Track: stations[node].Track, From: best[node].Previous, To: node });
    }
    return { Length: entry.Length, Time: entry.Time, Legs: legs };
  });
}

// =====================================================================
// Diskreetse raja graaf (etapp 7b)
// =====================================================================

const GraphCache = new WeakMap();   // [U] raja objekt -> { Adjacent, Distances } (arvutatakse üks kord)

// [U] GraphAdjacency – iga sõlme väljuvad sammud [{ Edge, Dir, Next }]: Dir 1 – lõigu From -> To,
//     -1 – vastupidi; ühesuunalist lõiku ainult lubatud suunas. Kutsuvad: GraphSearch, NodeDistances.
function GraphAdjacency(track) {
  let cache = GraphCache.get(track);
  if (cache === undefined) { cache = {}; GraphCache.set(track, cache); }
  if (cache.Adjacent === undefined) {
    cache.Adjacent = track.Nodes.map(() => []);
    track.Edges.forEach((edge, edgeIndex) => {
      if (edge.OneWay !== -1) cache.Adjacent[edge.From].push({ Edge: edgeIndex, Dir: 1, Next: edge.To });
      if (edge.OneWay !== 1) cache.Adjacent[edge.To].push({ Edge: edgeIndex, Dir: -1, Next: edge.From });
    });
  }
  return cache.Adjacent;
}

// [O nimi, U sisu] GraphSearch – Dijkstra diskreetse raja graafis: kaal = lõigu pikkus / kiirus,
//     viigi korral vähem lõike. starts: [{ Node, Time, Length, Start }] – algsõlmed (käru lõigu
//     sees: mõlemad otsad oma ajaga); blocked(tsoon) – tsoon, kuhu siseneda ei tohi ('N<sõlm>',
//     'E<lõik>'; algsõlm on alati lubatud). Tagastab sõlmede kaupa { Time, Length, Hops, Previous,
//     Edge, Dir, Start } või null. Kutsuvad: NodeDistances, ProgTM.
function GraphSearch(track, starts, blocked = () => false) {
  const adjacent = GraphAdjacency(track);
  const count = track.Nodes.length;
  const best = new Array(count).fill(null);
  const done = new Array(count).fill(false);
  const key = entry => [entry.Time, entry.Hops];
  for (const start of starts) {
    const entry = { Time: start.Time, Length: start.Length, Hops: 0, Previous: -1, Edge: -1, Dir: 0, Start: start.Start ?? null };
    if (best[start.Node] === null || CompareScores(key(entry), key(best[start.Node])) < 0) best[start.Node] = entry;
  }
  for (;;) {
    let current = -1;
    for (let i = 0; i < count; i++) {
      if (done[i] || best[i] === null) continue;
      if (current < 0 || CompareScores(key(best[i]), key(best[current])) < 0) current = i;
    }
    if (current < 0) break;
    done[current] = true;
    for (const step of adjacent[current]) {
      if (done[step.Next] || blocked(`E${step.Edge}`) || blocked(`N${step.Next}`)) continue;
      const edge = track.Edges[step.Edge];
      const candidate = {
        Time: best[current].Time + edge.Length / track.Speed, Length: best[current].Length + edge.Length,
        Hops: best[current].Hops + 1, Previous: current, Edge: step.Edge, Dir: step.Dir, Start: best[current].Start,
      };
      if (best[step.Next] === null || CompareScores(key(candidate), key(best[step.Next])) < 0) best[step.Next] = candidate;
    }
  }
  return best;
}

// [U] GraphSteps – Dijkstra tulemusest tee sõlme target: sammud [{ Edge, Dir }] algusest.
function GraphSteps(best, target) {
  const steps = [];
  for (let node = target; best[node].Previous >= 0; node = best[node].Previous) {
    steps.unshift({ Edge: best[node].Edge, Dir: best[node].Dir });
  }
  return steps;
}

// [U] NodeDistances – kiireimad sõidud sõlmest sõlme: Distances[a][b] = { Length, Time } või null
//     (sama sõlm või teed pole). Arvutatakse üks kord raja kohta. Kutsub: ShortestPaths.
function NodeDistances(track) {
  let cache = GraphCache.get(track);
  if (cache === undefined) { cache = {}; GraphCache.set(track, cache); }
  if (cache.Distances === undefined) {
    cache.Distances = track.Nodes.map((node, source) => GraphSearch(track, [{ Node: source, Time: 0, Length: 0 }])
      .map((entry, target) => (entry === null || target === source
        ? null : { Length: RoundPosition(entry.Length), Time: RoundPosition(entry.Time) })));
  }
  return cache.Distances;
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

// [U] FreePath – lühim tee jaamast from jaama to, mille kõik konnektorid on vabad (paralleelsetest
//     konnektoritest valitakse vaba), või null. Kutsuvad: Depart, DetectDeadlock.
function FreePath(fromStation, toStation) {
  if (TransportPaths[fromStation][toStation] === null) return null;
  return ShortestPaths(Model, fromStation, connectorIndex => CanReserveConnector(ConnectorArray[connectorIndex]))[toStation];
}

// [U] Depart – detailil on sihtkoht broneeritud: valib lühima vaba tee (FreePath), broneerib selle
//     konnektorid (kõik korraga, nii ei jää detail konnektoris järgmist ootama) ja detail hakkab
//     alust ootama (WAIT_PICKUP). Kui vaba teed pole (konnektorid kinni), ootab detail oma kohal
//     (WAIT_DEST, sihtkoht jääb) ja Planner proovib uuesti. Tagastab, kas õnnestus.
//     Kutsuvad: Planner, OutSysProc, LoadProc, DetectDeadlock.
function Depart(workpiece) {
  const fromStation = CurrentStationOf(workpiece);
  if (TransportPaths[fromStation][workpiece.Destination.Station] === null) {
    throw new Error(`Depart: WP${workpiece.Id} sihtkohta pole teed`);
  }
  const path = FreePath(fromStation, workpiece.Destination.Station);
  if (path === null) {
    if (workpiece.State !== 'WAIT_DEST') SetWPState(workpiece, 'WAIT_DEST');
    return false;
  }
  for (const connector of PathConnectors(path)) connector.Reserved++;
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
    if (track.Discrete) { MoveCarts(track); return; }
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
// Diskreetsed rajad: kärud (AGV-d) – DISAIN.md 11 (etapp 7b)
// =====================================================================
//
// Käru on punkt: ta on kas sõlmes (Node) või lõigul (Edge, Dir, Distance). Tsoon on sõlm ('N<i>')
// või lõik ('E<i>'), igas tsoonis on korraga üks käru (track.Holder: tsoon -> käru). Käru broneerib
// enne sõitu ploki (CartBlock): sõlme, kuhu ta siseneb, ja sellele järgneva ahela. Seepärast ootab
// käru ainult sõlmes või lõigu lõpus enne sõlme (WaitPoint), mitte kunagi vastutulijaga samal lõigul.

const DETOUR_FACTOR = 1.5;   // [U] ümbersõit, kui see on kõige rohkem 1,5 × praegune tee + DETOUR_SLACK
const DETOUR_SLACK = 10;     // [U] s
const REQUEST_PATIENCE = 30; // [U] s: nii kaua ootab soov käru, kelle teel pole teist käru (FindPal)
const COLLISION_RETRIES = 10; // [U] sama ring nii mitu korda järjest -> ummik (CollisionProc)

// [U] NodeZone, EdgeZone – tsooni võti.
const NodeZone = nodeIndex => `N${nodeIndex}`;
const EdgeZone = edgeIndex => `E${edgeIndex}`;

// [U] FarNode – sõlm, kuhu käru lõigul sõidab (samm { Edge, Dir } või käru ise).
function FarNode(track, step) {
  const edge = track.Edges[step.Edge];
  return step.Dir > 0 ? edge.To : edge.From;
}

// [U] CartZone – tsoon, kus käru praegu on.
function CartZone(cart) {
  return cart.Edge >= 0 ? EdgeZone(cart.Edge) : NodeZone(cart.Node);
}

// [U] HeldByOther – kas tsooni hoiab mõni teine käru.
function HeldByOther(track, zone, cart) {
  return track.Holder.has(zone) && track.Holder.get(zone) !== cart.Index;
}

// [U] CartBlock – tsoonid, mis käru peab korraga broneerima, et siseneda sõlme node ja sõita
//     sealt edasi (steps – tee pärast seda sõlme): sõlm (kui käru pole seal), siis lõigud ja
//     vahesõlmed kuni hargnemiseni (sõlm, kus on ≥ 3 haru – see jääb järgmisse plokki), ühesuunalise
//     lõigu lõpuni (selle lõpus võib oodata – vastutulijat pole) või tee lõpuni (lõppsõlm kaasa).
//     Nii ei saa kahesuunalisel ahelal olla vastutulijat. Kui sõlmest (mis pole hargnemine) läheb
//     edasi ühesuunaline lõik, on plokk ainult sõlm – seal võib oodata.
//     Kutsub: MoveCart.
function CartBlock(track, cart, node, steps) {
  const zones = [];
  if (cart.Edge >= 0 || cart.Node !== node) {
    zones.push(NodeZone(node));
    // sõlmes, kust edasi viib ühesuunaline lõik, võib oodata (vastutulijat pole), kui see pole hargnemine
    if (steps.length > 0 && !track.Nodes[node].Junction && track.Edges[steps[0].Edge].OneWay !== 0) return zones;
  }
  for (let i = 0; i < steps.length; i++) {
    const edge = track.Edges[steps[i].Edge];
    const far = FarNode(track, steps[i]);
    zones.push(EdgeZone(steps[i].Edge));
    if (edge.OneWay !== 0) break;                                   // ühesuunalise lõigu lõpus võib oodata
    if (i === steps.length - 1) { zones.push(NodeZone(far)); break; }
    if (track.Nodes[far].Junction) break;
    zones.push(NodeZone(far));
  }
  return zones;
}

// [U] TryHoldZones – broneerib kõik tsoonid korraga, kui ükski pole teise käru käes.
function TryHoldZones(track, cart, zones) {
  if (zones.some(zone => HeldByOther(track, zone, cart))) return false;
  for (const zone of zones) track.Holder.set(zone, cart.Index);
  return true;
}

// [U] ReleaseZone – käru vabastab tsooni (väljus sellest).
function ReleaseZone(track, cart, zone) {
  if (track.Holder.get(zone) === cart.Index) track.Holder.delete(zone);
}

// [U] WaitPoint – kus käru lõigul ootab järgmist sõlme: pool ikooni enne sõlme keskpunkti
//     (sõlme ikooni serval), lühikesel lõigul lõigu keskel.
function WaitPoint(edge) {
  return Math.max(0, edge.Length - Math.min(edge.Length / 2, Model.Scale / 2));
}

// [O nimi, U sisu] ProgTM – käru programmeerimine: kiireim tee käru praegusest kohast sõlme goal
//     (GraphSearch, kaal = pikkus / kiirus, ühesuunalist lõiku ainult lubatud suunas). Lõigul olev
//     käru võib kahesuunalisel lõigul ka ümber pöörata (Start 'Back'). blocked(tsoon) – tsoonid,
//     kuhu siseneda ei tohi (ümbersõit). Tagastab { Steps, Time, Start } või null.
//     Kutsuvad: FindPal, CartContinues, MoveCart (ümbersõit), CollisionProc, SendAside.
function ProgTM(track, cart, goal, blocked = () => false) {
  const starts = [];
  if (cart.Edge < 0) {
    starts.push({ Node: cart.Node, Time: 0, Length: 0, Start: 'Node' });
  } else {
    const edge = track.Edges[cart.Edge];
    const far = FarNode(track, cart);
    const near = cart.Dir > 0 ? edge.From : edge.To;
    if (!blocked(NodeZone(far))) {
      starts.push({ Node: far, Time: (edge.Length - cart.Distance) / track.Speed, Length: edge.Length - cart.Distance, Start: 'Forward' });
    }
    if (edge.OneWay === 0 && !blocked(NodeZone(near))) {
      starts.push({ Node: near, Time: cart.Distance / track.Speed, Length: cart.Distance, Start: 'Back' });
    }
  }
  if (starts.length === 0) return null;
  const best = GraphSearch(track, starts, blocked);
  if (best[goal] === null) return null;
  return { Steps: GraphSteps(best, goal), Time: best[goal].Time, Start: best[goal].Start, End: goal };
}

// [U] ProgTMOneWayInto – nagu ProgTM, aga viimane lõik sihtsõlme goal peab olema ühesuunaline
//     (selle lõpus saab oodata, kuni goal vabaneb – teine käru lahkub sealt teist teed pidi).
//     Tagastab { Steps, Time, Start, End } või null. Kutsuvad: CollisionProc, SendAside.
function ProgTMOneWayInto(track, cart, goal, blocked) {
  let best = null;
  track.Edges.forEach((edge, edgeIndex) => {
    const dir = edge.OneWay;
    if (dir === 0 || (dir > 0 ? edge.To : edge.From) !== goal) return;
    const from = dir > 0 ? edge.From : edge.To;
    if (from === goal || blocked(EdgeZone(edgeIndex))) return;
    const plan = cart.Edge < 0 && cart.Node === from
      ? { Steps: [], Time: 0, Start: 'Node' }
      : ProgTM(track, cart, from, zone => zone === NodeZone(goal) || blocked(zone));
    if (plan === null) return;
    const time = plan.Time + edge.Length / track.Speed;
    if (best === null || time < best.Time) {
      best = { Steps: [...plan.Steps, { Edge: edgeIndex, Dir: dir }], Time: time, Start: plan.Start, End: goal };
    }
  });
  return best;
}

// [U] SetRoute – annab kärule uue tee (ProgTM tulemus): vajadusel pöörab lõigul ümber; tsoonid,
//     mis olid broneeritud eespool (vana tee), vabastatakse.
function SetRoute(track, cart, plan) {
  if (plan.Start === 'Back') {
    cart.Dir = -cart.Dir;
    cart.Distance = track.Edges[cart.Edge].Length - cart.Distance;
    if (Math.abs(cart.Distance) < 1e-9) cart.Distance = 0;
  }
  const current = CartZone(cart);
  for (const [zone, holder] of [...track.Holder]) {
    if (holder === cart.Index && zone !== current) track.Holder.delete(zone);
  }
  cart.Route = plan.Steps.map(step => ({ ...step }));
  cart.RouteEnd = plan.End;
  cart.Waiting = null;
}

// [U] CartIdle – kas käru on vaba (tööd pole, ei laadi). Liikuv (kõrvale minev) vaba käru on ka vaba.
function CartIdle(cart) {
  return cart.WP === null && cart.ReservedWP === null && !cart.Stopped && cart.Goal < 0;
}

// [O nimi, T sisu] FindPal – jagab transpordisoovid vabadele kärudele: soov (detail ootab käru
//     selle raja jaamas, vanim enne) saab käru, mis jõuab kõige kiiremini kohale (ProgTM); viigi
//     korral väiksema numbriga käru. Kutsub: MoveCarts.
function FindPal(track) {
  const requests = SysWPArray
    .filter(workpiece => workpiece.State === 'WAIT_PICKUP' && workpiece.Path[0].Track === track.Index
      && !track.Pallets.some(cart => cart.ReservedWP === workpiece.Id))
    .sort((first, second) => first.StateSince - second.StateSince || first.Id - second.Id);
  for (const workpiece of requests) {
    const goal = StationArray[workpiece.Path[0].From].Node;
    let chosen = null;
    for (const cart of track.Pallets) {
      if (!CartIdle(cart)) continue;
      const plan = ProgTM(track, cart, goal);
      if (plan === null) continue;
      // eelistatud on käru, kelle teel pole teist käru (muidu peaks see temast mööda pääsema)
      const free = ProgTM(track, cart, goal, zone => HeldByOther(track, zone, cart));
      const score = [free !== null ? 0 : 1, plan.Time];
      if (chosen === null || CompareScores(score, chosen.Score) < 0) chosen = { Cart: cart, Plan: plan, Score: score };
    }
    if (chosen === null) {
      if (!track.Pallets.some(CartIdle)) break;   // vaba käru pole – soovid ootavad (FIFO)
      continue;
    }
    // vaba käru tee on teise käru tõttu kinni: oota veidi, ehk vabaneb lähem käru (REQUEST_PATIENCE)
    if (chosen.Score[0] === 1 && SYSTEM_TIME - workpiece.StateSince < REQUEST_PATIENCE) continue;
    chosen.Cart.ReservedWP = workpiece.Id;
    chosen.Cart.Goal = goal;
    SetRoute(track, chosen.Cart, chosen.Plan);
  }
}

// [U] CartPickupCandidate – detail, mille käru jaamas peale võtab: tema enda soov või (kui käru on
//     vaba) jaamas ootav soov, millel käru veel pole. Kutsuvad: StopMovProc, AfterPalletAtStation.
function CartPickupCandidate(cart, stationIndex) {
  const track = Tracks[cart.Track];
  if (cart.ReservedWP !== null) {
    const own = SysWPArray[cart.ReservedWP];
    return own.State === 'WAIT_PICKUP' && own.Path[0].From === stationIndex ? own : null;
  }
  const candidate = PickupCandidate(stationIndex);
  if (candidate === null || candidate.Path[0].Track !== cart.Track) return null;
  if (track.Pallets.some(other => other.ReservedWP === candidate.Id)) return null;
  cart.Goal = StationArray[stationIndex].Node;
  return candidate;
}

// [U] CartContinues – laadimine on läbi (MoveZ): koormaga käru sõidab detaili sõidu lõppjaama,
//     tühi käru jääb vabaks (FindPal annab uue töö). Kutsub: MoveZProc.
function CartContinues(track, cart) {
  cart.Stopped = false;
  if (cart.WP !== null) {
    cart.Goal = StationArray[SysWPArray[cart.WP].Path[0].To].Node;
    const plan = ProgTM(track, cart, cart.Goal);
    if (plan === null) throw new Error(`CartContinues: rajal ${track.Name} pole teed sihtjaama`);
    SetRoute(track, cart, plan);
  } else {
    cart.Goal = -1;
    cart.Route = null;
    cart.RouteEnd = -1;
  }
}

// [U] CartArrives – käru jõudis oma tee lõppu. Sihtsõlmes: peatub laadimiseks (StopMov); kõrvale
//     minnes: kui tal on töö, arvutab tee sihtkohta uuesti, muidu jääb vabaks. Lisab: StopMov.
function CartArrives(track, cart) {
  cart.Route = null;
  cart.RouteEnd = -1;
  cart.Waiting = null;
  if (cart.Goal < 0) return;
  if (cart.Node === cart.Goal) {
    const stationIndex = track.NodeStation[cart.Node];
    if ((cart.WP === null && cart.ReservedWP === null) || stationIndex < 0) { cart.Goal = -1; return; }   // sõidukäsk (testid)
    cart.Stopped = true;
    track.Stops++;
    PutEvent({ Event: 'StopMov', Track: track.Index, Pal: cart.Index, ObjType: 'Station', ObjCode: stationIndex });
    return;
  }
  const plan = ProgTM(track, cart, cart.Goal);
  if (plan !== null) SetRoute(track, cart, plan);
}

// [U] TryDetour – käru ei saanud plokki: kas on ümbersõit, mis väldib teiste kärude tsoone ja pole
//     palju pikem (DETOUR_FACTOR, DETOUR_SLACK)? Kui on, saab käru selle tee. Kutsub: MoveCart.
function TryDetour(track, cart) {
  const current = ProgTM(track, cart, cart.RouteEnd);
  const detour = ProgTM(track, cart, cart.RouteEnd, zone => HeldByOther(track, zone, cart));
  if (current === null || detour === null) return false;
  if (detour.Start === current.Start && JSON.stringify(detour.Steps) === JSON.stringify(cart.Route)) return false;
  if (detour.Time > current.Time * DETOUR_FACTOR + DETOUR_SLACK) return false;
  SetRoute(track, cart, detour);
  track.Detours++;
  return true;
}

// [U] MoveCart – liigutab käru ühe sekundi (Speed cm) mööda tema teed: sõlmest lahkudes ja lõigu
//     lõppu jõudes broneerib järgmise ploki (CartBlock); kui see on kinni, proovib ümbersõitu
//     (TryDetour) või ootab (sõlmes või lõigu WaitPoint-is, olek Waiting). Tsoonist väljudes
//     vabastab selle. Tee lõpus: CartArrives. Kutsub: MoveCarts.
function MoveCart(track, cart) {
  const EPSILON = 1e-6;
  if (cart.Stopped || cart.Route === null) return;
  let budget = track.Speed * 1;
  for (let guard = 0; guard < 1000; guard++) {
    if (cart.Edge < 0) {
      if (cart.Route.length === 0) { CartArrives(track, cart); return; }
      const zones = CartBlock(track, cart, cart.Node, cart.Route);
      if (!TryHoldZones(track, cart, zones)) {
        if (TryDetour(track, cart)) continue;
        if (cart.Waiting === null) cart.WaitSince = SYSTEM_TIME;
        cart.Waiting = zones;
        return;
      }
      const step = cart.Route.shift();
      ReleaseZone(track, cart, NodeZone(cart.Node));
      cart.Node = -1;
      cart.Edge = step.Edge;
      cart.Dir = step.Dir;
      cart.Distance = 0;
      cart.Waiting = null;
      continue;
    }
    const edge = track.Edges[cart.Edge];
    const far = FarNode(track, cart);
    if (track.Holder.get(NodeZone(far)) !== cart.Index) {
      const zones = CartBlock(track, cart, far, cart.Route);
      if (!TryHoldZones(track, cart, zones)) {
        if (TryDetour(track, cart)) continue;
        const stop = WaitPoint(edge);
        if (cart.Distance < stop - EPSILON) {
          const move = Math.min(budget, stop - cart.Distance);
          cart.Distance = RoundPosition(cart.Distance + move);
          if (cart.Distance < stop - EPSILON) { cart.Waiting = null; return; }
        }
        if (cart.Waiting === null) cart.WaitSince = SYSTEM_TIME;
        cart.Waiting = zones;
        return;
      }
    }
    const remaining = edge.Length - cart.Distance;
    if (budget < remaining - EPSILON) {
      cart.Distance = RoundPosition(cart.Distance + budget);
      cart.Waiting = null;
      return;
    }
    budget -= remaining;
    ReleaseZone(track, cart, EdgeZone(cart.Edge));
    cart.Edge = -1;
    cart.Dir = 0;
    cart.Distance = 0;
    cart.Node = far;
    cart.Waiting = null;
    if (cart.Route.length === 0) { CartArrives(track, cart); return; }
  }
  throw new Error(`MoveCart: rajal ${track.Name} käru ${cart.Index} ei saa ühe sekundiga hakkama`);
}

// [U] NeededZones – tsoonid, mida käru oma teel veel vajab (ootab või sõidab läbi).
function NeededZones(track, cart) {
  const zones = new Set(cart.Waiting ?? []);
  for (const step of cart.Route ?? []) {
    zones.add(EdgeZone(step.Edge));
    zones.add(NodeZone(FarNode(track, step)));
  }
  if (cart.Edge >= 0) zones.add(NodeZone(FarNode(track, cart)));
  return zones;
}

// [U] Stuck – vaba käru, keda keegi ootab, aga keda sel sekundil ei õnnestunud kõrvale saata.
const Stuck = cart => CartIdle(cart) && cart.Route === null && cart.AsideFailed === SYSTEM_TIME;

// [U] IsWaiting – kas käru ootab ootegraafis: ootab plokki või on kõrvale saamata (Stuck).
const IsWaiting = cart => cart.Waiting !== null || Stuck(cart);

// [U] Blockers – kärud, kelle taga käru ootab: ploki tsoonide hoidjad; kõrvale saamata vabal
//     kärul tema sõlmest väljuvate lõikude ja nende järgmiste sõlmede hoidjad.
function Blockers(track, cart) {
  let zones = [];
  if (cart.Waiting !== null) zones = cart.Waiting;
  else if (Stuck(cart)) zones = GraphAdjacency(track)[cart.Node].flatMap(step => [EdgeZone(step.Edge), NodeZone(step.Next)]);
  return [...new Set(zones.filter(zone => HeldByOther(track, zone, cart)).map(zone => track.Holder.get(zone)))]
    .map(index => track.Pallets[index]);
}

// [U] FindWaitCycle – ootegraafis ring (käru ootab käru, kes ootab …): kärude loend või null.
//     Laadiv või liikuv käru ringi ei sulge – ta liigub varsti edasi. Kutsub: FindCollision.
function FindWaitCycle(track) {
  for (const start of track.Pallets) {
    const seen = new Map();   // käru -> järjekorranumber teel (sügavuti otsing)
    const visit = (cart, path) => {
      if (path.includes(cart)) return path.slice(path.indexOf(cart));
      if (seen.has(cart) || !IsWaiting(cart)) return null;
      seen.set(cart, true);
      for (const blocker of Blockers(track, cart)) {
        const cycle = visit(blocker, [...path, cart]);
        if (cycle !== null) return cycle;
      }
      return null;
    };
    const cycle = visit(start, []);
    if (cycle !== null) return cycle;
  }
  return null;
}

// [U] SendAside – saadab käru kõrvale: lähimasse sõlme, mis pole teise käru käes ega teiste teel
//     (avoid), eelistatult mitte hargnemisse. Tee sinna võib minna läbi teiste vajatud tsoonide
//     (nemad ootavad), aga mitte läbi teiste käes olevate (blockers – ainult nende kärude, null –
//     kõigi). Kui vaba sõlme pole, sobib ka teise käru sõlm, kuhu viib ühesuunaline lõik (selle lõpus
//     saab oodata). Töö (Goal) jääb alles – kohale jõudes arvutab käru tee uuesti. Tagastab, kas
//     õnnestus. Kutsuvad: MoveCarts, CollisionProc.
function SendAside(track, cart, avoid, blockers = null) {
  const blocked = zone => HeldByOther(track, zone, cart)
    && (blockers === null || blockers.includes(track.Pallets[track.Holder.get(zone)]));
  let best = null;
  track.Nodes.forEach((node, nodeIndex) => {
    if (cart.Edge < 0 && cart.Node === nodeIndex) return;
    if (blocked(NodeZone(nodeIndex)) || avoid.has(NodeZone(nodeIndex))) return;
    const plan = ProgTM(track, cart, nodeIndex, blocked);
    if (plan === null) return;
    const score = [node.Junction ? 1 : 0, plan.Time, nodeIndex];
    if (best === null || CompareScores(score, best.Score) < 0) best = { Plan: plan, Score: score };
  });
  if (best === null) {
    // vaba sõlme pole: teise käru sõlm, kuhu viib ühesuunaline lõik – selle lõpus saab oodata, kuni
    // too lahkub (nt ringil sõidab vaba käru ootajast ette)
    track.Nodes.forEach((node, nodeIndex) => {
      if ((cart.Edge < 0 && cart.Node === nodeIndex) || !HeldByOther(track, NodeZone(nodeIndex), cart)) return;
      if (avoid.has(NodeZone(nodeIndex))) return;
      const plan = ProgTMOneWayInto(track, cart, nodeIndex, zone => zone !== NodeZone(nodeIndex) && blocked(zone));
      if (plan === null) return;
      const score = [node.Junction ? 1 : 0, plan.Time, nodeIndex];
      if (best === null || CompareScores(score, best.Score) < 0) best = { Plan: plan, Score: score };
    });
  }
  if (best === null) return false;
  SetRoute(track, cart, best.Plan);
  track.Asides++;
  return true;
}

// [U] MoveCarts – diskreetse raja sekund (MinuteMan): FindPal, kärude liikumine, siis ootegraaf:
//     vaba käru, kelle taga keegi ootab, saadetakse kõrvale; ringootamine -> Collision.
//     Kutsub: MinuteMan. Lisab: StopMov, Collision.
function MoveCarts(track) {
  FindPal(track);
  for (const cart of track.Pallets) {
    // vaba käru ei seisa hargnemises (see takistaks kõiki): läheb lähimasse vabasse sõlme
    if (CartIdle(cart) && cart.Route === null && cart.Edge < 0 && track.Nodes[cart.Node].Junction) {
      const avoid = new Set(track.Pallets.filter(other => other !== cart).flatMap(other => [...NeededZones(track, other)]));
      SendAside(track, cart, avoid);
    }
    MoveCart(track, cart);
  }
  // vaba käru, kelle taga keegi ootab, läheb kõrvale. Tema teed takistavad ainult seisvad (ootavad
  // või laadivad) kärud: liikuv käru vabastab tee ise ja teel seisvad vabad kärud lükatakse
  // järgmisel sekundil omakorda kõrvale.
  const parked = cart => CartIdle(cart) && cart.Route === null;
  for (const cart of track.Pallets) {
    for (const blocker of Blockers(track, cart)) {
      if (!parked(blocker)) continue;
      const working = track.Pallets.filter(other => other !== blocker && (other.Waiting !== null || other.Stopped));
      const avoidAll = new Set(track.Pallets.filter(other => other !== blocker).flatMap(other => [...NeededZones(track, other)]));
      // eelistus: väljapoole kõigi teid; väljapoole ootaja teed; väljapoole ootaja praegust plokki
      // (siis sõidab vaba käru ootajast ette ja lükatakse vajadusel uuesti edasi)
      if (!SendAside(track, blocker, avoidAll, working) && !SendAside(track, blocker, NeededZones(track, cart), working)
          && !SendAside(track, blocker, new Set(cart.Waiting), working)) {
        blocker.AsideFailed = SYSTEM_TIME;
      }
    }
  }
  if (!track.CollisionPending) {
    const collision = FindCollision(track);
    if (collision !== null) {
      track.CollisionPending = true;
      const first = collision.Victims[0];
      PutEvent({ Event: 'Collision', Track: track.Index, Pal: first.Index, ObjType: 'Pallette', ObjCode: first.Index });
    }
  }
}

// [U] FindCollision – kärud, kes ei saa kunagi edasi: ootegraafi ring (FindWaitCycle; ringis võib
//     olla ka vaba käru, keda ei õnnestunud kõrvale saata – tema väljapääsu sulgeb ootaja ise).
//     Tagastab { Victims – ootavad kärud, kellele otsitakse lahendust, Holders – ringi kärud, kelle
//     tsoone lahendus peab vältima } või null. Kutsuvad: MoveCarts, CollisionProc.
function FindCollision(track) {
  const cycle = FindWaitCycle(track);
  if (cycle === null) return null;
  return { Victims: cycle.filter(cart => cart.Waiting !== null), Holders: cycle };
}

// [O nimi, U tähendus] CollisionProc – kärud ootavad üksteist ringis (DISAIN.md 11.5). Valitakse
//     käru (tühi enne koormaga, siis lühema ooteajaga) ja antakse talle ümbersõit, mis väldib teiste
//     ringi kärude tsoone (ProgTM), või saadetakse ta kõrvale (SendAside), et teised mööda saaksid.
//     Ringist väljas olevad kärud ei takista (nad liiguvad või lükatakse kõrvale). Kui kumbki ei
//     õnnestu ühelgi ringi kärul, simulatsioon peatub ja teatab ummikust.
function CollisionProc(currentEvent) {
  const track = Tracks[currentEvent.Track];
  track.CollisionPending = false;
  const collision = FindCollision(track);
  if (collision === null) return;
  const cycle = collision.Holders;
  track.Collisions++;
  // ring (mõne samaga kärudest) kohe uuesti: eelmine lahendus ei aidanud (lõputu ringlemine) ->
  // ainult kõrvalepõige; kui ka see ei aita COLLISION_RETRIES korda järjest, on see ummik
  const members = cycle.map(cart => cart.Index);
  const repeat = SYSTEM_TIME - track.LastCollision.Time <= 2
    && members.some(index => track.LastCollision.Carts.includes(index));
  track.LastCollision = { Carts: members, Time: SYSTEM_TIME, Count: repeat ? track.LastCollision.Count + 1 : 1 };
  const candidates = [...collision.Victims].sort((first, second) => (first.WP !== null) - (second.WP !== null)
    || second.WaitSince - first.WaitSince || first.Index - second.Index);
  // ringist väljas olevad kärud liiguvad ise ära (või lükatakse kõrvale) – arvesse lähevad ringi
  // kärude tsoonid
  // ringi käru käes olevasse sihtsõlme võib minna ühesuunalist lõiku pidi (selle lõpus saab oodata)
  const heldByCycle = cart => zone => HeldByOther(track, zone, cart) && cycle.includes(track.Pallets[track.Holder.get(zone)]);
  for (const cart of (repeat ? [] : candidates)) {
    const goal = cart.RouteEnd;
    if (goal < 0) continue;
    const detour = heldByCycle(cart)(NodeZone(goal))
      ? ProgTMOneWayInto(track, cart, goal, heldByCycle(cart))
      : ProgTM(track, cart, goal, heldByCycle(cart));
    if (detour === null) continue;
    SetRoute(track, cart, detour);
    track.Detours++;
    return;
  }
  for (const cart of (track.LastCollision.Count > COLLISION_RETRIES ? [] : candidates)) {
    const avoid = new Set(cycle.filter(other => other !== cart).flatMap(other => [...NeededZones(track, other)]));
    if (SendAside(track, cart, avoid, cycle)) return;
  }
  DEADLOCK = true;
  Stats.DeadlockReason = FormatText(Texts.SimDeadlockCarts,
    { Track: track.Name, List: cycle.map(cart => cart.Index + 1).sort((a, b) => a - b).join(', ') });
  SIMULATION_DONE = true;
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
  if (track.Discrete) { CartContinues(track, track.Pallets[currentEvent.Pal]); return; }
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
    const candidate = track.Discrete ? CartPickupCandidate(pallet, stationIndex) : PickupCandidate(stationIndex);
    if (candidate !== null) {
      BeginPickup(currentEvent.Track, currentEvent.Pal, stationIndex, candidate);
      return;
    }
  }
  PutEvent({ Event: 'MoveZ', Track: currentEvent.Track, Pal: currentEvent.Pal });  // tegevus kadus vahepeal
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
  const track = Tracks[trackIndex];
  const candidate = track.Discrete
    ? CartPickupCandidate(track.Pallets[palletIndex], stationIndex)
    : PickupCandidate(stationIndex);
  if (candidate !== null) {
    BeginPickup(trackIndex, palletIndex, stationIndex, candidate);
  } else {
    PutEvent({ Event: 'MoveZ', Track: trackIndex, Pal: palletIndex });
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
    PutEvent({ Event: 'MoveZ', Track: currentEvent.Track, Pal: currentEvent.Pal });
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
  Collision: CollisionProc,
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
      path !== null ? path.Time : 0,
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
//     (pargitakse). Ühesuunalisest puhvrist (InBuf, OutBuf) ei saa sissetulevat detaili tagasi
//     rajale saata – pargitakse ainult väljaminevaid või kahesuunalise puhvri detaile. Kui
//     kesklattu ei saa, on ummik lahendamatu -> simulatsioon peatub. Kui tee kesklattu on hetkel
//     kinni (konnektor), proovitakse järgmisel sekundil uuesti.
//     Varukontroll: kui midagi ei toimu üle StallTime ja süsteemis on detaile -> peatub.
//     Kutsub: SimStep.
function DetectDeadlock() {
  const deadlocked = FindDeadlockedWorkpieces();
  const movable = deadlocked.filter(workpiece => workpiece.Location.Dir === 'Out'
    || !BufferArray[workpiece.Location.Index].OneWay);
  if (deadlocked.length > 0) {
    if (StorageFree() && movable.length > 0) {
      const workpiece = movable[0];
      if (FreePath(CurrentStationOf(workpiece), Storage.Station) !== null) {
        Storage.Reserved++;
        workpiece.Destination = { Kind: 'ToCS', Station: Storage.Station, Park: true };
        Depart(workpiece);
        Stats.Parked++;
      }
    } else {
      DEADLOCK = true;
      Stats.DeadlockReason = FormatText(Texts.SimDeadlockCycle,
        { List: deadlocked.map(workpiece => `WP${workpiece.Id}`).join(', ') })
        + (StorageFree() && movable.length === 0 ? Texts.SimDeadlockOneWay : '');
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
    // ühesuunaline puhver: sissetulev detail ei lähe tagasi rajale
    if (buffer.OneWay && buffer.Entries.some(entry => entry.Dir === 'In' && SysWPArray[entry.WP].State === 'WAIT_PICKUP')) {
      fail(`ühesuunalisest puhvrist ${buffer.Name} saadetakse sissetulev detail tagasi`);
    }
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
    if (track.Discrete) { CheckCarts(track, fail); return; }
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

// [U] CheckCarts – diskreetse raja invariandid (DISAIN.md 9): igas tsoonis kõige rohkem üks käru
//     ja käru on ainult enda broneeritud tsoonis; broneeritud tsoonid on käru kohal või tema teel;
//     ühesuunalist lõiku läbitakse õiges suunas; koormaga käru sõidab detaili sõidu lõppjaama poole;
//     käru detail ja broneering on kooskõlas. Kutsub: CheckInvariants.
function CheckCarts(track, fail) {
  const occupied = new Map();
  for (const cart of track.Pallets) {
    const name = `rada ${track.Name} käru ${cart.Index + 1}`;
    const zone = CartZone(cart);
    if (occupied.has(zone)) fail(`${name}: tsoonis ${zone} on kaks käru`);
    occupied.set(zone, cart.Index);
    if (track.Holder.get(zone) !== cart.Index) fail(`${name}: on tsoonis ${zone}, mida ta pole broneerinud`);
    if (cart.Edge >= 0) {
      const edge = track.Edges[cart.Edge];
      if (cart.Distance < -1e-6 || cart.Distance > edge.Length + 1e-6) fail(`${name}: väljaspool lõiku`);
      if (edge.OneWay !== 0 && cart.Dir !== edge.OneWay) fail(`${name}: sõidab ühesuunalisel lõigul vastu suunda`);
    }
    if (cart.WP !== null) {
      const workpiece = SysWPArray[cart.WP];
      if (workpiece.Location.Kind !== 'Pallet' || workpiece.Location.Track !== track.Index || workpiece.Location.Pal !== cart.Index) {
        fail(`${name}: detail WP${cart.WP} vale asukohaga`);
      }
      if (!cart.Stopped && cart.Goal !== StationArray[workpiece.Path[0].To].Node) fail(`${name}: koormaga käru ei sõida detaili sihtjaama`);
    }
    if (cart.ReservedWP !== null && !['WAIT_PICKUP', 'LOADING'].includes(SysWPArray[cart.ReservedWP].State)) {
      fail(`${name}: broneeritud detail WP${cart.ReservedWP} ei oota käru`);
    }
    const allowed = new Set([zone]);
    if (cart.Waiting !== null) cart.Waiting.forEach(item => allowed.add(item));
    for (const step of cart.Route ?? []) { allowed.add(EdgeZone(step.Edge)); allowed.add(NodeZone(FarNode(track, step))); }
    if (cart.Edge >= 0) allowed.add(NodeZone(FarNode(track, cart)));
    for (const [held, holder] of track.Holder) {
      if (holder === cart.Index && !allowed.has(held)) fail(`${name}: hoiab tsooni ${held}, mis pole tema teel`);
    }
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
    if (track.Discrete) {
      for (const cart of track.Pallets) {
        const state = CartState(cart);
        cart.StateTime[state] = (cart.StateTime[state] || 0) + 1;
        if (cart.Waiting !== null) track.MaxWait = Math.max(track.MaxWait, SYSTEM_TIME - cart.WaitSince);
      }
      continue;
    }
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
    Tracks: Tracks.map(track => (track.Discrete
      ? {
        Name: track.Name, Discrete: true, Stops: track.Stops, Collisions: track.Collisions, Detours: track.Detours, Asides: track.Asides,
        MaxWait: track.MaxWait,
        Carts: track.Pallets.map(cart => Object.fromEntries(['IDLE', 'EMPTY', 'LOADED', 'LOADING', 'WAIT_ZONE']
          .map(state => [state, (cart.StateTime[state] || 0) / time]))),
      }
      : { Name: track.Name, Closed: track.Closed, MovingShare: track.MovingTime / time,
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

// [U] InitCarts – diskreetse raja kärud: igaüks oma sõlmes (enne jaamata raja otsad, siis muud
//     sõlmed, siis hargnemised; igas grupis ülevalt alla, vasakult paremale), sõlm on tema tsoon.
//     Kutsub: SimInit.
function InitCarts(track, trackIndex) {
  const stationNodes = new Set(Model.Stations.filter(station => station.Track === trackIndex).map(station => station.Node));
  const score = nodeIndex => {
    const node = track.Nodes[nodeIndex];
    return [node.Junction ? 2 : node.Degree <= 1 && !stationNodes.has(nodeIndex) ? 0 : 1, node.Y, node.X];
  };
  const order = track.Nodes.map((node, nodeIndex) => nodeIndex)
    .sort((first, second) => CompareScores(score(first), score(second)));
  const result = {
    ...track, Index: trackIndex, Discrete: true, Closed: null, Offset: 0, StopCount: 0, MovingTime: 0, StoppedTime: 0,
    Stops: 0, Stations: [], NodeStation: track.Nodes.map(() => -1), Holder: new Map(),
    Collisions: 0, Detours: 0, Asides: 0, MaxWait: 0, CollisionPending: false,
    LastCollision: { Carts: [], Time: -10, Count: 0 },
  };
  result.Pallets = Array.from({ length: track.Carts }, (unused, cartIndex) => ({
    Index: cartIndex, Track: trackIndex, WP: null, ReservedWP: null, Stopped: false,
    Node: order[cartIndex], Edge: -1, Dir: 0, Distance: 0, Route: null, RouteEnd: -1, Goal: -1,
    Waiting: null, WaitSince: 0, AsideFailed: -1, StateTime: {},
  }));
  result.Pallets.forEach(cart => result.Holder.set(NodeZone(cart.Node), cart.Index));
  return result;
}

// [U] CartState – käru olek statistika jaoks: LOADING (laadimine), WAIT_ZONE (ootab tsooni),
//     LOADED / EMPTY (sõidab koormaga / tühjalt), IDLE (vaba).
function CartState(cart) {
  if (cart.Stopped) return 'LOADING';
  if (cart.Waiting !== null) return 'WAIT_ZONE';
  if (cart.Route !== null) return cart.WP !== null ? 'LOADED' : 'EMPTY';
  return 'IDLE';
}

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
    if (track.Mode === 'Discrete') return InitCarts(track, trackIndex);
    return {
      ...track, Closed: track.Closed !== false,
      Index: trackIndex, Offset: 0, StopCount: 0, MovingTime: 0, StoppedTime: 0, Stops: 0, Stations: [],
      Pallets: Array.from({ length: track.Carts }, (unused, palletIndex) => ({ Index: palletIndex, WP: null, ReservedWP: null })),
    };
  });
  StationArray = Model.Stations.map((station, stationIndex) => ({ ...station, Index: stationIndex }));
  StationArray.forEach(station => {
    Tracks[station.Track].Stations.push(station.Index);
    if (Tracks[station.Track].Discrete) Tracks[station.Track].NodeStation[station.Node] = station.Index;
  });
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

// [U] DriveCart – testidele: käru sõidab sõlme node (ilma laadimiseta), nagu tööga käru (Goal):
//     ootab, teeb ümbersõidu või läheb kõrvale. Tagastab, kas tee on olemas. Sündmusi ei lisa.
export function DriveCart(trackIndex, cartIndex, node) {
  const track = Tracks[trackIndex];
  const cart = track.Pallets[cartIndex];
  const plan = ProgTM(track, cart, node);
  if (plan === null) return false;
  cart.Goal = node;
  SetRoute(track, cart, plan);
  return true;
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
