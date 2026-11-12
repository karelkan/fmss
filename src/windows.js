// FMSS – graafikateek: ekraan, peamenüü, alammenüüd, dialoogid, klaviatuur ja hiir.
// Vastab originaali moodulile WINDOWS.PAS (J. Raid). Välimus tuleb teemast (fms_theme.js);
// siin on ainult paigutus ja loogika, värve ega fonte siin pole.
//
// Menüüpunkt (MenuItem):
//   { Label, Hint, Action, Items, Enabled, Dim, Checked, Separator }
//   Label  – nimi, & märgib kiirklahvi ('&Load');
//   Items  – alammenüü (massiiv või funktsioon, mis selle tagastab);
//   Action – mida valik teeb; Enabled: false – ei saa valida; Dim: true – hall, aga valitav
//            (nt „tuleb hiljem“); Checked() – kas ees on linnuke.

import { ROW_HEIGHT } from './fms_theme.js';
import { Texts } from './fms_lng.js';

// =====================================================================
// Globaalsed andmed
// =====================================================================

let ScreenCanvas = null;       // [U] põhilõuend
let ScreenContext = null;      // [U] põhilõuendi joonistuskontekst
let ActiveTheme = null;        // [U] kehtiv välimus
let MainMenu = [];             // [O] peamenüü punktid
let MENU_ACTIVE = false;       // [O] menüü on avatud
let MenuPath = [];             // [U] valitud punktide indeksid tasemete kaupa: [peamenüü, alammenüü, …]
let DialogStack = [];          // [U] avatud dialoogid (viimane on pealmine)
let FullScreenPainter = null;  // [U] täisekraani joonistaja (avaekraan); null = töölaud menüüga
let FullScreenInput = null;    // [U] täisekraani klahvi/klõpsu käsitleja
let DesktopPainter = null;     // [U] töölaua sisu joonistaja
let Hotkeys = {};              // [U] kiirklahvid: 'F1', 'F2', 'Alt-X' … → protseduur
let RedrawPending = false;     // [U] joonistamine on järjekorras

const MENU_PAD_X = 8;          // menüüriba punkti vahe teksti ümber
const DROPDOWN_PAD_Y = 4;      // alammenüü raami ja esimese rea vahe
const DROPDOWN_GUTTER = 16;    // linnukese koht vasakul
const DROPDOWN_RIGHT = 24;     // alammenüü noole koht paremal
const DIALOG_PAD_X = 24;
const BUTTON_MIN_WIDTH = 64;
const BUTTON_GAP = 16;

// =====================================================================
// Ekraan
// =====================================================================

// [O] InitScreen – seob graafikateegi lõuendiga ning hiire ja klaviatuuriga.
//     Kutsub: fms.js üks kord käivitamisel.
export function InitScreen(canvas, theme) {
  ScreenCanvas = canvas;
  ScreenContext = canvas.getContext('2d');
  ActiveTheme = theme;
  ResizeScreen();
  window.addEventListener('resize', ResizeScreen);
  window.addEventListener('keydown', HandleKeyDown);
  canvas.addEventListener('pointerdown', (event) => HandlePointer(event, 'down'));
  canvas.addEventListener('pointermove', (event) => HandlePointer(event, 'move'));
  canvas.focus();
}

// [U] SetTheme – vahetab välimust (F2). Kutsub: fms.js.
export function SetTheme(theme) {
  ActiveTheme = theme;
  ResizeScreen();
}

// [U] ResizeScreen – lõuendi suurus = akna suurus seadme pikslites; teema arvutab paigutuse.
function ResizeScreen() {
  const ratio = window.devicePixelRatio || 1;
  ScreenCanvas.width = Math.round(window.innerWidth * ratio);
  ScreenCanvas.height = Math.round(window.innerHeight * ratio);
  ActiveTheme.Resize(ScreenCanvas.width, ScreenCanvas.height, ratio);
  document.body.style.background = ActiveTheme.PageBackground;
  Redraw();
}

// [U] SetFullScreen – avaekraani moodi: joonistaja ja sisendi käsitleja; null = tagasi töölauale.
export function SetFullScreen(painter, input) {
  FullScreenPainter = painter;
  FullScreenInput = input;
  CloseMenu();
  RequestRedraw();
}

