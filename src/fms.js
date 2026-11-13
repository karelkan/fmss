// FMSS – peaprogramm: avaekraan, peamenüü, töölaud.
// Vastab originaali moodulile FMS.PAS. Menüü: originaali joon. 6.1–6.2 (originaal.md 8.1).

import { Texts, FormatText } from './fms_lng.js';
import { EmptyModel, ModelSummary, MAX_WORKPIECE_TYPES } from './fms_glb.js';
import { Enumerate, SimState } from './fms_sim.js';
import {
  STATIC_TOPICS, DYNAMIC_TOPICS, KeepReport, LastSimulation, StaticReport, DynamicReport, ReportText, ReportFileName,
  ShowReport, CloseReport,
} from './fms_rep.js';
import { StartAnimator, StopAnimator, ClockText } from './anima.js';
import { EditLayout, ViewLayout, StopEditor, EnsureTrack, NoteEditorChange, SetEditorCursor, EditorCursorRect } from './fms_ed.js';
import {
  EditConfig, ConfigAllCells, EditTransportSystem, EditWorkpieceData, NewWorkpiece, CopyWorkpiece, FlushWorkpiece,
  EditStorageData, EditModelData, ShowProblems,
} from './fms_ed_data.js';
import { EnvironmentOptions, LoadOptions, SaveOptions } from './fms_opt.js';
import {
  DemoModels, LoadDemoList, LoadDemoModel,ChooseLocalFile, SaveModel, RecentModels, RememberModel,
  ParseModelText, ModelFileName, SaveText,
} from './fms_file.js';
import { ROW_HEIGHT, CreateEgaTheme, CreateModernTheme, LoadEgaFont } from './fms_theme.js';
import {
  InitScreen, SetTheme, SetFullScreen, SetDesktop, SetHotkeys, RequestRedraw,
  MessageBox, ListBox, InputBox, FormBox, DialogOpen,
} from './windows.js';

// =====================================================================
// Globaalsed andmed
// =====================================================================

let CurrentModel = null;      // [U] laaditud mudel (DISAIN.md osa 8)
let CurrentFile = '';         // [U] mudeli failinimi
let MODEL_CHANGED = false;    // [U] mudelit on pärast laadimist / salvestamist muudetud
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
    rows.push([Texts.DesktopModelFile, (CurrentFile || '—') + (MODEL_CHANGED ? Texts.DesktopChanged : '')]);
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
  CloseReport();
  StopAnimator();
  StopEditor();
  CurrentModel = result.Model;
  CurrentFile = fileName;
  MODEL_CHANGED = false;
  RememberModel(fileName, text);
  RequestRedraw();
}

// [U] ConfirmDiscard – kui mudel on salvestamata, küsib enne, kui see asendatakse.
function ConfirmDiscard(action) {
  if (!MODEL_CHANGED) { action(); return; }
  MessageBox(Texts.ChangedTitle, [Texts.ChangedText], [Texts.ButtonYes, Texts.ButtonNo], (button) => {
    if (button === 0) action();
  });
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
  CloseReport();
  StopAnimator();
  StopEditor();
  CurrentModel = EmptyModel('');
  CurrentFile = '';
  MODEL_CHANGED = false;
  RequestRedraw();
}

function MenuSave() {
  if (!CurrentModel) return;
  if (!CurrentFile) { MenuWriteAs(); return; }
  SaveModel(CurrentModel, CurrentFile);
  MODEL_CHANGED = false;
  MessageBox(Texts.MenuSave.replace('&', ''), [FormatText(Texts.SaveDone, { File: CurrentFile })]);
}

function MenuWriteAs() {
  if (!CurrentModel) return;
  InputBox(Texts.WriteAsTitle, Texts.WriteAsPrompt, CurrentModel.Meta.Name, (name) => {
    if (name === null || name.trim() === '') return;
    CurrentModel.Meta.Name = name.trim();
    CurrentFile = ModelFileName(name);
    SaveModel(CurrentModel, CurrentFile);
    MODEL_CHANGED = false;
    MessageBox(Texts.WriteAsTitle, [FormatText(Texts.SaveDone, { File: CurrentFile })]);
  });
}

