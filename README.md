# FMSS – paindtootmissüsteemide simulaator

**Paindautomatiseeritud tootmise simulatsioonisüsteem.** Diplomiprojekt, Tallinna Tehnikaülikool, Arvutitehnika Instituut, 1993 (autor K. Kannel, juhendaja J. Riives). Kirjutati Turbo Pascalis ja jäi pooleli; versioon 1.0 valmis 2026 brauseris – *läks ainult 33 aastat, aga valmis sai*.

**Veebis:** [karelkan.github.io/fmss](https://karelkan.github.io/fmss/) – avaleht ja lühijuhend; versioon 1 (praegu 1.5): [karelkan.github.io/fmss/v1](https://karelkan.github.io/fmss/v1/); dokumentatsioon: [karelkan.github.io/fmss/doc](https://karelkan.github.io/fmss/doc/).

Kolm osa nagu originaalis:

1. **Editor** – tootmissüsteemi joonistamine: rajad, masinad, puhvrid, sisend, väljund; masinate ja toodete spetsifikatsioonid.
2. **Simulaator** – diskreetsündmuste simulatsioon; sündmused ajaliselt järjestatud ahelloendis (`FirstAtMoment`, `PutEvent` / `GetEvent`).
3. **Visualiseerija** – animaator ja aruanded.

Kaks välimust: **EGA** (640 × 350, 16 värvi, nagu 1993) ja **kaasaegne** (hele / tume), vahetab `F2`. Ainult staatilised failid, ilma build-sammu ja sõltuvusteta (HTML, JavaScripti moodulid, Canvas).

Originaali kirjeldus: [originaal.md](originaal.md). Skaneeritud diplomitöö on autori juures, avalikus repos seda pole.

## Käivitamine

```bash
python3 -m http.server 8000
```

Seejärel ava brauseris http://localhost:8000/v1/. Testid (Node 20+): `npm test`.

Veebisaidi kokkupanek (avaleht + `/doc/` + `/v1/`, sama mis GitHub Pages'is – [DISAIN.md](DISAIN.md) osa 19):

```bash
tools/site.sh /tmp/fmss-site
```

## Kaustad

| Kaust | Sisu |
|---|---|
| `core/` | ühine simulaator (versioonidel 1 ja 2): `fms_sim.js`, `fms_glb.js` (andmemudel, kontroll), `fms_lng.js` (tekstid) |
| `v1/` | versioon 1 (EGA ja kaasaegne): `index.html`, `src/` – liides originaali nimedega (`fms.js`, `fms_ed.js`, `fms_rep.js`, `anima.js` …), `fonts/` – EGA font; `v1/core` ja `v1/models` on lingid |
| `v2/` | versioon 2 (tuleb V2 etapis 3) |
| `models/` | näidismudelid (`*.fms.json`) ja nende nimekiri `index.json` – ühised |
| `site/` | avaleht ja lühijuhend; `site/doc/` – dokumentatsioon (joonised, ekraanipildid `img/`) |
| `tools/`, `.github/workflows/` | saidi kokkupanek ja GitHub Pages; dokumentatsiooni joonised mudelitest (`tools/layout_svg.js`) |
| `test/`, `test/proto/` | testid; simulaatori prototüüp (etapp 2, võrdluseks) |
| [PLAAN.md](PLAAN.md), [DISAIN.md](DISAIN.md) | versiooni 1 teostusplaan (ajalugu) ning simulatsiooniloogika ja liidese disain – külmutatud 2026-11-15 (tarkvara 1.5) |
| [PLAAN_TOOD_V2.md](PLAAN_TOOD_V2.md) | versiooni 2 plaan: otsused, etapid ja **ootel tööd** (osa 8) |
| [DISAIN_V2.md](DISAIN_V2.md) | versiooni 2 disaini muudatused ja uute nimede sõnastik |
| [VALIDEERIMINE.md](VALIDEERIMINE.md) | valideerimise tulemused ja leiud |
| [AJALUGU.md](AJALUGU.md) | taastamise lugu: etapid 0–12, otsused ja õppetunnid |

## Seis

- [x] Originaaldokumendi ümberkirjutus ([originaal.md](originaal.md))
- [x] Teostusplaan ja tehnoloogia valik ([PLAAN.md](PLAAN.md))
- [x] 1. Simulatsiooniloogika disain ([DISAIN.md](DISAIN.md))
- [x] 2. Prototüüp ja valideerimine ([VALIDEERIMINE.md](VALIDEERIMINE.md), `npm test`)
- [x] 3. Karkass (teemad EGA / kaasaegne, menüü, avaekraan, andmemudel – [DISAIN.md](DISAIN.md) osa 13)
- [x] 4. Täissimulaator (`core/fms_sim.js`: `Enumerate` ruudustikust, andmekontroll, statistika; *Simulate* jookseb lõpuni ja näitab kokkuvõtet – [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 4)
- [x] 5. Animaator (`v1/src/anima.js`: *Simulate* avab animatsiooni – kärud, pinkide ja puhvrite olekud, kiirus ×1…×1000, samm / järgmine sündmus; kaasaegses välimuses juhtriba ja Event List ekraanil – [DISAIN.md](DISAIN.md) osa 14, [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 5)
- [x] 6. Redaktor ([DISAIN.md](DISAIN.md) osa 15, [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 6)
  - [x] 6a. Layout ja View (`v1/src/fms_ed.js`: rada lohistades, ikoon valitakse ise; palett, kustutamine, suunanool, Undo, kerimine; salvestamata muudatuse hoiatus)
  - [x] 6b. Andmed vormides (`v1/src/fms_ed_data.js`, `FormBox`): Config (All / Choose), Transport (ka lõigu pikkus ja raja kustutamine), Workpiece data (Edit / Copy / Flush, marsruudid), Storage data, Model data; vigade ja hoiatuste arv Layout-is ja nimekiri (K, Edit → Check)
- [x] 7. Rajavõrk ja diskreetsed rajad
  - [x] 7a. Rajavõrgu graaf (`core/fms_sim.js`: mitu pidevat rada, konnektorid, avatud konveier, tee üle konnektorite, sild (mitteühendatud ristumine) – [DISAIN.md](DISAIN.md) osa 2.3, [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 7a); animaator ja redaktor koos sellega
  - [x] 7b. Diskreetsed rajad (`core/fms_sim.js`: rada kui teedevõrk – raja-harud, ristmikud, ühesuunalised lõigud noolega; kärud, tsoonid ja plokid, `ProgTM`, `FindPal`, `Collision`, ümbersõit ja kõrvalepõige; paralleelsed konnektorid; teed aja järgi – [DISAIN.md](DISAIN.md) osa 11, [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 7b); animaator ja redaktor koos sellega; näidismudel `models/agv.fms.json` (File → Load → Näidis-AGV)
  - [x] 7c. Mitu detaili alusel / kärul (`core/fms_sim.js`: kohad alusel, jaamas mitu peale- ja mahalaadimist, käru peatuste nimekiri ja kogumissõit odavaima lisamisega – [DISAIN.md](DISAIN.md) osa 16, [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 7c); animaator (kohad alusel, EGA olekurida kahel real) ja kokkuvõte
- [x] 8. Rikked ja juhuslikkus (`core/fms_sim.js`: tööpingi rike töötlemise ajal – `Crash`, remont `Repair`, praak SysOut-i; rikete vahe eksponentjaotusega, pingi oma juhuarvujada; kestuse jaotus ühtlane / kolmnurkne / normaalne – [DISAIN.md](DISAIN.md) osa 17, [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 8); animaator (rikkes pink R, praak ristiga), kokkuvõte, redaktori vormid
- [x] 9. Aruanded (`v1/src/fms_rep.js`: menüü Report – Static (algne seis ja lõppseis teemade kaupa), Dynamic (tsükliaeg ja osakaalud, tüüpide kaupa, aegrida graafikuga, sündmused), Output ekraanile (kerimisega aken mõlemas välimuses) või tekstifaili; Simulate kokkuvõttes nupp „Aruanne“; ka ummiku ja katkestuse korral – [DISAIN.md](DISAIN.md) osa 18, [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 9)
- [x] 10. Avaldamine – versioon 1.0 (avaleht ja lühijuhend `site/index.html`, `/v1/` tag'ist `v1.0`, `tools/site.sh`, GitHub Pages'i töövoog; näidiste nimekiri `models/index.json`, näidis riketega; Advise → „tuleb versioonis 2.0“ – [DISAIN.md](DISAIN.md) osa 19, [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 10). Avaldatud: https://karelkan.github.io/fmss/ (tag `v1.0`)
- [x] 11. Näidismudelid: 3 suurt tootmissüsteemi (12–16 tööpinki) avalike lugude põhjal; versioonid 1.1–1.3 ([PLAAN.md](PLAAN.md))
  - [x] 11a. Versioon 1.1 – kerimine ja suum: suur mudel animaatoris (EGA kerib, ikoon jääb 48 × 35; kaasaegne kahandab kuni 36 px, siis kerib; suum hiire rattaga, lohistamine, `0`), redaktoris kaasaegne suum (Ctrl + ratas); `/v1/` tag'ist `v1.1` – [DISAIN.md](DISAIN.md) osa 14, 19, [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 11a
  - [x] 11b. Versioon 1.2 – parandus: `ShortestPaths` ümardas aega igal sammul ja suletud konveieril võis tee tulla vahejaama kaudu (0,001 s „kiirem“) – simulatsioon katkes erindiga (leiti mudeliga A); `PATH_TIME_EPSILON` – [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 11b
  - [x] 11c. Mudelid: Kinnitustehas (16 pinki, 8 tüüpi, konveier), Allhanketehas (15 pinki, 12 tüüpi, 3 konveierit konnektoritega), Reduktori FMS (12 pinki, 7 tüüpi, 4 AGV-d, rikked) – `models/`, [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 11c. Versioon 1.3: Simulate kokkuvõte mahub EGA-s ekraanile (`SimSummaryLines`, `MessageBoxMaxLines`)
- [x] 11d. Versioon 1.4 – simulatsiooni lõpurežiim `Sim.EndMode`: Kellani, Kellani ja pink tühi, Kellani ja liin tühi, Tehas tühjaks (pärast kestust lõpetamine, kuni 2 × kestus), Partiid lõpuni (tellimus – igast tüübist „Partii, tk“, originaali reegel „partiidena“, praak asendatakse, tulemus makespan); tüüpide järjekord `Sim.OrderSequence` Segamini / Partii järjest (originaali II.2); läbilaskevõime ja rakendatus perioodi 0…T järgi; Model data vorm, animaatori „lõpetab“, kokkuvõte ja aruanne; Allhanketehas on tellimus (48 tk, partii järjest) – [DISAIN.md](DISAIN.md) osa 20, [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 11d
- [x] 11e. Taastamise ajalugu ([AJALUGU.md](AJALUGU.md)): kuidas jõuti esimesest vestlusest etapini 12 – iga etapi olulised otsused ja leiud, mis puudus originaalist, õppetunnid
- [x] 12. Dokumentatsioon: diplomitööga sarnane dokument saidil `/doc/` (`site/doc/index.html`, prinditav PDF-iks) – teooria koos täiendustega, arhitektuur 21 joonisega (SVG, mudelite paigutus `tools/layout_svg.js`-iga), kirjed, EventHandlerid ja sõnastik, valideerimine, näidismudelid; avalehelt viide; test `test/doc.test.js` hoiab selle koodi ja sõnastikuga kooskõlas – [DISAIN.md](DISAIN.md) osa 21, [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 12
  - [x] Versioon 1.5 – seitsmes näidis **Mootoriosade tehas** (`models/mootor.fms.json`: 32 pinki, 3 konveierit + kuue AGV-ga ring, 11 konnektorit, 16 tüüpi, rikked); EGA kokkuvõttes konnektorite koondrida – [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 12b, [DISAIN.md](DISAIN.md) osa 18, 19
  - [x] Dokumentatsioon 1.1 (tarkvara 1.5 – versiooni 1 viimane): uus peatükk 6 **Planner** – operatiivjuhtimise teooria, originaali reeglid, vastavus (tegemata reeglid → [PLAAN_TOOD_V2.md](PLAAN_TOOD_V2.md) 4.12), realisatsioon pseudokoodina, näide Näidis-PTS-i logist; parandatud marsruudi valiku ja `FindBuf` / `FindSysPos` kirjeldus ([DISAIN.md](DISAIN.md) 5.2, 21)
- [ ] Versioon 2.0: kaasaegne liides, Adviser ja Claude'i nõustaja – [PLAAN_TOOD_V2.md](PLAAN_TOOD_V2.md)
  - [x] V2 etapp 1. Arutelu ja tööplaan: otsused, võimalused (tööruum ja tabelid, metrooskeem ja plaan, tsehhid, tööstuslik visualiseerimine, katsete haldur, mitu sisendit ja väljundit, Adviser, Claude'i nõustaja, kasutusjuhend), etapid 2–13; 2.0 = etapid 3–7
  - [x] Kaustade ümberkorraldus: `v1/` (liides), `core/` (ühine simulaator), `test/proto/`; `/v1/` sait tag'ist sama ([DISAIN.md](DISAIN.md) osa 19)
  - [ ] V2 etapp 2. Maketid ja liidese spetsifikatsiooni kinnitus

## Autoriõigus ja litsentsid

© K. Kannel 1993, 2026. Kõik õigused kaitstud. Lähtekood on avalik tutvumiseks; selle kasutamiseks, muutmiseks või levitamiseks küsi autorilt luba.

EGA font: **PxPlus IBM EGA 8x14** kogumikust [The Ultimate Oldschool PC Font Pack](https://int10h.org/oldschool-pc-fonts/) (VileR), litsents [CC BY-SA 4.0](v1/fonts/LICENSE-CC-BY-SA-4.0.txt). Fail `v1/fonts/WebPlus_IBM_EGA_8x14.woff` on muutmata.