// [U] SetDesktop – töölaua sisu joonistaja ja peamenüü. Kutsub: fms.js.
export function SetDesktop(painter, menu) {
  DesktopPainter = painter;
  MainMenu = menu;
  RequestRedraw();
}

// [U] SetHotkeys – kiirklahvid, mis töötavad alati (ka avaekraanil ja dialoogis).
export function SetHotkeys(map) {
  Hotkeys = map;
}

// [U] RequestRedraw – joonistab ekraani järgmisel kaadril (mitu kutset = üks joonistamine).
export function RequestRedraw() {
  if (RedrawPending) return;
  RedrawPending = true;
  requestAnimationFrame(() => { RedrawPending = false; Redraw(); });
}

// [U] Redraw – joonistab kogu ekraani: töölaud, menüüriba, olekurida, alammenüüd, dialoogid.
function Redraw() {
  const theme = ActiveTheme;
  theme.BeginFrame(ScreenContext);
  if (FullScreenPainter) {
    FullScreenPainter(theme);
  } else {
    const desktop = DesktopRect();
    theme.DesktopBackground(desktop.X, desktop.Y, desktop.Width, desktop.Height);
    if (DesktopPainter) DesktopPainter(theme, desktop);
    DrawMenuBar(theme);
    DrawStatusLine(theme);
    if (MENU_ACTIVE) {
      for (let level = 1; level < MenuPath.length; level++) DrawDropdown(theme, level);
    }
  }
  DialogStack.forEach((dialog) => DrawDialog(theme, dialog));
  theme.EndFrame(ScreenContext);
}

// [U] DesktopRect – töölaua ala menüüriba ja olekurea vahel.
export function DesktopRect() {
  return { X: 0, Y: ROW_HEIGHT, Width: ActiveTheme.Width, Height: ActiveTheme.Height - 2 * ROW_HEIGHT };
}

// [U] ParseLabel – '&Load' → tekst 'Load', kiirklahv 'L' (indeks 0).
export function ParseLabel(label) {
  const index = label.indexOf('&');
  if (index < 0) return { Text: label, HotkeyIndex: -1, Hotkey: '' };
  const text = label.slice(0, index) + label.slice(index + 1);
  return { Text: text, HotkeyIndex: index, Hotkey: text[index].toUpperCase() };
}

// =====================================================================
// Peamenüü ja alammenüüd
// =====================================================================

function MenuItems(item) {
  if (!item || !item.Items) return null;
  return typeof item.Items === 'function' ? item.Items() : item.Items;
}

function IsSelectable(item) {
  return item && !item.Separator && item.Enabled !== false;
}

function FirstSelectable(items) {
  const index = items.findIndex(IsSelectable);
  return index < 0 ? 0 : index;
}

// Punkt, mis on valitud tasemel level (0 = peamenüü).
function SelectedItem(level) {
  let items = MainMenu;
  for (let i = 0; i < level; i++) items = MenuItems(items[MenuPath[i]]);
  return items[MenuPath[level]];
}

// Tasemel level (≥ 1) avatud alammenüü punktid.
function DropdownItems(level) {
  return MenuItems(SelectedItem(level - 1));
}

// [U] MenuBarLayout – peamenüü punktide asukohad.
function MenuBarLayout() {
  let x = MENU_PAD_X;
  return MainMenu.map((item) => {
    const width = ActiveTheme.TextWidth(ParseLabel(item.Label).Text) + 2 * MENU_PAD_X;
    const place = { X: x, Width: width };
    x += width;
    return place;
  });
}

