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
- [ ] 5. Animaator
- [ ] 6. Redaktor
- [ ] 7. Diskreetsed rajad
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
