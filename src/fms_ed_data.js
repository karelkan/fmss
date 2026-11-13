// FMSS – redaktor: objektide andmed vormides (Config, Transport, Workpiece data, Storage data,
// Model data) ning vigade ja hoiatuste nimekiri.
// Vastab originaali FMS_ED1.PAS-i protseduuridele EditConfig, EditMachTool, EditBuffer,
// EditTransportSystem, EditWorkpieceData, EditStorageData (originaal.md 8.2). Disain: DISAIN.md osa 15.
//
// Vormi väärtusi kontrollib sama CheckModel, mis faili laadimisel (fms_glb.js): väärtused
// pannakse mudeli koopiasse ja kontrollitakse – nii on piirid ühes kohas. Kui kõik on korras,
// muudetakse päris mudelit ja kutsutakse ctx.OnChange(before) (Undo, „muudetud“).
//
// ctx (kõigil vormidel): OnChange(before) – mudel muutus (before = JSON enne);
//   Avoid – valitud objekti ala ekraanil: vorm avaneb all või üleval nii, et seda ei kata;
//   Then(saved) – vorm suleti (Config → All läheb järgmise objekti juurde, kui saved).

import { IconTypes, OPERATIONS, TRACK_MODES, BUFFER_DISCIPLINES, DISTRIBUTIONS, MAX_WORKPIECE_TYPES, CheckModel } from './fms_glb.js';
import { Texts, FormatText } from './fms_lng.js';
import { FormBox, ListBox, MessageBox } from './windows.js';
import { SegmentCells, EdgeLengthOf, SetEdgeLength, DeleteTrack, UniqueName, ModelProblems, ProblemCell } from './fms_ed.js';

const DEFAULT_STORAGE = { Capacity: 30, LoadTime: 20 };
const SHOWN_PROBLEMS = 14;          // [U] mitu viga / hoiatust nimekirjas näidatakse (EGA ekraan)
const PROBLEM_TEXT_LENGTH = 72;     // nimekirja rea pikkus märkides

// =====================================================================
// Vormi abiprotseduurid (testitavad ilma brauserita)
// =====================================================================

// [U] NumberText, ParseNumber – arv vormi tekstiks (koma) ja tagasi; tühi või vigane → NaN.
export const NumberText = value => String(value).replace('.', ',');
export function ParseNumber(text) {
  const clean = String(text).trim().replace(',', '.');
  return clean === '' ? NaN : Number(clean);
}

// [U] FormValues – väljade väärtused: Number → arv (Optional ja tühi → null), Choice → Values[Value],
//     Check → true / false, Text → ilma tühikuteta ääres. Tagastab { Values, Errors }.
export function FormValues(fields) {
  const values = {};
  const errors = [];
  for (const field of fields) {
    switch (field.Kind) {
      case 'Number': {
        if (field.Optional && field.Text.trim() === '') { values[field.Key] = null; break; }
        const number = ParseNumber(field.Text);
        if (Number.isNaN(number)) errors.push({ Key: field.Key, Message: `${FieldName(field)}: ${Texts.CheckNotNumber}` });
        values[field.Key] = number;
        break;
      }
      case 'Choice': values[field.Key] = (field.Values ?? field.Choices)[field.Value]; break;
      case 'Check': values[field.Key] = Boolean(field.Value); break;
      case 'Text': values[field.Key] = field.Text.trim(); break;
      default: break;
    }
  }
  return { Values: values, Errors: errors };
}

