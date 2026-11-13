// FMSS – animaator: simulatsiooni käik ekraanil.
// Vastab originaali failile ANIMA.INC (FMS_SIM.PAS-i osa). Disain: DISAIN.md osa 14.
// Nimed ja tunnused [O]/[T]/[U]: DISAIN.md osa 12.
//
// Side on ühepoolne (originaal.md 6.3): animaator loeb simulaatori olekut (SimState) ja kutsub
// SimStep-i, aga ei muuda simulaatori andmeid. Simulaator töötab ka ilma animaatorita (SimRun).
//
// Osad:
//  - arvutus (ilma brauserita, testitav Node'iga): TrackGeometry, TrackPoint, WorkpiecePlaces,
//    EventListArray, DiffEventList, EventCardLayout, kiiruse skaala;
//  - joonistamine teema primitiividega: DrawLayout ja DrawIcon (ikoonid, kasutab ka redaktor),
//    Animator (pinkide, puhvrite ja ladude seis), Transport (alused ja detailid), SimStatus
//    (üldseis), Event List riba (ainult kaasaegses välimuses);
//  - juhtimine: StartAnimator, StopAnimator, klahvid; kaasaegses välimuses nupud ja liugur.
//
// Koordinaadid: ruudustiku ühikutes (ikoon = 1 × 1, X paremale, Y alla). Ekraanile teisendab
// vaade (View): ikooni laius CW ja kõrgus CH pikslites. EGA-s on CH < CW, sest EGA pikslid on
// kõrged – nii on ikoon ekraanil ruudukujuline.

import { IconTypes, DIRECTIONS, CellTrack } from './fms_glb.js';
import { Texts, FormatText } from './fms_lng.js';
import { ROW_HEIGHT } from './fms_theme.js';
import { SimInit, SimStep, SimState, SimReport } from './fms_sim.js';
import { SetDesktopView, RequestRedraw } from './windows.js';

// =====================================================================
// Konstandid
// =====================================================================

const PORT_POINTS = {           // [T] ikooni külje keskpunkt ikooni sees
  N: { X: 0.5, Y: 0 }, E: { X: 1, Y: 0.5 }, S: { X: 0.5, Y: 1 }, W: { X: 0, Y: 0.5 },
};
export const SPEED_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];   // [U] kiirused klahvidega
export const MAX_SPEED = 1000;          // [U] suurim kiirus: simulatsiooni sekundit reaalses sekundis
const DEFAULT_SPEED = 10;
const MAX_STEPS_PER_FRAME = 2000;       // kaitse: ühes kaadris kõige rohkem nii mitu SimStep-i
const MAX_MODE_BUDGET_MS = 14;          // maksimumkiirusel simuleeritakse kaadris nii kaua
const NEXT_EVENT_LIMIT = 36000;         // „järgmine sündmus“: kõige rohkem nii mitu sekundit edasi
const CATCH_UP_RATE = 4;                // sammu järel jõuab pilt järele 1/4 s jooksul
const CARDS_MAX_SPEED = 50;             // suuremal kiirusel näitab Event List ainult arvu
const EVENT_HORIZON = 3600;             // Event Listi ajatelje parem serv (s)
const EVENT_TICKS = [0, 10, 60, 600, 3600];   // [U] ajatelje märgid: nüüd, +10 s, +1 min, +10 min, +1 h
const EGA_CELL = { Width: 48, Height: 35 };   // EGA ikoon: 48 × 35 pikslit on 4:3 ekraanil ruut
const MODERN_MAX_CELL = 72;             // kaasaegne: ikooni suurim külg loogilistes pikslites
const STRIP_HEIGHT = 5 * ROW_HEIGHT + 4; // Event List riba kõrgus (kaasaegne)
const BAR_HEIGHT = ROW_HEIGHT + 12;     // juhtriba kõrgus (kaasaegne)
const CARD_WIDTH = 66;
const CARD_GAP = 4;
const CARD_ROWS = 3;
const WORKPIECE_ROLES = 16;             // detailitüüpide värvid Wp0 … Wp15
const MACHINE_ROLES = {                 // [U] tööpingi olek → keha värv
  IDLE: 'MachIdle', LOADING: 'MachLoading', SETUP: 'MachSetup', PROCESSING: 'MachProcessing',
  UNLOADING: 'MachLoading', DOWN: 'MachDown',
};
const MACHINE_LINK_SIDES = {            // [T] pingi ikoon → külg, kus on ühendus puhvriga (DISAIN.md 2.1)
  MachToolDown: ['S'], MachToolUp: ['N'], MachToolThruDown: ['N', 'S'], MachToolThruUp: ['N', 'S'],
};

let AnimState = null;   // [U] animaatori olek; null = animaator pole avatud

// =====================================================================
// Arvutus: raja geomeetria
// =====================================================================

const Modulo = (value, length) => ((value % length) + length) % length;

// Nurk vahemikku (-π, π].
function NormalizeAngle(angle) {
  let result = Modulo(angle + Math.PI, 2 * Math.PI) - Math.PI;
  if (result <= -Math.PI) result += 2 * Math.PI;
  return result;
}

// [U] ArcCorner – kaare (veerandringi raadiusega 1/2) keskpunkt ja nurgad: keskpunkt on ikooni
//     nurk kahe külje vahel. From – nurk lähtekülje juures, Sweep – ±π/2 sihtkülje poole.
export function ArcCorner(x, y, fromPort, toPort) {
  const ports = [fromPort, toPort];
  const center = { X: x + (ports.includes('E') ? 1 : 0), Y: y + (ports.includes('S') ? 1 : 0) };
  const angle = port => Math.atan2(y + PORT_POINTS[port].Y - center.Y, x + PORT_POINTS[port].X - center.X);
  return { Center: center, From: angle(fromPort), Sweep: NormalizeAngle(angle(toPort) - angle(fromPort)) };
}

// [U] CellPathPoint – punkt raja ikooni sees: fraction 0 = sisenemise külg (Entry), 1 = väljumise
//     külg (Exit). Sirgel lõik, kaarel veerandring.
export function CellPathPoint(cell, fraction) {
  if (IconTypes[cell.T].Arc) {
    const arc = ArcCorner(cell.X, cell.Y, cell.Entry, cell.Exit);
    const angle = arc.From + arc.Sweep * fraction;
    return { X: arc.Center.X + 0.5 * Math.cos(angle), Y: arc.Center.Y + 0.5 * Math.sin(angle) };
  }
  const from = PORT_POINTS[cell.Entry];
  const to = PORT_POINTS[cell.Exit];
  return { X: cell.X + from.X + (to.X - from.X) * fraction, Y: cell.Y + from.Y + (to.Y - from.Y) * fraction };
}

// [U] TrackGeometry – raja ikoonid koos asukohaga rajal (Enumerate tulemus) ja hargnemisikooni
//     keskkoha asukohaga (Middle = jaam). Hargnemise pooled võivad olla eri pikkusega, kui
//     naaberlõikudel on eri metrokaardi tegur. Kutsub: StartAnimator, testid.
export function TrackGeometry(network, trackIndex = 0) {
  const track = network.Tracks[trackIndex];
  const cells = track.Cells.map(cell => {
    const station = network.Stations.find(candidate => candidate.Track === trackIndex
      && candidate.Junction.X === cell.X && candidate.Junction.Y === cell.Y);
    return { ...cell, Middle: station ? Modulo(station.Position - cell.Start, track.Length) : null };
  });
  return { Length: track.Length, Cells: cells };
}

// [U] TrackPoint – asukoht rajal (cm alates FromCS jaamast) → punkt ruudustikus.
//     Kutsub: Transport, testid.
export function TrackPoint(geometry, position) {
  const length = geometry.Length;
  const point = Modulo(position, length);
  let best = null;
  for (const cell of geometry.Cells) {
    const local = Modulo(point - cell.Start, length);
    const overshoot = Math.max(0, local - cell.Length);
    if (best === null || overshoot < best.Overshoot) best = { Cell: cell, Local: local, Overshoot: overshoot };
    if (overshoot === 0) break;
  }
  const { Cell: cell } = best;
  const local = Math.min(best.Local, cell.Length);
  let fraction;
  if (cell.Length <= 0) {
    fraction = 0.5;
  } else if (cell.Middle !== null && cell.Middle > 0 && cell.Middle < cell.Length) {
    fraction = local < cell.Middle
      ? 0.5 * local / cell.Middle
      : 0.5 + 0.5 * (local - cell.Middle) / (cell.Length - cell.Middle);
  } else {
    fraction = local / cell.Length;
  }
  return CellPathPoint(cell, fraction);
}

// [U] PalletGrid – aluse kohtade paigutus (etapp 7c): veerud × read, näha kuni PLACES_SHOWN kohta
//     (1, 2, 3 reas; 4 – 2 × 2). Rohkem kohtade korral on alusel detailide arv.
export const PLACES_SHOWN = 4;
const PLACE_PITCH = 0.26;   // [U] kohtade vahe alusel, ikooni murdosades
export function PalletGrid(places) {
  const shown = Math.min(Math.max(1, places), PLACES_SHOWN);
  const columns = shown === 4 ? 2 : shown;
  return { Shown: shown, Columns: columns, Rows: Math.ceil(shown / columns),
           Width: 0.32 + (columns - 1) * PLACE_PITCH, Height: 0.32 + (Math.ceil(shown / columns) - 1) * PLACE_PITCH };
}

// [U] PalletPlacePoint – koha place keskpunkt alusel, mille keskpunkt on point (ruudustikus).
//     Kohad üle PLACES_SHOWN joonistatakse viimase nähtava koha peale.
export function PalletPlacePoint(point, places, place) {
  const grid = PalletGrid(places);
  const slot = Math.min(Math.max(0, place ?? 0), grid.Shown - 1);
  const column = slot % grid.Columns;
  const row = Math.floor(slot / grid.Columns);
  return { X: point.X + (column - (grid.Columns - 1) / 2) * PLACE_PITCH,
           Y: point.Y + (row - (grid.Rows - 1) / 2) * PLACE_PITCH };
}

// [T] PalletPosition – aluse asukoht konveieril (DISAIN.md 3.1, sama valem mis MinuteMan-is).
export function PalletPosition(track, palletIndex, offset) {
  return Modulo(offset + palletIndex * track.Length / track.Carts, track.Length);
}

// [U] InterpolateOffset – konveieri nihe eelmise ja praeguse sekundi vahel (sujuv liikumine).
export function InterpolateOffset(previous, current, length, fraction) {
  return Modulo(previous + Modulo(current - previous, length) * fraction, length);
}

