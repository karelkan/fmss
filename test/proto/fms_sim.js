// FMSS – simulaatori tuum, PROTOTÜÜP (etapp 2).
// Vastab originaali moodulitele FMS_SIM.PAS ja FMS_GLB1.PAS.
// Disain: DISAIN.md osad 1–7. Nimed ja tunnused [O]/[T]/[U]: DISAIN.md osa 12.
//
// Prototüübi piirangud:
//  - ainult pidevad suletud konveierid, kõik jaamad ühel rajal;
//  - mudel antakse "kompileeritud" kujul (rada = pikkus, jaamad = asukohad),
//    ikoonidest rajavõrgu ehitamine (Enumerate) tuleb hiljem;
//  - rikked (Crash) ja diskreetsed rajad puuduvad.

// =====================================================================
// Globaalsed andmed
// =====================================================================

let SYSTEM_TIME = 0;          // [O] simulatsiooni kell, sekundit algusest
let NO_EVENTS = true;         // [O] käesolevaks hetkeks pole rohkem sündmusi
let SIMULATION_DONE = false;  // [O] simulatsioon on läbi
let DEADLOCK = false;         // [U] ummik, mida ei õnnestunud lahendada

let FirstAtMoment = null;     // [O] viit Event Listi esimesele kirjele

let Model = null;             // [U] laaditud mudel (sisendandmed)
let Options = null;           // [U] käivitamise seaded (nt invariantide kontroll)
let Tracks = [];              // [O] rajad (siin: suletud konveierid)
let StationArray = [];        // [U] jaamad, kus alused peatuvad ja laaditakse
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
// Juhuarvud
// =====================================================================

// [U] Random – seemnega juhuarv vahemikus [0, 1) (mulberry32).
//     Kutsub: SampleDuration, SelectByDiscipline. Sündmusi ei lisa.
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
//     Kutsub: SimStep, SimInit.
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

// [U] StationDistance – kaugus konveieri liikumissuunas jaamast jaama, cm.
function StationDistance(fromStation, toStation) {
  const track = Tracks[StationArray[fromStation].Track];
  return ((StationArray[toStation].Position - StationArray[fromStation].Position) % track.Length + track.Length) % track.Length;
}