// [U] DropdownRect – tasemel level avatud alammenüü ristkülik.
//     Esimene tase avaneb peamenüü punkti alla, järgmised eelmisest paremale nihkega (joon. 6.2).
function DropdownRect(level) {
  const items = DropdownItems(level);
  const textWidth = Math.max(...items.map((item) => (item.Separator ? 0 : ActiveTheme.TextWidth(ParseLabel(item.Label).Text))));
  const width = Math.ceil((textWidth + DROPDOWN_GUTTER + DROPDOWN_RIGHT) / 8) * 8;
  const height = items.length * ROW_HEIGHT + 2 * DROPDOWN_PAD_Y;
  let x;
  let y;
  if (level === 1) {
    x = MenuBarLayout()[MenuPath[0]].X - MENU_PAD_X / 2;
    y = ROW_HEIGHT;
  } else {
    const parent = DropdownRect(level - 1);
    x = parent.X + parent.Width - 8;
    y = parent.Y + DROPDOWN_PAD_Y + MenuPath[level - 1] * ROW_HEIGHT + ROW_HEIGHT / 2;
  }
  x = Math.max(0, Math.min(x, ActiveTheme.Width - width - 8));
  y = Math.max(ROW_HEIGHT, Math.min(y, ActiveTheme.Height - ROW_HEIGHT - height - 8));
  return { X: x, Y: y, Width: width, Height: height, Items: items };
}

function DrawMenuBar(theme) {
  theme.FillRect(0, 0, theme.Width, ROW_HEIGHT, 'MenuBar');
  if (theme.MenuBarLine) theme.MenuBarLine(ROW_HEIGHT, theme.Width);
  MenuBarLayout().forEach((place, i) => {
    const item = MainMenu[i];
    const label = ParseLabel(item.Label);
    const selected = MENU_ACTIVE && MenuPath[0] === i;
    if (selected) theme.FillRect(place.X, 0, place.Width, ROW_HEIGHT, 'MenuSelected');
    const role = selected ? 'MenuSelectedText' : (item.Dim ? 'MenuDisabled' : 'MenuText');
    theme.Text(place.X + MENU_PAD_X, 0, label.Text, role,
      { HotkeyIndex: label.HotkeyIndex, HotkeyRole: selected ? 'MenuSelectedText' : 'MenuHotkey' });
  });
}

function DrawDropdown(theme, level) {
  const rect = DropdownRect(level);
  theme.Panel(rect.X, rect.Y, rect.Width, rect.Height, 'Menu');
  rect.Items.forEach((item, i) => {
    const y = rect.Y + DROPDOWN_PAD_Y + i * ROW_HEIGHT;
    if (item.Separator) { theme.Separator(rect.X, y, rect.Width, 'MenuFrame'); return; }
    const selected = MenuPath[level] === i;
    const gray = item.Enabled === false || item.Dim;
    if (selected) theme.FillRect(rect.X + 4, y, rect.Width - 8, ROW_HEIGHT, 'MenuSelected');
    const role = selected ? 'MenuSelectedText' : (gray ? 'MenuDisabled' : 'MenuText');
    const label = ParseLabel(item.Label);
    if (item.Checked && item.Checked()) theme.Text(rect.X + 6, y, theme.Symbols.Check, role);
    theme.Text(rect.X + DROPDOWN_GUTTER, y, label.Text, role, {
      HotkeyIndex: gray ? -1 : label.HotkeyIndex,
      HotkeyRole: selected ? 'MenuSelectedText' : 'MenuHotkey',
    });
    if (item.Items) theme.Text(rect.X + rect.Width - 16, y, theme.Symbols.Submenu, role);
  });
}

function DrawStatusLine(theme) {
  const y = theme.Height - ROW_HEIGHT;
  theme.FillRect(0, y, theme.Width, ROW_HEIGHT, 'StatusBar');
  if (theme.MenuBarLine) theme.MenuBarLine(y, theme.Width);
  const hint = MENU_ACTIVE ? SelectedItem(MenuPath.length - 1)?.Hint : '';
  if (hint) {
    theme.Text(8, y, hint, 'StatusText');
    return;
  }
  StatusLayout().forEach((place) => {
    theme.Text(place.X, y, place.Key, 'StatusKey', { Bold: true });
    theme.Text(place.X + theme.TextWidth(place.Key, { Bold: true }) + 6, y, place.Label, 'StatusText');
  });
}

// [U] StatusLayout – olekurea klahvide asukohad (ka hiireklõpsu jaoks).
function StatusLayout() {
  const keys = MENU_ACTIVE ? Texts.StatusMenuKeys : Texts.StatusKeys;
  let x = 8;
  return keys.map((entry) => {
    const width = ActiveTheme.TextWidth(entry.Key, { Bold: true }) + 6 + ActiveTheme.TextWidth(entry.Label);
    const place = { ...entry, X: x, Width: width };
    x += width + 16;
    return place;
  });
}

