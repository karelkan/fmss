// FMSS – peaprogramm: avaekraan, peamenüü, töölaud.
// Vastab originaali moodulile FMS.PAS. Menüü: originaali joon. 6.1–6.2 (originaal.md 8.1).

import { Texts, FormatText } from './fms_lng.js';
import { EmptyModel, ModelSummary } from './fms_glb.js';
import { EnvironmentOptions, LoadOptions, SaveOptions } from './fms_opt.js';
import {
  DemoModels, LoadDemoModel, ChooseLocalFile, SaveModel, RecentModels, RememberModel,
  ParseModelText, ModelFileName,
} from './fms_file.js';
import { ROW_HEIGHT, CreateEgaTheme, CreateModernTheme, LoadEgaFont } from './fms_theme.js';
import {
  InitScreen, SetTheme, SetFullScreen, SetDesktop, SetHotkeys, RequestRedraw,
  MessageBox, ListBox, InputBox, DialogOpen,
} from './windows.js';

// =====================================================================
// Globaalsed andmed
// =====================================================================

let CurrentModel = null;      // [U] laaditud mudel (DISAIN.md osa 8)
let CurrentFile = '';         // [U] mudeli failinimi
let SPLASH_ACTIVE = false;    // [U] avaekraan on ees
let SplashStart = 0;          // [U] avaekraani animatsiooni algus (ms)
let SplashTimer = null;       // [U] avaekraani animatsiooni taimer
let EgaTheme = null;          // [U] EGA välimus (luuakse üks kord, sest hoiab tähtede vahemälu)

const DARK_SCHEME_QUERY = window.matchMedia('(prefers-color-scheme: dark)');

// Avaekraani ajakava (ms)
const SPLASH_CHAR_DELAY = 70;      // käsurea tähtede vahe
const SPLASH_PAUSE = 450;          // paus pärast käsku
const SPLASH_LINE_DELAY = 90;      // ridade vahe
const SPLASH_BLINK = 530;          // kursori vilkumine

// =====================================================================
// Välimus
// =====================================================================

// [U] CurrentTheme – loob seadete järgi kehtiva välimuse.
function CurrentTheme() {
  if (EnvironmentOptions.Theme === 'EGA') {
    if (!EgaTheme) EgaTheme = CreateEgaTheme();
    return EgaTheme;
  }
  let scheme = EnvironmentOptions.ColorScheme;
  if (scheme === 'Auto') scheme = DARK_SCHEME_QUERY.matches ? 'Dark' : 'Light';
  return CreateModernTheme(scheme);
}

// [U] ChangeTheme – vahetab välimust ja jätab valiku meelde. Kutsub: F2, Options → Theme.
function ChangeTheme(name) {
  EnvironmentOptions.Theme = name;
  SaveOptions();
  SetTheme(CurrentTheme());
}

// [U] ChangeColorScheme – kaasaegse välimuse värvid. Kutsub: Options → Colors.
function ChangeColorScheme(scheme) {
  EnvironmentOptions.ColorScheme = scheme;
  SaveOptions();
  SetTheme(CurrentTheme());
}

// =====================================================================
// Avaekraan
// =====================================================================

// [U] ShowSplash – DOS-stiilis avaekraan. Kutsub: käivitamine, Quit.
function ShowSplash() {
  SPLASH_ACTIVE = true;
  SplashStart = performance.now();
  SetFullScreen(DrawSplash, SplashInput);
  clearInterval(SplashTimer);
  SplashTimer = setInterval(RequestRedraw, 50);
}

// Esimene klahv lõpetab animatsiooni, järgmine viib töölauale.
function SplashInput() {
  if (SplashElapsedSteps().Done) {
    SPLASH_ACTIVE = false;
    clearInterval(SplashTimer);
    SetFullScreen(null, null);
  } else {
    SplashStart = -Infinity;
    RequestRedraw();
  }
}