// [U] CurrentStationOf – jaam, kus detail parasjagu on (transpordi lähtekoht), või -1.
function CurrentStationOf(workpiece) {
  switch (workpiece.Location.Kind) {
    case 'FromCS': return Model.FromCSStation;
    case 'Storage': return Model.FromCSStation;   // pargitud detail lahkub FromCS kaudu
    case 'Buffer': return BufferArray[workpiece.Location.Index].Station;
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
// Pikapi (alusele laadimise) kandidaadid
// =====================================================================

// [U] PickupCandidate – vanim detail jaamas, millel on sihtkoht broneeritud ja mis ootab alust.
//     Kutsuvad: MinuteMan (NeedsStop), StopMovProc, AfterPalletAtStation.
function PickupCandidate(stationIndex) {
  const station = StationArray[stationIndex];
  let candidateIds = [];
  if (station.Kind === 'FromCS') {
    candidateIds = FromCSQueue;
  } else if (station.Kind === 'Buffer') {
    // tavaliselt väljaminevad; pargitav sissetulev detail (ummik) on samuti WAIT_PICKUP
    candidateIds = BufferArray[station.Buffer].Entries.map(entry => entry.WP);
  }
  let best = null;
  for (const workpieceId of candidateIds) {
    const workpiece = SysWPArray[workpieceId];
    if (workpiece.State !== 'WAIT_PICKUP') continue;
    if (best === null || workpiece.StateSince < best.StateSince
        || (workpiece.StateSince === best.StateSince && workpiece.Id < best.Id)) best = workpiece;
  }
  return best;
}

// =====================================================================
// MinuteMan – konveierite liigutamine
// =====================================================================

// [T] NeedsStop – kas alus peab jaamas peatuma: mahalaadimine (detaili sihtkoht) või
//     pealelaadimine (alus tühi, jaamas ootab detail).
function NeedsStop(track, palletIndex, stationIndex) {
  const pallet = track.Pallets[palletIndex];
  if (pallet.WP !== null) {
    const destination = SysWPArray[pallet.WP].Destination;
    return destination !== null && destination.Station === stationIndex;
  }
  return PickupCandidate(stationIndex) !== null;
}

// [O] MinuteMan – liigutab iga liikuvat konveierit ühe sekundi võrra. Kui mõni alus ületab
//     jaama, kus tal on tegevus, peatab konveieri täpselt seal (lähim ületus) ja lisab StopMov.
//     Kutsub: SimStep. Lisab: StopMov.
function MinuteMan() {
  const EPSILON = 1e-6;
  Tracks.forEach((track, trackIndex) => {
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
    PutEvent({ Event: 'StopMov', Track: trackIndex, Pal: bestStop.palletIndex,
               ObjType: 'Station', ObjCode: bestStop.stationIndex });
  });
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
    const workpiece = SysWPArray[pallet.WP];
    if (workpiece.Destination !== null && workpiece.Destination.Station === stationIndex) {
      BeginUnloadFromPallet(currentEvent.Track, currentEvent.Pal, stationIndex);
      return;
    }
  } else {
    const candidate = PickupCandidate(stationIndex);
    if (candidate !== null) {
      BeginPickup(currentEvent.Track, currentEvent.Pal, stationIndex, candidate);
      return;
    }
  }
  PutEvent({ Event: 'MoveZ', Track: currentEvent.Track });  // tegevus kadus vahepeal
}

// [U] BeginUnloadFromPallet – alustab detaili mahalaadimist aluselt jaama objekti.
function BeginUnloadFromPallet(trackIndex, palletIndex, stationIndex) {
  const workpiece = SysWPArray[Tracks[trackIndex].Pallets[palletIndex].WP];
  SetWPState(workpiece, 'LOADING');
  PutEvent({
    Event: 'Load', WP: workpiece.Id, Track: trackIndex, Pal: palletIndex,
    SrcType: 'Pallette', SrcCode: palletIndex,
    ...DestinationObject(workpiece.Destination),
    Time: SYSTEM_TIME + StationLoadTime(trackIndex, stationIndex),
  });
}

// [U] BeginPickup – alustab detaili pealelaadimist jaamast alusele.
function BeginPickup(trackIndex, palletIndex, stationIndex, workpiece) {
  const station = StationArray[stationIndex];
  Tracks[trackIndex].Pallets[palletIndex].ReservedWP = workpiece.Id;
  SetWPState(workpiece, 'LOADING');
  PutEvent({
    Event: 'Load', WP: workpiece.Id, Track: trackIndex, Pal: palletIndex,
    SrcType: station.Kind === 'FromCS' ? 'SysInput' : 'Buffer',
    SrcCode: station.Kind === 'FromCS' ? stationIndex : station.Buffer,
    ObjType: 'Pallette', ObjCode: palletIndex,
    Time: SYSTEM_TIME + StationLoadTime(trackIndex, stationIndex),
  });
}

// [U] AfterPalletAtStation – pärast mahalaadimist: kui samas jaamas ootab detail, laadi kohe
//     peale (konveier seisab edasi), muidu konveier jätkab.
function AfterPalletAtStation(trackIndex, palletIndex, stationIndex) {
  Planner('PalletUnloaded');
  const candidate = PickupCandidate(stationIndex);
  if (candidate !== null) {
    BeginPickup(trackIndex, palletIndex, stationIndex, candidate);
  } else {
    PutEvent({ Event: 'MoveZ', Track: trackIndex });
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
    SetWPState(workpiece, 'WAIT_MACHINE');
    AfterPalletAtStation(currentEvent.Track, currentEvent.Pal, buffer.Station);

  } else if (source === 'Pallette' && target === 'SysOutput') {
    // rajalt kesklattu või süsteemist välja
    const pallet = Tracks[currentEvent.Track].Pallets[currentEvent.Pal];
    const destination = workpiece.Destination;
    pallet.WP = null;
    workpiece.Destination = null;
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

  } else if (target === 'Pallette') {
    // jaamast (puhvri väljaminev koht või FromCS) alusele
    const pallet = Tracks[currentEvent.Track].Pallets[currentEvent.Pal];
    if (source === 'Buffer') {
      const buffer = BufferArray[currentEvent.SrcCode];
      buffer.Entries = buffer.Entries.filter(entry => entry.WP !== workpiece.Id);
    } else {
      FromCSQueue = FromCSQueue.filter(workpieceId => workpieceId !== workpiece.Id);
    }
    pallet.ReservedWP = null;
    pallet.WP = workpiece.Id;
    workpiece.Location = { Kind: 'Pallet', Track: currentEvent.Track, Pal: currentEvent.Pal };
    SetWPState(workpiece, 'ON_PALLET');
    PutEvent({ Event: 'MoveZ', Track: currentEvent.Track });
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
      SetWPState(workpiece, 'WAIT_PICKUP');
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
  SetWPState(workpiece, 'WAIT_PICKUP');
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
};

// =====================================================================
// Planner
// =====================================================================

// [O nimi, T sisu] Planner – operatiivtaseme otsused. Teeb igal kutsel täieliku ülevaatuse:
//     1) laadib vabad tööpingid puhvrist, 2) leiab ootavatele detailidele sihtkoha ja
//     broneerib selle, 3) toob süsteemi uusi detaile. Olekuid otse ei muuda – lisab sündmusi.
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
    SetWPState(workpiece, 'WAIT_PICKUP');
  }
}