// [O] OpenMenu – avab peamenüü punkti index; withDropdown – kas ka selle alammenüü.
function OpenMenu(index, withDropdown) {
  MENU_ACTIVE = true;
  MenuPath = [index];
  const items = MenuItems(MainMenu[index]);
  if (withDropdown && items) MenuPath.push(FirstSelectable(items));
  RequestRedraw();
}

// [U] CloseMenu – sulgeb kõik menüüd.
export function CloseMenu() {
  MENU_ACTIVE = false;
  MenuPath = [];
  RequestRedraw();
}

// [U] ChooseMenuItem – tasemel level valitud punkt: avab alammenüü või täidab käsu.
function ChooseMenuItem(level) {
  const item = SelectedItem(level);
  if (!IsSelectable(item)) return;
  const items = MenuItems(item);
  if (items) {
    MenuPath = MenuPath.slice(0, level + 1);
    MenuPath.push(FirstSelectable(items));
    RequestRedraw();
    return;
  }
  CloseMenu();
  if (item.Action) item.Action();
}

function MoveInDropdown(step) {
  const level = MenuPath.length - 1;
  const items = DropdownItems(level);
  let index = MenuPath[level];
  for (let tries = 0; tries < items.length; tries++) {
    index = (index + step + items.length) % items.length;
    if (!items[index].Separator) break;
  }
  MenuPath[level] = index;
  RequestRedraw();
}

function HandleMenuKey(name) {
  const level = MenuPath.length - 1;
  switch (name) {
    case 'Escape':
      if (level >= 2) { MenuPath.pop(); RequestRedraw(); } else CloseMenu();
      return true;
    case 'ArrowLeft':
      if (level >= 2) { MenuPath.pop(); RequestRedraw(); return true; }
      OpenMenu((MenuPath[0] - 1 + MainMenu.length) % MainMenu.length, level >= 1);
      return true;
    case 'ArrowRight':
      if (level >= 1 && MenuItems(SelectedItem(level))) { ChooseMenuItem(level); return true; }
      OpenMenu((MenuPath[0] + 1) % MainMenu.length, level >= 1);
      return true;
    case 'ArrowDown':
      if (level === 0) ChooseMenuItem(0); else MoveInDropdown(1);
      return true;
    case 'ArrowUp':
      if (level >= 1) MoveInDropdown(-1);
      return true;
    case 'Enter':
    case ' ':
      ChooseMenuItem(level);
      return true;
    case 'F10':
      CloseMenu();
      return true;
    default: {
      if (name.length !== 1) return false;
      const letter = name.toUpperCase();
      const items = level === 0 ? MainMenu : DropdownItems(level);
      const index = items.findIndex((item) => !item.Separator && ParseLabel(item.Label).Hotkey === letter);
      if (index < 0) return false;
      MenuPath[level] = index;
      ChooseMenuItem(level);
      return true;
    }
  }
}

// =====================================================================
// Dialoogid
// =====================================================================

// Dialoog (Dialog): { Title, Lines: [tekst | { Text, Role, Mono }], Items, ItemIndex,
//                     Input, Buttons, ButtonIndex, OnClose(tulemus) }
// Tulemus: nupu indeks; nimekirjas valitud rea indeks; sisestusväljas tekst; Esc → null.

// [O] MessageBox – teade nuppudega. onClose(nupu indeks | null).
export function MessageBox(title, lines, buttons = [Texts.ButtonOk], onClose = null) {
  OpenDialog({ Title: title, Lines: lines, Buttons: buttons, ButtonIndex: 0, OnClose: onClose });
}

// [O] ListBox – nimekiri, millest valitakse üks. onClose(rea indeks | null).
export function ListBox(title, lines, items, onClose) {
  OpenDialog({ Title: title, Lines: lines, Items: items, ItemIndex: 0, Buttons: [], OnClose: onClose });
}

// [O] InputBox – tekstiväli. onClose(tekst | null).
export function InputBox(title, prompt, initialText, onClose) {
  OpenDialog({
    Title: title, Lines: [prompt], Input: { Text: initialText },
    Buttons: [Texts.ButtonOk, Texts.ButtonCancel], ButtonIndex: 0, OnClose: onClose,
  });
}

