// FMSS – välimused (teemad): EGA ja kaasaegne.
// Uus moodul [U]: originaalis oli ainult EGA graafika (WINDOWS.PAS).
//
// Kõik joonistamine käib loogilistes koordinaatides: rida on ROW_HEIGHT pikslit kõrge,
// EGA ekraan on 640 × 350 (80 × 25 märki). Teema otsustab, kuidas see ekraanile jõuab:
//  - EGA: joonistatakse 640 × 350 varjatud lõuendile 16 värvi ja pikslifondiga,
//         siis suurendatakse 4:3 kujule nagu EGA monitoril (pikslid on kõrged);
//  - kaasaegne: joonistatakse otse seadme resolutsioonil, ekraan on nii suur kui aken.
//
// Rollid (Role) on värvide nimed kasutuse järgi: 'MenuBar', 'MenuText', 'WindowFrame' jne.
// windows.js kasutab ainult rolle ja allolevaid primitiive, mitte värve.

export const ROW_HEIGHT = 14;    // [U] tekstirea kõrgus loogilistes pikslites (EGA font 8 × 14)
export const EGA_WIDTH = 640;    // [O] EGA ekraani laius
export const EGA_HEIGHT = 350;   // [O] EGA ekraani kõrgus
const EGA_DISPLAY_ASPECT = 4 / 3;  // EGA monitori kuju
const EGA_FONT_NAME = 'FMSS EGA';
const EGA_FONT_URL = new URL('../fonts/WebPlus_IBM_EGA_8x14.woff', import.meta.url);
const EGA_CHAR_WIDTH = 8;

// [O] EGA 16-värviline palett
export const EgaPalette = [
  '#000000', '#0000AA', '#00AA00', '#00AAAA', '#AA0000', '#AA00AA', '#AA5500', '#AAAAAA',
  '#555555', '#5555FF', '#55FF55', '#55FFFF', '#FF5555', '#FF55FF', '#FFFF55', '#FFFFFF',
];
const EGA = {
  Black: 0, Blue: 1, Green: 2, Cyan: 3, Red: 4, Magenta: 5, Brown: 6, LightGray: 7,
  DarkGray: 8, LightBlue: 9, LightGreen: 10, LightCyan: 11, LightRed: 12, LightMagenta: 13, Yellow: 14, White: 15,
};

// Rollide värvid EGA-s (paleti indeksid)
const EgaRoles = {
  Screen: EGA.Black,
  Desktop: EGA.Blue,
  DesktopPattern: EGA.LightGray,
  MenuBar: EGA.LightGray,
  MenuText: EGA.Black,
  MenuHotkey: EGA.Red,
  MenuSelected: EGA.Green,
  MenuSelectedText: EGA.Black,
  MenuDisabled: EGA.DarkGray,
  MenuFrame: EGA.Black,
  Shadow: EGA.Black,
  Window: EGA.LightGray,
  WindowFrame: EGA.White,
  WindowTitle: EGA.White,
  WindowTitleBar: EGA.LightGray,
  WindowText: EGA.Black,
  WindowLabel: EGA.Blue,
  Button: EGA.Green,
  ButtonText: EGA.Black,
  ButtonSelected: EGA.LightGreen,
  ButtonSelectedText: EGA.White,
  Input: EGA.Blue,
  InputText: EGA.White,
  Error: EGA.Red,
  StatusBar: EGA.LightGray,
  StatusText: EGA.Black,
  StatusKey: EGA.Red,
  SplashBack: EGA.Black,
  SplashText: EGA.LightGray,
  SplashPrompt: EGA.LightGray,
  SplashTitle: EGA.Yellow,
  SplashSubtitle: EGA.LightCyan,
  SplashAccent: EGA.White,
  SplashDim: EGA.DarkGray,

  // Animaator (anima.js) [U]
  SimStatusBar: EGA.Cyan,
  SimStatusText: EGA.Black,
  LayoutBack: EGA.Black,
  LayoutGrid: EGA.DarkGray,
  LayoutLabel: EGA.LightGray,
  LayoutValue: EGA.White,
  Track: EGA.LightGray,
  TrackStopped: EGA.Brown,
  DotLink: EGA.DarkGray,
  Arrow: EGA.Yellow,
  MachineFrame: EGA.LightGray,
  MachineLabel: EGA.White,
  MachineLetter: EGA.White,
  MachIdle: EGA.Black,
  MachLoading: EGA.Cyan,
  MachSetup: EGA.Brown,
  MachProcessing: EGA.Green,
  MachDown: EGA.Red,
  Spindle: EGA.White,
  BufferBody: EGA.Black,
  BufferFrame: EGA.LightGray,
  SlotFree: EGA.DarkGray,
  SlotReserved: EGA.Yellow,
  SlotArrow: EGA.LightGray,
  StorageBody: EGA.Black,
  StorageFrame: EGA.LightGray,
  StorageEmpty: EGA.Black,
  StorageFill: EGA.Blue,
  Pallet: EGA.DarkGray,
  PalletFrame: EGA.LightGray,
  PalletReserved: EGA.Yellow,
  PalletPlace: EGA.Black,
  Highlight: EGA.Yellow,
  Deadlock: EGA.LightRed,
  WpFrame: EGA.Black,
  Wp0: EGA.LightRed, Wp1: EGA.LightCyan, Wp2: EGA.Yellow, Wp3: EGA.LightGreen,
  Wp4: EGA.LightMagenta, Wp5: EGA.White, Wp6: EGA.LightBlue, Wp7: EGA.Brown,
  Wp8: EGA.Red, Wp9: EGA.Cyan, Wp10: EGA.Green, Wp11: EGA.Magenta,
  Wp12: EGA.Blue, Wp13: EGA.LightGray, Wp14: EGA.DarkGray, Wp15: EGA.LightRed,
};

