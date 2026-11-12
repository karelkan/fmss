// FMSS – andmemudeli ja tekstide testid (etapp 3).
// Käivitamine: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CheckModel, EmptyModel, IconTypes, MAX_WORKPIECE_TYPES } from '../src/fms_glb.js';
import { ParseModelText, ModelFileName } from '../src/fms_file.js';
import { Texts, FormatText } from '../src/fms_lng.js';

const ROOT = new URL('../', import.meta.url);
const demoText = readFileSync(new URL('models/demo.fms.json', ROOT), 'utf8');
const demo = () => JSON.parse(demoText);

// Kontrollib, et mudelis on viga antud kohas.
function assertError(model, path) {
  const errors = CheckModel(model);
  assert.ok(errors.some((error) => error.Path === path),
    `oodatud viga kohas ${path}, saadi: ${JSON.stringify(errors)}`);
}

test('näidismudel läbib kontrolli', () => {
  assert.deepEqual(CheckModel(demo()), []);
});

test('tühi mudel (File → New) läbib kontrolli', () => {
  assert.deepEqual(CheckModel(EmptyModel('Uus')), []);
});

test('näidismudel kasutab ainult originaali ikoone (joon. 5.4)', () => {
  assert.equal(Object.keys(IconTypes).length, 25);
  for (const cell of demo().Layout.Cells) assert.ok(cell.T in IconTypes, cell.T);
});

test('puuduvad ja vale tüübiga väljad leitakse', () => {
  const model = demo();
  delete model.Tracks[0].Speed;
  model.Machines[1].SetupTime = 'palju';
  assertError(model, 'Tracks[1].Speed');
  assertError(model, 'Machines[2].SetupTime');
});

test('lubamatud väärtused leitakse', () => {
  const model = demo();
  model.Tracks[0].Mode = 'Teleport';
  model.Buffers[0].Discipline = 'LIFO';
  model.Buffers[1].Capacity = 0;
  model.Sim.Kl = 1.5;
  model.Workpieces[0].Routes[0].Ops[0].Dev = 999;
  assertError(model, 'Tracks[1].Mode');
  assertError(model, 'Buffers[1].Discipline');
  assertError(model, 'Buffers[2].Capacity');
  assertError(model, 'Sim.Kl');
  assertError(model, 'Workpieces[1].Routes[1].Ops[1].Dev');
});

test('lahtrid: ruudustikust väljas, topelt, vale ikoon, puuduv objekt', () => {
  const model = demo();
  model.Layout.Cells.push({ X: 20, Y: 0, T: 'HorTr', N: 1 });
  model.Layout.Cells.push({ X: 3, Y: 0, T: 'HorTr', N: 1 });
  model.Layout.Cells.push({ X: 0, Y: 6, T: 'Teleporter' });
  model.Layout.Cells.push({ X: 0, Y: 5, T: 'MachToolUp', N: 3 });
  const count = model.Layout.Cells.length;
  assertError(model, `Layout.Cells[${count - 3}]`);
  assertError(model, `Layout.Cells[${count - 2}]`);
  assertError(model, `Layout.Cells[${count - 1}].T`);
  assertError(model, `Layout.Cells[${count}].N`);
});

test('operatsioon, mida ükski pink ei tee, leitakse', () => {
  const model = demo();
  model.Workpieces[1].Routes[0].Ops[0].Op = 'lihvimine';
  assertError(model, 'Workpieces[2].Routes[1].Ops[1].Op');
});

test(`detailitüüpe kõige rohkem ${MAX_WORKPIECE_TYPES}`, () => {
  const model = demo();
  while (model.Workpieces.length <= MAX_WORKPIECE_TYPES) model.Workpieces.push(model.Workpieces[0]);
  assertError(model, 'Workpieces');
});

test('ParseModelText: vigane JSON ja vigane mudel annavad loetava teate', () => {
  const broken = ParseModelText('{ "Meta": ', 'katki.fms.json');
  assert.equal(broken.Model, null);
  assert.match(broken.Errors[0], /katki\.fms\.json/);

  const wrong = ParseModelText('{}', 'tühi.fms.json');
  assert.equal(wrong.Model, null);
  assert.ok(wrong.Errors.length > 1);

  const good = ParseModelText(demoText, 'demo.fms.json');
  assert.deepEqual(good.Errors, []);
  assert.equal(good.Model.Meta.Name, 'Näidis-PTS');
});

test('ModelFileName teeb nimest failinime', () => {
  assert.equal(ModelFileName('Näidis PTS'), 'Näidis_PTS.fms.json');
  assert.equal(ModelFileName('  '), `${Texts.DesktopUntitled}.fms.json`);
  assert.equal(ModelFileName('a/b:c'), 'abc.fms.json');
});

test('FormatText asendab kohatäited', () => {
  assert.equal(FormatText('{What} tuleb etapis {Stage}.', { What: 'Layout', Stage: 6 }), 'Layout tuleb etapis 6.');
  assert.equal(FormatText('{Puudub}', {}), '{Puudub}');
});

test('kõik koodis kasutatud tekstid on fms_lng.js-is olemas', () => {
  const sourceDir = new URL('src/', ROOT);
  const used = new Set();
  for (const file of readdirSync(sourceDir)) {
    const source = readFileSync(new URL(file, sourceDir), 'utf8');
    for (const match of source.matchAll(/Texts\.(\w+)/g)) used.add(match[1]);
  }
  const missing = [...used].filter((key) => !(key in Texts));
  assert.deepEqual(missing, []);
});