const FieldName = field => (field.ErrorLabel ?? field.Label).replace(/:$/, '');
const PathUnder = (path, prefix) => path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`);

// [U] SubmitModelForm – kontrollib ja rakendab vormi: apply(mudel, väärtused) mudeli koopiale,
//     CheckModel-i vead (ainult paths alt) väljade juurde (välja Path järgi). Kui vigu pole,
//     rakendab päris mudelile ja kutsub onChange(before). Tagastab vead (tühi = õnnestus).
export function SubmitModelForm(model, fields, apply, paths, onChange) {
  const { Values: values, Errors: errors } = FormValues(fields);
  if (errors.length) return errors;
  const trial = structuredClone(model);
  apply(trial, values);
  const problems = CheckModel(trial).filter(problem => paths.some(prefix => PathUnder(problem.Path, prefix)));
  if (problems.length) {
    return problems.map((problem) => {
      const field = fields.find(candidate => candidate.Path && PathUnder(problem.Path, candidate.Path));
      return field
        ? { Key: field.Key, Message: `${FieldName(field)}: ${problem.Message}` }
        : { Key: null, Message: `${problem.Path}: ${problem.Message}` };
    });
  }
  const before = JSON.stringify(model);
  apply(model, values);
  if (onChange) onChange(before);
  return [];
}

// [U] KnownOperations – operatsioonid valikuks: pinkide omad, siis originaali loend (OPERATIONS),
//     siis marsruutides ja extra-s olevad (ilma kordusteta).
export function KnownOperations(model, extra = []) {
  const ops = [
    ...model.Machines.flatMap(machine => machine.Ops),
    ...OPERATIONS,
    ...model.Workpieces.flatMap(workpiece => workpiece.Routes.flatMap(route => route.Ops.map(operation => operation.Op))),
    ...extra,
  ];
  return [...new Set(ops.filter(op => typeof op === 'string' && op.trim() !== ''))];
}

// [U] Done – vormi sulgemine: Then(saved) järgmise sammu jaoks (Config → All), muidu lihtsalt sulge.
const Done = (ctx, saved) => (ctx.Then ? () => ctx.Then(saved) : true);

// [U] ModelForm – tavaline vorm: OK salvestab (SubmitModelForm), Loobu ja Esc sulgevad.
function ModelForm(model, title, fields, apply, paths, ctx, options = {}) {
  FormBox(title, fields, [Texts.ButtonOk, Texts.ButtonCancel], (index, form) => {
    if (index !== 0) return Done(ctx, false);
    const errors = SubmitModelForm(model, form.Fields, apply, paths, ctx.OnChange);
    return errors.length ? errors : Done(ctx, true);
  }, { Position: ctx.Position ?? 'Center', Avoid: ctx.Avoid ?? null, Lines: options.Lines ?? [] });
}

// =====================================================================
// Objektid: tööpink, puhver, keskladu, rada (EditConfig)
// =====================================================================

// [O] EditMachTool – tööpingi andmed: nimi, mudel, laadimis- ja häälestusaeg, rike ja remont
//     (etapp 8), operatsioonid (märkeruudud + uus operatsioon). Kutsub: EditConfig, testid.
export function EditMachTool(model, number, ctx = {}) {
  const machine = model.Machines[number - 1];
  const path = `Machines[${number}]`;
  const ops = KnownOperations(model);
  const opRows = Math.ceil(ops.length / 3);
  const fields = [
    { Key: 'Name', Label: Texts.FormName, Kind: 'Text', Text: machine.Name, Row: 0, Width: 14, Path: `${path}.Name` },
    { Key: 'Model', Label: Texts.FormMachineModel, Kind: 'Text', Text: machine.Model ?? '', Row: 0, X: 32, Width: 14, Path: `${path}.Model` },
    { Key: 'LoadTime', Label: Texts.FormLoadTime, Kind: 'Number', Text: NumberText(machine.LoadTime), Row: 1, Path: `${path}.LoadTime` },
    { Key: 'SetupTime', Label: Texts.FormSetupTime, Kind: 'Number', Text: NumberText(machine.SetupTime), Row: 1, X: 32, Path: `${path}.SetupTime` },
    { Key: 'CrashMean', Label: Texts.FormCrashMean, Kind: 'Number', Text: NumberText(machine.CrashMean ?? 0), Row: 2, Path: `${path}.CrashMean` },
    { Key: 'RepairMean', Label: Texts.FormRepairMean, Kind: 'Number', Text: NumberText(machine.RepairMean ?? 0), Row: 3, Path: `${path}.RepairMean` },
    { Key: 'RepairDev', Label: Texts.FormRepairDev, Kind: 'Number', Text: NumberText(machine.RepairDev ?? 0), Row: 3, X: 32, Path: `${path}.RepairDev` },
    { Key: 'OpsLabel', Label: Texts.FormOps, Kind: 'Label', Row: 4 },
    ...ops.map((op, i) => ({ Key: `Op${i}`, Label: op, Kind: 'Check', Value: machine.Ops.includes(op), Row: 5 + Math.floor(i / 3), X: (i % 3) * 22 })),
    { Key: 'NewOp', Label: Texts.FormNewOp, Kind: 'Text', Text: '', Row: 5 + opRows, Width: 18, Path: `${path}.Ops`, ErrorLabel: Texts.FormOps },
  ];
  const apply = (target, values) => {
    const record = target.Machines[number - 1];
    record.Name = values.Name;
    record.Model = values.Model;
    record.LoadTime = values.LoadTime;
    record.SetupTime = values.SetupTime;
    record.CrashMean = values.CrashMean;
    record.RepairMean = values.RepairMean;
    record.RepairDev = values.RepairDev;
    record.Ops = ops.filter((op, i) => values[`Op${i}`]);
    if (values.NewOp && !record.Ops.includes(values.NewOp)) record.Ops.push(values.NewOp);
  };
  ModelForm(model, FormatText(Texts.FormMachineTitle, { N: number, Name: machine.Name }), fields, apply, [path], ctx,
    { Lines: Texts.FormMachineHint });
}

// [O] EditBuffer – puhvri andmed: maht, pöördusmeetod (FIFO / FILO / RANDOM), laadimisaeg.
export function EditBuffer(model, number, ctx = {}) {
  const buffer = model.Buffers[number - 1];
  const path = `Buffers[${number}]`;
  const fields = [
    { Key: 'Capacity', Label: Texts.FormCapacity, Kind: 'Number', Text: NumberText(buffer.Capacity), Row: 0, Path: `${path}.Capacity` },
    { Key: 'Discipline', Label: Texts.FormDiscipline, Kind: 'Choice', Choices: BUFFER_DISCIPLINES, Value: Math.max(0, BUFFER_DISCIPLINES.indexOf(buffer.Discipline)), Row: 1, Path: `${path}.Discipline` },
    { Key: 'LoadTime', Label: Texts.FormLoadTime, Kind: 'Number', Text: NumberText(buffer.LoadTime), Row: 2, Path: `${path}.LoadTime` },
  ];
  const apply = (target, values) => Object.assign(target.Buffers[number - 1], values);
  ModelForm(model, FormatText(Texts.FormBufferTitle, { N: number }), fields, apply, [path], ctx);
}

// [O] EditStorageData – kesklao andmed: kas keskladu on, maht, laadimisaeg (Storage: null – pole).
export function EditStorageData(model, ctx = {}) {
  const storage = model.Storage ?? DEFAULT_STORAGE;
  const fields = [
    { Key: 'Exists', Label: Texts.FormStorageExists, Kind: 'Check', Value: model.Storage !== null, Row: 0 },
    { Key: 'Capacity', Label: Texts.FormCapacity, Kind: 'Number', Text: NumberText(storage.Capacity), Row: 1, Path: 'Storage.Capacity' },
    { Key: 'LoadTime', Label: Texts.FormLoadTime, Kind: 'Number', Text: NumberText(storage.LoadTime), Row: 2, Path: 'Storage.LoadTime' },
  ];
  const apply = (target, values) => {
    target.Storage = values.Exists ? { Capacity: values.Capacity, LoadTime: values.LoadTime } : null;
  };
  ModelForm(model, Texts.FormStorageTitle, fields, apply, ['Storage'], ctx, { Lines: [Texts.FormStorageHint] });
}

// [O] EditTransportSystem – raja andmed (tabel 4.1); ctx.Cell – raja lahter: siis ka selle lõigu
//     pikkus (metrokaart, EdgeLengths; tühi = mõõtkavast). Nupp „Kustuta rada“ (DeleteTrack).
export function EditTransportSystem(model, number, ctx = {}) {
  const track = model.Tracks[number - 1];
  const path = `Tracks[${number}]`;
  const modeLabels = TRACK_MODES.map(mode => Texts.FormTrackModes[mode]);
  const fields = [
    { Key: 'Name', Label: Texts.FormName, Kind: 'Text', Text: track.Name, Row: 0, Width: 14, Path: `${path}.Name` },
    { Key: 'Mode', Label: Texts.FormTrackMode, Kind: 'Choice', Choices: modeLabels, Values: TRACK_MODES, Value: Math.max(0, TRACK_MODES.indexOf(track.Mode)), Row: 0, X: 32, Path: `${path}.Mode` },
    { Key: 'Carts', Label: Texts.FormCarts, Kind: 'Number', Text: NumberText(track.Carts), Row: 1, Path: `${path}.Carts` },
    { Key: 'PlacesPerCart', Label: Texts.FormPlacesPerCart, Kind: 'Number', Text: NumberText(track.PlacesPerCart), Row: 1, X: 32, Path: `${path}.PlacesPerCart` },
    { Key: 'Speed', Label: Texts.FormSpeed, Kind: 'Number', Text: NumberText(track.Speed), Row: 2, Path: `${path}.Speed` },
    { Key: 'LoadTime', Label: Texts.FormLoadTime, Kind: 'Number', Text: NumberText(track.LoadTime), Row: 2, X: 32, Path: `${path}.LoadTime` },
    { Key: 'AccessTime', Label: Texts.FormAccessTime, Kind: 'Number', Text: NumberText(track.AccessTime), Row: 3, Path: `${path}.AccessTime` },
  ];
  const segment = ctx.Cell && ctx.Cell.N === number ? SegmentCells(model, ctx.Cell.X, ctx.Cell.Y) : null;
  if (segment) {
    const scaled = Math.round(segment.Units * model.Scale * 10) / 10;
    const current = EdgeLengthOf(model, segment.Cells);
    fields.push(
      { Key: 'SegmentLabel', Label: FormatText(Texts.FormSegment, { Count: segment.Cells.length, Length: NumberText(scaled) }), Kind: 'Label', Row: 4 },
      { Key: 'EdgeLength', Label: Texts.FormEdgeLength, LabelWidth: Array.from(Texts.FormEdgeLength).length + 1, Kind: 'Number', Optional: true, Text: current === null ? '' : NumberText(current), Row: 5, Path: 'EdgeLengths' },
    );
  }
  const apply = (target, values) => {
    const record = target.Tracks[number - 1];
    for (const key of ['Name', 'Mode', 'Carts', 'PlacesPerCart', 'Speed', 'LoadTime', 'AccessTime']) record[key] = values[key];
    if (segment) SetEdgeLength(target, segment.Cells, values.EdgeLength);
  };
  const title = FormatText(Texts.FormTrackTitle, { N: number, Name: track.Name });
  FormBox(title, fields, [Texts.ButtonOk, Texts.FormDeleteTrack, Texts.ButtonCancel], (index, form) => {
    if (index === 1) {
      return () => MessageBox(title, [FormatText(Texts.FormDeleteTrackAsk, { Name: track.Name })], [Texts.ButtonYes, Texts.ButtonNo], (button) => {
        if (button !== 0) { EditTransportSystem(model, number, ctx); return; }
        const before = JSON.stringify(model);
        DeleteTrack(model, number);
        if (ctx.OnChange) ctx.OnChange(before);
        if (ctx.Then) ctx.Then(false);
      });
    }
    if (index !== 0) return Done(ctx, false);
    const errors = SubmitModelForm(model, form.Fields, apply, [path, 'EdgeLengths'], ctx.OnChange);
    return errors.length ? errors : Done(ctx, true);
  }, { Position: ctx.Position ?? 'Center', Avoid: ctx.Avoid ?? null });
}

// [U] ConfigAllCells – Config → All: objektid joonisel järjest (ülevalt alla, vasakult paremale):
//     pingid, puhvrid, keskladu (üks kord) ja iga rada (esimene lahter). Kutsub: fms.js, testid.
export function ConfigAllCells(model) {
  const cells = [...model.Layout.Cells].sort((a, b) => a.Y - b.Y || a.X - b.X);
  const result = [];
  const tracks = new Set();
  let storage = false;
  for (const cell of cells) {
    const kind = IconTypes[cell.T]?.Kind;
    if (kind === 'Machine' || kind === 'Buffer') result.push(cell);
    else if (kind === 'Storage' && !storage) { storage = true; result.push(cell); }
    else if (kind === 'Track' && !cell.Dot && !tracks.has(cell.N)) { tracks.add(cell.N); result.push(cell); }
  }
  return result;
}

// [O] EditConfig – lahtris oleva objekti andmed (Config → Choose; Config → All iga objekti kohta).
export function EditConfig(model, cell, ctx = {}) {
  const kind = IconTypes[cell.T]?.Kind;
  const notice = (text) => MessageBox(Texts.MenuConfig.replace('&', ''), [text], [Texts.ButtonOk], () => { if (ctx.Then) ctx.Then(true); });
  if (kind === 'Machine') EditMachTool(model, cell.N, ctx);
  else if (kind === 'Buffer') EditBuffer(model, cell.N, ctx);
  else if (kind === 'Storage') EditStorageData(model, ctx);
  else if (kind === 'Output') notice(Texts.FormNoDataSysOut);
  else if (kind === 'Connector') notice(Texts.FormNoDataConnector);
  else if (kind === 'Track' && cell.Dot) notice(Texts.FormNoDataDot);
  else if (kind === 'Track') EditTransportSystem(model, cell.N, { ...ctx, Cell: cell });
}

// =====================================================================
// Detailid: Workpiece data
// =====================================================================

// [U] NewWorkpiece – uus detailitüüp (üks marsruut, üks operatsioon). Tagastab numbri või null (16 täis).
export function NewWorkpiece(model) {
  if (model.Workpieces.length >= MAX_WORKPIECE_TYPES) return null;
  const name = UniqueName(Texts.FormWorkpieceName, model.Workpieces.map(workpiece => workpiece.Name));
  const op = KnownOperations(model)[0];
  model.Workpieces.push({ Name: name, Priority: 1, Batch: 10, Routes: [{ Priority: 1, Ops: [{ Op: op, Mean: 60, Dev: 0 }] }] });
  return model.Workpieces.length;
}

// [O] CopyWorkpiece – Copy: detailitüübi koopia nimega „… (koopia)“. Tagastab numbri või null.
export function CopyWorkpiece(model, number) {
  if (model.Workpieces.length >= MAX_WORKPIECE_TYPES) return null;
  const copy = structuredClone(model.Workpieces[number - 1]);
  copy.Name = FormatText(Texts.FormCopyName, { Name: copy.Name });
  model.Workpieces.push(copy);
  return model.Workpieces.length;
}

// [O] FlushWorkpiece – Flush: kustutab detailitüübi.
export function FlushWorkpiece(model, number) {
  model.Workpieces.splice(number - 1, 1);
}

// [O] EditWorkpieceData – detailitüübi andmed: nimi, prioriteet, partii; nupp „Marsruudid“.
export function EditWorkpieceData(model, number, ctx = {}) {
  const workpiece = model.Workpieces[number - 1];
  const path = `Workpieces[${number}]`;
  const fields = [
    { Key: 'Name', Label: Texts.FormName, Kind: 'Text', Text: workpiece.Name, Row: 0, Width: 18, Path: `${path}.Name` },
    { Key: 'Priority', Label: Texts.FormPriority, Kind: 'Number', Text: NumberText(workpiece.Priority), Row: 1, Path: `${path}.Priority` },
    { Key: 'Batch', Label: Texts.FormBatch, Kind: 'Number', Text: NumberText(workpiece.Batch ?? 1), Row: 2, Path: `${path}.Batch` },
    { Key: 'RoutesLabel', Label: FormatText(Texts.FormRoutesCount, { Count: workpiece.Routes.length }), Kind: 'Label', Row: 3 },
  ];
  const apply = (target, values) => {
    const record = target.Workpieces[number - 1];
    record.Name = values.Name;
    record.Priority = values.Priority;
    record.Batch = values.Batch;
  };
  FormBox(FormatText(Texts.FormWorkpieceTitle, { N: number, Name: workpiece.Name }), fields,
    [Texts.ButtonOk, Texts.FormRoutesButton, Texts.ButtonCancel], (index, form) => {
      if (index !== 0 && index !== 1) return Done(ctx, false);
      const errors = SubmitModelForm(model, form.Fields, apply, [`${path}.Name`, `${path}.Priority`, `${path}.Batch`], ctx.OnChange);
      if (errors.length) return errors;
      return index === 1 ? () => RouteList(model, number, ctx) : Done(ctx, true);
    }, { Position: ctx.Position ?? 'Center', Avoid: ctx.Avoid ?? null });
}

// [U] RouteText – marsruut ühe reana: „1. (prioriteet 1) treimine → freesimine“.
export function RouteText(route, index) {
  const text = FormatText(Texts.FormRouteLine, { N: index + 1, Priority: route.Priority, Ops: route.Ops.map(operation => operation.Op).join(' → ') });
  return Array.from(text).length > 60 ? `${Array.from(text).slice(0, 59).join('')}…` : text;
}

// [U] RouteList – detailitüübi marsruudid; valik avab marsruudi, viimane rida lisab uue.
function RouteList(model, number, ctx) {
  const workpiece = model.Workpieces[number - 1];
  const items = [...workpiece.Routes.map(RouteText), Texts.FormNewRoute];
  ListBox(FormatText(Texts.FormRoutesTitle, { Name: workpiece.Name }), [Texts.FormRoutesHint], items, (index) => {
    if (index === null) { if (ctx.Then) ctx.Then(true); return; }
    if (index === workpiece.Routes.length) {
      const before = JSON.stringify(model);
      const last = workpiece.Routes[workpiece.Routes.length - 1];
      workpiece.Routes.push({ Priority: last.Priority + 1, Ops: structuredClone(last.Ops) });
      if (ctx.OnChange) ctx.OnChange(before);
    }
    EditRoute(model, number, index + 1, ctx);
  });
}

// [U] RouteFields – marsruudi vormi väljad: prioriteet ja operatsioonide tabel (operatsioon, keskmine, kõrvalekalle).
function RouteFields(draft, choices, path) {
  const fields = [
    { Key: 'Priority', Label: Texts.FormPriority, Kind: 'Number', Text: draft.Priority, Row: 0, Path: `${path}.Priority` },
    { Key: 'Header', Label: Texts.FormRouteHeader, Kind: 'Label', Row: 1 },
  ];
  draft.Ops.forEach((operation, k) => {
    const opPath = `${path}.Ops[${k + 1}]`;
    fields.push(
      { Key: `Op${k}`, Label: `${k + 1}.`, Kind: 'Choice', Choices: choices, Value: Math.max(0, choices.indexOf(operation.Op)), Row: 2 + k, X: 0, LabelWidth: 4, Width: 20, Path: `${opPath}.Op`, ErrorLabel: FormatText(Texts.FormOpN, { N: k + 1 }) },
      { Key: `Mean${k}`, Label: '', Kind: 'Number', Text: operation.Mean, Row: 2 + k, X: 25, LabelWidth: 0, Width: 9, Path: `${opPath}.Mean`, ErrorLabel: FormatText(Texts.FormMeanN, { N: k + 1 }) },
      { Key: `Dev${k}`, Label: '±', Kind: 'Number', Text: operation.Dev, Row: 2 + k, X: 35, LabelWidth: 2, Width: 8, Path: `${opPath}.Dev`, ErrorLabel: FormatText(Texts.FormDevN, { N: k + 1 }) },
    );
  });
  return fields;
}

// [U] ReadRouteDraft – vormist tagasi mustandiks (et lisada / eemaldada rida ilma sisestatut kaotamata).
function ReadRouteDraft(form, choices) {
  const field = key => form.Fields.find(candidate => candidate.Key === key);
  const draft = { Priority: field('Priority').Text, Ops: [] };
  for (let k = 0; field(`Op${k}`); k++) {
    draft.Ops.push({ Op: choices[field(`Op${k}`).Value], Mean: field(`Mean${k}`).Text, Dev: field(`Dev${k}`).Text });
  }
  return draft;
}

// [U] EditRoute – üks marsruut: prioriteet ja operatsioonid; + op / − op / Kustuta.
function EditRoute(model, number, routeNumber, ctx) {
  const workpiece = model.Workpieces[number - 1];
  const route = workpiece.Routes[routeNumber - 1];
  const path = `Workpieces[${number}].Routes[${routeNumber}]`;
  const choices = KnownOperations(model, route.Ops.map(operation => operation.Op));
  const draft = {
    Priority: NumberText(route.Priority),
    Ops: route.Ops.map(operation => ({ Op: operation.Op, Mean: NumberText(operation.Mean), Dev: NumberText(operation.Dev) })),
  };
  const back = () => RouteList(model, number, ctx);
  const apply = (target, values) => {
    const record = target.Workpieces[number - 1].Routes[routeNumber - 1];
    record.Priority = values.Priority;
    const ops = [];
    for (let k = 0; `Op${k}` in values; k++) ops.push({ Op: values[`Op${k}`], Mean: values[`Mean${k}`], Dev: values[`Dev${k}`] });
    record.Ops = ops;
  };
  const buttons = [Texts.ButtonOk, Texts.FormAddOp, Texts.FormRemoveOp, Texts.FormDeleteRoute, Texts.ButtonCancel];
  FormBox(FormatText(Texts.FormRouteTitle, { N: routeNumber, Name: workpiece.Name }), RouteFields(draft, choices, path), buttons, (index, form) => {
    switch (index) {
      case 0: {
        const errors = SubmitModelForm(model, form.Fields, apply, [path], ctx.OnChange);
        return errors.length ? errors : back;
      }
      case 1: case 2: {
        const current = ReadRouteDraft(form, choices);
        if (index === 1) current.Ops.push({ ...current.Ops[current.Ops.length - 1] });
        else if (current.Ops.length > 1) current.Ops.pop();
        form.Fields = RouteFields(current, choices, path);
        return [];
      }
      case 3: {
        if (workpiece.Routes.length === 1) return [{ Key: null, Message: Texts.FormLastRoute }];
        const before = JSON.stringify(model);
        workpiece.Routes.splice(routeNumber - 1, 1);
        if (ctx.OnChange) ctx.OnChange(before);
        return back;
      }
      default:
        return back;
    }
  }, { Position: ctx.Position ?? 'Center', Avoid: ctx.Avoid ?? null });
}

// =====================================================================
// Mudel: Model data [U]
// =====================================================================

// [U] EditModelData – mudeli üldandmed: nimi, mõõtkava, simulatsiooni seeme, kestus, Kl, StallTime,
//     kestuse kõrvalekalde jaotus (Distribution, etapp 8).
export function EditModelData(model, ctx = {}) {
  const fields = [
    { Key: 'Name', Label: Texts.FormModelName, Kind: 'Text', Text: model.Meta.Name, Row: 0, Width: 24, Path: 'Meta.Name' },
    { Key: 'Scale', Label: Texts.FormScale, Kind: 'Number', Text: NumberText(model.Scale), Row: 1, Path: 'Scale' },
    { Key: 'Seed', Label: Texts.FormSeed, Kind: 'Number', Text: NumberText(model.Sim.Seed), Row: 2, Path: 'Sim.Seed' },
    { Key: 'Duration', Label: Texts.FormDuration, Kind: 'Number', Text: NumberText(model.Sim.Duration), Row: 3, Path: 'Sim.Duration' },
    { Key: 'Kl', Label: Texts.FormKl, Kind: 'Number', Text: NumberText(model.Sim.Kl), Row: 4, Path: 'Sim.Kl' },
    { Key: 'StallTime', Label: Texts.FormStallTime, Kind: 'Number', Text: NumberText(model.Sim.StallTime), Row: 5, Path: 'Sim.StallTime' },
    { Key: 'Distribution', Label: Texts.FormDistribution, Kind: 'Choice', Choices: DISTRIBUTIONS.map(name => Texts.FormDistributions[name]),
      Values: DISTRIBUTIONS, Value: Math.max(0, DISTRIBUTIONS.indexOf(model.Sim.Distribution ?? 'Uniform')), Row: 6, Path: 'Sim.Distribution' },
  ];
  const apply = (target, values) => {
    target.Meta.Name = values.Name;
    target.Scale = values.Scale;
    for (const key of ['Seed', 'Duration', 'Kl', 'StallTime', 'Distribution']) target.Sim[key] = values[key];
  };
  ModelForm(model, Texts.FormModelTitle, fields, apply, ['Meta', 'Scale', 'Sim'], ctx, { Lines: Texts.FormModelHint });
}

// =====================================================================
// Kontroll: vead ja hoiatused
// =====================================================================

// [U] ProblemLines – vead ja hoiatused nimekirja ridadeks: { Text, Cell } (Cell – koht joonisel või null).
export function ProblemLines(model) {
  const { Errors: errors, Warnings: warnings } = ModelProblems(model);
  const line = (problem, template) => {
    const where = problem.Path.startsWith('Layout') ? '' : `${problem.Path}: `;
    let text = FormatText(template, { Message: `${where}${problem.Message}` });
    if (Array.from(text).length > PROBLEM_TEXT_LENGTH) text = `${Array.from(text).slice(0, PROBLEM_TEXT_LENGTH - 1).join('')}…`;
    return { Text: text, Cell: ProblemCell(model, problem.Path) };
  };
  return { Errors: errors.length, Warnings: warnings.length,
    Lines: [...errors.map(problem => line(problem, Texts.CheckErrorLine)), ...warnings.map(problem => line(problem, Texts.CheckWarningLine))] };
}

// [U] ShowProblems – Edit → Check ja Layout-is K: vigade ja hoiatuste nimekiri; valitud rea koht
//     joonisel antakse onPick(lahter)-ile (Layout viib kursori sinna).
export function ShowProblems(model, onPick) {
  const problems = ProblemLines(model);
  if (problems.Lines.length === 0) { MessageBox(Texts.CheckTitle, [Texts.CheckAllGood]); return; }
  const shown = problems.Lines.slice(0, SHOWN_PROBLEMS);
  const items = shown.map(line => line.Text);
  if (problems.Lines.length > SHOWN_PROBLEMS) items.push(FormatText(Texts.LoadErrorMore, { Count: problems.Lines.length - SHOWN_PROBLEMS }));
  const header = FormatText(Texts.CheckSummary, { Errors: problems.Errors, Warnings: problems.Warnings });
  ListBox(Texts.CheckTitle, [header], items, (index) => {
    if (index === null || index >= shown.length || !shown[index].Cell) return;
    onPick(shown[index].Cell);
  });
}