// Rollide värvid kaasaegses välimuses
const ModernLight = {
  Screen: '#e9ebef',
  Desktop: '#e9ebef',
  DesktopPattern: '#dde0e6',
  MenuBar: '#fbfbfc',
  MenuBarLine: '#d9dce2',
  MenuText: '#1d1d1f',
  MenuHotkey: '#1d1d1f',
  MenuSelected: '#2563eb',
  MenuSelectedText: '#ffffff',
  MenuDisabled: '#a1a1aa',
  MenuFrame: '#d4d7de',
  Shadow: 'rgba(15, 23, 42, 0.16)',
  Window: '#ffffff',
  WindowFrame: '#d4d7de',
  WindowTitle: '#1d1d1f',
  WindowTitleBar: '#f4f5f7',
  WindowText: '#27272a',
  WindowLabel: '#71717a',
  Button: '#eef0f3',
  ButtonText: '#1d1d1f',
  ButtonSelected: '#2563eb',
  ButtonSelectedText: '#ffffff',
  Input: '#ffffff',
  InputText: '#1d1d1f',
  Error: '#dc2626',
  StatusBar: '#fbfbfc',
  StatusText: '#52525b',
  StatusKey: '#1d1d1f',
  SplashBack: '#0f172a',
  SplashText: '#cbd5e1',
  SplashPrompt: '#64748b',
  SplashTitle: '#ffffff',
  SplashSubtitle: '#93c5fd',
  SplashAccent: '#f8fafc',
  SplashDim: '#64748b',

  // Animaator (anima.js) [U]
  LayoutBack: '#fafbfc',
  LayoutGrid: '#cbd2dc',
  LayoutLabel: '#475569',
  LayoutValue: '#1e293b',
  Track: '#64748b',
  TrackStopped: '#f59e0b',
  DotLink: '#9aa5b4',
  Arrow: '#2563eb',
  MachineFrame: '#64748b',
  MachineLabel: '#1e293b',
  MachineLetter: '#334155',
  MachIdle: '#eef1f5',
  MachLoading: '#bae6fd',
  MachSetup: '#fde68a',
  MachProcessing: '#bbf7d0',
  MachDown: '#fecaca',
  Spindle: '#334155',
  BufferBody: '#ffffff',
  BufferFrame: '#94a3b8',
  SlotFree: '#cbd5e1',
  SlotReserved: '#2563eb',
  SlotArrow: '#64748b',
  StorageBody: '#ffffff',
  StorageFrame: '#94a3b8',
  StorageEmpty: '#f1f5f9',
  StorageFill: '#93c5fd',
  Pallet: '#e2e8f0',
  PalletFrame: '#64748b',
  PalletReserved: '#2563eb',
  PalletPlace: '#94a3b8',
  Highlight: '#f59e0b',
  Deadlock: '#dc2626',
  WpFrame: 'rgba(15, 23, 42, 0.45)',
  Wp0: '#ef4444', Wp1: '#3b82f6', Wp2: '#eab308', Wp3: '#22c55e',
  Wp4: '#a855f7', Wp5: '#06b6d4', Wp6: '#ec4899', Wp7: '#84cc16',
  Wp8: '#f97316', Wp9: '#6366f1', Wp10: '#14b8a6', Wp11: '#d946ef',
  Wp12: '#0ea5e9', Wp13: '#78716c', Wp14: '#facc15', Wp15: '#be123c',
  EventInSys: '#16a34a',
  EventLoad: '#2563eb',
  EventTurn: '#d97706',
  EventProcess: '#059669',
  EventMoveZ: '#64748b',
  EventStopMov: '#dc2626',
  EventOutSys: '#9333ea',
  EventOther: '#71717a',
  CardText: '#ffffff',
  StripTick: '#d4d7de',
  StripArrow: '#64748b',
  SliderTrack: '#d4d7de',
  SliderFill: '#2563eb',
  SliderKnob: '#ffffff',
};
const ModernDark = {
  ...ModernLight,
  Screen: '#18181b',
  Desktop: '#18181b',
  DesktopPattern: '#222226',
  MenuBar: '#232326',
  MenuBarLine: '#34343a',
  MenuText: '#e4e4e7',
  MenuHotkey: '#e4e4e7',
  MenuSelected: '#3b82f6',
  MenuDisabled: '#62626b',
  MenuFrame: '#3a3a40',
  Shadow: 'rgba(0, 0, 0, 0.45)',
  Window: '#26262a',
  WindowFrame: '#3a3a40',
  WindowTitle: '#f4f4f5',
  WindowTitleBar: '#2e2e33',
  WindowText: '#e4e4e7',
  WindowLabel: '#a1a1aa',
  Button: '#34343a',
  ButtonText: '#f4f4f5',
  ButtonSelected: '#3b82f6',
  Input: '#1c1c1f',
  InputText: '#f4f4f5',
  Error: '#f87171',
  StatusBar: '#232326',
  StatusText: '#a1a1aa',
  StatusKey: '#f4f4f5',

  LayoutBack: '#1c1c20',
  LayoutGrid: '#3a3a42',
  LayoutLabel: '#a1a1aa',
  LayoutValue: '#f4f4f5',
  Track: '#8b93a1',
  DotLink: '#5b6270',
  Arrow: '#60a5fa',
  MachineFrame: '#8b93a1',
  MachineLabel: '#f4f4f5',
  MachineLetter: '#e4e4e7',
  MachIdle: '#2a2a30',
  MachLoading: '#0c4a6e',
  MachSetup: '#713f12',
  MachProcessing: '#14532d',
  MachDown: '#7f1d1d',
  Spindle: '#e4e4e7',
  BufferBody: '#232328',
  BufferFrame: '#6b7280',
  SlotFree: '#4b5060',
  SlotReserved: '#60a5fa',
  SlotArrow: '#a1a1aa',
  StorageBody: '#232328',
  StorageFrame: '#6b7280',
  StorageEmpty: '#2a2a30',
  StorageFill: '#1d4ed8',
  Pallet: '#3f3f46',
  PalletFrame: '#a1a1aa',
  PalletReserved: '#60a5fa',
  PalletPlace: '#71717a',
  WpFrame: 'rgba(0, 0, 0, 0.6)',
  StripTick: '#34343a',
  StripArrow: '#a1a1aa',
  SliderTrack: '#3a3a40',
  SliderFill: '#3b82f6',
  SliderKnob: '#f4f4f5',
};