// [U] DialogOpen – kas mõni dialoog on avatud.
export function DialogOpen() {
  return DialogStack.length > 0;
}

function OpenDialog(dialog) {
  CloseMenu();
  DialogStack.push(dialog);
  RequestRedraw();
}

// Sulgeb pealmise dialoogi ja kutsub selle OnClose sünkroonselt
// (nii jääb kasutaja tegevus kehtima, nt faili valimise akna avamiseks).
function CloseDialog(result) {
  const dialog = DialogStack.pop();
  RequestRedraw();
  if (dialog.OnClose) dialog.OnClose(result);
}

function LineText(line) {
  return typeof line === 'string' ? line : line.Text;
}

function LineMono(line) {
  return typeof line !== 'string' && Boolean(line.Mono);
}

// [U] DialogLayout – dialoogi osade asukohad (joonistamiseks ja hiireklõpsu jaoks).
function DialogLayout(dialog) {
  const theme = ActiveTheme;
  const buttonWidths = dialog.Buttons.map((label) => Math.max(BUTTON_MIN_WIDTH, theme.TextWidth(label) + 24));
  const buttonsWidth = buttonWidths.reduce((sum, width) => sum + width, 0) + BUTTON_GAP * Math.max(0, buttonWidths.length - 1);
  const contentWidths = [
    theme.TextWidth(dialog.Title) + 32,
    buttonsWidth,
    ...dialog.Lines.map((line) => theme.TextWidth(LineText(line), { Mono: LineMono(line) })),
    ...(dialog.Items || []).map((item) => theme.TextWidth(item) + 16),
    dialog.Input ? 240 : 0,
  ];
  const width = Math.min(theme.Width - 16, Math.ceil((Math.max(...contentWidths) + 2 * DIALOG_PAD_X) / 8) * 8);
  const rows = 1 + dialog.Lines.length + (dialog.Items ? dialog.Items.length + 1 : 0)
    + (dialog.Input ? 2 : 0) + (dialog.Buttons.length ? 2 : 0);
  const height = (rows + 1) * ROW_HEIGHT;
  const x = Math.round((theme.Width - width) / 2 / 8) * 8;
  const y = Math.round((ROW_HEIGHT + (theme.Height - 2 * ROW_HEIGHT - height) / 2) / ROW_HEIGHT) * ROW_HEIGHT;

  let rowY = y + ROW_HEIGHT + ROW_HEIGHT / 2;
  const lines = dialog.Lines.map(() => { const lineY = rowY; rowY += ROW_HEIGHT; return lineY; });
  let items = [];
  if (dialog.Items) {
    if (dialog.Lines.length) rowY += ROW_HEIGHT / 2;
    items = dialog.Items.map(() => { const itemY = rowY; rowY += ROW_HEIGHT; return itemY; });
    rowY += ROW_HEIGHT / 2;
  }
  let input = null;
  if (dialog.Input) {
    input = { X: x + DIALOG_PAD_X, Y: rowY + 2, Width: width - 2 * DIALOG_PAD_X };
    rowY += 2 * ROW_HEIGHT;
  }
  let buttonX = x + Math.round((width - buttonsWidth) / 2);
  const buttons = buttonWidths.map((buttonWidth) => {
    const place = { X: buttonX, Y: rowY + ROW_HEIGHT / 2, Width: buttonWidth };
    buttonX += buttonWidth + BUTTON_GAP;
    return place;
  });
  return { X: x, Y: y, Width: width, Height: height, Lines: lines, Items: items, Input: input, Buttons: buttons };
}

