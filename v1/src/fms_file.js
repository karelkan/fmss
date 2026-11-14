// FMSS – failifunktsioonid: mudeli laadimine, salvestamine, viimati kasutatud mudelid.
// Vastab originaali moodulile FMS_FILE.PAS. Mudelifaili vorming: DISAIN.md osa 8 (*.fms.json).
//
// Brauseris pole failisüsteemi: Load loeb näidismudeli serverist või faili kasutaja arvutist,
// Save laadib faili alla. Pick (10 viimast) hoitakse brauseri mälus.
// ParseModelText ja ModelFileName ei kasuta brauserit (testitavad Node'iga).

import { CheckModel } from '../core/fms_glb.js';
import { Texts, FormatText } from '../core/fms_lng.js';

const RECENT_KEY = 'fmss.recent';
const MAX_RECENT = 10;            // [O] Pick – 10 viimast (joon. 6.1)
const MAX_SHOWN_ERRORS = 8;
const MODEL_EXTENSION = '.fms.json';

// [U] DemoModels – programmiga kaasas olevad näidismudelid (kaust models/). Nimekiri tuleb
//     failist models/index.json (LoadDemoList), et näidiseid saaks lisada koodi muutmata;
//     siin on varunimekiri, kui faili ei saa lugeda. Massiivi sisu asendatakse, viide jääb samaks.
export const DemoModels = [
  { File: 'demo.fms.json', Name: 'Näidis-PTS (joon. 5.5)' },
  { File: 'agv.fms.json', Name: 'Näidis-AGV (diskreetne rada)' },
];

const DEMO_LIST_FILE = 'index.json';
const DEMO_FILE_PATTERN = /^[A-Za-z0-9_-]+\.fms\.json$/;

// [U] ParseDemoList – näidiste nimekirja (models/index.json) sisust [{ File, Name }].
//     Vigased kirjed jäetakse välja (failinimi ainult kujul nimi.fms.json – kaustast välja ei pääse).
//     Kutsub: LoadDemoList, testid.
export function ParseDemoList(text) {
  let list;
  try { list = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(list)) return [];
  return list
    .filter((entry) => entry && typeof entry.File === 'string' && DEMO_FILE_PATTERN.test(entry.File)
      && typeof entry.Name === 'string' && entry.Name.trim() !== '')
    .map((entry) => ({ File: entry.File, Name: entry.Name.trim() }));
}

// [U] LoadDemoList – loeb näidiste nimekirja serverist ja asendab DemoModels-i sisu.
//     Kui faili pole või see on tühi, jääb varunimekiri. onDone() kutsutakse alati. Kutsub: Main.
export function LoadDemoList(onDone) {
  fetch(new URL(`../models/${DEMO_LIST_FILE}`, import.meta.url), { cache: 'no-cache' })
    .then((response) => { if (!response.ok) throw new Error(response.statusText); return response.text(); })
    .then((text) => {
      const list = ParseDemoList(text);
      if (list.length > 0) DemoModels.splice(0, DemoModels.length, ...list);
    })
    .catch(() => {})
    .finally(() => onDone());
}

// [U] ParseModelText – teeb failisisust mudeli ja kontrollib seda (CheckModel).
//     Tagastab { Model, Errors }: Errors on kasutajale näidatavad read; kui need on, Model = null.
//     Kutsub: LoadDemoModel, ChooseLocalFile, Pick, testid.
export function ParseModelText(text, fileName) {
  let model;
  try {
    model = JSON.parse(text);
  } catch (error) {
    return { Model: null, Errors: [FormatText(Texts.LoadErrorJson, { File: fileName, Detail: error.message })] };
  }
  const problems = CheckModel(model);
  if (problems.length === 0) return { Model: model, Errors: [] };
  const lines = [FormatText(Texts.LoadErrorModel, { File: fileName })];
  problems.slice(0, MAX_SHOWN_ERRORS).forEach((problem) => lines.push(`  ${problem.Path}: ${problem.Message}`));
  if (problems.length > MAX_SHOWN_ERRORS) {
    lines.push(FormatText(Texts.LoadErrorMore, { Count: problems.length - MAX_SHOWN_ERRORS }));
  }
  return { Model: null, Errors: lines };
}

// [U] ModelFileName – mudeli nimest failinimi: 'Näidis PTS' → 'Näidis_PTS.fms.json'.
export function ModelFileName(name) {
  const base = (name || '').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_');
  return (base || Texts.DesktopUntitled) + MODEL_EXTENSION;
}

// [O] LoadDemoModel – laadib näidismudeli serverist. onDone(tulemus { Model, Errors }).
export function LoadDemoModel(fileName, onDone) {
  const url = new URL(`../models/${fileName}`, import.meta.url);
  fetch(url)
    .then((response) => { if (!response.ok) throw new Error(response.statusText); return response.text(); })
    .then((text) => onDone(ParseModelText(text, fileName), text))
    .catch(() => onDone({ Model: null, Errors: [FormatText(Texts.LoadErrorRead, { File: fileName })] }));
}

// [O] ChooseLocalFile – avab brauseri faili valimise akna ja loeb valitud faili.
//     Peab olema kutsutud otse kasutaja tegevusest (klahv, klõps). onDone(tulemus, tekst, failinimi).
export function ChooseLocalFile(onDone) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = `${MODEL_EXTENSION},.json,application/json`;
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;
    file.text()
      .then((text) => onDone(ParseModelText(text, file.name), text, file.name))
      .catch(() => onDone({ Model: null, Errors: [FormatText(Texts.LoadErrorRead, { File: file.name })] }));
  });
  input.click();
}

// [O] SaveModel – salvestab mudeli faili (brauser laadib selle alla).
export function SaveModel(model, fileName) {
  const text = `${JSON.stringify(model, null, 2)}\n`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  RememberModel(fileName, text);
}

// [U] SaveText – tekstifaili allalaadimine (aruanne, Output → File). Kutsub: fms.js.
export function SaveText(text, fileName) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// [O] RecentModels – viimati kasutatud mudelid (Pick): [{ File, Text }], uusim ees.
export function RecentModels() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(list) ? list.filter((entry) => entry && typeof entry.File === 'string') : [];
  } catch {
    return [];
  }
}

// [U] RememberModel – lisab mudeli viimati kasutatute nimekirja algusesse.
export function RememberModel(fileName, text) {
  try {
    const list = RecentModels().filter((entry) => entry.File !== fileName);
    list.unshift({ File: fileName, Text: text });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // mälu pole saadaval või on täis – nimekiri jääb uuendamata
  }
}