// =====================================================================
// Simulatsioon
// =====================================================================

const SIM_SHOWN_ERRORS = 8;    // [U] mitu viga dialoogis näidatakse
const SIM_SHOWN_OBJECTS = 6;   // [U] mitu pinki / puhvrit kokkuvõttes näidatakse

// [U] Percent, Decimal – protsent ja kümnendmurd (komaga) kokkuvõttes.
const Percent = (value) => `${Math.round(value * 100)} %`;
const Decimal = (value, digits = 1) => value.toFixed(digits).replace('.', ',');

// [U] CheckLine – kontrolli tulemus dialoogi reaks (lahtri asukoht on juba teates).
function CheckLine(problem) {
  return problem.Path.startsWith('Layout') ? `  ${problem.Message}` : `  ${problem.Path}: ${problem.Message}`;
}

// [O] MenuSimulate – Simulate: kontroll (Enumerate), siis animaator (pausil, anima.js).
//     Lõpus või Esc-iga lühikokkuvõte; tulemus jääb aruannete jaoks meelde (KeepReport),
//     nupp „Aruanne“ näitab Static ja Dynamic aruannet (etapp 9).
function MenuSimulate() {
  if (!CurrentModel) { MessageBox(Texts.SimTitle, [Texts.SimNoModel]); return; }
  const result = Enumerate(CurrentModel);
  if (result.Errors.length > 0) {
    const lines = [{ Text: Texts.SimCannot, Role: 'Error' }, ...result.Errors.slice(0, SIM_SHOWN_ERRORS).map(CheckLine)];
    if (result.Errors.length > SIM_SHOWN_ERRORS) {
      lines.push(FormatText(Texts.LoadErrorMore, { Count: result.Errors.length - SIM_SHOWN_ERRORS }));
    }
    MessageBox(Texts.SimTitle, lines);
    return;
  }
  const model = CurrentModel;
  const modelText = JSON.stringify(model);
  const fileName = CurrentFile;
  CloseReport();
  StopEditor();
  StartAnimator({
    Model: structuredClone(model),
    Network: result.Network,
    OnSummary: (report, onClose) => {
      KeepReport(report, SimState(), modelText, fileName);
      MessageBox(Texts.SimTitle, SimSummaryLines(report, result.Warnings), [Texts.ButtonOk, Texts.ButtonReport], (button) => {
        if (onClose) onClose();
        if (button === 1) FullReport();
      });
    },
  });
}

