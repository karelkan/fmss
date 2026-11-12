// FMSS – globaalsed tüübid ja mudeli andmed.
// Vastab originaali moodulile FMS_GLB1.PAS. Disain: DISAIN.md osad 8 ja 12.
//
// Moodul ei kasuta brauserit, nii et seda saab testida Node'iga.

import { Texts, FormatText } from './fms_lng.js';

// =====================================================================
// Ikoonid (originaali joon. 5.4, lk 55)
// =====================================================================

// [O] IconTypes – ikooni tüüp → mis objekti see tähistab (Kind) ja mis massiivi N viitab (Array).
//     Kind: Track – rajalõik; Connector – radade ühendus; Buffer, Storage, Output, Machine – objektid.
//     [T] Ports – küljed, mille kaudu rada läbi ikooni kulgeb (N üles, E paremale, S alla, W vasakule);
//     Branch – hargnemisikooni (Tee*) haru külg. Ristmikul (Cruise) kulgeb rada otse läbi (N–S, W–E).
//     Arc – kaar (veerandring, pikkus π/4 ikooni). Kasutavad: CheckModel, Enumerate, redaktor, animaator.
export const IconTypes = {
  Empty:            { Kind: 'Empty',     Array: null },
  VertTr:           { Kind: 'Track',     Array: 'Tracks', Ports: ['N', 'S'] },
  HorTr:            { Kind: 'Track',     Array: 'Tracks', Ports: ['W', 'E'] },
  ArcNE:            { Kind: 'Track',     Array: 'Tracks', Ports: ['N', 'E'], Arc: true },
  ArcSE:            { Kind: 'Track',     Array: 'Tracks', Ports: ['S', 'E'], Arc: true },
  ArcNW:            { Kind: 'Track',     Array: 'Tracks', Ports: ['N', 'W'], Arc: true },
  ArcSW:            { Kind: 'Track',     Array: 'Tracks', Ports: ['S', 'W'], Arc: true },
  TeeN:             { Kind: 'Track',     Array: 'Tracks', Ports: ['W', 'E'], Branch: 'N' },
  TeeE:             { Kind: 'Track',     Array: 'Tracks', Ports: ['N', 'S'], Branch: 'E' },
  TeeS:             { Kind: 'Track',     Array: 'Tracks', Ports: ['W', 'E'], Branch: 'S' },
  TeeW:             { Kind: 'Track',     Array: 'Tracks', Ports: ['N', 'S'], Branch: 'W' },
  Cruise:           { Kind: 'Track',     Array: 'Tracks', Ports: ['N', 'E', 'S', 'W'] },
  VertCon:          { Kind: 'Connector', Array: null, Ports: ['N', 'S'] },
  HorCon:           { Kind: 'Connector', Array: null, Ports: ['W', 'E'] },
  InBuf:            { Kind: 'Buffer',    Array: 'Buffers' },
  OutBuf:           { Kind: 'Buffer',    Array: 'Buffers' },
  InOutBuf:         { Kind: 'Buffer',    Array: 'Buffers' },
  TurnBuf:          { Kind: 'Buffer',    Array: 'Buffers' },
  FromCS:           { Kind: 'Storage',   Array: null },
  ToCS:             { Kind: 'Storage',   Array: null },
  SysOut:           { Kind: 'Output',    Array: null },
  MachToolDown:     { Kind: 'Machine',   Array: 'Machines' },
  MachToolUp:       { Kind: 'Machine',   Array: 'Machines' },
  MachToolThruDown: { Kind: 'Machine',   Array: 'Machines' },
  MachToolThruUp:   { Kind: 'Machine',   Array: 'Machines' },
};

// [T] DIRECTIONS – ruudustiku suunad: samm (DX, DY) ja vastaskülg. Y kasvab alla.
export const DIRECTIONS = {
  N: { DX: 0, DY: -1, Opposite: 'S' },
  E: { DX: 1, DY: 0, Opposite: 'W' },
  S: { DX: 0, DY: 1, Opposite: 'N' },
  W: { DX: -1, DY: 0, Opposite: 'E' },
};

// [O/T] DirectionPorts – küljed, kuhu raja suunanool võib ikoonil näidata: ainult sirgel ja
//     kaarel (kaks külge), mitte hargnemisel ega ristmikul. Nool näitab, kummast küljest
//     kärud ikoonist väljuvad (DISAIN.md 2). Teistel ikoonidel tühi loend.
export function DirectionPorts(iconType) {
  const icon = IconTypes[iconType];
  if (!icon || icon.Kind !== 'Track' || icon.Branch || icon.Ports.length !== 2) return [];
  return icon.Ports;
}

