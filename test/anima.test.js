// FMSS – animaatori testid (etapp 5): raja geomeetria, detailide kohad, Event List, kiirus.
// Käivitamine: npm test
// Animaator ei tohi simulatsiooni mõjutada: samm-sammult koos olekut lugedes peab aruanne
// olema sama mis SimRun-iga.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Enumerate, SimInit, SimStep, SimState, SimReport, SimRun } from '../src/fms_sim.js';
import {
  TrackGeometry, TrackPoint, CellPathPoint, PalletPosition, InterpolateOffset, WorkpiecePlaces,
  EventListArray, DiffEventList, EventCardLayout, EventAxisX, SpeedFromSlider, SliderFromSpeed,
  NextSpeed, SpeedText, SPEED_STEPS,
} from '../src/anima.js';
import { IconTypes } from '../src/fms_glb.js';

const ROOT = new URL('../', import.meta.url);
const demoText = readFileSync(new URL('models/demo.fms.json', ROOT), 'utf8');
const demo = () => JSON.parse(demoText);
const EPSILON = 1e-6;

function NetworkOf(model) {
  const result = Enumerate(model);
  assert.deepEqual(result.Errors, []);
  return result.Network;
}

// Demomudel, kus ülemise rea pinkide vaheline lõik on metrokaardi pikkusega (eri tegur
// hargnemise kahel poolel).
function StretchedDemo() {
  const model = demo();
  model.EdgeLengths = [{ Cells: [[4, 3], [5, 3], [6, 3]], Length: 1000 }];
  return model;
}

const distance = (a, b) => Math.hypot(a.X - b.X, a.Y - b.Y);

for (const [name, makeModel] of [['näidismudel', demo], ['metrokaardi lõiguga', StretchedDemo]]) {
  test(`TrackPoint (${name}): jaam on hargnemisikooni keskel`, () => {
    const network = NetworkOf(makeModel());
    const geometry = TrackGeometry(network);
    for (const station of network.Stations) {
      const point = TrackPoint(geometry, station.Position);
      assert.ok(distance(point, { X: station.Junction.X + 0.5, Y: station.Junction.Y + 0.5 }) < 1e-3,
        `${station.Name}: ${JSON.stringify(point)} ≠ lahtri (${station.Junction.X}, ${station.Junction.Y}) keskpunkt`);
    }
  });

  test(`TrackPoint (${name}): liikumine on pidev ja ring sulgub`, () => {
    const network = NetworkOf(makeModel());
    const geometry = TrackGeometry(network);
    const samples = 20000;
    let previous = TrackPoint(geometry, 0);
    for (let i = 1; i <= samples; i++) {
      const point = TrackPoint(geometry, geometry.Length * i / samples);
      // samm on ≤ 0,3 cm; kõige kokkusurutumal lõigul (100 cm ikoon) on see ≤ 0,003 ikooni
      assert.ok(distance(previous, point) < 0.01, `hüpe asukohas ${(geometry.Length * i / samples).toFixed(2)} cm`);
      previous = point;
    }
    assert.ok(distance(TrackPoint(geometry, 0), TrackPoint(geometry, geometry.Length)) < EPSILON);
  });
}

test('TrackPoint: punkt on alati raja joonel (sirgel külgede vahel, kaarel raadiusega 1/2)', () => {
  const geometry = TrackGeometry(NetworkOf(demo()));
  for (const cell of geometry.Cells) {
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      const point = CellPathPoint(cell, fraction);
      if (IconTypes[cell.T].Arc) {
        const corner = { X: cell.X + (cell.Entry === 'E' || cell.Exit === 'E' ? 1 : 0),
                         Y: cell.Y + (cell.Entry === 'S' || cell.Exit === 'S' ? 1 : 0) };
        assert.ok(Math.abs(distance(point, corner) - 0.5) < EPSILON, `kaar ${cell.T} (${cell.X}, ${cell.Y})`);
      } else {
        assert.ok(point.X >= cell.X - EPSILON && point.X <= cell.X + 1 + EPSILON);
        assert.ok(point.Y >= cell.Y - EPSILON && point.Y <= cell.Y + 1 + EPSILON);
      }
    }
    // ikooni algus ja lõpp on sisenemis- ja väljumiskülje keskpunktid
    const ports = { N: [0.5, 0], E: [1, 0.5], S: [0.5, 1], W: [0, 0.5] };
    const port = side => ({ X: cell.X + ports[side][0], Y: cell.Y + ports[side][1] });
    assert.ok(distance(CellPathPoint(cell, 0), port(cell.Entry)) < EPSILON);
    assert.ok(distance(CellPathPoint(cell, 1), port(cell.Exit)) < EPSILON);
  }
});

test('aluse asukoht ja sujuv liikumine (ka üle nullpunkti)', () => {
  const track = { Length: 1000, Carts: 4 };
  assert.equal(PalletPosition(track, 0, 0), 0);
  assert.equal(PalletPosition(track, 3, 900), 650);
  assert.equal(InterpolateOffset(100, 120, 1000, 0.5), 110);
  assert.equal(InterpolateOffset(990, 10, 1000, 0.5), 0);         // üle nullpunkti edasi, mitte tagasi
  assert.equal(InterpolateOffset(500, 500, 1000, 0.7), 500);       // seisev konveier
});