// Kui kaugel animatsioon on: mitu käsu tähte ja mitu rida on näha.
function SplashElapsedSteps() {
  const elapsed = performance.now() - SplashStart;
  const prompt = Array.from(Texts.SplashPrompt);
  const promptChars = Math.min(prompt.length, Math.floor(elapsed / SPLASH_CHAR_DELAY));
  const linesStart = prompt.length * SPLASH_CHAR_DELAY + SPLASH_PAUSE;
  const totalLines = Texts.SplashLines.length + 2;   // pealkiri + read + „vajuta klahvi“
  const lines = Math.max(0, Math.min(totalLines, Math.floor((elapsed - linesStart) / SPLASH_LINE_DELAY) + 1));
  return {
    PromptChars: promptChars,
    Lines: elapsed < linesStart ? 0 : lines,
    Done: elapsed >= linesStart + totalLines * SPLASH_LINE_DELAY,
    CursorOn: Math.floor(elapsed / SPLASH_BLINK) % 2 === 0,
  };
}

function DrawSplash(theme) {
  if (theme.Name === 'EGA') DrawSplashEga(theme); else DrawSplashModern(theme);
}

// EGA: tekstiekraan 80 × 25, pealkiri topeltjoonega kastis.
function DrawSplashEga(theme) {
  const step = SplashElapsedSteps();
  const column = (n) => n * 8;
  const row = (n) => n * ROW_HEIGHT;
  theme.FillRect(0, 0, theme.Width, theme.Height, 'SplashBack');

  const prompt = Array.from(Texts.SplashPrompt).slice(0, step.PromptChars).join('');
  theme.Text(column(0), row(0), prompt, 'SplashPrompt');
  if (step.Lines === 0 && step.CursorOn) theme.Text(column(prompt.length), row(0), '_', 'SplashPrompt');
  if (step.Lines === 0) return;

  // Pealkirjakast (read 2–5)
  const left = 4;
  const inner = 70;
  theme.Text(column(left), row(2), `╔${'═'.repeat(inner)}╗`, 'SplashAccent');
  theme.Text(column(left), row(3), `║${' '.repeat(inner)}║`, 'SplashAccent');
  theme.Text(column(left), row(4), `║${' '.repeat(inner)}║`, 'SplashAccent');
  theme.Text(column(left), row(5), `╚${'═'.repeat(inner)}╝`, 'SplashAccent');
  theme.Text(column(left + 3), row(3), Texts.SplashTitle, 'SplashTitle', { Bold: true });
  theme.Text(column(left + inner - 1 - Texts.DesktopVersion.length), row(3), Texts.DesktopVersion, 'SplashDim');
  theme.Text(column(left + 3), row(4), Texts.SplashSubtitle, 'SplashSubtitle');

  Texts.SplashLines.slice(0, step.Lines - 1).forEach((line, i) => {
    const role = line.startsWith('(') ? 'SplashTitle' : 'SplashText';
    theme.Text(column(left + 3), row(7 + i), line, role);
  });
  if (step.Lines > Texts.SplashLines.length + 1 && step.CursorOn) {
    theme.Text(column(left + 3), row(23), Texts.SplashAnyKey, 'SplashDim');
  }
}

// Kaasaegne: tume taust, keskel pealkiri ja read.
function DrawSplashModern(theme) {
  const step = SplashElapsedSteps();
  theme.FillRect(0, 0, theme.Width, theme.Height, 'SplashBack');
  const prompt = Array.from(Texts.SplashPrompt).slice(0, step.PromptChars).join('');
  theme.Text(16, 10, prompt + (step.Lines === 0 && step.CursorOn ? '_' : ''), 'SplashPrompt', { Mono: true });
  if (step.Lines === 0) return;

  const blockHeight = 60 + Texts.SplashLines.length * ROW_HEIGHT;
  const top = Math.max(30, (theme.Height - blockHeight) / 2);
  const blockWidth = Math.max(theme.TextWidth(Texts.SplashSubtitle, { Size: 10.5 }),
    ...Texts.SplashLines.map((line) => theme.TextWidth(line)));
  const left = Math.max(16, (theme.Width - blockWidth) / 2);
  theme.Text(left, top, Texts.SplashTitle, 'SplashTitle', { Bold: true, Size: 30 });
  theme.Text(left + theme.TextWidth(Texts.SplashTitle, { Bold: true, Size: 30 }) + 10, top + 4,
    Texts.DesktopVersion, 'SplashDim');
  theme.Text(left, top + 22, Texts.SplashSubtitle, 'SplashSubtitle', { Size: 10.5 });
  Texts.SplashLines.slice(0, step.Lines - 1).forEach((line, i) => {
    const role = line.startsWith('(') ? 'SplashAccent' : 'SplashText';
    theme.Text(left, top + 46 + i * ROW_HEIGHT, line, role, { Mono: line.includes('   '), Bold: line.startsWith('(') });
  });
  if (step.Lines > Texts.SplashLines.length + 1) {
    theme.Text(left, theme.Height - 40, Texts.SplashAnyKey, 'SplashDim');
  }
}