// =====================================================================
// Mudeli piirid ja lubatud väärtused
// =====================================================================

export const MODEL_VERSION = 1;              // [U] mudelifaili vorming (Meta.Version)
export const MAX_WORKPIECE_TYPES = 16;       // [O] detailitüüpe kõige rohkem (lk 33)
export const TRACK_MODES = ['Continuous', 'Discrete'];       // [O] pidev / diskreetne rada
export const BUFFER_DISCIPLINES = ['FIFO', 'FILO', 'RANDOM']; // [O] puhvri distsipliin
// [O] OPERATIONS – tööpinkide operatsioonid (tabel 4.2, originaal.md 2.2). Simulatsioonile on
//     oluline ainult see, et need on erinevad; redaktor pakub neid valikuks (uus pink saab esimese).
export const OPERATIONS = ['treimine', 'puurimine', 'sisetreimine', 'freesimine', 'lihvimine',
  'kammlõikamine', 'hambalõikamine', 'erosioontöötlus', 'pesemine', 'mõõtmine'];

// =====================================================================
// Mudel
// =====================================================================

// [U] EmptyModel – uus tühi mudel (File → New). Läbib CheckModel-i.
//     Kutsub: fms_file.js. Sündmusi ei lisa.
export function EmptyModel(name = '') {
  return {
    Meta: { Name: name, Version: MODEL_VERSION },
    Scale: 100,
    Layout: { Dim: { X: 13, Y: 4 }, Cells: [] },
    EdgeLengths: [],
    Tracks: [],
    Machines: [],
    Buffers: [],
    Storage: { Capacity: 50, LoadTime: 20 },
    Workpieces: [],
    Sim: { Seed: 1, Duration: 28800, Kl: 0.85, StallTime: 600 },
  };
}

// [U] ModelSummary – mudeli lühikokkuvõte töölaual näitamiseks.
//     Kutsub: fms.js. Sündmusi ei lisa.
export function ModelSummary(model) {
  return {
    Name: model.Meta.Name,
    Dim: model.Layout.Dim,
    Tracks: model.Tracks.length,
    Machines: model.Machines.length,
    Buffers: model.Buffers.length,
    Workpieces: model.Workpieces.length,
  };
}

// =====================================================================
// Mudeli kontroll
// =====================================================================