function DrawDialog(theme, dialog) {
  const layout = DialogLayout(dialog);
  theme.Panel(layout.X, layout.Y, layout.Width, layout.Height, 'Window');
  theme.WindowTitle(layout.X, layout.Y + 2, layout.Width, dialog.Title);
  dialog.Lines.forEach((line, i) => {
    const role = typeof line === 'string' ? 'WindowText' : (line.Role || 'WindowText');
    theme.Text(layout.X + DIALOG_PAD_X, layout.Lines[i], LineText(line), role, { Mono: LineMono(line) });
  });
  (dialog.Items || []).forEach((item, i) => {
    const y = layout.Items[i];
    const selected = i === dialog.ItemIndex;
    if (selected) theme.FillRect(layout.X + DIALOG_PAD_X - 8, y, layout.Width - 2 * DIALOG_PAD_X + 16, ROW_HEIGHT, 'MenuSelected');
    theme.Text(layout.X + DIALOG_PAD_X, y, item, selected ? 'MenuSelectedText' : 'WindowText');
  });
  if (layout.Input) {
    const { X, Y, Width } = layout.Input;
    theme.FillRect(X, Y, Width, ROW_HEIGHT, 'Input');
    theme.Text(X + 4, Y, dialog.Input.Text, 'InputText');
    theme.Caret(X + 4 + theme.TextWidth(dialog.Input.Text), Y);
  }
  dialog.Buttons.forEach((label, i) => {
    const place = layout.Buttons[i];
    theme.Button(place.X, place.Y, place.Width, label, i === dialog.ButtonIndex);
  });
}

// Dialoogi „põhitulemus“ Enteri või OK-nupu korral.
function DialogResult(dialog, buttonIndex) {
  if (dialog.Items) return dialog.ItemIndex;
  if (dialog.Input) return buttonIndex === 0 ? dialog.Input.Text : null;
  return buttonIndex;
}

function HandleDialogKey(dialog, event) {
  const name = event.key;
  if (name === 'Escape') { CloseDialog(null); return true; }
  if (name === 'Enter') { CloseDialog(DialogResult(dialog, dialog.ButtonIndex ?? 0)); return true; }
  if (dialog.Items && (name === 'ArrowDown' || name === 'ArrowUp')) {
    const step = name === 'ArrowDown' ? 1 : -1;
    dialog.ItemIndex = (dialog.ItemIndex + step + dialog.Items.length) % dialog.Items.length;
    RequestRedraw();
    return true;
  }
  if (dialog.Buttons.length > 1 && ['ArrowLeft', 'ArrowRight', 'Tab'].includes(name)) {
    const step = name === 'ArrowLeft' || event.shiftKey ? -1 : 1;
    dialog.ButtonIndex = (dialog.ButtonIndex + step + dialog.Buttons.length) % dialog.Buttons.length;
    RequestRedraw();
    return true;
  }
  if (dialog.Input) {
    if (name === 'Backspace') {
      dialog.Input.Text = Array.from(dialog.Input.Text).slice(0, -1).join('');
      RequestRedraw();
      return true;
    }
    if (name.length === 1 && !event.ctrlKey && !event.metaKey) {
      dialog.Input.Text += name;
      RequestRedraw();
      return true;
    }
    return false;
  }
  // Nupu valimine esitähega (J – Jah, E – Ei)
  if (name.length === 1) {
    const index = dialog.Buttons.findIndex((label) => label[0].toUpperCase() === name.toUpperCase());
    if (index >= 0) { CloseDialog(DialogResult(dialog, index)); return true; }
  }
  return false;
}

function HandleDialogPointer(dialog, point) {
  const layout = DialogLayout(dialog);
  const inside = (x, y, width, height) => point.X >= x && point.X < x + width && point.Y >= y && point.Y < y + height;
  const buttonIndex = layout.Buttons.findIndex((place) => inside(place.X, place.Y, place.Width, ROW_HEIGHT));
  if (buttonIndex >= 0) { dialog.ButtonIndex = buttonIndex; CloseDialog(DialogResult(dialog, buttonIndex)); return; }
  const itemIndex = layout.Items.findIndex((y) => inside(layout.X, y, layout.Width, ROW_HEIGHT));
  if (itemIndex >= 0) { dialog.ItemIndex = itemIndex; CloseDialog(itemIndex); }
}

// =====================================================================
// Sisend
// =====================================================================

// [U] KeyName – klahvi nimi: 'F2', 'Alt-X', 'Enter', 'a' …
//     Alt + täht loetakse klahvi asukohast (Macis annab Option + täht muu märgi).
function KeyName(event) {
  if (event.altKey && /^Key[A-Z]$/.test(event.code)) return `Alt-${event.code.slice(3)}`;
  return event.key;
}