const MODERN_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MODERN_MONO_FONT = 'ui-monospace, Menlo, Consolas, monospace';
const MODERN_FONT_SIZE = 9.5;      // loogilistes pikslites; rida 14
const MODERN_MAX_SCALE = 1.5;      // CSS-pikslit loogilise piksli kohta (et suurel ekraanil ei läheks hiiglaslikuks)

// =====================================================================
// EGA
// =====================================================================

// [U] CreateEgaTheme – EGA välimus: 640 × 350, 16 värvi, pikslifont, 4:3 monitor.
//     Kutsub: fms.js. Fondi laadimiseks tuleb enne kutsuda LoadEgaFont.
export function CreateEgaTheme() {
  const frame = document.createElement('canvas');
  frame.width = EGA_WIDTH;
  frame.height = EGA_HEIGHT;
  const frameContext = frame.getContext('2d');
  const glyphCache = new Map();   // 'märk|värv' → 8 × 14 lõuend ainult selle värvi pikslitega
  let target = { X: 0, Y: 0, Width: 0, Height: 0 };   // kuhu ekraan põhilõuendil joonistatakse

  // Täht → teravate servadega pilt (pikslid kas värvi või läbipaistvad, ilma silumiseta).
  function glyph(char, colorIndex) {
    const key = `${char}|${colorIndex}`;
    let image = glyphCache.get(key);
    if (image) return image;
    image = document.createElement('canvas');
    image.width = EGA_CHAR_WIDTH;
    image.height = ROW_HEIGHT;
    const context = image.getContext('2d', { willReadFrequently: true });
    context.font = `${ROW_HEIGHT}px "${EGA_FONT_NAME}"`;
    context.textBaseline = 'top';
    context.fillStyle = '#fff';
    context.fillText(char, 0, 0);
    const pixels = context.getImageData(0, 0, EGA_CHAR_WIDTH, ROW_HEIGHT);
    const [r, g, b] = hexToRgb(EgaPalette[colorIndex]);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const on = pixels.data[i + 3] >= 128;
      pixels.data[i] = r; pixels.data[i + 1] = g; pixels.data[i + 2] = b;
      pixels.data[i + 3] = on ? 255 : 0;
    }
    context.putImageData(pixels, 0, 0);
    glyphCache.set(key, image);
    return image;
  }

  const color = (role) => EgaPalette[EgaRoles[role] ?? EGA.Magenta];

  return {
    Name: 'EGA',
    Width: EGA_WIDTH,
    Height: EGA_HEIGHT,
    Symbols: { Check: '√', Submenu: '►', Ellipsis: '…' },
    PageBackground: EgaPalette[EGA.Black],

    // Põhilõuendi suurus muutus: arvutab, kuhu ja kui suurelt 640 × 350 ekraan joonistatakse.
    Resize(deviceWidth, deviceHeight) {
      const displayHeight = EGA_WIDTH / EGA_DISPLAY_ASPECT;   // 480
      let scale = Math.min(deviceWidth / EGA_WIDTH, deviceHeight / displayHeight);
      if (scale >= 1) scale = Math.floor(scale);   // täisarvuline suurendus, et pikslid oleksid ühesugused
      const width = Math.round(EGA_WIDTH * scale);
      const height = Math.round(displayHeight * scale);
      target = {
        X: Math.floor((deviceWidth - width) / 2), Y: Math.floor((deviceHeight - height) / 2),
        Width: width, Height: height,
      };
    },
    DeviceToLogical(deviceX, deviceY) {
      return {
        X: (deviceX - target.X) * EGA_WIDTH / target.Width,
        Y: (deviceY - target.Y) * EGA_HEIGHT / target.Height,
      };
    },
    BeginFrame() {
      frameContext.fillStyle = color('Screen');
      frameContext.fillRect(0, 0, EGA_WIDTH, EGA_HEIGHT);
    },
    EndFrame(screenContext) {
      screenContext.setTransform(1, 0, 0, 1, 0, 0);
      screenContext.fillStyle = color('Screen');
      screenContext.fillRect(0, 0, screenContext.canvas.width, screenContext.canvas.height);
      screenContext.imageSmoothingEnabled = false;
      screenContext.drawImage(frame, target.X, target.Y, target.Width, target.Height);
    },

    FillRect(x, y, width, height, role) {
      frameContext.fillStyle = color(role);
      frameContext.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
    },
    // Paneel: menüü või aken. EGA-s: täidetud ristkülik, raam ja vari paremal all.
    Panel(x, y, width, height, kind) {
      x = Math.round(x); y = Math.round(y);
      const background = kind === 'Menu' ? 'MenuBar' : 'Window';
      const frameRole = kind === 'Menu' ? 'MenuFrame' : 'WindowFrame';
      this.FillRect(x + 8, y + height, width, 7, 'Shadow');
      this.FillRect(x + width, y + 7, 8, height, 'Shadow');
      this.FillRect(x, y, width, height, background);
      frameContext.strokeStyle = color(frameRole);
      frameContext.lineWidth = 1;
      if (kind === 'Menu') {
        frameContext.strokeRect(x + 3.5, y + 2.5, width - 7, height - 5);
      } else {   // aken: topeltjoon
        frameContext.strokeRect(x + 3.5, y + 2.5, width - 7, height - 5);
        frameContext.strokeRect(x + 5.5, y + 4.5, width - 11, height - 9);
      }
    },
    // Akna pealkiri raami sisse keskele
    WindowTitle(x, y, width, title) {
      const text = ` ${title} `;
      const titleX = x + Math.round((width - this.TextWidth(text)) / 2 / EGA_CHAR_WIDTH) * EGA_CHAR_WIDTH;
      this.FillRect(titleX, y, this.TextWidth(text), ROW_HEIGHT - 4, 'Window');
      this.Text(titleX, y - 2, text, 'WindowText');
    },
    Separator(x, y, width, role) {
      this.FillRect(x + 4, y + ROW_HEIGHT / 2, width - 8, 1, role);
    },
    // Nupp: roheline ristkülik varjuga (Turbo Vision stiilis)
    Button(x, y, width, label, selected) {
      this.FillRect(x + width, y + 3, 6, ROW_HEIGHT - 1, 'Shadow');
      this.FillRect(x + 6, y + ROW_HEIGHT, width, 3, 'Shadow');
      this.FillRect(x, y, width, ROW_HEIGHT, selected ? 'ButtonSelected' : 'Button');
      this.Text(x + (width - this.TextWidth(label)) / 2, y, label, selected ? 'ButtonSelectedText' : 'ButtonText');
    },
    // Tekst: y on rea ülemine serv. hotkeyIndex – mitmes märk joonistatakse kiirklahvi värviga.
    Text(x, y, text, role, { HotkeyIndex = -1, HotkeyRole = 'MenuHotkey', Bold = false } = {}) {
      x = Math.round(x); y = Math.round(y);
      const chars = Array.from(text);
      chars.forEach((char, i) => {
        if (char === ' ') return;
        const colorIndex = EgaRoles[i === HotkeyIndex ? HotkeyRole : role] ?? EGA.Magenta;
        frameContext.drawImage(glyph(char, colorIndex), x + i * EGA_CHAR_WIDTH, y);
        if (Bold) frameContext.drawImage(glyph(char, colorIndex), x + i * EGA_CHAR_WIDTH + 1, y);
      });
    },
    TextWidth(text) {
      return Array.from(text).length * EGA_CHAR_WIDTH;
    },
    // Töölaua taust: helehall muster ░ sinisel (Turbo Vision stiilis)
    DesktopBackground(x, y, width, height) {
      this.FillRect(x, y, width, height, 'Desktop');
      for (let row = y; row < y + height; row += ROW_HEIGHT) {
        for (let column = x; column < x + width; column += EGA_CHAR_WIDTH) {
          frameContext.drawImage(glyph('░', EgaRoles.DesktopPattern), column, row);
        }
      }
    },
    // Tekstikursor sisestusväljas
    Caret(x, y) {
      this.FillRect(x, y + ROW_HEIGHT - 3, EGA_CHAR_WIDTH, 2, 'InputText');
    },

    // --- Joonistamise primitiivid (animaator, redaktor) [U] ---
    // EGA-s ilma silumiseta: iga punkt on terve piksel ühes 16 värvist (nagu BGI graafikas).
    // Dash = [joon, vahe] pikslites.
    Line(x1, y1, x2, y2, role, { Width = 1, Dash = null } = {}) {
      frameContext.fillStyle = color(role);
      EgaLine(frameContext, x1, y1, x2, y2, Math.max(1, Math.round(Width)), Dash);
    },
    // Ellips või ellipsi kaar (Start … End radiaanides); Fill – täidetud.
    Ellipse(cx, cy, rx, ry, role, { Fill = true, Width = 1, Start = 0, End = 2 * Math.PI, Dash = null } = {}) {
      frameContext.fillStyle = color(role);
      if (Fill) EgaFillEllipse(frameContext, cx, cy, rx, ry);
      else EgaArc(frameContext, cx, cy, rx, ry, Start, End, Math.max(1, Math.round(Width)), Dash);
    },
    Polygon(points, role) {
      frameContext.fillStyle = color(role);
      EgaFillPolygon(frameContext, points);
    },
    StrokeRect(x, y, width, height, role, { Width = 1, Dash = null } = {}) {
      x = Math.round(x); y = Math.round(y); width = Math.round(width); height = Math.round(height);
      const w = Math.max(1, Math.round(Width));
      if (Dash) {
        this.Line(x, y, x + width - 1, y, role, { Dash });
        this.Line(x + width - 1, y, x + width - 1, y + height - 1, role, { Dash });
        this.Line(x + width - 1, y + height - 1, x, y + height - 1, role, { Dash });
        this.Line(x, y + height - 1, x, y, role, { Dash });
        return;
      }
      this.FillRect(x, y, width, w, role);
      this.FillRect(x, y + height - w, width, w, role);
      this.FillRect(x, y, w, height, role);
      this.FillRect(x + width - w, y, w, height, role);
    },
    RoundRect(x, y, width, height, radius, role) {
      this.FillRect(x, y, width, height, role);
    },
    Clip(x, y, width, height, draw) {
      frameContext.save();
      frameContext.beginPath();
      frameContext.rect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
      frameContext.clip();
      draw();
      frameContext.restore();
    },
    // Läbipaistvust EGA-s pole: pool või rohkem nähtav → joonistatakse.
    Alpha(alpha, draw) {
      if (alpha >= 0.5) draw();
    },
  };
}