// =====================================================================
// Töölaud
// =====================================================================

// [U] DrawDesktop – töölaual on aken laaditud mudeli kokkuvõttega.
function DrawDesktop(theme, desktop) {
  const rows = [];
  if (CurrentModel) {
    const summary = ModelSummary(CurrentModel);
    rows.push([Texts.DesktopModelName, summary.Name || Texts.DesktopUntitled]);
    rows.push([Texts.DesktopModelFile, CurrentFile || '—']);
    rows.push([Texts.DesktopModelGrid, FormatText(Texts.DesktopModelGridValue, summary.Dim)]);
    rows.push([Texts.DesktopModelCounts, FormatText(Texts.DesktopModelCountsValue, summary)]);
  } else {
    rows.push(['', Texts.DesktopNoModel]);
  }
  const labelWidth = Math.max(...rows.map(([label]) => theme.TextWidth(label))) + 16;
  const valueWidth = Math.max(...rows.map(([, value]) => theme.TextWidth(value)));
  const width = Math.ceil((labelWidth + valueWidth + 48) / 8) * 8;
  const height = (rows.length + 3) * ROW_HEIGHT;
  const x = Math.round((desktop.Width - width) / 2 / 8) * 8;
  const y = desktop.Y + Math.round((desktop.Height - height) / 2 / ROW_HEIGHT) * ROW_HEIGHT;
  theme.Panel(x, y, width, height, 'Window');
  theme.WindowTitle(x, y + 2, width, Texts.DesktopModelTitle);
  rows.forEach(([label, value], i) => {
    const rowY = y + (i + 1.5) * ROW_HEIGHT;
    theme.Text(x + 24, rowY, label, 'WindowLabel');
    theme.Text(x + 24 + (label ? labelWidth : 0), rowY, value, 'WindowText');
  });
}

// =====================================================================
// Mudeli laadimine ja salvestamine
// =====================================================================

// [U] AcceptLoadedModel – näitab laadimise vigu või võtab mudeli kasutusele.
function AcceptLoadedModel(result, text, fileName) {
  if (result.Errors.length) {
    MessageBox(Texts.LoadErrorTitle, result.Errors.map((line, i) => ({ Text: line, Role: i === 0 ? 'Error' : 'WindowText' })));
    return;
  }
  CurrentModel = result.Model;
  CurrentFile = fileName;
  RememberModel(fileName, text);
  RequestRedraw();
}

function MenuLoad() {
  const items = [...DemoModels.map((demo) => demo.Name), Texts.LoadFromComputer];
  ListBox(Texts.LoadTitle, [], items, (index) => {
    if (index === null) return;
    if (index < DemoModels.length) {
      const file = DemoModels[index].File;
      LoadDemoModel(file, (result, text) => AcceptLoadedModel(result, text, file));
    } else {
      ChooseLocalFile(AcceptLoadedModel);
    }
  });
}

function MenuPick() {
  const recent = RecentModels();
  if (recent.length === 0) { MessageBox(Texts.PickTitle, [Texts.PickEmpty]); return; }
  ListBox(Texts.PickTitle, [], recent.map((entry) => entry.File), (index) => {
    if (index === null) return;
    const entry = recent[index];
    AcceptLoadedModel(ParseModelText(entry.Text, entry.File), entry.Text, entry.File);
  });
}

