// FMSS – avaldamine (etapp 10): näidiste nimekiri (models/index.json), näidismudelid ja
// saidi failid. Käivitamine: npm test. VALIDEERIMINE.md etapp 10.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { CheckModel } from '../src/fms_glb.js';
import { ParseDemoList, ParseModelText, DemoModels } from '../src/fms_file.js';
import { Enumerate, SimRun } from '../src/fms_sim.js';

const ROOT = new URL('../', import.meta.url);
const Read = path => readFileSync(new URL(path, ROOT), 'utf8');
const demoList = ParseDemoList(Read('models/index.json'));

test('L1 models/index.json: iga kirje on õige ja iga mudelifail on nimekirjas', () => {
  const raw = JSON.parse(Read('models/index.json'));
  assert.equal(demoList.length, raw.length, 'vigaseid kirjeid pole');
  const files = readdirSync(new URL('models/', ROOT)).filter(name => name.endsWith('.fms.json')).sort();
  assert.deepEqual(demoList.map(entry => entry.File).sort(), files);
  assert.equal(new Set(demoList.map(entry => entry.Name)).size, demoList.length, 'nimed on erinevad');
  assert.equal(demoList[0].File, 'demo.fms.json', 'esimene näidis avaneb käivitamisel');
});

test('L2 varunimekiri (DemoModels) on index.json-i osa', () => {
  for (const entry of DemoModels) assert.ok(demoList.some(demo => demo.File === entry.File), entry.File);
});

test('L3 ParseDemoList jätab vigased kirjed välja', () => {
  assert.deepEqual(ParseDemoList('ei ole json'), []);
  assert.deepEqual(ParseDemoList('{"File":"a.fms.json"}'), []);
  const list = ParseDemoList(JSON.stringify([
    { File: 'hea.fms.json', Name: ' Hea ' },
    { File: '../src/fms.js', Name: 'kaustast välja' },
    { File: 'sub/x.fms.json', Name: 'alamkaust' },
    { File: 'x.json', Name: 'vale laiend' },
    { File: 'nimeta.fms.json', Name: '' },
    null,
  ]));
  assert.deepEqual(list, [{ File: 'hea.fms.json', Name: 'Hea' }]);
});

for (const demo of demoList) {
  test(`L4 ${demo.Name}: laadib, jookseb 8 h invariantidega ilma ummikuta`, () => {
    const text = Read(`models/${demo.File}`);
    const { Model: model, Errors: errors } = ParseModelText(text, demo.File);
    assert.deepEqual(errors, []);
    assert.deepEqual(CheckModel(model), []);
    const { Network: network, Errors: enumErrors } = Enumerate(model);
    assert.deepEqual(enumErrors, []);
    const report = SimRun(network, { CheckInvariants: true });
    assert.equal(report.Deadlock, false, report.DeadlockReason);
    assert.equal(report.Time, model.Sim.Duration);
    assert.ok(report.Completed > 0);
  });
}

test('L5 riketega näidis: rikkeid ja praaki tekib', () => {
  const { Network: network } = Enumerate(JSON.parse(Read('models/rike.fms.json')));
  const report = SimRun(network, {});
  assert.ok(report.Crashes > 0 && report.Scrapped > 0, `rikkeid ${report.Crashes}, praak ${report.Scrapped}`);
});

test('L6 rakendus kasutab ainult suhtelisi teid (töötab alamkaustas /v1/)', () => {
  const html = Read('index.html');
  assert.match(html, /<script type="module" src="src\/fms\.js"><\/script>/);
  for (const name of readdirSync(new URL('src/', ROOT))) {
    const source = Read(`src/${name}`);
    for (const match of source.matchAll(/(?:from\s+|import\(\s*|fetch\(\s*|new URL\(\s*)(['"`])([^'"`]+)\1/g)) {
      const path = match[2];
      assert.ok(!path.startsWith('/') && !/^[a-z]+:/i.test(path), `${name}: absoluutne tee ${path}`);
    }
  }
});