// [U] EgaLine – Bresenhami joon EGA kaadrisse (värv on juba seatud).
function EgaLine(context, x1, y1, x2, y2, width, dash) {
  let x = Math.round(x1);
  let y = Math.round(y1);
  const endX = Math.round(x2);
  const endY = Math.round(y2);
  const dx = Math.abs(endX - x);
  const dy = -Math.abs(endY - y);
  const stepX = x < endX ? 1 : -1;
  const stepY = y < endY ? 1 : -1;
  const half = Math.floor((width - 1) / 2);
  let error = dx + dy;
  for (let step = 0; ; step++) {
    if (!dash || step % (dash[0] + dash[1]) < dash[0]) context.fillRect(x - half, y - half, width, width);
    if (x === endX && y === endY) break;
    const double = 2 * error;
    if (double >= dy) { error += dy; x += stepX; }
    if (double <= dx) { error += dx; y += stepY; }
  }
}

// [U] EgaArc – ellipsi kaar punktide kaupa.
function EgaArc(context, cx, cy, rx, ry, start, end, width, dash) {
  const count = Math.max(8, Math.ceil(Math.max(rx, ry) * Math.abs(end - start) * 1.5));
  const half = Math.floor((width - 1) / 2);
  let last = '';
  let step = 0;
  for (let i = 0; i <= count; i++) {
    const angle = start + (end - start) * i / count;
    const x = Math.round(cx + rx * Math.cos(angle));
    const y = Math.round(cy + ry * Math.sin(angle));
    const key = `${x},${y}`;
    if (key === last) continue;
    last = key;
    if (!dash || step % (dash[0] + dash[1]) < dash[0]) context.fillRect(x - half, y - half, width, width);
    step++;
  }
}