function MenuNew() {
  CurrentModel = EmptyModel('');
  CurrentFile = '';
  RequestRedraw();
}

function MenuSave() {
  if (!CurrentModel) return;
  if (!CurrentFile) { MenuWriteAs(); return; }
  SaveModel(CurrentModel, CurrentFile);
  MessageBox(Texts.MenuSave.replace('&', ''), [FormatText(Texts.SaveDone, { File: CurrentFile })]);
}

function MenuWriteAs() {
  if (!CurrentModel) return;
  InputBox(Texts.WriteAsTitle, Texts.WriteAsPrompt, CurrentModel.Meta.Name, (name) => {
    if (name === null || name.trim() === '') return;
    CurrentModel.Meta.Name = name.trim();
    CurrentFile = ModelFileName(name);
    SaveModel(CurrentModel, CurrentFile);
    MessageBox(Texts.WriteAsTitle, [FormatText(Texts.SaveDone, { File: CurrentFile })]);
  });
}

// =====================================================================
// Menüü
// =====================================================================

// [U] NotYet – menüüpunkt, mis tuleb hilisemas etapis: hall, valimisel teade.
function NotYet(label, stage, extra = {}) {
  const what = label.replace('&', '');
  return {
    Label: label,
    Hint: FormatText(Texts.HintNotYet, { Stage: stage }),
    Dim: true,
    Action: () => MessageBox(Texts.NotYetTitle, [FormatText(Texts.NotYetText, { What: what, Stage: stage })]),
    ...extra,
  };
}

function NoDisk(label) {
  return { Label: label, Hint: Texts.HintNoDisk, Enabled: false };
}

function TrackItems() {
  const tracks = CurrentModel ? CurrentModel.Tracks : [];
  if (tracks.length === 0) return [{ Label: Texts.NoTracks, Enabled: false }];
  return tracks.map((track, i) => NotYet(`&${i + 1} ${track.Name}`, 6));
}

function WorkpieceItems() {
  const workpieces = CurrentModel ? CurrentModel.Workpieces : [];
  if (workpieces.length === 0) return [{ Label: Texts.NoWorkpieces, Enabled: false }];
  return workpieces.map((workpiece, i) => ({
    Label: `&${i + 1} ${workpiece.Name}`,
    Hint: FormatText(Texts.HintNotYet, { Stage: 6 }),
    Dim: true,
    Items: [NotYet(Texts.MenuWpEdit, 6), NotYet(Texts.MenuWpCopy, 6), NotYet(Texts.MenuWpFlush, 6)],
  }));
}