// [O nimi, T sisu] FindMach – sobivaim tööpink operatsioonile, mille puhvris on vaba koht.
//     Eelistus: vaba ja tühja järjekorraga pink -> lühim järjekord -> lähim konveieri suunas.
//     Tagastab pingi indeksi või -1.
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
    const queueLength = buffer.Entries.filter(entry => entry.Dir === 'In').length + buffer.Reserved;
    const busy = machine.State === 'IDLE' ? 0 : 1;
    const score = [
      busy === 0 && queueLength === 0 ? 0 : 1,
      queueLength + busy,
      fromStation >= 0 ? StationDistance(fromStation, buffer.Station) : 0,
    ];
    if (bestScore === null || CompareScores(score, bestScore) < 0) { best = machine.Index; bestScore = score; }
  }
  return best;
}

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
      Location: { Kind: 'Entering' }, Destination: null, OutSysPlanned: false,
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
        if (MachineArray.some(candidate => candidate !== machine && candidate.Ops.includes(nextOperation.Op)
            && slotObtainable(BufferArray[candidate.InBuffer]))) return true;
        continue;
      }
      if (workpiece.State !== 'WAIT_DEST') return true;
      const operation = CurrentOp(workpiece);
      if (operation === null) return true;
      for (const candidate of MachineArray) {
        if (candidate.Ops.includes(operation.Op) && slotObtainable(BufferArray[candidate.InBuffer])) return true;
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
//     (pargitakse). Kui kesklattu ei saa, on ummik lahendamatu -> simulatsioon peatub.
//     Varukontroll: kui midagi ei toimu üle StallTime ja süsteemis on detaile -> peatub.
//     Kutsub: SimStep.
function DetectDeadlock() {
  const deadlocked = FindDeadlockedWorkpieces();
  if (deadlocked.length > 0) {
    if (StorageFree()) {
      const workpiece = deadlocked[0];
      Storage.Reserved++;
      workpiece.Destination = { Kind: 'ToCS', Station: Storage.Station, Park: true };
      SetWPState(workpiece, 'WAIT_PICKUP');
      Stats.Parked++;
    } else {
      DEADLOCK = true;
      Stats.DeadlockReason = `ringootamine: ${deadlocked.map(workpiece => `WP${workpiece.Id}`).join(', ')}`;
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
    Stats.DeadlockReason = `midagi ei toimu ${Model.Sim.StallTime} s`;
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
      default: fail(`WP${workpiece.Id} tundmatu asukoht ${location.Kind}`);
    }
  }
  // tagurpidi: struktuuris olev detail viitab samale kohale; mahutavused
  for (const buffer of BufferArray) {
    if (buffer.Entries.length + buffer.Reserved > buffer.Capacity) fail(`puhver ${buffer.Name} ületäis`);
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
    if (track.StopCount < 0) fail(`rada ${track.Name} StopCount < 0`);
    track.Pallets.forEach((pallet, palletIndex) => {
      if (pallet.WP !== null) {
        const location = SysWPArray[pallet.WP].Location;
        if (location.Kind !== 'Pallet' || location.Track !== trackIndex || location.Pal !== palletIndex) fail(`alus ${palletIndex} detail vale asukohaga`);
      }
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

// =====================================================================
// Statistika
// =====================================================================

// [T] CollectStats – kogub iga sekundi lõpus aegridade statistika.
function CollectStats() {
  for (const buffer of BufferArray) {
    buffer.FillIntegral += buffer.Entries.length;
    buffer.MaxFill = Math.max(buffer.MaxFill, buffer.Entries.length);
  }
  for (const track of Tracks) {
    if (track.StopCount > 0) track.StoppedTime++; else track.MovingTime++;
  }
  Stats.WipIntegral += CountWorkpiecesInSystem();
}

// [T] SimReport – kokkuvõte: läbilaskevõime, tsükliaeg ja osakaalud, pinkide rakendatus jne.
export function SimReport() {
  const time = Math.max(1, SYSTEM_TIME);
  const finished = Stats.Finished;
  const sum = { Process: 0, Setup: 0, Load: 0, Transport: 0, Wait: 0 };
  let cycleSum = 0;
  for (const item of finished) {
    cycleSum += item.TimeOut - item.TimeIn;
    for (const key of Object.keys(sum)) sum[key] += item.Times[key];
  }
  const share = key => (cycleSum > 0 ? sum[key] / cycleSum : 0);
  return {
    Model: Model.Name,
    Seed: Model.Sim.Seed,
    Time: SYSTEM_TIME,
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
    Shares: { Process: share('Process'), Setup: share('Setup'), Load: share('Load'),
              Transport: share('Transport'), Wait: share('Wait') },
    Machines: MachineArray.map(machine => {
      const stateTime = { ...machine.StateTime };
      stateTime[machine.State] = (stateTime[machine.State] || 0) + SYSTEM_TIME - machine.StateSince;
      const busy = (stateTime.LOADING || 0) + (stateTime.SETUP || 0) + (stateTime.PROCESSING || 0) + (stateTime.UNLOADING || 0);
      return { Name: machine.Name, Utilization: busy / time, ProcessingShare: (stateTime.PROCESSING || 0) / time, StateTime: stateTime };
    }),
    Buffers: BufferArray.map(buffer => ({ Name: buffer.Name, AvgFill: buffer.FillIntegral / time, MaxFill: buffer.MaxFill })),
    Tracks: Tracks.map(track => ({ Name: track.Name, MovingShare: track.MovingTime / time })),
    StorageCount: Storage !== null ? Storage.Count : null,
    EventCount: Stats.EventCount,
    EventCountByType: Stats.EventCountByType,
    Finished: finished,
  };
}

// =====================================================================
// Käivitamine
// =====================================================================

// [O] SimInit – loeb mudeli, eraldab andmestruktuurid, seab algväärtused ja töötleb hetke 0.
export function SimInit(inputModel, inputOptions = {}) {
  Model = structuredClone(inputModel);
  Model.Sim = { ReserveNextBeforeStart: true, ...Model.Sim };  // ummiku vältimine vaikimisi sees
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
            PlannerCalls: 0, LastProgressTime: 0, WipIntegral: 0, Finished: [] };

  Tracks = Model.Tracks.map((track, trackIndex) => {
    if (track.Mode !== 'Continuous') throw new Error('Prototüüp toetab ainult pidevaid radu');
    return {
      ...track, Index: trackIndex, Offset: 0, StopCount: 0, MovingTime: 0, StoppedTime: 0, Stations: [],
      Pallets: Array.from({ length: track.Carts }, (unused, palletIndex) => ({ Index: palletIndex, WP: null, ReservedWP: null })),
    };
  });
  StationArray = Model.Stations.map((station, stationIndex) => ({ ...station, Index: stationIndex }));
  StationArray.forEach(station => Tracks[station.Track].Stations.push(station.Index));
  BufferArray = Model.Buffers.map((buffer, bufferIndex) => ({
    ...buffer, Index: bufferIndex, Entries: [], Reserved: 0, FillIntegral: 0, MaxFill: 0,
  }));
  MachineArray = Model.Machines.map((machine, machineIndex) => ({
    ...machine, Index: machineIndex, State: 'IDLE', StateSince: 0, StateTime: {}, WP: null, LastOp: null,
  }));
  Workpieces = Model.Workpieces.map(type => ({ ...type, Started: 0, Completed: 0 }));

  Model.FromCSStation = StationArray.findIndex(station => station.Kind === 'FromCS');
  Model.SysOutStation = StationArray.findIndex(station => station.Kind === 'SysOut');
  const toCSStation = StationArray.findIndex(station => station.Kind === 'ToCS');
  if (Model.FromCSStation < 0) throw new Error('Mudelis pole FromCS jaama');
  if (Model.SysOutStation < 0) throw new Error('Mudelis pole SysOut jaama');
  Storage = Model.Storage && toCSStation >= 0
    ? { ParkingReserve: 2, ...Model.Storage, Station: toCSStation, Count: 0, Parked: [], Reserved: 0 }
    : null;

  TotalPlaces = Tracks.reduce((sum, track) => sum + track.Carts * track.PlacesPerCart, 0)
    + MachineArray.length
    + BufferArray.reduce((sum, buffer) => sum + buffer.Capacity, 0);

  Planner('Init');
  ProcAllEvents();
  if (Options.CheckInvariants) CheckInvariants();
}

// [O] SimStep – üks sekund: kell edasi, MinuteMan, kõik selle hetke sündmused, ummiku kontroll.
//     Järjekord erineb originaalist (joon. 5.3): MinuteMan enne sündmusi (DISAIN.md 1).
export function SimStep() {
  SYSTEM_TIME++;
  MinuteMan();
  ProcAllEvents();
  DetectDeadlock();
  if (Options.CheckInvariants) CheckInvariants();
  CollectStats();
  if (SYSTEM_TIME >= Model.Sim.Duration) SIMULATION_DONE = true;
}

// [U] SimRun – käivitab simulatsiooni lõpuni ja tagastab aruande.
export function SimRun(inputModel, inputOptions = {}) {
  SimInit(inputModel, inputOptions);
  while (!SIMULATION_DONE) SimStep();
  return SimReport();
}

// [U] SimState – sisemine olek testidele ja hiljem animaatorile (ainult lugemiseks).
export function SimState() {
  return { SYSTEM_TIME, SIMULATION_DONE, DEADLOCK, Tracks, StationArray, MachineArray, BufferArray,
           Storage, Workpieces, SysWPArray, FromCSQueue, FirstAtMoment, Stats };
}