// [U] EdgePoint – punkt diskreetse raja lõigul: kaugus lõigu From-sõlmest (cm) -> punkt
//     ruudustikus (lõigu ikoonid Enumerate-st: F0 … F1 osa ikoonist). Kutsuvad: CartPoint, DrawZones.
export function EdgePoint(edge, distance) {
  const point = Math.min(Math.max(distance, 0), edge.Length);
  let piece = edge.Cells[edge.Cells.length - 1];
  for (const candidate of edge.Cells) {
    if (point <= candidate.Start + candidate.Length + 1e-9) { piece = candidate; break; }
  }
  const local = piece.Length > 0 ? Math.min(1, Math.max(0, (point - piece.Start) / piece.Length)) : 0;
  return CellPathPoint(piece, piece.F0 + (piece.F1 - piece.F0) * local);
}

// [U] NodePoint – diskreetse raja sõlme punkt (ikooni keskel, kaare otsal kaare keskel).
export function NodePoint(track, nodeIndex) {
  return CellPathPoint(track.Nodes[nodeIndex], 0.5);
}

// [U] CartPosition – käru asukoht koopiana: { Node } või { Edge, Dir, Distance }.
export function CartPosition(cart) {
  return cart.Edge >= 0 ? { Edge: cart.Edge, Dir: cart.Dir, Distance: cart.Distance } : { Node: cart.Node };
}

// [U] CartPoint – käru punkt ruudustikus (Distance on käru sõidusuunas).
export function CartPoint(track, position) {
  if (position.Edge === undefined) return NodePoint(track, position.Node);
  const edge = track.Edges[position.Edge];
  return EdgePoint(edge, position.Dir > 0 ? position.Distance : edge.Length - position.Distance);
}

// [U] InterpolateCart – käru punkt eelmise ja praeguse sekundi vahel (sujuv liikumine): sama lõik
//     (ka ümber pöörates), lõigult sõlme, sõlmest lõigule või lõigult järgmisele lõigule läbi sõlme;
//     muidu praegune punkt.
export function InterpolateCart(track, previous, current, fraction) {
  if (!previous || fraction >= 1) return CartPoint(track, current);
  const far = position => (position.Dir > 0 ? track.Edges[position.Edge].To : track.Edges[position.Edge].From);
  const near = position => (position.Dir > 0 ? track.Edges[position.Edge].From : track.Edges[position.Edge].To);
  const along = (position, distance) => CartPoint(track, { ...position, Distance: distance });
  const onEdge = position => position.Edge !== undefined;
  if (onEdge(previous) && onEdge(current) && previous.Edge === current.Edge) {
    // sama lõik; ümber pöörates loetakse eelmine kaugus uues suunas
    const start = previous.Dir === current.Dir ? previous.Distance : track.Edges[current.Edge].Length - previous.Distance;
    return along(current, start + (current.Distance - start) * fraction);
  }
  if (onEdge(previous) && !onEdge(current) && far(previous) === current.Node) {
    const length = track.Edges[previous.Edge].Length;
    return along(previous, previous.Distance + (length - previous.Distance) * fraction);
  }
  if (!onEdge(previous) && onEdge(current) && near(current) === previous.Node) {
    return along(current, current.Distance * fraction);
  }
  if (onEdge(previous) && onEdge(current) && far(previous) === near(current)) {
    const rest = track.Edges[previous.Edge].Length - previous.Distance;
    const travelled = (rest + current.Distance) * fraction;
    return travelled < rest ? along(previous, previous.Distance + travelled) : along(current, travelled - rest);
  }
  return CartPoint(track, current);
}

// =====================================================================
// Arvutus: detailid ja sündmused
// =====================================================================

// [U] EventListArray – Event List (ahelloend FirstAtMoment → Next) massiivina.
export function EventListArray(first) {
  const events = [];
  for (let event = first; event !== null; event = event.Next) events.push(event);
  return events;
}

// [U] DiffEventList – võrdleb kahte Event Listi seisu: lisandunud ja töödeldud (kadunud) kirjed.
//     Kirjed on samad objektid, nii et võrreldakse viiteid.
export function DiffEventList(previous, current) {
  const previousSet = new Set(previous);
  const currentSet = new Set(current);
  return {
    Added: current.filter(event => !previousSet.has(event)),
    Removed: previous.filter(event => !currentSet.has(event)),
  };
}

// Sündmuse kirje lähte- või sihtobjekt joonistamise kohaks. Alusel: detaili koht (mahalaadimine)
// või esimene vaba koht, kuhu ta laaditakse (pealelaadimine).
function EventPlace(state, event, type, code, workpiece) {
  switch (type) {
    case 'Pallette': {
      const location = workpiece.Location;
      const place = location.Kind === 'Pallet' ? location.Place
        : Math.max(0, state.Tracks[event.Track].Pallets[code].Places.indexOf(null));
      return { Kind: 'Pallet', Track: event.Track, Pal: code, Place: place };
    }
    case 'Buffer': return { Kind: 'Buffer', Index: code };
    case 'Machine': return { Kind: 'Machine', Index: code };
    case 'SysInput': return { Kind: 'FromCS' };
    case 'SysOutput': return { Kind: state.StationArray[code].Kind };   // ToCS või SysOut
    case 'Connector': return { Kind: 'Connector', Index: code };
    default: return null;
  }
}

// Detaili koht tema asukoha (Location) järgi.
function LocationPlace(state, workpiece) {
  const location = workpiece.Location;
  switch (location.Kind) {
    case 'Pallet': return { Kind: 'Pallet', Track: location.Track, Pal: location.Pal, Place: location.Place };
    case 'Buffer': {
      const slot = state.BufferArray[location.Index].Entries.findIndex(entry => entry.WP === workpiece.Id);
      return { Kind: 'Buffer', Index: location.Index, Slot: slot };
    }
    case 'Machine': return { Kind: 'Machine', Index: location.Index };
    case 'FromCS': return { Kind: 'FromCS', Slot: state.FromCSQueue.indexOf(workpiece.Id) };
    case 'Storage': return { Kind: 'ToCS' };
    case 'Connector': return { Kind: 'Connector', Index: location.Index };
    default: return null;
  }
}

// [U] WorkpiecePlaces – kus iga süsteemis olev detail joonistatakse. Laadimise ajal liigub
//     detail lähtekohast (From) sihtkohta (To); aeg Since … Until tuleb detaili olekust ja
//     Event Listis olevast Load-sündmusest. Parking – detail saadetakse ummiku tõttu kesklattu.
//     Kutsub: Animator, testid.
export function WorkpiecePlaces(state) {
  const loadEvents = new Map();
  for (let event = state.FirstAtMoment; event !== null; event = event.Next) {
    if (event.Event === 'Load') loadEvents.set(event.WP, event);
  }
  const places = [];
  for (const workpiece of state.SysWPArray) {
    const place = LocationPlace(state, workpiece);
    if (place === null) continue;
    const parking = workpiece.Destination !== null && workpiece.Destination.Park === true;
    const load = workpiece.State === 'LOADING' ? loadEvents.get(workpiece.Id) : undefined;
    if (load) {
      places.push({
        WP: workpiece, Kind: 'Moving', Parking: parking, Since: workpiece.StateSince, Until: load.Time,
        From: EventPlace(state, load, load.SrcType, load.SrcCode, workpiece) ?? place,
        To: EventPlace(state, load, load.ObjType, load.ObjCode, workpiece) ?? place,
      });
    } else {
      places.push({ WP: workpiece, ...place, Parking: parking });
    }
  }
  return places;
}

// [U] EventAxisX – Event Listi ajatelg: aeg sündmuseni (s) → x. Logaritmiline, et lähemad
//     sündmused oleksid hõredamalt ja kaugemad (töötlemine) mahuksid ära.
export function EventAxisX(delta, axis) {
  const share = Math.min(1, Math.log1p(Math.max(0, delta)) / Math.log1p(axis.Horizon ?? EVENT_HORIZON));
  return axis.X0 + (axis.X1 - axis.CardWidth - axis.X0) * share;
}

// [U] EventCardLayout – Event Listi kaardid veergudesse: üks veerg = üks aeg, veerus kaardid
//     listi (FIFO) järjekorras. Veerg on ajateljel oma kohal või eelmisest paremal, nii et
//     kaardid ei kattu. Mis ei mahu, loetakse kokku (Hidden, veeru Extra).
//     Kutsub: Event List riba, testid.
export function EventCardLayout(events, now, axis) {
  const columns = [];
  for (const event of events) {
    const last = columns[columns.length - 1];
    if (last && last.Time === event.Time) last.Events.push(event);
    else columns.push({ Time: event.Time, Events: [event] });
  }
  const placed = [];
  let hidden = 0;
  let minX = axis.X0;
  for (const column of columns) {
    const x = Math.max(EventAxisX(column.Time - now, axis), minX);
    if (x + axis.CardWidth > axis.X1) { hidden += column.Events.length; continue; }
    placed.push({
      X: x, Time: column.Time,
      Cards: column.Events.slice(0, axis.Rows).map((event, row) => ({ Event: event, X: x, Row: row })),
      Extra: Math.max(0, column.Events.length - axis.Rows),
    });
    minX = x + axis.CardWidth + axis.Gap;
  }
  return { Columns: placed, Hidden: hidden };
}

// =====================================================================
// Arvutus: kiirus
// =====================================================================

// [U] SpeedFromSlider, SliderFromSpeed – liuguri asend 0 … 1 ↔ kiirus ×1 … ×1000 (logaritmiline).
export const SpeedFromSlider = value => Math.pow(MAX_SPEED, Math.min(1, Math.max(0, value)));
export const SliderFromSpeed = speed => Math.log(Math.max(1, speed)) / Math.log(MAX_SPEED);

// [U] NextSpeed – järgmine kiirus SPEED_STEPS-ist (direction +1 kiiremini, -1 aeglasemalt).
export function NextSpeed(speed, direction) {
  if (direction > 0) return SPEED_STEPS.find(step => step > speed + 1e-9) ?? MAX_SPEED;
  return [...SPEED_STEPS].reverse().find(step => step < speed - 1e-9) ?? 1;
}

// [U] SpeedText – kiirus kasutajale: ×1, ×2,5, ×10 …
export function SpeedText(speed) {
  const rounded = speed >= 10 ? Math.round(speed) : Math.round(speed * 10) / 10;
  return `×${String(rounded).replace('.', ',')}`;
}