// [U] EgaFillEllipse – täidetud ellips ridade kaupa.
function EgaFillEllipse(context, cx, cy, rx, ry) {
  for (let y = Math.floor(cy - ry); y < Math.ceil(cy + ry); y++) {
    const relative = (y + 0.5 - cy) / ry;
    if (Math.abs(relative) > 1) continue;
    const half = rx * Math.sqrt(1 - relative * relative);
    const left = Math.round(cx - half);
    const right = Math.round(cx + half);
    context.fillRect(left, y, Math.max(1, right - left), 1);
  }
}

// [U] EgaFillPolygon – täidetud hulknurk ridade kaupa (paaris-paaritu reegel).
function EgaFillPolygon(context, points) {
  const top = Math.floor(Math.min(...points.map(point => point.Y)));
  const bottom = Math.ceil(Math.max(...points.map(point => point.Y)));
  for (let y = top; y < bottom; y++) {
    const scan = y + 0.5;
    const crossings = [];
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length];
      if ((a.Y <= scan && b.Y > scan) || (b.Y <= scan && a.Y > scan)) {
        crossings.push(a.X + (scan - a.Y) * (b.X - a.X) / (b.Y - a.Y));
      }
    });
    crossings.sort((first, second) => first - second);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const left = Math.round(crossings[i]);
      context.fillRect(left, y, Math.max(1, Math.round(crossings[i + 1]) - left), 1);
    }
  }
}