// [U] SimSummaryLines – simulatsiooni kokkuvõte dialoogi ridadeks.
function SimSummaryLines(report, warnings) {
  const limited = (items, format) => {
    const lines = items.slice(0, SIM_SHOWN_OBJECTS).map(format);
    if (items.length > SIM_SHOWN_OBJECTS) lines.push(FormatText(Texts.SimMore, { Count: items.length - SIM_SHOWN_OBJECTS }));
    return lines;
  };
  const lines = [
    FormatText(Texts.SimHeader, { Name: report.Model || Texts.DesktopUntitled, Time: ClockText(report.Time), Seed: report.Seed }),
  ];
  if (report.Deadlock) {
    lines.push({ Text: FormatText(Texts.SimDeadlock, { Time: ClockText(report.Time), Reason: report.DeadlockReason }), Role: 'Error' });
  }
  lines.push(
    FormatText(Texts.SimCounts, report),
    ...(report.Crashes > 0 ? [FormatText(Texts.SimCrashes, report)] : []),
    FormatText(Texts.SimThroughput, { Throughput: Decimal(report.ThroughputPerHour), Cycle: ClockText(Math.round(report.AvgCycleTime)) }),
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

// =====================================================================
// Aruanded (fms_rep.js)
// =====================================================================

// [U] ReportTopics – aruande valitud teemad seadetest (null = kõik).
function ReportTopics(kind) {
  const all = kind === 'Static' ? STATIC_TOPICS : DYNAMIC_TOPICS;
  const saved = EnvironmentOptions[`Report${kind}`];
  return saved === null ? [...all] : all.filter((topic) => saved.includes(topic));
}

// [O] ChooseTopics – Static / Dynamic: kasutaja valib, mis teemad aruandesse tulevad
//     (originaal ptk 6.5). Valik jääb seadetesse. onChosen(teemad).
function ChooseTopics(kind, title, onChosen) {
  const all = kind === 'Static' ? STATIC_TOPICS : DYNAMIC_TOPICS;
  const chosen = ReportTopics(kind);
  const fields = all.map((topic, i) => ({ Key: topic, Label: Texts.RepTopicNames[topic], Kind: 'Check', Value: chosen.includes(topic), Row: i }));
  const output = EnvironmentOptions.ReportOutput === 'File' ? Texts.RepOutputFile : Texts.RepOutputDisplay;
  FormBox(title, fields, [Texts.ButtonOk, Texts.ButtonCancel], (index, form) => {
    if (index !== 0) return true;
    const topics = form.Fields.filter((field) => field.Value).map((field) => field.Key);
    if (topics.length === 0) return [{ Key: all[0], Message: Texts.RepNoTopics }];
    EnvironmentOptions[`Report${kind}`] = topics;
    SaveOptions();
    return () => onChosen(topics);
  }, { Lines: [Texts.RepTopicsPrompt, FormatText(Texts.RepTopicsOutput, { Output: output })] });
}

// [O] MenuStaticReport – Report → Static: algne seis (parameetrid) ja lõppseis valitud teemadega.
function MenuStaticReport() {
  if (!CurrentModel) { MessageBox(Texts.RepStaticTitle, [Texts.SimNoModel]); return; }
  const result = Enumerate(CurrentModel);
  if (result.Errors.length > 0) {
    MessageBox(Texts.RepStaticTitle, [{ Text: Texts.SimCannot, Role: 'Error' }, ...result.Errors.slice(0, SIM_SHOWN_ERRORS).map(CheckLine)]);
    return;
  }
  ChooseTopics('Static', Texts.RepStaticTitle, (topics) => OutputReport(Texts.RepStaticTitle,
    StaticReport(CurrentModel, result.Network, LastSimulation(), topics), ReportFileName(CurrentFile, CurrentModel.Meta?.Name, 'static')));
}

// [O] MenuDynamicReport – Report → Dynamic: viimase simulatsiooni statistika valitud teemadega.
function MenuDynamicReport() {
  const last = LastSimulation();
  if (!last) { MessageBox(Texts.RepDynamicTitle, [Texts.RepNoSimulation]); return; }
  ChooseTopics('Dynamic', Texts.RepDynamicTitle, (topics) => OutputReport(Texts.RepDynamicTitle,
    DynamicReport(last, CurrentModel, topics), ReportFileName(last.File, last.Report.Model, 'dynamic')));
}

// [U] FullReport – Simulate kokkuvõtte nupp „Aruanne“: Static ja Dynamic valitud teemadega ekraanile.
function FullReport() {
  const last = LastSimulation();
  const result = CurrentModel ? Enumerate(CurrentModel) : null;
  if (!last || !result || result.Errors.length > 0) return;
  const lines = [
    ...StaticReport(CurrentModel, result.Network, last, ReportTopics('Static')),
    ...DynamicReport(last, CurrentModel, ReportTopics('Dynamic'), { Header: false }),
  ];
  const fileName = ReportFileName(last.File, last.Report.Model, 'report');
  ShowReport(Texts.RepFullTitle, lines, { OnFile: () => SaveReportAs(Texts.RepFullTitle, lines, fileName) });
}

// [O] OutputReport – aruanne valitud väljundisse (Report → Output): ekraanile või faili.
function OutputReport(title, lines, fileName) {
  if (EnvironmentOptions.ReportOutput === 'File') SaveReportAs(title, lines, fileName);
  else ShowReport(title, lines, { OnFile: () => SaveReportAs(title, lines, fileName) });
}

// [U] SaveReportAs – küsib failinime ja laadib aruande tekstifailina alla.
function SaveReportAs(title, lines, fileName) {
  InputBox(Texts.RepFileTitle, Texts.RepFilePrompt, fileName, (name) => {
    if (name === null || name.trim() === '') return;
    const file = /\.txt$/i.test(name.trim()) ? name.trim() : `${name.trim()}.txt`;
    SaveText(ReportText(title, lines, new Date().toLocaleString('et-EE')), file);
    MessageBox(Texts.RepFileTitle, [FormatText(Texts.RepSaved, { File: file })]);
  });
}

// [U] ChangeReportOutput – Report → Output → Display | File; jääb seadetesse.
function ChangeReportOutput(output) {
  EnvironmentOptions.ReportOutput = output;
  SaveOptions();
}

// =====================================================================
// Redaktor (fms_ed.js)
// =====================================================================

// [O] MenuLayout – Edit → Layout: ruudustik ja ikoonid. Mudeli puudumisel alustatakse tühjaga.
//     tool – algne tööriist ('Select' – Config → Choose); kui Layout on juba avatud, jääb Undo alles.
function MenuLayout(tool = undefined, message = '') {
  CloseReport();
  StopAnimator();
  if (!CurrentModel) { CurrentModel = EmptyModel(''); CurrentFile = ''; MODEL_CHANGED = false; }
  EditLayout({
    Model: CurrentModel,
    Tool: tool,
    Message: message,
    OnChange: () => { MODEL_CHANGED = true; RequestRedraw(); },
    OnExit: RequestRedraw,
    OnEditCell: (cell) => EditConfig(CurrentModel, cell, FormContext()),
    OnCheck: MenuCheck,
  });
}

// [U] NoteChange – vorm muutis mudelit: Layout-i Undo ja kontroll, „muudetud“ töölaual.
function NoteChange(before) {
  if (JSON.stringify(CurrentModel) === before) return;
  if (!NoteEditorChange(CurrentModel, before)) MODEL_CHANGED = true;
  RequestRedraw();
}

// [U] FormContext – vormide ühine kontekst (fms_ed_data.js): muudatuse teade; Layout-is
//     ei kata vorm valitud objekti.
function FormContext(extra = {}) {
  return { OnChange: NoteChange, Avoid: EditorCursorRect(), ...extra };
}

// [O] MenuConfigAll – Config → All: kõik objektid joonisel järjest; objekt on Layout-is esile
//     tõstetud ja vorm avaneb ekraani all (või üleval, kui objekt on all). Loobu / Esc lõpetab.
function MenuConfigAll() {
  MenuLayout('Select');
  const cells = ConfigAllCells(CurrentModel);
  const step = (index) => {
    if (index >= cells.length) return;
    const cell = cells[index];
    SetEditorCursor(cell.X, cell.Y);
    EditConfig(CurrentModel, cell, FormContext({ Then: (saved) => { if (saved) step(index + 1); } }));
  };
  step(0);
}

// [O] MenuConfigChoose – Config → Choose: Layout tööriistaga „vali“; klõps / Enter avab andmed.
function MenuConfigChoose() {
  MenuLayout('Select', Texts.EdChooseHint);
}

// [U] MenuCheck – Edit → Check: vead ja hoiatused; valik viib Layout-is vea kohale.
function MenuCheck() {
  if (!CurrentModel) return;
  ShowProblems(CurrentModel, (cell) => {
    MenuLayout();
    SetEditorCursor(cell.X, cell.Y);
  });
}

function MenuNewTrack() {
  const before = JSON.stringify(CurrentModel);
  EnsureTrack(CurrentModel, CurrentModel.Tracks.length + 1);
  NoteChange(before);
  EditTransportSystem(CurrentModel, CurrentModel.Tracks.length, FormContext());
}

function MenuNewWorkpiece() {
  const before = JSON.stringify(CurrentModel);
  const number = NewWorkpiece(CurrentModel);
  if (number === null) { MessageBox(Texts.MenuWorkpieceData.replace('&', ''), [FormatText(Texts.FormMaxWorkpieces, { Max: MAX_WORKPIECE_TYPES })]); return; }
  NoteChange(before);
  EditWorkpieceData(CurrentModel, number, FormContext());
}

function MenuCopyWorkpiece(number) {
  const before = JSON.stringify(CurrentModel);
  const copy = CopyWorkpiece(CurrentModel, number);
  if (copy === null) { MessageBox(Texts.MenuWorkpieceData.replace('&', ''), [FormatText(Texts.FormMaxWorkpieces, { Max: MAX_WORKPIECE_TYPES })]); return; }
  NoteChange(before);
  EditWorkpieceData(CurrentModel, copy, FormContext());
}

function MenuFlushWorkpiece(number) {
  const name = CurrentModel.Workpieces[number - 1].Name;
  MessageBox(Texts.MenuWorkpieceData.replace('&', ''), [FormatText(Texts.FormFlushAsk, { Name: name })], [Texts.ButtonYes, Texts.ButtonNo], (button) => {
    if (button !== 0) return;
    const before = JSON.stringify(CurrentModel);
    FlushWorkpiece(CurrentModel, number);
    NoteChange(before);
  });
}

// [O] MenuView – Edit → View: kogu mudel korraga.
function MenuView() {
  if (!CurrentModel) { MessageBox(Texts.MenuView.replace('&', ''), [Texts.SimNoModel]); return; }
  CloseReport();
  StopAnimator();
  ViewLayout({ Model: CurrentModel, OnExit: RequestRedraw });
}

// =====================================================================
// Menüü
// =====================================================================

// [U] NotYet – menüüpunkt, mis tuleb hilisemas versioonis: hall, valimisel teade.
function NotYet(label, version, extra = {}) {
  const what = label.replace('&', '');
  return {
    Label: label,
    Hint: FormatText(Texts.HintNotYet, { Version: version }),
    Dim: true,
    Action: () => MessageBox(Texts.NotYetTitle, [FormatText(Texts.NotYetText, { What: what, Version: version })]),
    ...extra,
  };
}

function NoDisk(label) {
  return { Label: label, Hint: Texts.HintNoDisk, Enabled: false };
}

// Menüü numbrid: 1 … 9, siis A, B … (kiirklahv).
const ItemNumber = (i) => (i < 9 ? String(i + 1) : String.fromCharCode(65 + i - 9));

function TrackItems() {
  const tracks = CurrentModel.Tracks;
  return [
    ...tracks.map((track, i) => ({
      Label: `&${ItemNumber(i)} ${track.Name}`, Hint: Texts.HintTrack,
      Action: () => EditTransportSystem(CurrentModel, i + 1, FormContext()),
    })),
    ...(tracks.length ? [{ Separator: true }] : []),
    { Label: Texts.MenuNewTrack, Hint: Texts.HintNewTrack, Action: MenuNewTrack },
  ];
}

function WorkpieceItems() {
  const workpieces = CurrentModel.Workpieces;
  return [
    ...workpieces.map((workpiece, i) => ({
      Label: `&${ItemNumber(i)} ${workpiece.Name}`,
      Hint: Texts.HintWorkpiece,
      Items: [
        { Label: Texts.MenuWpEdit, Hint: Texts.HintWpEdit, Action: () => EditWorkpieceData(CurrentModel, i + 1, FormContext()) },
        { Label: Texts.MenuWpCopy, Hint: Texts.HintWpCopy, Action: () => MenuCopyWorkpiece(i + 1) },
        { Label: Texts.MenuWpFlush, Hint: Texts.HintWpFlush, Action: () => MenuFlushWorkpiece(i + 1) },
      ],
    })),
    ...(workpieces.length ? [{ Separator: true }] : []),
    { Label: Texts.MenuNewWorkpiece, Hint: Texts.HintNewWorkpiece, Action: MenuNewWorkpiece },
  ];
}

// [O] BuildMainMenu – peamenüü (originaal.md 8.1).
function BuildMainMenu() {
  const modelLoaded = () => CurrentModel !== null;
  return [
    {
      Label: Texts.MenuFile, Hint: Texts.HintFile, Items: () => [
        { Label: Texts.MenuLoad, Hint: Texts.HintLoad, Action: () => ConfirmDiscard(MenuLoad) },
        { Label: Texts.MenuPick, Hint: Texts.HintPick, Action: () => ConfirmDiscard(MenuPick) },
        { Label: Texts.MenuNew, Hint: Texts.HintNew, Action: () => ConfirmDiscard(MenuNew) },
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
        { Label: Texts.MenuLayout, Hint: Texts.HintLayout, Action: () => MenuLayout() },
        { Label: Texts.MenuView, Hint: Texts.HintView, Action: MenuView, Enabled: modelLoaded() },
        {
          Label: Texts.MenuConfig, Hint: Texts.HintConfig, Enabled: modelLoaded(), Items: [
            { Label: Texts.MenuConfigAll, Hint: Texts.HintConfigAll, Action: MenuConfigAll },
            { Label: Texts.MenuConfigChoose, Hint: Texts.HintConfigChoose, Action: MenuConfigChoose },
          ],
        },
        { Label: Texts.MenuTransport, Hint: Texts.HintTransport, Enabled: modelLoaded(), Items: TrackItems },
        { Label: Texts.MenuWorkpieceData, Hint: Texts.HintWorkpieceData, Enabled: modelLoaded(), Items: WorkpieceItems },
        { Label: Texts.MenuStorageData, Hint: Texts.HintStorageData, Enabled: modelLoaded(), Action: () => EditStorageData(CurrentModel, FormContext()) },
        { Label: Texts.MenuModelData, Hint: Texts.HintModelData, Enabled: modelLoaded(), Action: () => EditModelData(CurrentModel, FormContext()) },
        { Separator: true },
        { Label: Texts.MenuCheck, Hint: Texts.HintCheck, Enabled: modelLoaded(), Action: MenuCheck },
      ],
    },
    {
      Label: Texts.MenuAdvise, Hint: Texts.HintAdvise, Items: [
        NotYet(Texts.MenuLayoutChooser, '2.0'),
        NotYet(Texts.MenuLayoutFinder, '2.0'),
      ],
    },
    { Label: Texts.MenuSimulate, Hint: Texts.HintSimulate, Action: MenuSimulate },
    {
      Label: Texts.MenuReport, Hint: Texts.HintReport, Items: () => [
        { Label: Texts.MenuStatic, Hint: Texts.HintStatic, Enabled: modelLoaded(), Action: MenuStaticReport },
        { Label: Texts.MenuDynamic, Hint: Texts.HintDynamic, Action: MenuDynamicReport },
        {
          Label: Texts.MenuOutput, Hint: Texts.HintOutput, Items: [
            { Label: Texts.MenuDisplay, Hint: Texts.HintDisplay, Checked: () => EnvironmentOptions.ReportOutput === 'Display', Action: () => ChangeReportOutput('Display') },
            { Label: Texts.MenuToFile, Hint: Texts.HintToFile, Checked: () => EnvironmentOptions.ReportOutput === 'File', Action: () => ChangeReportOutput('File') },
          ],
        },
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
  MessageBox(Texts.QuitTitle, [MODEL_CHANGED ? Texts.ChangedText : Texts.QuitText], [Texts.ButtonYes, Texts.ButtonNo], (button) => {
    if (button === 0) { CloseReport(); StopEditor(); StopAnimator(); ShowSplash(); }
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
  LoadDemoList(() => {
    const demo = DemoModels[0].File;
    LoadDemoModel(demo, (result) => {
      if (result.Model && !CurrentModel) { CurrentModel = result.Model; CurrentFile = demo; RequestRedraw(); }
    });
  });
}

Main();