// [U] ClockText – sekundid kujul h:mm:ss.
export function ClockText(seconds) {
  const two = value => String(value).padStart(2, '0');
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 3600)}:${two(Math.floor(whole / 60) % 60)}:${two(whole % 60)}`;
}

// =====================================================================
// Joonistamine: vaade ja ikoonid
// =====================================================================

// [U] LayoutView – kuhu ja kui suurelt ruudustik joonistatakse: ala rect, mõõdud dim (ikoonides).
export function LayoutView(theme, rect, dim) {
  let cellWidth;
  let cellHeight;
  if (theme.Name === 'EGA') {
    cellWidth = Math.min(EGA_CELL.Width, Math.floor(rect.Width / dim.X));
    cellHeight = Math.round(cellWidth * EGA_CELL.Height / EGA_CELL.Width);
    if (cellHeight * dim.Y > rect.Height) {
      cellHeight = Math.floor(rect.Height / dim.Y);
      cellWidth = Math.floor(cellHeight * EGA_CELL.Width / EGA_CELL.Height);
    }
  } else {
    cellWidth = cellHeight = Math.min(MODERN_MAX_CELL, rect.Width / dim.X, rect.Height / dim.Y);
  }
  return {
    X: Math.round(rect.X + (rect.Width - cellWidth * dim.X) / 2),
    Y: Math.round(rect.Y + (rect.Height - cellHeight * dim.Y) / 2),
    CW: cellWidth, CH: cellHeight, Dim: dim, Ega: theme.Name === 'EGA',
  };
}

const ToScreen = (view, point) => ({ X: view.X + point.X * view.CW, Y: view.Y + point.Y * view.CH });
const LineWidth = view => (view.Ega ? 1 : Math.max(1.2, view.CW * 0.045));
const DashPattern = view => (view.Ega ? [2, 2] : [view.CW * 0.06, view.CW * 0.06]);
const LabelSize = view => Math.max(6, Math.min(9, view.CW * 0.15));

// Tekst keskele punkti (cx, cy) ümber.
function CenterText(theme, view, cx, cy, text, role, options = {}) {
  const size = options.Size ?? LabelSize(view);
  const width = theme.TextWidth(text, { Size: size, Bold: options.Bold });
  theme.Text(cx - width / 2, cy - ROW_HEIGHT / 2, text, role, { Size: size, Bold: options.Bold });
}

// Ristkülik ikooni sees (inset ikooni murdosades).
function CellBox(view, cell, insetX, insetTop, insetBottom = insetTop) {
  const topLeft = ToScreen(view, { X: cell.X + insetX, Y: cell.Y + insetTop });
  return {
    X: Math.round(topLeft.X), Y: Math.round(topLeft.Y),
    Width: Math.round(view.CW * (1 - 2 * insetX)), Height: Math.round(view.CH * (1 - insetTop - insetBottom)),
  };
}

// Raja ikooni joon (sirge, kaar, hargnemine, ristmik, sild, punktiir). role2 – sillal N–S raja värv.
function DrawTrackIcon(theme, view, cell, role, role2 = role, branchTrack = false) {
  const icon = IconTypes[cell.T];
  const dotted = Boolean(cell.Dot) || icon.Kind === 'Connector';
  const lineRole = cell.Dot ? 'DotLink' : role;
  const options = { Width: LineWidth(view), Dash: cell.Dot ? DashPattern(view) : null };
  const port = name => ToScreen(view, { X: cell.X + PORT_POINTS[name].X, Y: cell.Y + PORT_POINTS[name].Y });
  const line = (from, to, lineOptions = options, lineColor = lineRole) => {
    const a = port(from);
    const b = to === 'C' ? ToScreen(view, { X: cell.X + 0.5, Y: cell.Y + 0.5 }) : port(to);
    theme.Line(a.X, a.Y, b.X, b.Y, lineColor, lineOptions);
  };
  if (icon.CrossOver) {
    // sild nagu elektriskeemil: N–S sirge, W–E läheb keskel väikese poolringiga üle
    const hop = 0.16;
    line('N', 'S', options, role2);
    const left = ToScreen(view, { X: cell.X + 0.5 - hop, Y: cell.Y + 0.5 });
    const right = ToScreen(view, { X: cell.X + 0.5 + hop, Y: cell.Y + 0.5 });
    const west = port('W');
    const east = port('E');
    theme.Line(west.X, west.Y, left.X, left.Y, lineRole, options);
    theme.Line(right.X, right.Y, east.X, east.Y, lineRole, options);
    const center = ToScreen(view, { X: cell.X + 0.5, Y: cell.Y + 0.5 });
    theme.Ellipse(center.X, center.Y, view.CW * hop, view.CH * hop, lineRole,
      { Fill: false, Width: options.Width, Start: Math.PI, End: 2 * Math.PI });
    return;
  }
  if (icon.Arc) {
    const arc = ArcCorner(cell.X, cell.Y, icon.Ports[0], icon.Ports[1]);
    const center = ToScreen(view, arc.Center);
    const start = Math.min(arc.From, arc.From + arc.Sweep);
    theme.Ellipse(center.X, center.Y, view.CW / 2, view.CH / 2, lineRole,
      { Fill: false, Width: options.Width, Dash: options.Dash, Start: start, End: start + Math.abs(arc.Sweep) });
  } else if (icon.Ports.length === 4) {
    line('N', 'S');
    line('W', 'E');
  } else {
    line(icon.Ports[0], icon.Ports[1]);
  }
  // haru: punktiirühendus (jaam) või raja-haru (diskreetne rada, 7b) – pidev joon
  if (icon.Branch) {
    if (branchTrack) line(icon.Branch, 'C');
    else line(icon.Branch, 'C', { Width: options.Width, Dash: DashPattern(view) }, 'DotLink');
  }
  if (icon.Kind === 'Connector' && !dotted) return;
  if (icon.Kind === 'Connector') {   // konnektor: väike kast keskel (etapp 7)
    const box = CellBox(view, cell, 0.38, 0.38);
    theme.StrokeRect(box.X, box.Y, box.Width, box.Height, 'LayoutLabel', { Width: 1 });
  }
}

// Suunanool raja kõrval: näitab, kuhu kärud ikoonist väljuvad. [O]
//     Arvutatakse ruudustiku ühikutes, nii et EGA-s on nool ekraanil sama kujuga.
function DrawDirectionArrow(theme, view, cell) {
  const icon = IconTypes[cell.T];
  const entry = icon.Ports.find(port => port !== cell.Dir);
  const path = { ...cell, Entry: entry, Exit: cell.Dir };
  const middle = CellPathPoint(path, 0.5);
  const ahead = CellPathPoint(path, 0.6);
  const length = Math.hypot(ahead.X - middle.X, ahead.Y - middle.Y) || 1;
  const along = { X: (ahead.X - middle.X) / length, Y: (ahead.Y - middle.Y) / length };
  const right = { X: -along.Y, Y: along.X };   // sõidusuunast paremal (Y kasvab alla)
  const size = view.Ega ? 0.12 : 0.1;
  const center = { X: middle.X + right.X * 0.24, Y: middle.Y + right.Y * 0.24 };
  const at = (forward, side) => ToScreen(view, {
    X: center.X + along.X * forward * size + right.X * side * size,
    Y: center.Y + along.Y * forward * size + right.Y * side * size,
  });
  theme.Polygon([at(1, 0), at(-0.7, 0.75), at(-0.7, -0.75)], 'Arrow');
}

// [U] DrawIcon – üks ikoon ruudustikus. label – objekti nimi (pink, puhver); style:
//     TrackRole – raja värv, MachineRole – pingi keha värv. Kutsub: DrawLayout (ka redaktor).
export function DrawIcon(theme, view, cell, label = '', style = {}) {
  const icon = IconTypes[cell.T];
  if (!icon || icon.Kind === 'Empty') return;
  const size = LabelSize(view);
  switch (icon.Kind) {
    case 'Track':
    case 'Connector':
      DrawTrackIcon(theme, view, cell, style.TrackRole ?? 'Track', style.TrackRole2 ?? style.TrackRole ?? 'Track', style.BranchTrack);
      if (cell.Dir) DrawDirectionArrow(theme, view, cell);
      break;
    case 'Machine': {
      const box = CellBox(view, cell, 0.08, 0.1);
      const radius = view.Ega ? 0 : 3;
      for (const side of MACHINE_LINK_SIDES[cell.T] ?? []) {   // ühendus puhvriga
        const from = ToScreen(view, { X: cell.X + 0.5, Y: cell.Y + (side === 'S' ? 0.9 : 0.1) });
        const to = ToScreen(view, { X: cell.X + 0.5, Y: cell.Y + (side === 'S' ? 1 : 0) });
        theme.Line(from.X, from.Y, to.X, to.Y, 'MachineFrame', { Width: LineWidth(view) });
      }
      theme.RoundRect(box.X, box.Y, box.Width, box.Height, radius, style.MachineRole ?? 'MachIdle');
      theme.StrokeRect(box.X, box.Y, box.Width, box.Height, 'MachineFrame', { Width: 1, Radius: radius });
      theme.Text(box.X + (view.Ega ? 3 : 3), box.Y + (view.Ega ? 0 : -2), label, 'MachineLabel', { Size: size, Bold: true });
      break;
    }
    case 'Buffer': {
      const box = CellBox(view, cell, 0.08, 0.16);
      for (const y of [0, 0.84]) {   // ühendused pingi ja raja poole
        const from = ToScreen(view, { X: cell.X + 0.5, Y: cell.Y + y });
        const to = ToScreen(view, { X: cell.X + 0.5, Y: cell.Y + y + 0.16 });
        theme.Line(from.X, from.Y, to.X, to.Y, 'BufferFrame', { Width: LineWidth(view) });
      }
      theme.RoundRect(box.X, box.Y, box.Width, box.Height, view.Ega ? 0 : 3, 'BufferBody');
      theme.StrokeRect(box.X, box.Y, box.Width, box.Height, 'BufferFrame', { Width: 1, Radius: view.Ega ? 0 : 3 });
      theme.Text(box.X + 3, box.Y + (view.Ega ? -1 : -0.5), label, 'LayoutLabel', { Size: size });
      break;
    }
    case 'Storage':
    case 'Output': {
      const box = CellBox(view, cell, 0.05, 0.08);
      theme.RoundRect(box.X, box.Y, box.Width, box.Height, view.Ega ? 0 : 3, 'StorageBody');
      theme.StrokeRect(box.X, box.Y, box.Width, box.Height, 'StorageFrame', { Width: 1, Radius: view.Ega ? 0 : 3 });
      CenterText(theme, view, box.X + box.Width / 2, box.Y + (view.Ega ? 7 : 7), cell.T, 'LayoutLabel', { Size: size });
      break;
    }
    default:
      break;
  }
}

// [U] ObjectLabel – ikooni silt: pingi nimi mudelist, puhvri nimi BUFn.
function ObjectLabel(model, cell) {
  const icon = IconTypes[cell.T];
  if (icon.Kind === 'Machine') return model.Machines[cell.N - 1]?.Name ?? `MT${cell.N}`;
  if (icon.Kind === 'Buffer') return `BUF${cell.N}`;
  return '';
}

// [U] BranchIsTrack – kas hargnemise haru on sama raja rada (raja-haru diskreetsel rajal, 7b),
//     mitte punktiirühendus. grid: 'x,y' -> lahter.
function BranchIsTrack(grid, cell) {
  const branch = IconTypes[cell.T]?.Branch;
  if (!branch || cell.Dot) return false;
  const step = DIRECTIONS[branch];
  const next = grid.get(`${cell.X + step.DX},${cell.Y + step.DY}`);
  if (!next || next.Dot || IconTypes[next.T]?.Kind !== 'Track') return false;
  const icon = IconTypes[next.T];
  const ports = icon.Branch ? [...icon.Ports, icon.Branch] : icon.Ports;
  return ports.includes(step.Opposite) && CellTrack(next, step.Opposite) === cell.N;
}

// [U] DrawLayout – kogu ruudustik: taust, ruudustiku punktid, ikoonid.
//     style.MachineRole(cell) – pingi värv olekust; style.TrackRole – raja värv (roll või
//     funktsioon raja numbrist, iga raja jaoks oma; sillal kaks rada); style.Grid: false – ilma ruudustiku punktideta
//     (View). Kutsub: Animator, redaktor (fms_ed.js).
export function DrawLayout(theme, view, model, style = {}) {
  const { Dim: dim } = view;
  for (let y = 0; style.Grid !== false && y <= dim.Y; y++) {
    for (let x = 0; x <= dim.X; x++) {
      const point = ToScreen(view, { X: x, Y: y });
      theme.FillRect(Math.round(point.X), Math.round(point.Y), 1, 1, 'LayoutGrid');
    }
  }
  const cells = [...model.Layout.Cells].sort((first, second) =>
    Number(IconTypes[first.T]?.Kind !== 'Track') - Number(IconTypes[second.T]?.Kind !== 'Track'));
  const grid = new Map(model.Layout.Cells.map(cell => [`${cell.X},${cell.Y}`, cell]));
  for (const cell of cells) {
    DrawIcon(theme, view, cell, ObjectLabel(model, cell), {
      BranchTrack: BranchIsTrack(grid, cell),
      TrackRole: typeof style.TrackRole === 'function' ? style.TrackRole(cell.Dot ? undefined : cell.N) : style.TrackRole,
      TrackRole2: typeof style.TrackRole === 'function' ? style.TrackRole(cell.N2 ?? (cell.Dot ? undefined : cell.N)) : style.TrackRole,
      MachineRole: style.MachineRole ? style.MachineRole(cell) : undefined,
    });
  }
}

// =====================================================================
// Joonistamine: Animator ja Transport (objektide seis)
// =====================================================================

// Puhvri koha keskpunkt ruudustikus; Size – koha laius ikooni murdosades.
function SlotPoint(cell, capacity, slot) {
  const width = Math.min(0.2, 0.76 / Math.max(1, capacity));
  return { X: cell.X + 0.5 + (slot - (capacity - 1) / 2) * width, Y: cell.Y + 0.6, Size: width };
}

// FromCS-is ootava detaili koht (esimesed 4 on näha).
const QUEUE_SHOWN = 4;
const QueuePoint = (cell, index) => ({ X: cell.X + 0.18 + Math.min(index, QUEUE_SHOWN - 1) * 0.14, Y: cell.Y + 0.62 });

// Detail: ring tüübi värviga (ruudukujuline ka EGA-s).
function DrawWorkpiece(theme, view, point, workpiece, ring = null) {
  const screen = ToScreen(view, point);
  const rx = Math.max(2, view.CW * 0.11);
  const ry = rx * view.CH / view.CW;
  theme.Ellipse(screen.X, screen.Y, rx, ry, `Wp${workpiece.Type % WORKPIECE_ROLES}`);
  if (!view.Ega) theme.Ellipse(screen.X, screen.Y, rx, ry, 'WpFrame', { Fill: false, Width: 0.6 });
  if (ring) theme.Ellipse(screen.X, screen.Y, rx + 2.5, ry + 2.5 * view.CH / view.CW, ring, { Fill: false, Width: view.Ega ? 1 : 1.5 });
}

// Ring või raam esiletõstmiseks.
function HighlightCell(theme, view, cell) {
  const box = CellBox(view, cell, 0.02, 0.02);
  theme.StrokeRect(box.X, box.Y, box.Width, box.Height, 'Highlight', { Width: view.Ega ? 1 : 2, Radius: view.Ega ? 0 : 4 });
}
function HighlightPoint(theme, view, point) {
  const screen = ToScreen(view, point);
  const rx = view.CW * 0.26;
  theme.Ellipse(screen.X, screen.Y, rx, rx * view.CH / view.CW, 'Highlight', { Fill: false, Width: view.Ega ? 1 : 2 });
}

// [U] PlacePoint – detaili koha punkt ruudustikus (alus, puhvri koht, pink, ladu).
function PlacePoint(anim, state, scene, place) {
  const network = anim.Network;
  switch (place.Kind) {
    case 'Pallet': return PalletPlacePoint(scene.PalletPoints[place.Track][place.Pal],
      state.Tracks[place.Track].PlacesPerCart, place.Place);
    case 'Buffer': {
      const buffer = network.Buffers[place.Index];
      const slot = place.Slot !== undefined && place.Slot >= 0
        ? place.Slot
        : Math.min(buffer.Capacity - 1, state.BufferArray[place.Index].Entries.length);
      return SlotPoint(buffer.Cell, buffer.Capacity, slot);
    }
    case 'Machine': {
      const cell = network.Machines[place.Index].Cell;
      return { X: cell.X + 0.5, Y: cell.Y + 0.6 };
    }
    case 'FromCS': return QueuePoint(anim.StationCells.FromCS, Math.max(0, place.Slot ?? 0));
    case 'Connector': {
      const cell = network.Connectors[place.Index].Cell;
      return { X: cell.X + 0.5, Y: cell.Y + 0.5 };
    }
    default: {
      const cell = anim.StationCells[place.Kind];
      return cell ? { X: cell.X + 0.5, Y: cell.Y + 0.62 } : { X: 0, Y: 0 };
    }
  }
}

// [U] BuildScene – kaadri andmed: nähtav aeg (eelmise ja praeguse sekundi vahel), aluste
//     punktid, detailide kohad. Kutsub: AnimatorPainter.
function BuildScene(anim, state) {
  const time = Math.max(0, state.SYSTEM_TIME - 1 + anim.Fraction);
  const palletPoints = state.Tracks.map((track, trackIndex) => {
    if (track.Discrete) {
      return track.Pallets.map((cart, cartIndex) =>
        InterpolateCart(track, anim.PrevCarts[trackIndex]?.[cartIndex], CartPosition(cart), anim.Fraction));
    }
    const offset = InterpolateOffset(anim.PrevOffsets[trackIndex] ?? track.Offset, track.Offset, track.Length, anim.Fraction);
    return track.Pallets.map((pallet, palletIndex) =>
      TrackPoint(anim.Geometry[trackIndex], PalletPosition(track, palletIndex, offset)));
  });
  return { Time: time, PalletPoints: palletPoints, Places: WorkpiecePlaces(state) };
}

// [O] Transport – kärud (alused) konveieril. Mitme kohaga alusel (7c) on kohad lahtritena:
//     vaba (hall kontuur), broneeritud (kontuur – detail tuleb peale); rohkem kui PLACES_SHOWN
//     kohta – alusel on detailide arv. Detailid joonistab Animator.
function Transport(theme, view, anim, state, scene) {
  state.Tracks.forEach((track, trackIndex) => {
    const grid = PalletGrid(track.PlacesPerCart);
    const widthX = view.CW * grid.Width;
    const height = view.CH * grid.Height;
    track.Pallets.forEach((pallet, palletIndex) => {
      const center = scene.PalletPoints[trackIndex][palletIndex];
      const point = ToScreen(view, center);
      const x = Math.round(point.X - widthX / 2);
      const y = Math.round(point.Y - height / 2);
      theme.RoundRect(x, y, Math.round(widthX), Math.round(height), view.Ega ? 0 : 2, 'Pallet');
      const reserved = pallet.ReservedWPs.length > 0;
      const waiting = track.Discrete && pallet.Waiting !== null;   // käru ootab tsooni (7b)
      const role = waiting ? 'TrackStopped' : reserved ? 'PalletReserved' : 'PalletFrame';
      theme.StrokeRect(x, y, Math.round(widthX), Math.round(height), role,
        { Width: (reserved || waiting) && !view.Ega ? 1.5 : 1, Radius: view.Ega ? 0 : 2 });
      if (track.PlacesPerCart > 1) DrawPalletPlaces(theme, view, track, pallet, center);
    });
  });
}

// [U] DrawPalletPlaces – mitme kohaga aluse lahtrid: vaba (PalletPlace) või broneeritud (esimesed vabad kohad,
//     nii mitu kui broneeringuid); üle PLACES_SHOWN kohta – detailide arv / kohti.
function DrawPalletPlaces(theme, view, track, pallet, center) {
  const grid = PalletGrid(track.PlacesPerCart);
  let reserved = pallet.ReservedWPs.length;
  const size = Math.max(3, Math.round(view.CW * 0.22));
  const sizeY = Math.max(3, Math.round(size * view.CH / view.CW));
  for (let place = 0; place < grid.Shown; place++) {
    if (pallet.Places[place] !== null) continue;
    const point = ToScreen(view, PalletPlacePoint(center, track.PlacesPerCart, place));
    const booked = reserved > 0;
    if (booked) reserved--;
    theme.StrokeRect(Math.round(point.X - size / 2), Math.round(point.Y - sizeY / 2), size, sizeY,
      booked ? 'SlotReserved' : 'PalletPlace', { Width: 1, Dash: booked && !view.Ega ? [2, 1.5] : null, Radius: view.Ega ? 0 : 1 });
  }
  if (track.PlacesPerCart > PLACES_SHOWN) {
    const count = pallet.Places.filter(id => id !== null).length;
    const point = ToScreen(view, { X: center.X, Y: center.Y - grid.Height / 2 - 0.12 });
    CenterText(theme, view, point.X, point.Y, `${count}/${track.PlacesPerCart}`, 'LayoutLabel', { Size: LabelSize(view) });
  }
}

// Puhvri kohad: detail (sees), broneeritud (kontuur), vaba. Sissetulev detail – nool pingi poole.
function DrawBufferSlots(theme, view, anim, state) {
  anim.Network.Buffers.forEach((buffer, bufferIndex) => {
    const live = state.BufferArray[bufferIndex];
    const machineCell = buffer.Machine >= 0 ? anim.Network.Machines[buffer.Machine].Cell : null;
    const towardMachine = machineCell && machineCell.Y < buffer.Cell.Y ? -1 : 1;
    for (let slot = 0; slot < buffer.Capacity; slot++) {
      const point = SlotPoint(buffer.Cell, buffer.Capacity, slot);
      const center = ToScreen(view, point);
      const width = Math.max(4, Math.round(point.Size * view.CW * 0.82));
      const height = Math.max(3, Math.round(width * view.CH / view.CW));
      const x = Math.round(center.X - width / 2);
      const y = Math.round(center.Y - height / 2);
      const entry = live.Entries[slot];
      const moving = entry && state.SysWPArray[entry.WP].State === 'LOADING';
      const reserved = slot >= live.Entries.length && slot < live.Entries.length + live.Reserved;
      if (reserved || moving) {
        theme.StrokeRect(x, y, width, height, 'SlotReserved', { Width: 1, Dash: view.Ega ? null : [2, 1.5] });
      } else {
        theme.StrokeRect(x, y, width, height, 'SlotFree', { Width: 1 });
      }
      if (entry && !moving) {   // suund: nool pingi poole (sisse) või raja poole (välja)
        const direction = entry.Dir === 'In' ? towardMachine : -towardMachine;
        const tipY = direction < 0 ? y - 1 : y + height + 1;
        const baseY = tipY - direction * Math.max(2, height * 0.35);
        const half = Math.max(1.5, width * 0.25);
        theme.Polygon([{ X: center.X, Y: tipY }, { X: center.X - half, Y: baseY }, { X: center.X + half, Y: baseY }], 'SlotArrow');
      }
    }
  });
}

// Keskladu ja väljund: FromCS järjekord, ToCS täituvus, SysOut lahkunute arv.
function DrawStorages(theme, view, anim, state) {
  const size = LabelSize(view);
  const fromCell = anim.StationCells.FromCS;
  if (fromCell && state.FromCSQueue.length > QUEUE_SHOWN) {
    const point = ToScreen(view, { X: fromCell.X + 0.84, Y: fromCell.Y + 0.62 });
    CenterText(theme, view, point.X, point.Y, `${state.FromCSQueue.length}`, 'LayoutLabel', { Size: size });
  }
  const toCell = anim.StationCells.ToCS;
  if (toCell && state.Storage) {
    const storage = state.Storage;
    const box = CellBox(view, toCell, 0.14, 0.44, 0.38);
    const share = value => Math.round(box.Width * Math.min(1, value / Math.max(1, storage.Capacity)));
    theme.RoundRect(box.X, box.Y, box.Width, box.Height, 0, 'StorageEmpty');
    const done = share(storage.Count);
    const parked = share(storage.Count + storage.Parked.length) - done;
    const reserved = share(storage.Count + storage.Parked.length + storage.Reserved) - done - parked;
    theme.FillRect(box.X, box.Y, done, box.Height, 'StorageFill');
    theme.FillRect(box.X + done, box.Y, parked, box.Height, 'Deadlock');
    if (reserved > 0) theme.StrokeRect(box.X + done + parked, box.Y, reserved, box.Height, 'SlotReserved', { Width: 1 });
    theme.StrokeRect(box.X, box.Y, box.Width, box.Height, 'StorageFrame', { Width: 1 });
    const text = `${storage.Count + storage.Parked.length}/${storage.Capacity}`;
    const point = ToScreen(view, { X: toCell.X + 0.5, Y: toCell.Y + 0.8 });
    CenterText(theme, view, point.X, point.Y, text, 'LayoutLabel', { Size: size * 0.9 });
  }
  const outCell = anim.StationCells.SysOut;
  if (outCell) {
    const left = state.Stats.Completed - (state.Storage ? state.Storage.Count : 0);
    const point = ToScreen(view, { X: outCell.X + 0.5, Y: outCell.Y + 0.62 });
    CenterText(theme, view, point.X, point.Y, `${left}`, 'LayoutValue', { Size: size * 1.3, Bold: true });
  }
}

// Spindel (kaasaegne): töötlemisel pöörleb kiiresti, häälestusel aeglaselt (hammasratas).
function DrawSpindle(theme, view, cell, machineState, time) {
  const center = ToScreen(view, { X: cell.X + 0.5, Y: cell.Y + 0.6 });
  const radius = view.CW * 0.17;
  theme.Ellipse(center.X, center.Y, radius, radius, 'Spindle', { Fill: false, Width: 1 });
  const spokes = machineState === 'SETUP' ? 6 : 3;
  const angle = machineState === 'PROCESSING' ? time * 2.2 : machineState === 'SETUP' ? time * 0.5 : 0;
  for (let i = 0; i < spokes; i++) {
    const a = angle + i * 2 * Math.PI / spokes;
    const inner = machineState === 'SETUP' ? radius : radius * 0.25;
    const outer = machineState === 'SETUP' ? radius * 1.3 : radius;
    theme.Line(center.X + Math.cos(a) * inner, center.Y + Math.sin(a) * inner,
      center.X + Math.cos(a) * outer, center.Y + Math.sin(a) * outer, 'Spindle', { Width: machineState === 'SETUP' ? 2 : 1.2 });
  }
}

// Pingi oleku täht nurgas: L laadimine, H häälestus, T töötlemine, M mahalaadimine.
function DrawMachineLetters(theme, view, anim, state) {
  anim.Network.Machines.forEach((machine, machineIndex) => {
    const letter = Texts.AnimMachineLetters[state.MachineArray[machineIndex].State] ?? '';
    if (!letter) return;
    const box = CellBox(view, machine.Cell, 0.08, 0.1);
    const width = theme.TextWidth(letter, { Size: LabelSize(view), Bold: true });
    theme.Text(box.X + box.Width - width - 3, box.Y + box.Height - ROW_HEIGHT + (view.Ega ? 0 : 2), letter, 'MachineLetter',
      { Size: LabelSize(view), Bold: true });
  });
}

// [U] RelatedObjects – sündmusega seotud objektid (Event Listi kaardi esiletõstmiseks).
function RelatedObjects(anim, event) {
  const cells = [];
  const pallets = [];
  const add = (type, code) => {
    if (code === null || code === undefined) return;
    if (type === 'Machine') cells.push(anim.Network.Machines[code]?.Cell);
    else if (type === 'Buffer') cells.push(anim.Network.Buffers[code]?.Cell);
    else if (type === 'Connector') cells.push(anim.Network.Connectors[code]?.Cell);
    else if (type === 'Pallette') pallets.push({ Track: event.Track ?? 0, Pal: code });
    else if (type === 'SysInput' || type === 'SysOutput' || type === 'Station') cells.push(anim.Network.Stations[code]?.Cell);
  };
  add(event.ObjType, event.ObjCode);
  add(event.SrcType, event.SrcCode);
  if (event.Pal !== null && event.Track !== null) pallets.push({ Track: event.Track, Pal: event.Pal });
  return { Cells: cells.filter(Boolean), Pallets: pallets, WP: event.WP };
}

// Konnektor: broneeritud (detail tuleb) – kontuur ümber kasti.
function DrawConnectors(theme, view, anim, state) {
  (anim.Network.Connectors ?? []).forEach((connector, connectorIndex) => {
    if (state.ConnectorArray[connectorIndex].Reserved === 0) return;
    const box = CellBox(view, connector.Cell, 0.3, 0.3);
    theme.StrokeRect(box.X, box.Y, box.Width, box.Height, 'SlotReserved', { Width: 1, Dash: view.Ega ? null : [2, 1.5] });
  });
}

// [U] DrawZones – diskreetse raja broneeritud tsoonid, kuhu käru pole veel jõudnud (plokk): lõik
//     katkendjoonena, sõlm ringina (DISAIN.md 11.5).
function DrawZones(theme, view, state) {
  const dash = view.Ega ? [2, 2] : [view.CW * 0.08, view.CW * 0.06];
  const width = view.Ega ? 1 : Math.max(1.5, view.CW * 0.06);
  for (const track of state.Tracks) {
    if (!track.Discrete) continue;
    for (const [zone, holder] of track.Holder) {
      const cart = track.Pallets[holder];
      const current = cart.Edge >= 0 ? `E${cart.Edge}` : `N${cart.Node}`;
      if (zone === current) continue;
      const index = Number(zone.slice(1));
      if (zone[0] === 'N') {
        const point = ToScreen(view, NodePoint(track, index));
        theme.Ellipse(point.X, point.Y, view.CW * 0.22, view.CH * 0.22, 'SlotReserved', { Fill: false, Width: width, Dash: dash });
        continue;
      }
      const edge = track.Edges[index];
      const steps = Math.max(2, Math.ceil(edge.Cells.length * 4));
      let previous = ToScreen(view, EdgePoint(edge, 0));
      for (let i = 1; i <= steps; i++) {
        const point = ToScreen(view, EdgePoint(edge, edge.Length * i / steps));
        theme.Line(previous.X, previous.Y, point.X, point.Y, 'SlotReserved', { Width: width, Dash: dash });
        previous = point;
      }
    }
  }
}

// [O] Animator – kogu pilt: rajad, pingid (olek), puhvrid, laod, konnektorid, alused, detailid,
//     esiletõstmine. Iga raja värv oma seisu järgi (seisab, kui mõni laadimine käib).
function Animator(theme, view, anim, state, scene) {
  DrawLayout(theme, view, anim.Model, {
    TrackRole: number => {
      const trackIndex = number !== undefined ? anim.TrackIndex.get(number - 1) : undefined;
      return trackIndex !== undefined && state.Tracks[trackIndex].StopCount > 0 ? 'TrackStopped' : 'Track';
    },
    MachineRole: cell => {
      const machineIndex = anim.MachineIndex.get(`${cell.X},${cell.Y}`);
      return machineIndex === undefined ? 'MachIdle' : MACHINE_ROLES[state.MachineArray[machineIndex].State];
    },
  });
  DrawBufferSlots(theme, view, anim, state);
  DrawStorages(theme, view, anim, state);
  DrawConnectors(theme, view, anim, state);
  DrawZones(theme, view, state);
  Transport(theme, view, anim, state, scene);

  const points = new Map();   // detaili Id → punkt (esiletõstmiseks)
  for (const place of scene.Places) {
    if (place.Kind === 'ToCS') continue;                       // pargitud: kesklao täituvuses
    if (place.Kind === 'FromCS' && place.Slot >= QUEUE_SHOWN) continue;
    let point;
    if (place.Kind === 'Moving') {
      const span = Math.max(1, place.Until - place.Since);
      const progress = Math.min(1, Math.max(0, (scene.Time - place.Since) / span));
      const from = PlacePoint(anim, state, scene, place.From);
      const to = PlacePoint(anim, state, scene, place.To);
      point = { X: from.X + (to.X - from.X) * progress, Y: from.Y + (to.Y - from.Y) * progress };
    } else {
      point = PlacePoint(anim, state, scene, place);
    }
    points.set(place.WP.Id, point);
    DrawWorkpiece(theme, view, point, place.WP, place.Parking ? 'Deadlock' : null);
  }

  if (!view.Ega) {
    anim.Network.Machines.forEach((machine, machineIndex) => {
      const machineState = state.MachineArray[machineIndex].State;
      if (machineState !== 'IDLE') DrawSpindle(theme, view, machine.Cell, machineState, scene.Time);
    });
  }
  DrawMachineLetters(theme, view, anim, state);

  if (anim.HoverEvent) {
    const related = RelatedObjects(anim, anim.HoverEvent);
    related.Cells.forEach(cell => HighlightCell(theme, view, cell));
    related.Pallets.forEach(pallet => {
      const point = scene.PalletPoints[pallet.Track]?.[pallet.Pal];
      if (point) HighlightPoint(theme, view, point);
    });
    if (related.WP !== null && points.has(related.WP)) HighlightPoint(theme, view, points.get(related.WP));
  }
}

// =====================================================================
// Joonistamine: SimStatus, juhtriba, Event List
// =====================================================================

// [O] SimStatus – üldseis: aeg, kiirus, detailid, läbilaskevõime (General) ja radade seis (Tracks).
//     Worst – radade tekst kõige pikemal kujul (EGA olekurea kõrguse valikuks, et see ei hüppaks).
function SimStatus(anim, state) {
  let mode = Texts.AnimModePause;
  if (state.DEADLOCK) mode = Texts.AnimModeDeadlock;
  else if (state.SIMULATION_DONE) mode = Texts.AnimModeDone;
  else if (anim.Running && anim.Max) mode = Texts.AnimModeMax;
  else if (anim.Running) mode = Texts.AnimModeRun;
  const time = Math.max(1, state.SYSTEM_TIME);
  const worst = state.Tracks.map(track => (track.Discrete
    ? FormatText(Texts.AnimTrackCartsWaiting, { Name: track.Name, Moving: track.Carts, Count: track.Carts, Waiting: track.Carts })
    : FormatText(Texts.AnimTrackStopped, { Name: track.Name, Count: track.Carts })));
  const tracks = state.Tracks.map(track => {
    if (track.Discrete) {
      const moving = track.Pallets.filter(cart => cart.Route !== null && cart.Waiting === null && !cart.Stopped).length;
      const waiting = track.Pallets.filter(cart => cart.Waiting !== null).length;
      return FormatText(waiting > 0 ? Texts.AnimTrackCartsWaiting : Texts.AnimTrackCarts,
        { Name: track.Name, Moving: moving, Count: track.Pallets.length, Waiting: waiting });
    }
    return track.StopCount > 0
      ? FormatText(Texts.AnimTrackStopped, { Name: track.Name, Count: track.StopCount })
      : FormatText(Texts.AnimTrackMoving, { Name: track.Name });
  });
  const general = FormatText(Texts.AnimStatus, {
    Time: ClockText(state.SYSTEM_TIME), Duration: ClockText(anim.Network.Sim.Duration),
    Speed: anim.Max ? Texts.AnimModeMax : SpeedText(anim.Speed), Mode: mode,
    InSystem: state.Stats.Created - state.Stats.Completed, Completed: state.Stats.Completed,
    Throughput: (state.Stats.Completed / (time / 3600)).toFixed(1).replace('.', ','),
  });
  return { General: general, Tracks: tracks.join(', '), Worst: worst.join(', '),
           Text: `${general}  ${tracks.join(', ')}` };
}

// [U] FitText – tekst lühendatud nii, et mahub laiusesse width (lõpus „..“).
function FitText(theme, text, width) {
  if (theme.TextWidth(text) <= width) return text;
  let cut = text;
  while (cut.length > 0 && theme.TextWidth(`${cut}..`) > width) cut = cut.slice(0, -1);
  return `${cut}..`;
}

// [U] EgaStatusRows – EGA olekurida: üks rida, kui see mahub ka radade kõige pikema tekstiga, muidu
//     kaks (teisel real rajad, vajadusel lühendatud). Tagastab read. Kutsub: AnimatorPainter.
function EgaStatusRows(theme, status, width) {
  if (theme.TextWidth(`${status.General}  ${status.Worst}`) <= width) return [status.Text];
  return [FitText(theme, status.General, width), FitText(theme, status.Tracks, width)];
}

// [U] ControlLayout – juhtriba nupud ja liugur (kaasaegne): asukohad joonistamiseks ja hiireks.
function ControlLayout(theme, desktop) {
  const y = desktop.Y + 6;
  const height = ROW_HEIGHT + 1;
  const controls = [];
  let x = desktop.X + 10;
  const add = (id, width, hint, extra = {}) => {
    controls.push({ Id: id, X: x, Y: y, Width: width, Height: height, Hint: hint, ...extra });
    x += width + 4;
  };
  add('Run', 28, Texts.AnimHintRun);
  add('Step', 28, Texts.AnimHintStep);
  add('Next', 28, Texts.AnimHintNext);
  add('Stop', 28, Texts.AnimHintStop);
  x += 10;
  const labelX = x;
  x += theme.TextWidth(Texts.AnimSpeed) + 8;
  add('Speed', 120, Texts.AnimHintSpeed);
  const valueX = x;
  x += 34;
  add('Max', 34, Texts.AnimHintMax);
  return { Controls: controls, LabelX: labelX, ValueX: valueX, StatusX: x + 10, Y: y };
}

// Nupu ikoon: kolmnurk, paus, samm, järgmine sündmus, stopp.
function DrawControlGlyph(theme, control, glyph, role) {
  const cx = control.X + control.Width / 2;
  const cy = control.Y + control.Height / 2;
  const s = 3.6;
  const triangle = (x) => theme.Polygon([{ X: x - s * 0.6, Y: cy - s }, { X: x + s * 0.9, Y: cy }, { X: x - s * 0.6, Y: cy + s }], role);
  switch (glyph) {
    case 'Play': triangle(cx); break;
    case 'Pause':
      theme.FillRect(cx - s * 0.8, cy - s, s * 0.6, 2 * s, role);
      theme.FillRect(cx + s * 0.2, cy - s, s * 0.6, 2 * s, role);
      break;
    case 'Step':
      triangle(cx - 1.5);
      theme.FillRect(cx + s * 0.6, cy - s, 1.2, 2 * s, role);
      break;
    case 'Next':
      triangle(cx - s * 0.9);
      triangle(cx + s * 0.5);
      theme.FillRect(cx + s * 1.5, cy - s, 1.2, 2 * s, role);
      break;
    case 'Stop': theme.FillRect(cx - s * 0.85, cy - s * 0.85, s * 1.7, s * 1.7, role); break;
    default: break;
  }
}

// [U] DrawControlBar – juhtriba (kaasaegne): nupud, kiiruse liugur, max ja SimStatus.
function DrawControlBar(theme, desktop, anim, state) {
  const layout = ControlLayout(theme, desktop);
  anim.Controls = layout.Controls;
  const done = state.SIMULATION_DONE;
  for (const control of layout.Controls) {
    if (control.Id === 'Speed') {
      theme.Slider(control.X, control.Y, control.Width, SliderFromSpeed(anim.Speed), anim.DragSlider || anim.HoverControl === 'Speed');
      continue;
    }
    const active = (control.Id === 'Run' && anim.Running && !done) || (control.Id === 'Max' && anim.Max);
    theme.Button(control.X, control.Y, control.Width, control.Id === 'Max' ? Texts.AnimMaxLabel : '', active);
    const role = active ? 'ButtonSelectedText' : (done && control.Id !== 'Stop' ? 'MenuDisabled' : 'ButtonText');
    if (control.Id === 'Run') DrawControlGlyph(theme, control, anim.Running && !done ? 'Pause' : 'Play', role);
    else if (control.Id !== 'Max') DrawControlGlyph(theme, control, control.Id, role);
  }
  theme.Text(layout.LabelX, layout.Y, Texts.AnimSpeed, 'WindowLabel');
  theme.Text(layout.ValueX + 2, layout.Y, anim.Max ? '—' : SpeedText(anim.Speed), 'WindowText', { Bold: true });
  theme.Text(layout.StatusX, layout.Y, FitText(theme, SimStatus(anim, state).Text, desktop.X + desktop.Width - layout.StatusX - 8), 'WindowText');
}

// Sündmuse kaardi tekst: „Load WP12“.
const CardLabel = event => (event.WP !== null ? `${event.Event} WP${event.WP}` : event.Event);
const EventRole = event => {
  if (event.Event === 'Collision') return 'Deadlock';   // kärud ootavad üksteist (7b)
  return ['InSys', 'Load', 'Turn', 'Process', 'MoveZ', 'StopMov', 'OutSys'].includes(event.Event)
    ? `Event${event.Event}` : 'EventOther';
};

// [U] DrawEventStrip – Event List ekraanil (kaasaegne): ajatelg alates SYSTEM_TIME-st, sündmused
//     kaartidena; lisandunud kaart libiseb kohale, töödeldu kaob vasakule. L – ahelloendi vaade.
function DrawEventStrip(theme, rect, anim, state, scene) {
  theme.Panel(rect.X, rect.Y, rect.Width, rect.Height, 'Window');
  const events = EventListArray(state.FirstAtMoment);
  const titleY = rect.Y + 2;
  theme.Text(rect.X + 10, titleY, Texts.AnimEventListTitle, 'WindowTitle', { Bold: true });
  const counts = FormatText(Texts.AnimEventCount, { Count: events.length, Processed: state.Stats.EventCount });
  theme.Text(rect.X + rect.Width - 10 - theme.TextWidth(counts), titleY, counts, 'WindowLabel');
  const now = performance.now();
  const dt = Math.min(0.1, (now - (anim.CardsPainted ?? now)) / 1000);
  anim.CardsPainted = now;
  anim.CardRects = [];
  anim.CardsMoving = false;

  const area = { X: rect.X + 10, Y: rect.Y + ROW_HEIGHT + 4, Width: rect.Width - 20, Height: rect.Height - ROW_HEIGHT - 8 };
  if (anim.Max || anim.Speed > CARDS_MAX_SPEED) {
    anim.Cards.clear();
    anim.Leaving = [];
    anim.LastEvents = events;
    theme.Text(area.X, area.Y + ROW_HEIGHT, Texts.AnimEventsHidden, 'WindowLabel');
    return;
  }
  if (anim.ListView) { DrawLinkedList(theme, area, events); anim.LastEvents = events; return; }

  const axis = { X0: area.X + 2, X1: area.X + area.Width, CardWidth: CARD_WIDTH, Gap: CARD_GAP, Rows: CARD_ROWS, Horizon: EVENT_HORIZON };
  const axisY = area.Y + 1;
  const shownTime = Math.floor(scene.Time + 0.5);   // märgid kellaajana nagu üleval (h:mm:ss)
  for (const delta of EVENT_TICKS) {
    const x = EventAxisX(delta, axis);
    theme.FillRect(x, axisY + 10, 0.5, area.Height - 10, 'StripTick');
    theme.Text(x + 2, axisY - 4, ClockText(shownTime + delta), 'WindowLabel', { Size: 7, Bold: delta === 0 });
  }
  const cardsTop = axisY + 12;
  const rowHeight = (area.Height - 12) / CARD_ROWS;
  const layout = EventCardLayout(events, scene.Time, axis);

  // lisandunud ja töödeldud kaardid
  const diff = DiffEventList(anim.LastEvents, events);
  for (const event of diff.Removed) {
    const card = anim.Cards.get(event);
    if (card) anim.Leaving.push({ ...card, Event: event });
    anim.Cards.delete(event);
  }
  anim.LastEvents = events;

  const ease = 1 - Math.exp(-dt * 12);
  theme.Clip(area.X, area.Y + 10, area.Width, area.Height - 10, () => {
    for (const column of layout.Columns) {
      for (const placed of column.Cards) {
        const targetY = cardsTop + placed.Row * rowHeight;
        let card = anim.Cards.get(placed.Event);
        if (!card) {
          card = { X: placed.X, Y: targetY - rowHeight * 0.8, Alpha: 0 };
          anim.Cards.set(placed.Event, card);
        }
        card.X += (placed.X - card.X) * ease;
        card.Y += (targetY - card.Y) * ease;
        card.Alpha += (1 - card.Alpha) * ease;
        if (Math.abs(placed.X - card.X) > 0.3 || Math.abs(targetY - card.Y) > 0.3 || card.Alpha < 0.98) anim.CardsMoving = true;
        DrawCard(theme, card, placed.Event, rowHeight, anim.HoverEvent === placed.Event);
        anim.CardRects.push({ X: card.X, Y: card.Y, Width: CARD_WIDTH, Height: rowHeight - 2, Event: placed.Event });
      }
      if (column.Extra > 0) {
        theme.Text(column.X + CARD_WIDTH - 16, cardsTop + (CARD_ROWS - 1) * rowHeight + 1, `+${column.Extra}`, 'WindowLabel', { Size: 7 });
      }
    }
    anim.Leaving = anim.Leaving.filter(card => {
      card.X -= dt * 160;
      card.Alpha -= dt * 3;
      if (card.Alpha <= 0) return false;
      anim.CardsMoving = true;
      DrawCard(theme, card, card.Event, rowHeight, false);
      return true;
    });
  });
  if (layout.Hidden > 0) {
    const text = `+${layout.Hidden}`;
    theme.Text(area.X + area.Width - theme.TextWidth(text), area.Y + area.Height - ROW_HEIGHT, text, 'WindowLabel');
  }
}

function DrawCard(theme, card, event, rowHeight, hot) {
  theme.Alpha(Math.max(0, Math.min(1, card.Alpha)), () => {
    theme.RoundRect(card.X, card.Y, CARD_WIDTH, rowHeight - 2, 3, EventRole(event));
    if (hot) theme.StrokeRect(card.X - 1, card.Y - 1, CARD_WIDTH + 2, rowHeight, 'Highlight', { Width: 1.5, Radius: 4 });
    theme.Text(card.X + 4, card.Y + (rowHeight - 2) / 2 - ROW_HEIGHT / 2, CardLabel(event), 'CardText', { Size: 7.5, Bold: true });
  });
}

// [U] DrawLinkedList – Event List ahelloendina: kastid (Event, WP, Time) ja Next-nooled
//     (nagu diplomitöö joonistel).
function DrawLinkedList(theme, area, events) {
  const boxWidth = 70;
  const boxHeight = Math.min(area.Height - 4, 3 * 11 + 6);
  const gap = 18;
  const y = area.Y + (area.Height - boxHeight) / 2;
  let x = area.X;
  theme.Text(x, y + boxHeight / 2 - ROW_HEIGHT / 2, Texts.AnimFirstAtMoment, 'WindowLabel', { Mono: true, Size: 8 });
  x += theme.TextWidth(Texts.AnimFirstAtMoment, { Mono: true, Size: 8 }) + 4;
  const arrow = (fromX) => {
    const arrowY = y + boxHeight / 2;
    theme.Line(fromX, arrowY, fromX + gap - 4, arrowY, 'StripArrow', { Width: 1 });
    theme.Polygon([{ X: fromX + gap - 1, Y: arrowY }, { X: fromX + gap - 6, Y: arrowY - 3 }, { X: fromX + gap - 6, Y: arrowY + 3 }], 'StripArrow');
  };
  arrow(x);
  x += gap;
  for (const [index, event] of events.entries()) {
    if (x + boxWidth + gap + 30 > area.X + area.Width && index < events.length) {
      theme.Text(x, y + boxHeight / 2 - ROW_HEIGHT / 2, FormatText(Texts.AnimListMore, { Count: events.length - index }), 'WindowLabel');
      return;
    }
    theme.RoundRect(x, y, boxWidth, boxHeight, 2, 'Window');
    theme.StrokeRect(x, y, boxWidth, boxHeight, EventRole(event), { Width: 1.5, Radius: 2 });
    theme.FillRect(x, y, 3, boxHeight, EventRole(event));
    const lines = [event.Event, event.WP !== null ? `WP ${event.WP}` : 'WP –', `Time ${ClockText(event.Time)}`];
    lines.forEach((line, i) => theme.Text(x + 7, y + 2 + i * 11 - 1.5, line, i === 0 ? 'WindowText' : 'WindowLabel', { Mono: true, Size: 8, Bold: i === 0 }));
    x += boxWidth;
    arrow(x);
    x += gap;
  }
  theme.Text(x, y + boxHeight / 2 - ROW_HEIGHT / 2, Texts.AnimNil, 'WindowLabel', { Mono: true, Size: 8 });
}

// [U] AnimatorPainter – töölaua joonistaja animaatori ajal (windows.js DesktopView).
function AnimatorPainter(theme, desktop) {
  const anim = AnimState;
  if (!anim) return;
  anim.Theme = theme;
  const state = SimState();
  const scene = BuildScene(anim, state);
  const modern = theme.Name !== 'EGA';
  let layoutRect;
  if (modern) {
    DrawControlBar(theme, desktop, anim, state);
    const stripRect = { X: desktop.X + 8, Y: desktop.Y + desktop.Height - STRIP_HEIGHT - 6, Width: desktop.Width - 16, Height: STRIP_HEIGHT };
    const panel = { X: desktop.X + 8, Y: desktop.Y + BAR_HEIGHT + 2, Width: desktop.Width - 16, Height: stripRect.Y - desktop.Y - BAR_HEIGHT - 8 };
    theme.Panel(panel.X, panel.Y, panel.Width, panel.Height, 'Window');
    theme.RoundRect(panel.X + 1, panel.Y + 1, panel.Width - 2, panel.Height - 2, 5, 'LayoutBack');
    layoutRect = { X: panel.X + 12, Y: panel.Y + 10, Width: panel.Width - 24, Height: panel.Height - 20 };
    DrawEventStrip(theme, stripRect, anim, state, scene);
  } else {
    const rows = EgaStatusRows(theme, SimStatus(anim, state), desktop.Width - 16);
    const statusHeight = rows.length * ROW_HEIGHT;
    theme.FillRect(desktop.X, desktop.Y, desktop.Width, statusHeight, 'SimStatusBar');
    rows.forEach((row, index) => theme.Text(desktop.X + 8, desktop.Y + index * ROW_HEIGHT, row, 'SimStatusText'));
    layoutRect = { X: desktop.X, Y: desktop.Y + statusHeight, Width: desktop.Width, Height: desktop.Height - statusHeight };
    theme.FillRect(layoutRect.X, layoutRect.Y, layoutRect.Width, layoutRect.Height, 'LayoutBack');
  }
  const view = LayoutView(theme, layoutRect, anim.Model.Layout.Dim);
  anim.View = view;
  if (anim.Max && anim.Running && !state.SIMULATION_DONE) {
    CenterText(theme, view, layoutRect.X + layoutRect.Width / 2, layoutRect.Y + layoutRect.Height / 2,
      Texts.AnimMaxRunning, 'LayoutLabel', { Size: 10 });
    return;
  }
  Animator(theme, view, anim, state, scene);
}

// =====================================================================
// Juhtimine
// =====================================================================

// Üks simulatsiooni sekund; konveieri eelmine nihe jääb meelde sujuva liikumise jaoks.
function StepSimulation(anim) {
  anim.PrevOffsets = SimState().Tracks.map(track => track.Offset);
  anim.PrevCarts = CartPositions();
  SimStep();
}

// [U] CartPositions – diskreetsete radade kärude asukohad (eelmine sekund sujuvaks liikumiseks).
function CartPositions() {
  return SimState().Tracks.map(track => (track.Discrete ? track.Pallets.map(CartPosition) : null));
}

// [U] AdvanceSimulation – kaadri jagu simulatsiooni: kiirus × möödunud aeg (time mapping).
function AdvanceSimulation(anim, dt) {
  if (anim.Max) {
    const deadline = performance.now() + MAX_MODE_BUDGET_MS;
    do StepSimulation(anim); while (!SimState().SIMULATION_DONE && performance.now() < deadline);
    anim.Fraction = 1;
    anim.Accumulator = 0;
    return;
  }
  anim.Accumulator += dt * anim.Speed;
  const steps = Math.min(MAX_STEPS_PER_FRAME, Math.floor(anim.Accumulator));
  anim.Accumulator -= Math.floor(anim.Accumulator);
  for (let i = 0; i < steps && !SimState().SIMULATION_DONE; i++) StepSimulation(anim);
  anim.Fraction = SimState().SIMULATION_DONE ? 1 : anim.Accumulator;
}

// Simulatsioon jõudis lõppu (aeg täis või ummik): paus ja kokkuvõte.
function CheckFinished(anim) {
  if (anim.Finished || !SimState().SIMULATION_DONE) return;
  anim.Finished = true;
  anim.Running = false;
  anim.Max = false;
  anim.Fraction = 1;
  anim.OnSummary(SimReport(), null);
}

// [U] AnimatorFrame – üks kaader: simulatsioon edasi, kaardid, joonistamine.
function AnimatorFrame(now) {
  const anim = AnimState;
  if (!anim) return;
  anim.FrameRequest = 0;
  const dt = Math.min(0.25, Math.max(0, (now - anim.LastFrame) / 1000));
  anim.LastFrame = now;
  if (anim.Running) AdvanceSimulation(anim, dt);
  else if (anim.Fraction < 1) anim.Fraction = Math.min(1, anim.Fraction + dt * CATCH_UP_RATE);
  CheckFinished(anim);
  RequestRedraw();
  if (anim.Running || anim.Fraction < 1 || anim.CardsMoving) ScheduleFrame(anim);
}

function ScheduleFrame(anim) {
  if (anim.FrameRequest) return;
  anim.FrameRequest = requestAnimationFrame(AnimatorFrame);
}

// Pärast kasutaja tegevust: järgmine kaader (aeg mõõdetakse sellest hetkest).
function WakeAnimator(anim) {
  if (!anim.FrameRequest) anim.LastFrame = performance.now();
  ScheduleFrame(anim);
  RequestRedraw();
}

function ToggleRun(anim) {
  if (anim.Finished) return;
  anim.Running = !anim.Running;
  // nähtav aeg on SYSTEM_TIME - 1 + Fraction: jätkame samast kohast
  if (anim.Running) anim.Accumulator = anim.Fraction;
  WakeAnimator(anim);
}

function StepOnce(anim) {
  if (anim.Finished) return;
  anim.Running = false;
  StepSimulation(anim);
  anim.Fraction = 0;
  anim.Accumulator = 0;
  CheckFinished(anim);
  WakeAnimator(anim);
}

// [U] NextEvent – sammhaaval kuni järgmise sündmuse töötlemiseni.
function NextEvent(anim) {
  if (anim.Finished) return;
  anim.Running = false;
  const count = SimState().Stats.EventCount;
  for (let i = 0; i < NEXT_EVENT_LIMIT; i++) {
    StepSimulation(anim);
    const state = SimState();
    if (state.SIMULATION_DONE || state.Stats.EventCount > count) break;
  }
  anim.Fraction = 0;
  anim.Accumulator = 0;
  CheckFinished(anim);
  WakeAnimator(anim);
}

function SetSpeed(anim, speed) {
  anim.Speed = Math.min(MAX_SPEED, Math.max(1, speed));
  WakeAnimator(anim);
}

function ToggleMax(anim) {
  if (anim.Finished) return;
  anim.Max = !anim.Max;
  if (anim.Max) anim.Running = true;
  anim.Accumulator = 1;   // pilt on praeguse sekundi lõpus (Fraction = 1)
  anim.Fraction = 1;
  anim.PrevOffsets = SimState().Tracks.map(track => track.Offset);
  WakeAnimator(anim);
}

// Lõpp (Esc, ⏹): kokkuvõte ja tagasi töölauale. Kui kokkuvõte on juba näidatud, kohe tagasi.
function StopRun(anim) {
  if (anim.Finished) { ExitAnimator(); return; }
  anim.Running = false;
  anim.Finished = true;
  RequestRedraw();
  anim.OnSummary(SimReport(), ExitAnimator);
}

function ExitAnimator() {
  const anim = AnimState;
  StopAnimator();
  if (anim && anim.OnExit) anim.OnExit();
}

// [U] AnimatorKey – klahvid: Space, + / −, ., N, M, L, Esc. Tagastab, kas klahv kasutati.
function AnimatorKey(anim, name) {
  switch (name) {
    case ' ': ToggleRun(anim); return true;
    case '+': case '=': SetSpeed(anim, NextSpeed(anim.Speed, 1)); return true;
    case '-': case '−': SetSpeed(anim, NextSpeed(anim.Speed, -1)); return true;
    case '.': case ',': StepOnce(anim); return true;
    case 'n': case 'N': NextEvent(anim); return true;
    case 'm': case 'M': ToggleMax(anim); return true;
    case 'l': case 'L': anim.ListView = !anim.ListView; anim.HoverEvent = null; WakeAnimator(anim); return true;
    case 'Escape': StopRun(anim); return true;
    default: return false;
  }
}

const Inside = (rect, point) => point.X >= rect.X && point.X < rect.X + rect.Width && point.Y >= rect.Y && point.Y < rect.Y + rect.Height;

function SliderValueAt(control, x) {
  return (x - control.X) / control.Width;
}

// [U] AnimatorInput – klahvid ja hiir töölaual (windows.js DesktopView.Input).
//     Tagastab true (kasutatud), 'capture' (lohistamine algas) või false.
function AnimatorInput(input) {
  const anim = AnimState;
  if (!anim) return false;
  if (input.Kind === 'key') return AnimatorKey(anim, input.Name);
  if (!anim.Theme || anim.Theme.Name === 'EGA') return false;
  const control = anim.Controls.find(candidate => Inside(candidate, input.Point)) ?? null;
  switch (input.Kind) {
    case 'down':
      if (!control) return false;
      switch (control.Id) {
        case 'Run': ToggleRun(anim); break;
        case 'Step': StepOnce(anim); break;
        case 'Next': NextEvent(anim); break;
        case 'Stop': StopRun(anim); break;
        case 'Max': ToggleMax(anim); break;
        case 'Speed':
          anim.DragSlider = true;
          SetSpeed(anim, SpeedFromSlider(SliderValueAt(control, input.Point.X)));
          return 'capture';
        default: break;
      }
      return true;
    case 'move': {
      if (anim.DragSlider) {
        const slider = anim.Controls.find(candidate => candidate.Id === 'Speed');
        SetSpeed(anim, SpeedFromSlider(SliderValueAt(slider, input.Point.X)));
        return true;
      }
      const card = anim.CardRects.find(candidate => Inside(candidate, input.Point));
      const hoverEvent = card ? card.Event : null;
      const hoverControl = control ? control.Id : null;
      if (hoverEvent !== anim.HoverEvent || hoverControl !== anim.HoverControl) {
        anim.HoverEvent = hoverEvent;
        anim.HoverControl = hoverControl;
        RequestRedraw();
      }
      return true;
    }
    case 'up':
      anim.DragSlider = false;
      RequestRedraw();
      return true;
    case 'wheel':
      if (!control || control.Id !== 'Speed') return false;
      SetSpeed(anim, SpeedFromSlider(SliderFromSpeed(anim.Speed) - Math.sign(input.Delta) * 0.04));
      return true;
    default:
      return false;
  }
}

// [U] AnimatorHint – olekurea vihje: nupp hiire all või Event Listi kaart.
function AnimatorHint() {
  const anim = AnimState;
  if (!anim) return '';
  if (anim.HoverEvent) {
    const event = anim.HoverEvent;
    return FormatText(Texts.AnimEventHint, {
      Label: CardLabel(event), Time: ClockText(event.Time), Delta: Math.max(0, event.Time - SimState().SYSTEM_TIME),
    });
  }
  const control = anim.Controls.find(candidate => candidate.Id === anim.HoverControl);
  return control ? control.Hint : '';
}

function AnimatorStatusKeys(theme) {
  return theme.Name === 'EGA' ? Texts.AnimStatusKeysEga : Texts.AnimStatusKeys;
}

// [U] StartAnimator – avab animaatori: SimInit, töölaual animaatori vaade (pausil).
//     options: Model (mudelifail – joonis), Network (Enumerate tulemus), OnSummary(aruanne, onClose),
//     OnExit(). Kutsub: fms.js (Simulate).
export function StartAnimator({ Model: model, Network: network, OnSummary: onSummary, OnExit: onExit = null }) {
  StopAnimator();
  SimInit(network);
  const stationCell = kind => network.Stations.find(station => station.Kind === kind)?.Cell ?? null;
  AnimState = {
    Model: model, Network: network, OnSummary: onSummary, OnExit: onExit,
    Geometry: network.Tracks.map((track, trackIndex) => (track.Mode === 'Discrete' ? null : TrackGeometry(network, trackIndex))),
    MachineIndex: new Map(network.Machines.map((machine, machineIndex) => [`${machine.Cell.X},${machine.Cell.Y}`, machineIndex])),
    TrackIndex: new Map(network.Tracks.map((track, trackIndex) => [track.ModelIndex, trackIndex])),   // mudeli rada -> võrgu rada
    StationCells: { FromCS: stationCell('FromCS'), ToCS: stationCell('ToCS'), SysOut: stationCell('SysOut') },
    Running: false, Max: false, Finished: false, Speed: DEFAULT_SPEED,
    Accumulator: 0, Fraction: 1, PrevOffsets: SimState().Tracks.map(track => track.Offset), PrevCarts: CartPositions(),
    FrameRequest: 0, LastFrame: 0,
    Theme: null, View: null, Controls: [], DragSlider: false, HoverControl: null, HoverEvent: null,
    Cards: new Map(), Leaving: [], LastEvents: [], CardRects: [], CardsMoving: false, CardsPainted: null, ListView: false,
  };
  SetDesktopView({ Painter: AnimatorPainter, Input: AnimatorInput, StatusKeys: AnimatorStatusKeys, StatusHint: AnimatorHint });
}

// [U] StopAnimator – sulgeb animaatori (töölaud tagasi). Kutsub: fms.js (uus mudel), ExitAnimator.
export function StopAnimator() {
  if (!AnimState) return;
  if (AnimState.FrameRequest) cancelAnimationFrame(AnimState.FrameRequest);
  AnimState = null;
  SetDesktopView(null);
}

// [U] AnimatorActive – kas animaator on avatud.
export function AnimatorActive() {
  return AnimState !== null;
}
