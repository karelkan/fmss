// FMSS prototüüp – valideerimise stsenaariumid (DISAIN.md osa 9).
// Mudelid on "kompileeritud" kujul: rada = pikkus, jaamad = asukohad rajal (cm).

// [U] ScenarioA – üks tööpink, kindlad ajad. Tulemus peab klappima käsitsi arvutusega.
//   Konveier 2000 cm, 20 cm/s (ring 100 s), 4 alust (vahe 500 cm), laadimine 10 s.
//   FromCS 0 cm, MT1 puhver 500 cm, SysOut 1000 cm. Pink: laadimine 10 s, töötlemine 300 s.
export function ScenarioA({ Kl = 0.85, Duration = 28800 } = {}) {
  return {
    Name: 'A – üks tööpink',
    Tracks: [{ Name: 'Konveier', Mode: 'Continuous', Length: 2000, Speed: 20, Carts: 4, PlacesPerCart: 1, LoadTime: 10 }],
    Stations: [
      { Name: 'FromCS', Track: 0, Position: 0, Kind: 'FromCS' },
      { Name: 'BUF1', Track: 0, Position: 500, Kind: 'Buffer', Buffer: 0 },
      { Name: 'SysOut', Track: 0, Position: 1000, Kind: 'SysOut' },
    ],
    Buffers: [{ Name: 'BUF1', Kind: 'InOutBuf', Capacity: 2, Discipline: 'FIFO', Station: 1, Machine: 0 }],
    Machines: [{ Name: 'MT1', LoadTime: 10, SetupTime: 0, Ops: ['treimine'], InBuffer: 0, OutBuffer: 0 }],
    Storage: null,
    Workpieces: [{ Name: 'Võll', Priority: 1, Routes: [{ Priority: 1, Ops: [{ Op: 'treimine', Mean: 300, Dev: 0 }] }] }],
    Sim: { Seed: 1, Duration, Kl, StallTime: 600 },
  };
}

// [U] ScenarioB – näidis-PTS (originaali joon. 5.5): suletud konveier, FromCS, kaks tööpinki
//   (MT1 InOutBuf-iga, MT2 TurnBuf-iga), ToCS ja SysOut. Kaks detailitüüpi, juhuslikud ajad.
export function ScenarioB({ Seed = 1, Duration = 28800, Kl = 0.85 } = {}) {
  return {
    Name: 'B – näidis-PTS',
    Tracks: [{ Name: 'Konveier', Mode: 'Continuous', Length: 3000, Speed: 20, Carts: 6, PlacesPerCart: 1, LoadTime: 15 }],
    Stations: [
      { Name: 'FromCS', Track: 0, Position: 0, Kind: 'FromCS' },
      { Name: 'BUF1', Track: 0, Position: 700, Kind: 'Buffer', Buffer: 0 },
      { Name: 'BUF2', Track: 0, Position: 1300, Kind: 'Buffer', Buffer: 1 },
      { Name: 'ToCS', Track: 0, Position: 2000, Kind: 'ToCS' },
      { Name: 'SysOut', Track: 0, Position: 2300, Kind: 'SysOut' },
    ],
    Buffers: [
      { Name: 'BUF1', Kind: 'InOutBuf', Capacity: 3, Discipline: 'FIFO', Station: 1, Machine: 0 },
      { Name: 'BUF2', Kind: 'TurnBuf', Capacity: 3, Discipline: 'FIFO', Station: 2, Machine: 1 },
    ],
    Machines: [
      { Name: 'MT1', LoadTime: 20, SetupTime: 120, Ops: ['treimine', 'puurimine'], InBuffer: 0, OutBuffer: 0 },
      { Name: 'MT2', LoadTime: 20, SetupTime: 90, Ops: ['freesimine', 'puurimine'], InBuffer: 1, OutBuffer: 1 },
    ],
    Storage: { Capacity: 30, LoadTime: 20 },
    Workpieces: [
      { Name: 'Võll', Priority: 1, Routes: [
        { Priority: 1, Ops: [{ Op: 'treimine', Mean: 240, Dev: 30 }, { Op: 'freesimine', Mean: 180, Dev: 20 }] },
        { Priority: 2, Ops: [{ Op: 'treimine', Mean: 240, Dev: 30 }, { Op: 'puurimine', Mean: 150, Dev: 15 }] },
      ] },
      { Name: 'Äärik', Priority: 1, Routes: [
        { Priority: 1, Ops: [{ Op: 'freesimine', Mean: 200, Dev: 30 }, { Op: 'puurimine', Mean: 120, Dev: 10 }] },
      ] },
    ],
    Sim: { Seed, Duration, Kl, StallTime: 600 },
  };
}

// [U] ScenarioC – ristmarsruudid: tüüp A läheb MT1 -> MT2, tüüp B MT2 -> MT1. Puhvrid mahutavusega 1
//   ja kõrge Kl -> ummik on tõenäoline. withStorage: kas ummiku lahendamiseks on keskladu.
export function ScenarioC({ withStorage = true, Seed = 1, Duration = 28800, Kl = 0.95 } = {}) {
  const stations = [
    { Name: 'FromCS', Track: 0, Position: 0, Kind: 'FromCS' },
    { Name: 'BUF1', Track: 0, Position: 500, Kind: 'Buffer', Buffer: 0 },
    { Name: 'BUF2', Track: 0, Position: 1000, Kind: 'Buffer', Buffer: 1 },
    { Name: 'SysOut', Track: 0, Position: 1700, Kind: 'SysOut' },
  ];
  if (withStorage) stations.push({ Name: 'ToCS', Track: 0, Position: 1500, Kind: 'ToCS' });
  return {
    Name: withStorage ? 'C – ristmarsruudid, keskladuga' : 'C – ristmarsruudid, ilma kesklaota',
    Tracks: [{ Name: 'Konveier', Mode: 'Continuous', Length: 2000, Speed: 20, Carts: 3, PlacesPerCart: 1, LoadTime: 10 }],
    Stations: stations,
    Buffers: [
      { Name: 'BUF1', Kind: 'InOutBuf', Capacity: 1, Discipline: 'FIFO', Station: 1, Machine: 0 },
      { Name: 'BUF2', Kind: 'InOutBuf', Capacity: 1, Discipline: 'FIFO', Station: 2, Machine: 1 },
    ],
    Machines: [
      { Name: 'MT1', LoadTime: 10, SetupTime: 30, Ops: ['a1', 'b2'], InBuffer: 0, OutBuffer: 0 },
      { Name: 'MT2', LoadTime: 10, SetupTime: 30, Ops: ['a2', 'b1'], InBuffer: 1, OutBuffer: 1 },
    ],
    Storage: withStorage ? { Capacity: 20, LoadTime: 10 } : null,
    Workpieces: [
      { Name: 'A', Priority: 1, Routes: [{ Priority: 1, Ops: [{ Op: 'a1', Mean: 200, Dev: 50 }, { Op: 'a2', Mean: 200, Dev: 50 }] }] },
      { Name: 'B', Priority: 1, Routes: [{ Priority: 1, Ops: [{ Op: 'b1', Mean: 200, Dev: 50 }, { Op: 'b2', Mean: 200, Dev: 50 }] }] },
    ],
    Sim: { Seed, Duration, Kl, StallTime: 600 },
  };
}

export const Scenarios = { A: ScenarioA, B: ScenarioB, C: ScenarioC };
