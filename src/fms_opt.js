// FMSS – keskkonna seaded.
// Vastab originaali moodulile FMS_OPT.PAS ja seadete failile FMSS.CFG.
// Seaded hoitakse brauseri mälus (localStorage); kui see pole saadaval, kehtivad vaikeväärtused.

const OPTIONS_KEY = 'fmss.options';

// [O] EnvironmentOptions – keskkonna seaded.
//     Theme: 'EGA' | 'Modern'; ColorScheme (ainult kaasaegsel): 'Auto' | 'Light' | 'Dark'.
export const EnvironmentOptions = {
  Theme: 'EGA',
  ColorScheme: 'Auto',
};

// [O] LoadOptions – loeb seaded brauseri mälust. Kutsub: fms.js käivitamisel.
export function LoadOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) || '{}');
    if (saved.Theme === 'EGA' || saved.Theme === 'Modern') EnvironmentOptions.Theme = saved.Theme;
    if (['Auto', 'Light', 'Dark'].includes(saved.ColorScheme)) EnvironmentOptions.ColorScheme = saved.ColorScheme;
  } catch {
    // mälu pole saadaval – vaikeväärtused
  }
}

// [O] SaveOptions – salvestab seaded brauseri mällu. Kutsub: fms.js pärast muutmist.
export function SaveOptions() {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(EnvironmentOptions));
  } catch {
    // mälu pole saadaval – seaded kehtivad ainult selle seansi ajal
  }
}