// [U] LoadEgaFont – laadib EGA pikslifondi (PxPlus IBM EGA 8x14, VileR, CC BY-SA 4.0).
//     Kutsub: fms.js enne esimest joonistamist.
export async function LoadEgaFont() {
  const face = new FontFace(EGA_FONT_NAME, `url(${EGA_FONT_URL.href})`);
  await face.load();
  document.fonts.add(face);
}

// =====================================================================
// Kaasaegne
// =====================================================================

// [U] CreateModernTheme – kaasaegne välimus: teravad vektorjooned, süsteemifont,
//     ümarad nurgad, hele või tume. Ekraan on nii suur kui aken.
//     colorScheme: 'Light' | 'Dark'. Kutsub: fms.js.
export function CreateModernTheme(colorScheme) {
  const roles = colorScheme === 'Dark' ? ModernDark : ModernLight;
  const color = (role) => roles[role] ?? '#ff00ff';
  let context = null;
  let scale = 1;
  const theme = {
    Name: 'Modern',
    ColorScheme: colorScheme,
    Width: EGA_WIDTH,
    Height: EGA_HEIGHT,
    Symbols: { Check: '✓', Submenu: '›', Ellipsis: '…' },
    PageBackground: roles.Screen,

    Resize(deviceWidth, deviceHeight, devicePixelRatio) {
      const cssScale = Math.min(MODERN_MAX_SCALE, deviceWidth / devicePixelRatio / EGA_WIDTH,
        deviceHeight / devicePixelRatio / EGA_HEIGHT);
      scale = cssScale * devicePixelRatio;
      theme.Width = deviceWidth / scale;
      theme.Height = deviceHeight / scale;
    },
    DeviceToLogical(deviceX, deviceY) {
      return { X: deviceX / scale, Y: deviceY / scale };
    },
    BeginFrame(screenContext) {
      context = screenContext;
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.imageSmoothingEnabled = true;
      context.fillStyle = color('Screen');
      context.fillRect(0, 0, theme.Width, theme.Height);
      context.textBaseline = 'middle';
    },
    EndFrame() {},

    FillRect(x, y, width, height, role) {
      context.fillStyle = color(role);
      context.fillRect(x, y, width, height);
    },
    Panel(x, y, width, height, kind) {
      const radius = kind === 'Menu' ? 4 : 6;
      context.save();
      context.shadowColor = color('Shadow');
      context.shadowBlur = 12 * scale;
      context.shadowOffsetY = 2 * scale;
      roundedRect(context, x, y, width, height, radius);
      context.fillStyle = color(kind === 'Menu' ? 'MenuBar' : 'Window');
      context.fill();
      context.restore();
      roundedRect(context, x + 0.25, y + 0.25, width - 0.5, height - 0.5, radius);
      context.strokeStyle = color(kind === 'Menu' ? 'MenuFrame' : 'WindowFrame');
      context.lineWidth = 0.5;
      context.stroke();
    },
    WindowTitle(x, y, width, title) {
      context.font = `600 ${MODERN_FONT_SIZE}px ${MODERN_FONT}`;
      context.fillStyle = color('WindowTitle');
      context.textAlign = 'center';
      context.fillText(title, x + width / 2, y + ROW_HEIGHT / 2 + 1);
      context.textAlign = 'left';
    },
    Separator(x, y, width, role) {
      context.fillStyle = color('MenuFrame');
      context.fillRect(x + 6, y + ROW_HEIGHT / 2, width - 12, 0.5);
    },
    Button(x, y, width, label, selected) {
      roundedRect(context, x, y, width, ROW_HEIGHT + 1, 3);
      context.fillStyle = color(selected ? 'ButtonSelected' : 'Button');
      context.fill();
      if (!selected) {
        context.strokeStyle = color('WindowFrame');
        context.lineWidth = 0.5;
        context.stroke();
      }
      context.font = `500 ${MODERN_FONT_SIZE}px ${MODERN_FONT}`;
      context.fillStyle = color(selected ? 'ButtonSelectedText' : 'ButtonText');
      context.textAlign = 'center';
      context.fillText(label, x + width / 2, y + ROW_HEIGHT / 2 + 1);
      context.textAlign = 'left';
    },
    Text(x, y, text, role, { HotkeyIndex = -1, Bold = false, Size = MODERN_FONT_SIZE, Mono = false } = {}) {
      context.font = `${Bold ? 600 : 400} ${Size}px ${Mono ? MODERN_MONO_FONT : MODERN_FONT}`;
      context.fillStyle = color(role);
      const middle = y + ROW_HEIGHT / 2 + 0.5;
      context.fillText(text, x, middle);
      if (HotkeyIndex >= 0) {   // kiirklahv on alla joonitud
        const before = context.measureText(text.slice(0, HotkeyIndex)).width;
        const letter = context.measureText(text[HotkeyIndex]).width;
        context.fillRect(x + before, middle + Size * 0.55, letter, 0.6);
      }
    },
    TextWidth(text, { Bold = false, Size = MODERN_FONT_SIZE, Mono = false } = {}) {
      context.font = `${Bold ? 600 : 400} ${Size}px ${Mono ? MODERN_MONO_FONT : MODERN_FONT}`;
      return context.measureText(text).width;
    },
    DesktopBackground(x, y, width, height) {
      this.FillRect(x, y, width, height, 'Desktop');
      // peen punktruudustik
      context.fillStyle = color('DesktopPattern');
      for (let row = y + 10; row < y + height; row += 14) {
        for (let column = x + 10; column < x + width; column += 14) {
          context.fillRect(column, row, 1, 1);
        }
      }
    },
    Caret(x, y) {
      this.FillRect(x, y + 2, 0.75, ROW_HEIGHT - 4, 'InputText');
    },
    // Kaasaegsel teemal on menüüriba all õhuke joon.
    MenuBarLine(y, width) {
      this.FillRect(0, y, width, 0.5, 'MenuBarLine');
    },

    // --- Joonistamise primitiivid (animaator, redaktor) [U] ---
    Line(x1, y1, x2, y2, role, { Width = 1, Dash = null } = {}) {
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      strokePath(role, Width, Dash);
    },
    Ellipse(cx, cy, rx, ry, role, { Fill = true, Width = 1, Start = 0, End = 2 * Math.PI, Dash = null } = {}) {
      context.beginPath();
      context.ellipse(cx, cy, Math.max(0, rx), Math.max(0, ry), 0, Start, End);
      if (Fill) { context.fillStyle = color(role); context.fill(); } else strokePath(role, Width, Dash);
    },
    Polygon(points, role) {
      context.beginPath();
      points.forEach((point, i) => (i === 0 ? context.moveTo(point.X, point.Y) : context.lineTo(point.X, point.Y)));
      context.closePath();
      context.fillStyle = color(role);
      context.fill();
    },
    StrokeRect(x, y, width, height, role, { Width = 1, Dash = null, Radius = 0 } = {}) {
      roundedRect(context, x + Width / 2, y + Width / 2, width - Width, height - Width, Radius);
      strokePath(role, Width, Dash);
    },
    RoundRect(x, y, width, height, radius, role) {
      roundedRect(context, x, y, width, height, radius);
      context.fillStyle = color(role);
      context.fill();
    },
    Clip(x, y, width, height, draw) {
      context.save();
      context.beginPath();
      context.rect(x, y, width, height);
      context.clip();
      draw();
      context.restore();
    },
    Alpha(alpha, draw) {
      context.save();
      context.globalAlpha *= alpha;
      draw();
      context.restore();
    },
    // Liugur: rada, täidetud osa kuni value (0 … 1) ja nupp; active – lohistamisel või hiire all.
    Slider(x, y, width, value, active) {
      const middle = y + (ROW_HEIGHT + 1) / 2;
      const knobX = x + 5 + (width - 10) * Math.min(1, Math.max(0, value));
      this.RoundRect(x + 5, middle - 1.5, width - 10, 3, 1.5, 'SliderTrack');
      this.RoundRect(x + 5, middle - 1.5, knobX - x - 5, 3, 1.5, 'SliderFill');
      context.save();
      context.shadowColor = color('Shadow');
      context.shadowBlur = 3 * scale;
      this.Ellipse(knobX, middle, active ? 5.5 : 5, active ? 5.5 : 5, 'SliderKnob');
      context.restore();
      this.Ellipse(knobX, middle, active ? 5.5 : 5, active ? 5.5 : 5, active ? 'SliderFill' : 'WindowFrame', { Fill: false, Width: active ? 1.2 : 0.6 });
    },
  };
  function strokePath(role, width, dash) {
    context.strokeStyle = color(role);
    context.lineWidth = width;
    context.lineCap = 'round';
    context.setLineDash(dash || []);
    context.stroke();
    context.setLineDash([]);
  }
  // TextWidth vajab konteksti juba enne esimest kaadrit (paigutuse arvutamiseks).
  context = document.createElement('canvas').getContext('2d');
  return theme;
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
