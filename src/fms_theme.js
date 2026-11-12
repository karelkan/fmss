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
  };
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
  };
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