// [U] CheckModel – kontrollib mudelifaili struktuuri: väljad, tüübid, väärtuste piirid,
//     lahtrite viited objektidele ja operatsioonide olemasolu tööpinkides.
//     Rajavõrgu kontroll (vabad otsad, hargnemised, seosed) on Enumerate-s (fms_sim.js).
//     Tagastab vigade loendi [{ Path, Message }]; tühi loend = mudel on korras.
//     Kutsub: fms_file.js, testid. Sündmusi ei lisa.
export function CheckModel(model) {
  const errors = [];
  const fail = (path, message) => errors.push({ Path: path, Message: message });

  // Abifunktsioonid: iga kontroll lisab vea ja tagastab, kas väärtus sobis.
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const checkObject = (value, path) => {
    if (value === undefined) { fail(path, Texts.CheckMissing); return false; }
    if (!isObject(value)) { fail(path, Texts.CheckNotObject); return false; }
    return true;
  };
  const checkArray = (value, path) => {
    if (value === undefined) { fail(path, Texts.CheckMissing); return false; }
    if (!Array.isArray(value)) { fail(path, Texts.CheckNotArray); return false; }
    return true;
  };
  const checkString = (value, path, { allowEmpty = false } = {}) => {
    if (value === undefined) { fail(path, Texts.CheckMissing); return false; }
    if (typeof value !== 'string') { fail(path, Texts.CheckNotString); return false; }
    if (!allowEmpty && value.trim() === '') { fail(path, Texts.CheckEmptyString); return false; }
    return true;
  };
  const checkNumber = (value, path, { integer = false, min = null, max = null, above = null } = {}) => {
    if (value === undefined) { fail(path, Texts.CheckMissing); return false; }
    if (typeof value !== 'number' || !Number.isFinite(value)) { fail(path, Texts.CheckNotNumber); return false; }
    if (integer && !Number.isInteger(value)) { fail(path, Texts.CheckNotInteger); return false; }
    if (above !== null && value <= above) { fail(path, FormatText(Texts.CheckAbove, { Min: above })); return false; }
    if (min !== null && max !== null && (value < min || value > max)) {
      fail(path, FormatText(Texts.CheckRange, { Min: min, Max: max })); return false;
    }
    if (min !== null && value < min) { fail(path, FormatText(Texts.CheckMin, { Min: min })); return false; }
    if (max !== null && value > max) { fail(path, FormatText(Texts.CheckMax, { Max: max })); return false; }
    return true;
  };
  const checkOneOf = (value, path, allowed) => {
    if (value === undefined) { fail(path, Texts.CheckMissing); return false; }
    if (!allowed.includes(value)) { fail(path, FormatText(Texts.CheckOneOf, { Values: allowed.join(', ') })); return false; }
    return true;
  };

  if (!checkObject(model, 'mudel')) return errors;

  // Meta, Scale
  if (checkObject(model.Meta, 'Meta')) {
    checkString(model.Meta.Name, 'Meta.Name', { allowEmpty: true });
    checkNumber(model.Meta.Version, 'Meta.Version', { integer: true, min: 1, max: MODEL_VERSION });
  }
  checkNumber(model.Scale, 'Scale', { above: 0 });

  // Objektide massiivid (enne Layout-i, sest lahtrid viitavad neile)
  const arrays = {};
  for (const name of ['Tracks', 'Machines', 'Buffers', 'Workpieces']) {
    arrays[name] = checkArray(model[name], name) ? model[name] : [];
  }

  arrays.Tracks.forEach((track, i) => {
    const path = `Tracks[${i + 1}]`;
    if (!checkObject(track, path)) return;
    checkString(track.Name, `${path}.Name`);
    checkOneOf(track.Mode, `${path}.Mode`, TRACK_MODES);
    checkNumber(track.Carts, `${path}.Carts`, { integer: true, min: 1 });
    checkNumber(track.PlacesPerCart, `${path}.PlacesPerCart`, { integer: true, min: 1 });
    checkNumber(track.Speed, `${path}.Speed`, { above: 0 });
    checkNumber(track.LoadTime, `${path}.LoadTime`, { min: 0 });
    checkNumber(track.AccessTime, `${path}.AccessTime`, { min: 0 });
  });

  const machineOps = new Set();
  arrays.Machines.forEach((machine, i) => {
    const path = `Machines[${i + 1}]`;
    if (!checkObject(machine, path)) return;
    checkString(machine.Name, `${path}.Name`);
    if (machine.Model !== undefined) checkString(machine.Model, `${path}.Model`, { allowEmpty: true });
    checkNumber(machine.LoadTime, `${path}.LoadTime`, { min: 0 });
    checkNumber(machine.SetupTime, `${path}.SetupTime`, { min: 0 });
    if (checkArray(machine.Ops, `${path}.Ops`)) {
      if (machine.Ops.length === 0) fail(`${path}.Ops`, Texts.CheckEmptyString);
      machine.Ops.forEach((op, j) => {
        if (checkString(op, `${path}.Ops[${j + 1}]`)) machineOps.add(op);
      });
    }
  });

  arrays.Buffers.forEach((buffer, i) => {
    const path = `Buffers[${i + 1}]`;
    if (!checkObject(buffer, path)) return;
    checkNumber(buffer.Capacity, `${path}.Capacity`, { integer: true, min: 1 });
    checkOneOf(buffer.Discipline, `${path}.Discipline`, BUFFER_DISCIPLINES);
    checkNumber(buffer.LoadTime, `${path}.LoadTime`, { min: 0 });
  });

  if (model.Storage !== null) {
    if (checkObject(model.Storage, 'Storage')) {
      checkNumber(model.Storage.Capacity, 'Storage.Capacity', { integer: true, min: 0 });
      checkNumber(model.Storage.LoadTime, 'Storage.LoadTime', { min: 0 });
    }
  }

  if (arrays.Workpieces.length > MAX_WORKPIECE_TYPES) {
    fail('Workpieces', FormatText(Texts.CheckTooManyTypes, { Max: MAX_WORKPIECE_TYPES }));
  }
  arrays.Workpieces.forEach((workpiece, i) => {
    const path = `Workpieces[${i + 1}]`;
    if (!checkObject(workpiece, path)) return;
    checkString(workpiece.Name, `${path}.Name`);
    checkNumber(workpiece.Priority, `${path}.Priority`, { integer: true, min: 1 });
    if (workpiece.Batch !== undefined) checkNumber(workpiece.Batch, `${path}.Batch`, { integer: true, min: 1 });
    if (!checkArray(workpiece.Routes, `${path}.Routes`)) return;
    if (workpiece.Routes.length === 0) fail(`${path}.Routes`, Texts.CheckEmptyString);
    workpiece.Routes.forEach((route, j) => {
      const routePath = `${path}.Routes[${j + 1}]`;
      if (!checkObject(route, routePath)) return;
      checkNumber(route.Priority, `${routePath}.Priority`, { integer: true, min: 1 });
      if (!checkArray(route.Ops, `${routePath}.Ops`)) return;
      if (route.Ops.length === 0) fail(`${routePath}.Ops`, Texts.CheckEmptyString);
      route.Ops.forEach((operation, k) => {
        const opPath = `${routePath}.Ops[${k + 1}]`;
        if (!checkObject(operation, opPath)) return;
        if (checkString(operation.Op, `${opPath}.Op`) && !machineOps.has(operation.Op)) {
          fail(`${opPath}.Op`, FormatText(Texts.CheckUnknownOp, { Op: operation.Op }));
        }
        const meanOk = checkNumber(operation.Mean, `${opPath}.Mean`, { above: 0 });
        const devOk = checkNumber(operation.Dev, `${opPath}.Dev`, { min: 0 });
        if (meanOk && devOk && operation.Dev > operation.Mean) fail(`${opPath}.Dev`, Texts.CheckDevTooLarge);
      });
    });
  });

  // Layout: ruudustik ja ikoonid
  if (checkObject(model.Layout, 'Layout')) {
    let dimOk = false;
    if (checkObject(model.Layout.Dim, 'Layout.Dim')) {
      const xOk = checkNumber(model.Layout.Dim.X, 'Layout.Dim.X', { integer: true, min: 1 });
      const yOk = checkNumber(model.Layout.Dim.Y, 'Layout.Dim.Y', { integer: true, min: 1 });
      dimOk = xOk && yOk;
    }
    if (checkArray(model.Layout.Cells, 'Layout.Cells')) {
      const occupied = new Set();
      model.Layout.Cells.forEach((cell, i) => {
        const path = `Layout.Cells[${i + 1}]`;
        if (!checkObject(cell, path)) return;
        const xOk = checkNumber(cell.X, `${path}.X`, { integer: true, min: 0 });
        const yOk = checkNumber(cell.Y, `${path}.Y`, { integer: true, min: 0 });
        if (xOk && yOk) {
          if (dimOk && (cell.X >= model.Layout.Dim.X || cell.Y >= model.Layout.Dim.Y)) {
            fail(path, FormatText(Texts.CheckOutsideGrid, { X: cell.X, Y: cell.Y }));
          }
          const key = `${cell.X},${cell.Y}`;
          if (occupied.has(key)) fail(path, FormatText(Texts.CheckDuplicateCell, { X: cell.X, Y: cell.Y }));
          occupied.add(key);
        }
        if (!checkOneOf(cell.T, `${path}.T`, Object.keys(IconTypes))) return;
        if (cell.Dot !== undefined && typeof cell.Dot !== 'boolean') {
          fail(`${path}.Dot`, FormatText(Texts.CheckOneOf, { Values: 'true, false' }));
        }
        // Suunanool (Dir): ainult raja sirgel või kaarel, mitte punktiirühendusel.
        if (cell.Dir !== undefined) {
          const allowed = cell.Dot ? [] : DirectionPorts(cell.T);
          if (allowed.length === 0) fail(`${path}.Dir`, Texts.CheckDirIcon);
          else checkOneOf(cell.Dir, `${path}.Dir`, allowed);
        }
        // Punktiirühendusel (Dot) pole oma objekti, seega ka viidet N.
        const arrayName = IconTypes[cell.T].Array;
        if (arrayName && !cell.Dot) {
          if (checkNumber(cell.N, `${path}.N`, { integer: true, min: 1 }) && cell.N > arrays[arrayName].length) {
            fail(`${path}.N`, FormatText(Texts.CheckNoObject,
              { N: cell.N, Array: arrayName, Count: arrays[arrayName].length }));
          }
        }
      });
    }
  }

  if (model.EdgeLengths !== undefined && checkArray(model.EdgeLengths, 'EdgeLengths')) {
    model.EdgeLengths.forEach((edge, i) => {
      const path = `EdgeLengths[${i + 1}]`;
      if (!checkObject(edge, path)) return;
      checkArray(edge.Cells, `${path}.Cells`);
      checkNumber(edge.Length, `${path}.Length`, { above: 0 });
    });
  }

  if (checkObject(model.Sim, 'Sim')) {
    checkNumber(model.Sim.Seed, 'Sim.Seed', { integer: true });
    checkNumber(model.Sim.Duration, 'Sim.Duration', { integer: true, min: 1 });
    checkNumber(model.Sim.Kl, 'Sim.Kl', { above: 0, max: 1 });
    checkNumber(model.Sim.StallTime, 'Sim.StallTime', { integer: true, min: 1 });
  }

  return errors;
}