// [O] HandleKeyDown – kõik klahvivajutused: kiirklahvid → dialoog → avaekraan → menüü.
function HandleKeyDown(event) {
  const name = KeyName(event);
  let handled = false;
  if (Hotkeys[name]) {
    Hotkeys[name]();
    handled = true;
  } else if (DialogStack.length) {
    handled = HandleDialogKey(DialogStack[DialogStack.length - 1], event);
  } else if (FullScreenPainter) {
    if (!['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key) && !event.metaKey && FullScreenInput) {
      FullScreenInput();
      handled = true;
    }
  } else if (MENU_ACTIVE) {
    handled = HandleMenuKey(name);
  } else if (name === 'F10') {
    OpenMenu(0, false);
    handled = true;
  } else if (name.startsWith('Alt-')) {
    const index = MainMenu.findIndex((item) => ParseLabel(item.Label).Hotkey === name.slice(4));
    if (index >= 0) {
      OpenMenu(index, true);
      if (!MenuItems(MainMenu[index])) ChooseMenuItem(0);
      handled = true;
    }
  }
  if (handled || DialogStack.length || MENU_ACTIVE) event.preventDefault();
}

// [O] HandlePointer – hiir ja puutetundlik ekraan.
function HandlePointer(event, kind) {
  const ratio = window.devicePixelRatio || 1;
  const bounds = ScreenCanvas.getBoundingClientRect();
  const point = ActiveTheme.DeviceToLogical((event.clientX - bounds.left) * ratio, (event.clientY - bounds.top) * ratio);
  ScreenCanvas.focus();

  if (DialogStack.length) {
    if (kind === 'down') HandleDialogPointer(DialogStack[DialogStack.length - 1], point);
    return;
  }
  if (FullScreenPainter) {
    if (kind === 'down' && FullScreenInput) FullScreenInput();
    return;
  }

  // Avatud alammenüüd, alates sügavaimast
  if (MENU_ACTIVE) {
    for (let level = MenuPath.length - 1; level >= 1; level--) {
      const rect = DropdownRect(level);
      if (point.X < rect.X || point.X >= rect.X + rect.Width || point.Y < rect.Y || point.Y >= rect.Y + rect.Height) continue;
      const row = Math.floor((point.Y - rect.Y - DROPDOWN_PAD_Y) / ROW_HEIGHT);
      if (row < 0 || row >= rect.Items.length || rect.Items[row].Separator) return;
      if (kind === 'move') {
        if (MenuPath[level] !== row || MenuPath.length > level + 1) {
          MenuPath = MenuPath.slice(0, level + 1);
          MenuPath[level] = row;
          if (MenuItems(rect.Items[row]) && IsSelectable(rect.Items[row])) ChooseMenuItem(level);
          RequestRedraw();
        }
      } else {
        MenuPath = MenuPath.slice(0, level + 1);
        MenuPath[level] = row;
        ChooseMenuItem(level);
      }
      return;
    }
  }

  // Menüüriba
  if (point.Y >= 0 && point.Y < ROW_HEIGHT) {
    const index = MenuBarLayout().findIndex((place) => point.X >= place.X && point.X < place.X + place.Width);
    if (index < 0) { if (kind === 'down') CloseMenu(); return; }
    if (kind === 'move') {
      if (MENU_ACTIVE && MenuPath[0] !== index && MenuPath.length > 1) OpenMenu(index, true);
      return;
    }
    if (MENU_ACTIVE && MenuPath[0] === index) { CloseMenu(); return; }
    OpenMenu(index, true);
    if (!MenuItems(MainMenu[index])) ChooseMenuItem(0);
    return;
  }

  if (kind !== 'down') return;
  if (MENU_ACTIVE) { CloseMenu(); return; }

  // Olekurea klahvid on klõpsatavad
  if (point.Y >= ActiveTheme.Height - ROW_HEIGHT) {
    const place = StatusLayout().find((entry) => point.X >= entry.X && point.X < entry.X + entry.Width);
    if (!place) return;
    if (place.Key === 'F10') OpenMenu(0, true);
    else if (Hotkeys[place.Key]) Hotkeys[place.Key]();
  }
}