test('animaator ei mõjuta simulatsiooni; iga detail on igal sekundil täpselt ühes kohas', () => {
  const network = NetworkOf(demo());
  network.Sim.Duration = 4 * 3600;
  const expected = SimRun(network);

  SimInit(network);
  let previousEvents = [];
  let moving = 0;
  let checkedSeconds = 0;
  while (!SimState().SIMULATION_DONE) {
    SimStep();
    const state = SimState();
    const places = WorkpiecePlaces(state);
    const inSystem = state.SysWPArray.filter(workpiece => !['Gone', 'Entering'].includes(workpiece.Location.Kind));
    assert.equal(places.length, inSystem.length, `t=${state.SYSTEM_TIME}: detailide arv`);
    assert.equal(new Set(places.map(place => place.WP.Id)).size, places.length, `t=${state.SYSTEM_TIME}: detail kaks korda`);
    for (const place of places) {
      if (place.WP.State === 'LOADING') {
        assert.equal(place.Kind, 'Moving', `t=${state.SYSTEM_TIME}: WP${place.WP.Id} laadimisel, aga Load puudub`);
        assert.ok(place.From && place.To && place.Until >= state.SYSTEM_TIME && place.Since <= state.SYSTEM_TIME);
        moving++;
      }
      if (place.Kind === 'Pallet') {
        assert.equal(state.Tracks[place.Track].Pallets[place.Pal].WP, place.WP.Id);
      }
      if (place.Kind === 'Buffer') assert.ok(place.Slot >= 0 && place.Slot < network.Buffers[place.Index].Capacity);
    }
    // Event Listi võrdlus: lisandunud on uued kirjed, kadunud ei ole enam listis
    const events = EventListArray(state.FirstAtMoment);
    const diff = DiffEventList(previousEvents, events);
    assert.equal(previousEvents.length + diff.Added.length - diff.Removed.length, events.length);
    for (let i = 1; i < events.length; i++) assert.ok(events[i - 1].Time <= events[i].Time);
    previousEvents = events;
    checkedSeconds++;
  }
  assert.ok(moving > 1000, 'laadimisi oli vähe – test ei kontrolli liikumist');
  assert.equal(checkedSeconds, 4 * 3600);
  assert.deepEqual(SimReport(), expected);
});

test('Event List kaardid: aja järjekorras, sama aeg ühes veerus, ei kattu', () => {
  const event = (Event, Time, WP = null) => ({ Event, Time, WP, Next: null });
  const events = [event('Load', 12, 1), event('Turn', 12, 2), event('Load', 12, 3), event('Load', 12, 4),
                  event('Process', 13, 5), event('Process', 300, 6), event('InSys', 5000, 7)];
  const axis = { X0: 0, X1: 400, CardWidth: 60, Gap: 4, Rows: 3, Horizon: 3600 };
  const layout = EventCardLayout(events, 10, axis);
  const columns = layout.Columns;
  assert.deepEqual(columns.map(column => column.Time), [12, 13, 300, 5000].slice(0, columns.length));
  assert.deepEqual(columns[0].Cards.map(card => card.Event.WP), [1, 2, 3]);   // FIFO, 3 rida
  assert.equal(columns[0].Extra, 1);
  for (let i = 1; i < columns.length; i++) assert.ok(columns[i].X >= columns[i - 1].X + axis.CardWidth + axis.Gap - EPSILON);
  for (const column of columns) assert.ok(column.X + axis.CardWidth <= axis.X1 + EPSILON);
  const shown = columns.reduce((sum, column) => sum + column.Cards.length + column.Extra, 0);
  assert.equal(shown + layout.Hidden, events.length);
  // ajatelg: kaugem sündmus on paremal, kaugemal kui horisont – serval
  assert.ok(EventAxisX(10, axis) < EventAxisX(100, axis));
  assert.equal(EventAxisX(99999, axis), axis.X1 - axis.CardWidth);
});

test('DiffEventList leiab lisandunud ja töödeldud kirjed viite järgi', () => {
  const a = { Event: 'Load', Time: 5, Next: null };
  const b = { Event: 'Turn', Time: 7, Next: null };
  const c = { Event: 'Process', Time: 9, Next: null };
  a.Next = b;
  assert.deepEqual(EventListArray(a), [a, b]);
  const diff = DiffEventList([a, b], [b, c]);
  assert.deepEqual(diff.Added, [c]);
  assert.deepEqual(diff.Removed, [a]);
});

test('kiiruse skaala: ×1 … ×1000, liugur ja klahvid', () => {
  assert.equal(SpeedFromSlider(0), 1);
  assert.ok(Math.abs(SpeedFromSlider(1) - 1000) < EPSILON);
  for (const speed of SPEED_STEPS) assert.ok(Math.abs(SpeedFromSlider(SliderFromSpeed(speed)) - speed) < 1e-6);
  assert.equal(NextSpeed(10, 1), 20);
  assert.equal(NextSpeed(10, -1), 5);
  assert.equal(NextSpeed(1000, 1), 1000);
  assert.equal(NextSpeed(1, -1), 1);
  assert.equal(NextSpeed(37, 1), 50);    // liugurilt saadud kiirus → järgmine samm
  assert.equal(SpeedText(2.5), '×2,5');
  assert.equal(SpeedText(316.2), '×316');
});