// [O] BuildMainMenu – peamenüü (originaal.md 8.1).
function BuildMainMenu() {
  const modelLoaded = () => CurrentModel !== null;
  return [
    {
      Label: Texts.MenuFile, Hint: Texts.HintFile, Items: () => [
        { Label: Texts.MenuLoad, Hint: Texts.HintLoad, Action: MenuLoad },
        { Label: Texts.MenuPick, Hint: Texts.HintPick, Action: MenuPick },
        { Label: Texts.MenuNew, Hint: Texts.HintNew, Action: MenuNew },
        { Label: Texts.MenuSave, Hint: Texts.HintSave, Action: MenuSave, Enabled: modelLoaded() },
        { Label: Texts.MenuWriteAs, Hint: Texts.HintWriteAs, Action: MenuWriteAs, Enabled: modelLoaded() },
        { Separator: true },
        NoDisk(Texts.MenuDirectory),
        NoDisk(Texts.MenuChangeDir),
        NoDisk(Texts.MenuRename),
        NoDisk(Texts.MenuDelete),
      ],
    },
    {
      Label: Texts.MenuEdit, Hint: Texts.HintEdit, Items: () => [
        NotYet(Texts.MenuLayout, 6),
        NotYet(Texts.MenuView, 6),
        NotYet(Texts.MenuConfig, 6, { Items: [NotYet(Texts.MenuConfigAll, 6), NotYet(Texts.MenuConfigChoose, 6)] }),
        NotYet(Texts.MenuTransport, 6, { Items: TrackItems }),
        NotYet(Texts.MenuWorkpieceData, 6, { Items: WorkpieceItems }),
        NotYet(Texts.MenuStorageData, 6),
      ],
    },
    {
      Label: Texts.MenuAdvise, Hint: Texts.HintAdvise, Items: [
        NotYet(Texts.MenuLayoutChooser, 11),
        NotYet(Texts.MenuLayoutFinder, 11),
      ],
    },
    NotYet(Texts.MenuSimulate, '4–5', { Hint: Texts.HintSimulate, Dim: false }),
    {
      Label: Texts.MenuReport, Hint: Texts.HintReport, Items: [
        NotYet(Texts.MenuStatic, 9),
        NotYet(Texts.MenuDynamic, 9),
        NotYet(Texts.MenuOutput, 9, { Items: [NotYet(Texts.MenuDisplay, 9), NotYet(Texts.MenuToFile, 9)] }),
      ],
    },
    {
      Label: Texts.MenuOptions, Hint: Texts.HintOptions, Items: () => [
        {
          Label: Texts.MenuTheme, Hint: Texts.HintTheme, Items: [
            { Label: Texts.MenuThemeEga, Hint: Texts.HintTheme, Checked: () => EnvironmentOptions.Theme === 'EGA', Action: () => ChangeTheme('EGA') },
            { Label: Texts.MenuThemeModern, Hint: Texts.HintTheme, Checked: () => EnvironmentOptions.Theme === 'Modern', Action: () => ChangeTheme('Modern') },
          ],
        },
        {
          Label: Texts.MenuColors,
          Hint: EnvironmentOptions.Theme === 'Modern' ? Texts.HintColors : Texts.HintColorsEgaOnly,
          Enabled: EnvironmentOptions.Theme === 'Modern',
          Items: ['Auto', 'Light', 'Dark'].map((scheme) => ({
            Label: Texts[`MenuColors${scheme}`], Hint: Texts.HintColors,
            Checked: () => EnvironmentOptions.ColorScheme === scheme,
            Action: () => ChangeColorScheme(scheme),
          })),
        },
      ],
    },
    { Label: Texts.MenuQuit, Hint: Texts.HintQuit, Action: AskQuit },
  ];
}

function AskQuit() {
  MessageBox(Texts.QuitTitle, [Texts.QuitText], [Texts.ButtonYes, Texts.ButtonNo], (button) => {
    if (button === 0) ShowSplash();
  });
}

function ShowHelp() {
  MessageBox(Texts.HelpTitle, Texts.HelpLines.map((line) => ({ Text: line, Mono: true })));
}

// =====================================================================
// Käivitamine
// =====================================================================

// [O] Main – peaprogramm: seaded, font, ekraan, avaekraan, näidismudel.
async function Main() {
  LoadOptions();
  try {
    await LoadEgaFont();
  } catch {
    // font puudub – EGA välimus kasutab brauseri fonti
  }
  InitScreen(document.getElementById('Screen'), CurrentTheme());
  SetDesktop(DrawDesktop, BuildMainMenu());
  SetHotkeys({
    F1: () => { if (!SPLASH_ACTIVE && !DialogOpen()) ShowHelp(); },
    F2: () => ChangeTheme(EnvironmentOptions.Theme === 'EGA' ? 'Modern' : 'EGA'),
    'Alt-X': () => { if (!SPLASH_ACTIVE && !DialogOpen()) AskQuit(); },
  });
  DARK_SCHEME_QUERY.addEventListener('change', () => {
    if (EnvironmentOptions.Theme === 'Modern' && EnvironmentOptions.ColorScheme === 'Auto') SetTheme(CurrentTheme());
  });
  ShowSplash();
  const demo = DemoModels[0].File;
  LoadDemoModel(demo, (result) => {
    if (result.Model) { CurrentModel = result.Model; CurrentFile = demo; RequestRedraw(); }
  });
}

Main();
