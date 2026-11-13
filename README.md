# FMSS – paindtootmissüsteemide simulaator

Diplomitöö (Turbo Pascal) taastamine uues versioonis.

## Originaal

Kolm osa:

1. **Editor** – tootmissüsteemi joonistamine: rajad, masinad, puhvrid, sisend, väljund; masinate ja toodete spetsifikatsioonid.
2. **Simulaator** – diskreetsündmuste simulatsioon; sündmused ajaliselt järjestatud ahelloendis `event_list` (kirje: viide järgmisele, sündmuse aeg, parameetrid).
3. **Visualiseerija** – 2D vaade lihtsate ikoonidega.

Originaali täpne kirjeldus: [originaal.md](originaal.md). Skaneeritud diplomitöö (TTÜ 1993, mittelõplik versioon, lisad puuduvad): [docs/skaneeringud/](docs/skaneeringud/).

## Seis

- [x] Originaaldokumendi ümberkirjutus ([originaal.md](originaal.md))
- [x] Teostusplaan ja tehnoloogia valik ([PLAAN.md](PLAAN.md))
- [x] 1. Simulatsiooniloogika disain ([DISAIN.md](DISAIN.md))
- [x] 2. Prototüüp ja valideerimine ([VALIDEERIMINE.md](VALIDEERIMINE.md), `npm test`)
- [x] 3. Karkass (teemad EGA / kaasaegne, menüü, avaekraan, andmemudel – [DISAIN.md](DISAIN.md) osa 13)
- [x] 4. Täissimulaator (`src/fms_sim.js`: `Enumerate` ruudustikust, andmekontroll, statistika; *Simulate* jookseb lõpuni ja näitab kokkuvõtet – [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 4)
- [x] 5. Animaator (`src/anima.js`: *Simulate* avab animatsiooni – kärud, pinkide ja puhvrite olekud, kiirus ×1…×1000, samm / järgmine sündmus; kaasaegses välimuses juhtriba ja Event List ekraanil – [DISAIN.md](DISAIN.md) osa 14, [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 5)
- [x] 6. Redaktor ([DISAIN.md](DISAIN.md) osa 15, [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 6)
  - [x] 6a. Layout ja View (`src/fms_ed.js`: rada lohistades, ikoon valitakse ise; palett, kustutamine, suunanool, Undo, kerimine; salvestamata muudatuse hoiatus)
  - [x] 6b. Andmed vormides (`src/fms_ed_data.js`, `FormBox`): Config (All / Choose), Transport (ka lõigu pikkus ja raja kustutamine), Workpiece data (Edit / Copy / Flush, marsruudid), Storage data, Model data; vigade ja hoiatuste arv Layout-is ja nimekiri (K, Edit → Check)
- [ ] 7. Rajavõrk ja diskreetsed rajad
  - [x] 7a. Rajavõrgu graaf (`src/fms_sim.js`: mitu pidevat rada, konnektorid, avatud konveier, tee üle konnektorite – [DISAIN.md](DISAIN.md) osa 2.3, [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 7a); animaator ja redaktor koos sellega
  - [ ] 7b. Diskreetsed rajad (AGV-d, `ProgTM`, `Collision`)
  - [ ] 7c. Mitu detaili alusel (`PlacesPerCart > 1`)
- [ ] 8. Rikked ja juhuslikkus
- [ ] 9. Aruanded
- [ ] 10. Avaldamine (GitHub Pages)
- [ ] 11. Adviser

## Käivitamine

```bash
python3 -m http.server 8000
```

Seejärel ava brauseris http://localhost:8000/. Testid (Node 20+): `npm test`.

## Litsentsid

EGA font: **PxPlus IBM EGA 8x14** kogumikust [The Ultimate Oldschool PC Font Pack](https://int10h.org/oldschool-pc-fonts/) (VileR), litsents [CC BY-SA 4.0](fonts/LICENSE-CC-BY-SA-4.0.txt). Fail `fonts/WebPlus_IBM_EGA_8x14.woff` on muutmata.
