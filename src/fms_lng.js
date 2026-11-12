// FMSS – kõik kasutajale näidatavad tekstid.
// Vastab originaali failile FMS_LNG.INC. Nimed ja tunnused [O]/[T]/[U]: DISAIN.md osa 12.
//
// Menüü nimed on inglise keeles nagu originaalis (joon. 6.1); vihjed ja teated eesti keeles.
// Märk & menüü nimes tähistab kiirklahvi (järgmine täht).

// [O] Texts – tekstid võtme järgi. Kohatäide {Nimi} asendatakse FormatText-iga.
export const Texts = {
  // --- Avaekraan ---
  SplashPrompt: 'C:\\FMSS>FMS',
  SplashTitle: 'FMSS',
  SplashSubtitle: 'Paindautomatiseeritud tootmise simulatsioonisüsteem',
  SplashLines: [
    'Diplomiprojekt',
    'Tallinna Tehnikaülikool, Arvutitehnika Instituut, 1993',
    '',
    'Autor        K. Kannel',
    'Juhendaja    J. Riives',
    'Konsultant   V. Leppikson',
    '',
    'Alustatud 1993 … valmis 2026',
    '(läks ainult 33 aastat, aga valmis sai)',
  ],
  SplashAnyKey: 'Vajuta suvalist klahvi…',

  // --- Peamenüü ---
  MenuFile: '&File',
  MenuEdit: '&Edit',
  MenuAdvise: '&Advise',
  MenuSimulate: '&Simulate',
  MenuReport: '&Report',
  MenuOptions: '&Options',
  MenuQuit: '&Quit',

  MenuLoad: '&Load',
  MenuPick: '&Pick',
  MenuNew: '&New',
  MenuSave: '&Save',
  MenuWriteAs: '&Write as',
  MenuDirectory: '&Directory',
  MenuChangeDir: '&Change dir',
  MenuRename: '&Rename',
  MenuDelete: 'D&elete',

  MenuLayout: '&Layout',
  MenuView: '&View',
  MenuConfig: '&Config',
  MenuConfigAll: '&All',
  MenuConfigChoose: '&Choose',
  MenuTransport: '&Transport',
  MenuWorkpieceData: '&Workpiece data',
  MenuWpEdit: '&Edit',
  MenuWpCopy: '&Copy',
  MenuWpFlush: '&Flush',
  MenuStorageData: '&Storage data',

  MenuLayoutChooser: 'Layout &Chooser',
  MenuLayoutFinder: 'Layout &Finder',

  MenuStatic: '&Static',
  MenuDynamic: '&Dynamic',
  MenuOutput: '&Output',
  MenuDisplay: '&Display',
  MenuToFile: '&File',

  MenuTheme: '&Theme',
  MenuThemeEga: '&EGA',
  MenuThemeModern: '&Modern',
  MenuColors: '&Colors',
  MenuColorsAuto: '&Auto',
  MenuColorsLight: '&Light',
  MenuColorsDark: '&Dark',

  // --- Menüü vihjed (olekureal) ---
  HintFile: 'Mudeli laadimine ja salvestamine',
  HintEdit: 'Mudeli redigeerimine',
  HintAdvise: 'Struktuuri soovitamine (planeerimistase)',
  HintSimulate: 'Simulatsioon ja animatsioon',
  HintReport: 'Aruanded',
  HintOptions: 'Keskkonna seaded',
  HintQuit: 'Töö lõpetamine',
  HintLoad: 'Laadi näidismudel või fail arvutist',
  HintPick: 'Vali viimati kasutatud mudelite seast',
  HintNew: 'Alusta tühja mudeliga',
  HintSave: 'Salvesta mudel faili (laaditakse alla)',
  HintWriteAs: 'Salvesta mudel uue nimega',
  HintNoDisk: 'Brauseris pole kettale ligipääsu',
  HintTheme: 'Välimus: EGA või kaasaegne (F2)',
  HintColors: 'Kaasaegse välimuse värvid',
  HintColorsEgaOnly: 'Värve saab valida ainult kaasaegses välimuses',
  HintNotYet: 'Tuleb etapis {Stage}',

  // --- Olekurida ---
  StatusKeys: [
    { Key: 'F1', Label: 'Abi' },
    { Key: 'F2', Label: 'Teema' },
    { Key: 'F10', Label: 'Menüü' },
    { Key: 'Alt-X', Label: 'Välju' },
  ],
  StatusMenuKeys: [
    { Key: '←→↑↓', Label: 'Vali' },
    { Key: 'Enter', Label: 'Ava' },
    { Key: 'Esc', Label: 'Tagasi' },
  ],

  // --- Dialoogid ---
  ButtonOk: 'OK',
  ButtonYes: 'Jah',
  ButtonNo: 'Ei',
  ButtonCancel: 'Loobu',

  NotYetTitle: 'Pole veel valmis',
  NotYetText: '{What} tuleb etapis {Stage}.',

  QuitTitle: 'Quit',
  QuitText: 'Kas lõpetad töö?',

  HelpTitle: 'Abi',
  HelpLines: [
    'F10 või Alt        avab menüü',
    'Alt + täht         avab menüü otse',
    '← → ↑ ↓            liigub menüüs',
    'Enter              valib',
    'Esc                sulgeb',
    'F2                 vahetab välimust (EGA / kaasaegne)',
    'Alt-X              lõpetab töö',
    '',
    'Hiirega saab kõike valida klõpsuga.',
  ],

  LoadTitle: 'Load',
  LoadFromComputer: 'Fail arvutist…',
  PickTitle: 'Pick',
  PickEmpty: 'Viimati kasutatud mudeleid veel pole.',
  WriteAsTitle: 'Write as',
  WriteAsPrompt: 'Mudeli nimi:',
  NewTitle: 'New',
  NewDone: 'Uus tühi mudel on loodud.',
  SaveDone: 'Mudel salvestati faili {File}.',

  LoadErrorTitle: 'Viga',
  LoadErrorRead: 'Faili {File} ei õnnestunud lugeda.',
  LoadErrorJson: 'Fail {File} ei ole korrektne JSON: {Detail}',
  LoadErrorModel: 'Fail {File} ei ole korrektne FMSS-i mudel:',
  LoadErrorMore: '… ja veel {Count} viga',

  // --- Töölaud ---
  DesktopModelTitle: 'Mudel',
  DesktopNoModel: 'Mudelit pole laaditud. Vali File → Load.',
  DesktopModelName: 'Nimi',
  DesktopModelFile: 'Fail',
  DesktopModelGrid: 'Ruudustik',
  DesktopModelCounts: 'Koosseis',
  DesktopModelCountsValue: 'radu {Tracks}, tööpinke {Machines}, puhvreid {Buffers}, detailitüüpe {Workpieces}',
  DesktopModelGridValue: '{X} × {Y} ikooni',
  DesktopVersion: 'versioon 2026',
  NoTracks: '(radu pole)',
  NoWorkpieces: '(detailitüüpe pole)',
  DesktopUntitled: 'Nimetu',

  // --- Mudeli kontroll (CheckModel) ---
  CheckNotObject: 'peab olema objekt',
  CheckNotArray: 'peab olema massiiv',
  CheckMissing: 'puudub',
  CheckNotString: 'peab olema tekst',
  CheckEmptyString: 'ei tohi olla tühi',
  CheckNotInteger: 'peab olema täisarv',
  CheckNotNumber: 'peab olema arv',
  CheckMin: 'peab olema vähemalt {Min}',
  CheckAbove: 'peab olema suurem kui {Min}',
  CheckMax: 'peab olema kõige rohkem {Max}',
  CheckRange: 'peab olema vahemikus {Min} … {Max}',
  CheckOneOf: 'peab olema üks järgmistest: {Values}',
  CheckOutsideGrid: 'lahter ({X}, {Y}) on ruudustikust väljas',
  CheckDuplicateCell: 'lahtris ({X}, {Y}) on juba ikoon',
  CheckNoObject: 'viitab objektile nr {N}, aga {Array} on ainult {Count}',
  CheckDevTooLarge: 'kõrvalekalle ei tohi olla suurem kui keskmine',
  CheckUnknownOp: 'operatsiooni „{Op}“ ei tee ükski tööpink',
  CheckTooManyTypes: 'detailitüüpe võib olla kõige rohkem {Max}',
};

// [U] FormatText – asendab tekstis kohatäited {Nimi} väärtustega.
//     Kutsub: kõik, kes näitavad kasutajale muutuva sisuga teksti.
export function FormatText(template, values = {}) {
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    (name in values ? String(values[name]) : whole));
}
