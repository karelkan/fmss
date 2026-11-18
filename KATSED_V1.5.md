# Katsed tarkvaraga 1.5

Simulaatori tegelik mõte on aru saada, mis tootmissüsteemis mida mõjutab. Siin on näidismudelitega tehtud katsed: mudeli koopias muudetakse üht parameetrit ja vaadatakse, kuidas muutuvad tulemused.

- **Tarkvara**: versioon 1.5 (tag `v1.5`), `core/fms_glb.js` ja `core/fms_sim.js`. Koodi ei muudetud; katsed ei ole arendus.
- **Jooksutamine**: Node'is nagu VALIDEERIMINE.md etappides 11c ja 12b – mudeli koopia → parameetri muudatus → `CheckModel`, `Enumerate`, `SimRun`. Katseskriptid ei ole repos.
- **Juhuslikkus**: iga variant 10 seemnega (1–10). Tulemus on keskmine ja vahemik (min–max). Seemne 1 jooksud kontrollivad invariante igal sekundil.
- **Vead**: kui katse leiab tarkvarast vea, saab see numbri `PLAAN_TOOD_V2.md` osas 8 (T-n) ja siin on ainult viide.

| Katse | Küsimus | Seis |
|---|---|---|
| K1 | `Kl` (detaile süsteemis) ↔ tellimuse täitmise aeg, tsükliaeg | tehtud 2026-11-18 |
| K2 | puhvrite maht × ummiku vältimine sees / väljas ↔ tellimuse täitmise aeg | tehtud 2026-11-18 |
| K3 | AGV-de / aluste arv ja kiirus, konnektorid ↔ tellimuse täitmise aeg | tehtud 2026-11-18 |
| K4 | partii suurus, tüüpide järjekord ja häälestusaeg ↔ läbilaskevõime | tehtud 2026-11-18 |
| K5 | rikete muster sama käideldavusega; seemnete arv | tehtud 2026-11-18 |
| K6 | puhvri distsipliin FIFO / FILO / RANDOM ↔ tsükliaja jaotus | tehtud 2026-11-18 |

---

## K1. Detaile süsteemis (`Kl`) ja tellimuse täitmise aeg

### Küsimus ja hüpotees

Planner toob uue detaili süsteemi, kui `Ndet / (Ntm + Nmt + Nbuf + Ncon) < Kl` (DISAIN.md 5.2). `Kl` määrab seega, mitu detaili on korraga süsteemis.

Hüpotees (Little'i seadus `WIP = TH × CT` ja „kriitiline WIP“):
- Kuni kitsaskoha küllastumiseni lüheneb tellimuse täitmise aeg `Kl` kasvades kiiresti.
- Pärast seda läbilaskevõime enam ei kasva. Lisadetailid ainult ootavad ja tsükliaeg kasvab lineaarselt.
- Väga suure `Kl` juures võivad tulla parkimised või ummikud.

### Seaded

| | |
|---|---|
| Mudelid | Näidis-PTS (`demo`, 2 pinki, konveier), Reduktori FMS (`reduktor`, 12 pinki, 4 AGV-d, rikked), Mootoriosade tehas (`mootor`, 32 pinki, 3 konveierit + AGV-ring, 11 konnektorit, rikked) |
| Tellimus | lõpurežiim **Partiid lõpuni** (`Order`), tüüpide järjekord **Segamini**. Igast tüübist võrdselt: Näidis-PTS 40 tk (kokku 80), Reduktori FMS 10 tk (70), Mootoriosade tehas 9 tk (144). Praak asendatakse. |
| Mõõdik | **tellimuse täitmise aeg** (makespan) – esimese detaili sissetoomisest viimase valmimiseni, tundides |
| Muudetav | `Kl` 0,10…1,00, samm 0,05 (19 väärtust) × seemned 1–10 = 190 jooksu mudeli kohta, kokku 570 |
| Muu | mudeli ülejäänud seaded nagu näidises; ülempiir `Duration` 7 päeva (ühelgi jooksul ei saabunud) |

Kohtade arv `P = Ntm + Nmt + Nbuf + Ncon` on Näidis-PTS-is 14, Reduktori FMS-is 60 ja Mootoriosade tehases 162. Süsteemis on korraga kuni ⌈`Kl` · P⌉ detaili (tabelis veerg „detaile kuni“). Väikeses mudelis annavad kaks kõrvuti `Kl`-i sama arvu, seepärast on osa ridu samad.

### Tulemused

Graafikul (kaust `katsed/`, SVG) on sinine joon 10 seemne keskmine ja helesinine ala vahemik (väikseim–suurim). Horisontaalteljel on `Kl`, vertikaalteljel tellimuse täitmise aeg tundides.

Kõik 570 jooksu täitsid tellimuse. Ummikuid ega parkimisi ei olnud, invariandid (seeme 1) olid korras.

#### Näidis-PTS (80 detaili)

![K1 Näidis-PTS: tellimuse täitmise aeg](katsed/k1_demo.svg)

| Kl | detaile kuni | täitmise aeg, h: keskm. (min–max) | läbilaskevõime, tk/h | detaile keskm. | tsükliaeg, min | ootamine | suurim rakendatus |
|---|---|---|---|---|---|---|---|
| 0,10 | 2 | **9,63** (9,57–9,68) | 8,31 | 2,0 | 14 | 4 % | 70 % |
| 0,15 | 3 | **7,75** (7,65–7,84) | 10,32 | 3,0 | 17 | 19 % | 96 % |
| 0,20 | 3 | **7,75** (7,65–7,84) | 10,32 | 3,0 | 17 | 19 % | 96 % |
| 0,25 | 4 | **7,75** (7,68–7,83) | 10,33 | 3,9 | 23 | 40 % | 99 % |
| 0,30 | 5 | **7,81** (7,73–7,88) | 10,25 | 4,9 | 28 | 51 % | 99 % |
| 0,35 | 5 | **7,81** (7,73–7,88) | 10,25 | 4,9 | 28 | 51 % | 99 % |
| 0,40 | 6 | **7,80** (7,69–7,87) | 10,25 | 5,8 | 34 | 58 % | 99 % |
| 0,45 | 7 | **7,86** (7,78–7,92) | 10,18 | 6,6 | 39 | 64 % | 99 % |
| 0,50 | 7 | **7,86** (7,78–7,92) | 10,18 | 6,6 | 39 | 64 % | 99 % |
| 0,55 | 8 | **7,87** (7,68–7,98) | 10,16 | 7,5 | 44 | 68 % | 99 % |
| 0,60 | 9 | **7,87** (7,73–8,00) | 10,16 | 8,4 | 49 | 71 % | 99 % |
| 0,65 | 10 | **7,93** (7,81–8,01) | 10,09 | 9,2 | 55 | 74 % | 99 % |
| 0,70 | 10 | **7,93** (7,81–8,01) | 10,09 | 9,2 | 55 | 74 % | 99 % |
| 0,75 | 11 | **7,95** (7,85–8,05) | 10,06 | 10,0 | 60 | 76 % | 99 % |
| 0,80 | 12 | **7,94** (7,81–8,06) | 10,08 | 10,8 | 64 | 78 % | 99 % |
| 0,85 | 12 | **7,94** (7,81–8,06) | 10,08 | 10,8 | 64 | 78 % | 99 % |
| 0,90 | 13 | **8,00** (7,83–8,10) | 10,00 | 11,6 | 70 | 80 % | 99 % |
| 0,95 | 14 | **8,02** (7,85–8,14) | 9,97 | 12,4 | 74 | 81 % | 99 % |
| 1,00 | 14 | **8,02** (7,85–8,14) | 9,97 | 12,4 | 74 | 81 % | 99 % |

Praaki kokku (10 seemet × 19 Kl-i): 0.

#### Reduktori FMS (70 detaili)

![K1 Reduktori FMS: tellimuse täitmise aeg](katsed/k1_reduktor.svg)

| Kl | detaile kuni | täitmise aeg, h: keskm. (min–max) | läbilaskevõime, tk/h | detaile keskm. | tsükliaeg, min | ootamine | suurim rakendatus |
|---|---|---|---|---|---|---|---|
| 0,10 | 6 | **15,92** (15,18–16,64) | 4,40 | 5,7 | 76 | 12 % | 52 % |
| 0,15 | 9 | **11,34** (10,86–11,80) | 6,18 | 8,4 | 80 | 16 % | 70 % |
| 0,20 | 12 | **9,94** (9,48–10,49) | 7,05 | 10,9 | 91 | 25 % | 73 % |
| 0,25 | 15 | **9,20** (8,73–9,99) | 7,62 | 13,4 | 104 | 34 % | 79 % |
| 0,30 | 18 | **9,12** (8,65–10,30) | 7,70 | 15,4 | 118 | 43 % | 80 % |
| 0,35 | 21 | **9,18** (8,78–10,29) | 7,64 | 17,4 | 135 | 50 % | 77 % |
| 0,40 | 24 | **9,14** (8,70–10,01) | 7,67 | 19,5 | 151 | 55 % | 76 % |
| 0,45 | 27 | **9,36** (8,82–10,35) | 7,49 | 21,1 | 167 | 60 % | 74 % |
| 0,50 | 30 | **9,20** (8,78–10,19) | 7,62 | 23,4 | 181 | 63 % | 76 % |
| 0,55 | 33 | **9,20** (8,66–10,11) | 7,62 | 24,9 | 193 | 65 % | 76 % |
| 0,60 | 36 | **9,15** (8,66–10,11) | 7,67 | 26,6 | 205 | 67 % | 76 % |
| 0,65 | 39 | **9,18** (8,66–10,11) | 7,64 | 28,0 | 217 | 69 % | 76 % |
| 0,70 | 42 | **9,18** (8,66–10,11) | 7,64 | 29,4 | 228 | 70 % | 76 % |
| 0,75 | 45 | **9,18** (8,66–10,11) | 7,64 | 30,7 | 238 | 72 % | 76 % |
| 0,80 | 48 | **9,18** (8,66–10,11) | 7,64 | 31,9 | 247 | 73 % | 76 % |
| 0,85 | 51 | **9,18** (8,66–10,11) | 7,64 | 32,9 | 256 | 74 % | 76 % |
| 0,90 | 54 | **9,18** (8,66–10,11) | 7,64 | 33,9 | 263 | 74 % | 76 % |
| 0,95 | 57 | **9,18** (8,66–10,11) | 7,64 | 34,8 | 270 | 75 % | 76 % |
| 1,00 | 60 | **9,18** (8,66–10,11) | 7,64 | 35,6 | 276 | 76 % | 76 % |

Praaki kokku (10 seemet × 19 Kl-i): 196.

#### Mootoriosade tehas (144 detaili)

![K1 Mootoriosade tehas: tellimuse täitmise aeg](katsed/k1_mootor.svg)

| Kl | detaile kuni | täitmise aeg, h: keskm. (min–max) | läbilaskevõime, tk/h | detaile keskm. | tsükliaeg, min | ootamine | suurim rakendatus |
|---|---|---|---|---|---|---|---|
| 0,10 | 17 | **12,14** (11,30–13,23) | 11,89 | 15,2 | 75 | 13 % | 52 % |
| 0,15 | 25 | **9,51** (9,01–10,46) | 15,17 | 21,5 | 84 | 18 % | 58 % |
| 0,20 | 33 | **9,18** (8,60–10,21) | 15,75 | 26,3 | 99 | 30 % | 57 % |
| 0,25 | 41 | **10,27** (9,46–11,89) | 14,09 | 29,2 | 122 | 43 % | 49 % |
| 0,30 | 49 | **10,52** (9,83–11,91) | 13,73 | 33,5 | 144 | 52 % | 49 % |
| 0,35 | 57 | **10,19** (9,07–12,12) | 14,24 | 39,7 | 165 | 58 % | 51 % |
| 0,40 | 65 | **10,40** (9,31–11,80) | 13,91 | 43,5 | 184 | 63 % | 50 % |
| 0,45 | 73 | **10,65** (9,65–12,10) | 13,59 | 46,5 | 202 | 66 % | 48 % |
| 0,50 | 81 | **10,50** (9,59–12,10) | 13,77 | 50,5 | 217 | 68 % | 51 % |
| 0,55 | 90 | **10,82** (9,95–12,22) | 13,38 | 53,3 | 235 | 71 % | 50 % |
| 0,60 | 98 | **10,78** (10,07–11,59) | 13,39 | 56,3 | 248 | 73 % | 50 % |
| 0,65 | 106 | **10,75** (9,83–12,61) | 13,46 | 58,7 | 257 | 73 % | 50 % |
| 0,70 | 114 | **10,53** (9,72–12,20) | 13,73 | 61,9 | 266 | 74 % | 51 % |
| 0,75 | 122 | **10,64** (9,64–11,78) | 13,58 | 63,4 | 275 | 75 % | 52 % |
| 0,80 | 130 | **10,69** (9,69–11,78) | 13,51 | 64,9 | 283 | 76 % | 51 % |
| 0,85 | 138 | **10,74** (9,76–11,78) | 13,44 | 65,8 | 289 | 76 % | 51 % |
| 0,90 | kõik | **10,71** (9,69–11,78) | 13,48 | 66,7 | 292 | 77 % | 51 % |
| 0,95 | kõik | **10,71** (9,69–11,78) | 13,48 | 66,7 | 292 | 77 % | 51 % |
| 1,00 | kõik | **10,71** (9,69–11,78) | 13,48 | 66,7 | 292 | 77 % | 51 % |

Praaki kokku (10 seemet × 19 Kl-i): 526.

### Little'i seadus

Tellimuse režiimis on kõik detailid lõpuks valmis, seega peab kehtima `AvgWip = (valmis / makespan) × AvgCycleTime` ehk suhe on 1.
- **279 praagita jooksus** on suhe 0,9999–1,0000.
- **291 praagiga jooksus** on suhe 1,002–1,065. Põhjus: `AvgWip` arvestab ka praagiks läinud detaile, aga `AvgCycleTime` ainult valmis detaile.

Statistika on seega kooskõlas ja tarkvara viga ei ole.

### Näidis-PTS – kriitiline WIP

- Kitsaskoht on MT2 (rakendatus 96–99 %), küllastunud läbilaskevõime `rb` ≈ 10,3 tk/h.
- Puhas tööaeg `T0` ≈ 13,8 min. See on 2 detailiga jooksu tsükliaeg 14,4 min miinus ootamine 4 %, seega mõõdetud, mitte käsitsi arvutatud.
- Kriitiline WIP `W0 = rb × T0` ≈ 10,3 × 13,8 / 60 ≈ **2,4 detaili**.

Parim võimalik läbilaskevõime on `min(w / T0, rb)`:

| detaile w | ootus | simulatsioon |
|---|---|---|
| 2 | 8,7 tk/h | 8,3 |
| 3 | 10,3 tk/h (küllastus) | 10,3 |

Murdepunkt on 2 ja 3 detaili vahel, nagu teooria ütleb.

### Järeldused

1. **Hüpotees kehtib Näidis-PTS-is ja Reduktori FMS-is.**
   - Näidis-PTS: täitmise aeg langeb 9,6 → 7,75 h, kui `Kl` = 0,15 (3 detaili), ja püsib siis 7,75–8,0 h juures.
   - Reduktori FMS: täitmise aeg langeb 15,9 → 9,1 h, kui `Kl` ≈ 0,3 (keskmiselt 15 detaili), ja püsib siis 9,1–9,4 h juures.
   - Pärast murdepunkti kasvab tsükliaeg lineaarselt: Näidis-PTS 17 → 74 min, Reduktori FMS 91 → 276 min. Kasvab ka ootamise osa, kuni ~80 %-ni. Läbilaskevõime ei kasva.
2. **Liiga suur `Kl` ei kiirenda, aga teeb tsükliaja pikaks.**
   - Näidis-PTS-i näidise seade `Kl` 0,85: täitmise aeg sama mis 0,15 juures (+2,5 %), tsükliaeg 64 min (0,15 juures 17 min).
   - Reduktori FMS-i seade 0,4: 0,3 annab sama täitmise aja ja 21 % lühema tsükliaja.
3. **Mootoriosade tehases on parim `Kl` 0,2** (9,2 h, näidise oma seade 12b-st). Suurem `Kl` teeb tellimuse täitmise **aeglasemaks** (0,25…1,0: 10,2–10,8 h, +11–18 %).
   - Mõõdetud (seeme 1): kui `Kl` on 0,6, ootab FromCS-is sihtkohta keskmiselt 21,9 detaili (0,2 juures 1,0). Pinkide puhvrites ootab 16,6 detaili (0,2 juures 5,0).
   - Täitmise aja lõpu määrab mõlemal juhul praagi asendus: viimane Plokikaas tuuakse sisse 7,7 h / 8,3 h ja tema marsruut kestab ~2,5 h.
   - Miks just suur `Kl` on aeglasem, on **kontrollimata**. Hüpotees: kui palju detaile ootab sissepääsu juures, ei vabastata neid enam Planneri „Segamini“ järjekorras, vaid selles järjekorras, kes saab esimesena sihtkoha.
4. **Seemnete hajuvus kasvab koos rikete mõjuga.**

   | mudel | vahemik | seemnete vahe |
   |---|---|---|
   | Näidis-PTS (rikkeid pole) | 0,2–0,3 h | ±2 % |
   | Reduktori FMS | ~1,5 h | ±8 % |
   | Mootoriosade tehas | kuni 3 h | ±15 % |

   Mootoriosade tehases on aeglasemad need seemned, kus on rohkem praaki. Näiteks `Kl` 0,2 juures: seemnel 8 oli 7 praaki ja täitmise aeg 9,9 h, seemnel 4 0 praaki ja 8,7 h. Praak asendatakse tellimuse lõpus ja asendus läbib kogu marsruudi.
5. **Kui `Kl` kasvab üle murdepunkti, ootavad lisadetailid sissepääsu juures.** `Kl` loeb süsteemi kõik sisse toodud detailid, ka FromCS-is sihtkohta ootavad (DISAIN.md 5.2). Detail läheb teele alles siis, kui sihtkoht on broneeritud (5.2 p 3).
   - Seepärast on tsükliajas ka ootamine sissepääsu juures (`TimeIn` = sissetoomine).
   - Reduktori FMS-is on tulemus alates `Kl` 0,6 kõigi seemnetega täpselt sama, ainult maksimaalne detailide arv kasvab: lisadetailid ainult ootavad järjekorras.
   - See on mudeli loogika, mitte viga, aga tulemuste lugemisel on see oluline.

**Tarkvara vigu K1 ei leidnud.**

### Mida see EI kontrolli

- Läbilaskevõimet Kellani-režiimis (püsiseisus): ainult tellimus, kus täitmise aja sees on käivitus ja lõpp.
- Tüüpide järjekorda Partii järjest, teisi näidismudeleid ega `Kl` väärtusi alla 0,1.
- Mootoriosade tehase suurema `Kl` aeglustumise põhjust (järeldus 3) ja seda, kui palju määrab täitmise aja praagi asendus. Selleks oleks vaja suuremat tellimust või Kellani-režiimi.

### Edasi (katsete ideed, mitte arendus)

- K1b: Mootoriosade tehas suurema tellimusega (nt 30 tk tüübist) ja Kellani-režiimis 24 h, et lahutada lõpu mõju (järeldus 3).

---

## K2. Puhvrite maht ja ummiku vältimise hind

### Küsimus ja hüpotees

Ummiku vältimine (`Sim.ReserveNextBeforeStart`, vaikimisi sees, DISAIN.md 3.3) tähendab, et pink alustab detailiga alles siis, kui detaili järgmise pingi puhvris on koht broneeritud. Broneering hoiab kohta kinni kogu töötlemise aja (VALIDEERIMINE.md 11c leid 4).

Hüpotees:
- Kui vältimine on sees, aeglustavad väikesed puhvrid tööd.
- Kui see on väljas, tuleb väikeste puhvritega ummikuid ja parkimisi. Suurte puhvritega on tulemus sama või parem.

### Seaded

| | |
|---|---|
| Mudelid | Näidis-PTS, Reduktori FMS, Allhanketehas, Mootoriosade tehas. Lisaks **Näidis-PTS ristmarsruudiga**: mudeli koopias on Ääriku marsruut freesimine 200 ± 30 s (MT2) → treimine 120 ± 10 s (MT1), nii et Võll läheb MT1 → MT2 ja Äärik MT2 → MT1. |
| Tellimus | nagu K1: Partiid lõpuni, Segamini. Näidis-PTS 40 tk tüübist (80), Reduktori FMS 10 (70), Allhanketehas 4 (48), Mootoriosade tehas 9 (144). |
| Muudetav | **kõigi puhvrite maht** 1…8 × ummiku vältimine **sees / väljas** × seemned 1–10 = 160 jooksu mudeli kohta, kokku 800 |
| Detaile süsteemis | sama mis näidises (Näidis-PTS 12, Reduktori FMS 24, Allhanketehas 23, Mootoriosade tehas 33). Puhvri maht muudab kohtade arvu P, seepärast arvutatakse `Kl` = (W − 0,5) / P ümber, et piir ⌈`Kl` · P⌉ jääks samaks. Nii mõõdetakse puhvri mõju, mitte detailide arvu mõju (K1). |
| Mõõdik | tellimuse täitmise aeg, tsükliaeg, parkimised (ajutine viimine kesklattu), lahendamatud ummikud |

### Tulemused

Graafikul on **sinine** joon „vältimine sees“ ja **punane** joon „vältimine väljas“ (10 seemne keskmine). Graafikud on kaustas `katsed/` (SVG). Horisontaalteljel on puhvri maht, vertikaalteljel tellimuse täitmise aeg tundides. Invariandid (seeme 1) olid kõigis jooksudes korras.

#### Näidis-PTS (80 detaili, 12 süsteemis)

![K2 Näidis-PTS: tellimuse täitmise aeg](katsed/k2_demo.svg)

| maht | kohti P | `Kl` | vältimine sees: aeg, h | tsükliaeg, min | parkimisi | vältimine väljas: aeg, h | tsükliaeg, min | parkimisi |
|---|---|---|---|---|---|---|---|---|
| 1 | 10 | 1,150 | **11,81** (11,74–11,86) | 97 | 0 | **11,25** (11,20–11,31) | 93 | 0 |
| 2 | 12 | 0,958 | **8,41** (8,25–8,56) | 69 | 0 | **7,79** (7,62–8,06) | 66 | 0 |
| 3 | 14 | 0,821 | **7,94** (7,81–8,06) | 64 | 0 | **7,81** (7,67–7,89) | 67 | 0 |
| 4 | 16 | 0,719 | **7,90** (7,81–7,98) | 64 | 0 | **7,81** (7,73–7,92) | 65 | 0 |
| 5 | 18 | 0,639 | **7,85** (7,78–7,93) | 64 | 0 | **7,63** (7,53–7,73) | 63 | 0 |
| 6 | 20 | 0,575 | **7,93** (7,82–8,05) | 65 | 0 | **7,67** (7,59–7,72) | 63 | 0 |
| 7 | 22 | 0,523 | **7,90** (7,79–8,07) | 65 | 0 | **7,67** (7,58–7,77) | 63 | 0 |
| 8 | 24 | 0,479 | **7,85** (7,81–7,94) | 64 | 0 | **7,67** (7,58–7,76) | 63 | 0 |

#### Reduktori FMS (70 detaili, 24 süsteemis)

![K2 Reduktori FMS: tellimuse täitmise aeg](katsed/k2_reduktor.svg)

| maht | kohti P | `Kl` | vältimine sees: aeg, h | tsükliaeg, min | parkimisi | vältimine väljas: aeg, h | tsükliaeg, min | parkimisi |
|---|---|---|---|---|---|---|---|---|
| 1 | 28 | 0,839 | **37,28** (36,52–38,99) | 649 | 0 | **14,42** (13,70–15,67) | 241 | 0 |
| 2 | 40 | 0,588 | **18,60** (17,76–19,45) | 321 | 0 | **8,68** (8,15–9,95) | 145 | 0 |
| 3 | 52 | 0,452 | **13,73** (12,77–15,15) | 224 | 0 | **8,30** (7,75–9,25) | 136 | 0 |
| 4 | 64 | 0,367 | **10,57** (10,09–11,26) | 176 | 0 | **8,31** (7,80–9,31) | 135 | 0 |
| 5 | 76 | 0,309 | **9,20** (8,56–10,34) | 152 | 0 | **8,32** (7,80–9,08) | 136 | 0 |
| 6 | 88 | 0,267 | **8,72** (8,34–9,81) | 141 | 0 | **8,28** (7,81–9,02) | 136 | 0 |
| 7 | 100 | 0,235 | **8,27** (7,71–9,10) | 136 | 0 | **8,33** (7,71–9,26) | 136 | 0 |
| 8 | 112 | 0,210 | **8,35** (7,88–9,25) | 136 | 0 | **8,39** (7,89–9,41) | 136 | 0 |

#### Allhanketehas (48 detaili, 23 süsteemis)

![K2 Allhanketehas: tellimuse täitmise aeg](katsed/k2_allhange.svg)

| maht | kohti P | `Kl` | vältimine sees: aeg, h | tsükliaeg, min | parkimisi | vältimine väljas: aeg, h | tsükliaeg, min | parkimisi |
|---|---|---|---|---|---|---|---|---|
| 1 | 46 | 0,489 | **15,75** (15,07–15,88) | 318 | 0 | **7,01** (6,80–7,41) | 154 | 0 |
| 2 | 61 | 0,369 | **7,82** (7,30–8,33) | 157 | 0 | **4,48** (4,35–4,81) | 98 | 0 |
| 3 | 76 | 0,296 | **6,31** (5,68–6,77) | 119 | 0 | **4,45** (4,25–4,76) | 94 | 0 |
| 4 | 91 | 0,247 | **5,17** (4,78–5,97) | 104 | 0 | **4,47** (4,26–4,83) | 96 | 0 |
| 5 | 106 | 0,212 | **4,81** (4,52–5,24) | 99 | 0 | **4,57** (4,32–4,95) | 96 | 0 |
| 6 | 121 | 0,186 | **4,57** (4,26–4,88) | 97 | 0 | **4,57** (4,32–4,95) | 96 | 0 |
| 7 | 136 | 0,165 | **4,52** (4,35–4,96) | 98 | 0 | **4,57** (4,32–4,95) | 96 | 0 |
| 8 | 151 | 0,149 | **4,53** (4,35–4,96) | 98 | 0 | **4,57** (4,32–4,95) | 96 | 0 |

#### Mootoriosade tehas (144 detaili, 33 süsteemis)

![K2 Mootoriosade tehas: tellimuse täitmise aeg](katsed/k2_mootor.svg)

| maht | kohti P | `Kl` | vältimine sees: aeg, h | tsükliaeg, min | parkimisi | vältimine väljas: aeg, h | tsükliaeg, min | parkimisi |
|---|---|---|---|---|---|---|---|---|
| 1 | 111 | 0,293 | **34,49** (32,41–39,05) | 330 | 0 | **17,53** (17,17–17,74) | 195 | 0 |
| 2 | 143 | 0,227 | **18,33** (17,11–20,66) | 174 | 0 | **9,91** (9,69–10,31) | 114 | 0 |
| 3 | 175 | 0,186 | **12,85** (12,19–14,13) | 123 | 0 | **8,29** (7,54–9,36) | 93 | 0 |
| 4 | 207 | 0,157 | **9,31** (8,71–10,71) | 99 | 0 | **8,10** (7,61–8,85) | 91 | 0 |
| 5 | 239 | 0,136 | **8,22** (7,68–9,32) | 92 | 0 | **8,08** (7,47–9,29) | 90 | 0 |
| 6 | 271 | 0,120 | **8,11** (7,44–9,04) | 91 | 0 | **8,07** (7,50–9,07) | 90 | 0 |
| 7 | 303 | 0,107 | **8,08** (7,49–9,21) | 91 | 0 | **8,07** (7,50–9,07) | 90 | 0 |
| 8 | 335 | 0,097 | **8,16** (7,62–9,21) | 91 | 0 | **8,07** (7,50–9,07) | 90 | 0 |

#### Näidis-PTS ristmarsruudiga (80 detaili, 12 süsteemis)

![K2 Näidis-PTS ristmarsruudiga: tellimuse täitmise aeg](katsed/k2_demoX.svg)

Rist (×) näitab mahtu, kus vähemalt üks seeme jäi lõplikult ummikusse; seal joont ei ole.

| maht | kohti P | `Kl` | vältimine sees: aeg, h | tsükliaeg, min | parkimisi | vältimine väljas: aeg, h | tsükliaeg, min | parkimisi |
|---|---|---|---|---|---|---|---|---|
| 1 | 10 | 1,150 | **14,51** (14,41–14,63) | 119 | 10 | ummik 10/10 | 128 | 260 |
| 2 | 12 | 0,958 | **8,58** (8,40–8,80) | 72 | 10 | ummik 10/10 | 106 | 248 |
| 3 | 14 | 0,821 | **6,82** (6,70–6,93) | 58 | 10 | ummik 10/10 | 85 | 140 |
| 4 | 16 | 0,719 | **6,81** (6,70–6,91) | 59 | 10 | **6,93** (6,81–7,05), ummik 7/10 | 64 | 152 |
| 5 | 18 | 0,639 | **6,81** (6,69–6,90) | 59 | 10 | **5,83** (5,53–6,13) | 50 | 55 |
| 6 | 20 | 0,575 | **6,80** (6,68–6,90) | 59 | 10 | **5,36** (5,28–5,44) | 46 | 10 |
| 7 | 22 | 0,523 | **5,27** (5,21–5,35) | 45 | 0 | **5,24** (5,20–5,29) | 45 | 0 |
| 8 | 24 | 0,479 | **5,24** (5,20–5,29) | 45 | 0 | **5,24** (5,20–5,29) | 45 | 0 |

### Miks näidismudelites ummikut ei teki

Kõigis 7 näidismudelis on pinkide järjekord marsruutides **ühesuunaline**. Kontrollisin seda graafina: serv pingist A pinki B, kui mõni marsruut läheb A-st B-sse; tsükleid ei ole. Ükski tüüp ei lähe B-st tagasi A-sse.

Ringootamiseks on vaja tsüklit. Ilma tsüklita jõuab ootamisahel alati pingini, mis saab detaili edasi anda: viimased pingid saadavad detaili kesklattu, mis ei saa täis. Seepärast ei tekkinud nelja näidise 640 jooksus ühtegi ummikut ega parkimist, ka mitte siis, kui vältimine oli väljas.

### Järeldused

1. **Ühesuunalise vooga mudelites on ummiku vältimine puhas kulu.** Ilma vältimiseta on tellimus väikeste puhvritega mitu korda kiiremini täidetud (maht 2):

   | mudel | vältimine sees | väljas |
   |---|---|---|
   | Reduktori FMS | 18,6 h | 8,7 h |
   | Allhanketehas | 7,8 h | 4,5 h |
   | Mootoriosade tehas | 18,3 h | 9,9 h |

   Vältimine sees vajab sama tulemuse jaoks palju suuremaid puhvreid: Reduktori FMS 7, Allhanketehas 6, Mootoriosade tehas 5. Ilma vältimiseta piisab 2–3 kohast. Põhjus: broneeritud koht järgmise pingi puhvris on kinni kogu töötlemise aja, kuigi on füüsiliselt tühi (11c leid 4).
2. **Ristmarsruudiga on vältimine vajalik.**
   - Vältimine väljas: puhvri mahuga 1–3 jäi süsteem kõigi seemnetega lõplikult ummikusse. Kesklattu pargiti, kuni see oli täis, ja tellimus jäi pooleli. Mahuga 4 juhtus sama 7 seemnega 10-st, mahuga 5 pargiti 55 korda (10 jooksus).
   - Vältimine sees: lahendamatut ummikut ei olnud ühelgi mahul. Mahuga 1–6 pargiti igas jooksus täpselt üks detail, käivitusel (seeme 1: t = 716 s).
   - See kinnitab varasemat valideerimist (VALIDEERIMINE.md etapp 2 leid 3).
3. **Ristmarsruudi korral on puhvri mahul selge lävi.**
   - Kui kahe puhvri kohti on kokku vähem või sama palju kui detaile süsteemis (maht ≤ 6: kuni 12 kohta, 12 detaili), saavad puhvrid täis. Pingid ootavad vaheldumisi teineteise broneeringut: mahuga 3–6 on täitmise aeg 6,8 h ja rakendatus 75 % (mahuga 1–2 veel aeglasem).
   - Mahuga 7 (14 kohta > 12 detaili) on täitmise aeg 5,2 h ja rakendatus 97–98 %. Siis on vältimisega ja ilma sama tulemus.
   - Mahuga 5–6 on ilma vältimiseta kiirem (5,8 ja 5,4 h), aga ainult parkimise abil: kesklaos peab olema ruumi.
   - Kokkuvõttes: **ristmarsruudiga peab puhvrikohti olema rohkem kui detaile süsteemis**, siis ei maksa vältimine midagi.
4. **Kui puhvreid on piisavalt, ei anna nende suurendamine enam midagi** (nagu 12b leid 3). Tõuseb ainult `Kl` järgi süsteemi lubatud detailide arv. Siin hoiti see konstantsena (K1 näitas, mida see teeb).
5. **Näidiste segamahud on head.** Reduktori FMS-i oma puhvrid (8 × 3, ühistel pinkidel 4 × 5, K1-s `Kl` 0,4) annavad 9,1 h. Ühtlane maht 3 annab vältimisega 13,7 h ja ühtlane 4 annab 10,6 h. Suured puhvrid ühiste pinkide ees on kasulikumad kui ühtlane suurendamine.

**Tarkvara vigu K2 ei leidnud.**

Seadet `ReserveNextBeforeStart` liideses ei ole (ainult mudelifailis `Sim`-is). Tarkvaras 1.5 on vältimine kasutaja jaoks seega alati sees.

### Mida see EI kontrolli

- Puhvri mahtu ainult ühiste pinkide ees (siin muudeti kõiki puhvreid korraga).
- Puhvri distsipliini (FIFO / FILO / RANDOM).
- Teisi ristmarsruudiga mudeleid kui Näidis-PTS-i koopiat. Seal on tsükkel kahe pingi vahel; pikem tsükkel (A → B → C → A) võib käituda teisiti.
- Kellani-režiimi (püsiseisu läbilaskevõimet).

### Edasi (katsete ideed, mitte arendus)

- K2b: puhvri maht ainult ühiste (kitsaskoha) pinkide ees ja pikema tsükliga ristmarsruut.

---

## K3. Transport: kärud, alused, kiirus, konnektorid

### Küsimus ja hüpotees

Kui palju transporti on vaja ja mis mõjub rohkem, kas kärude / aluste arv või kiirus?

Hüpotees:
- **AGV-d**: kasu kahaneb kiiresti ja kõrvalepõigete arv kasvab.
- **Pidev konveier**: kiirus mõjub vähe, sest konveier seisab iga laadimise ajal (T-6).
- **Konnektorid**: üle 5 enam ei aita, kitsaskoht liigub konveierile (12b).

### Seaded

| | |
|---|---|
| K3a | Reduktori FMS, tellimus 70 detaili: AGV-sid 2…8 × kiirus 40 / 80 / 120 cm/s (näidis: 4 AGV-d, 80 cm/s) |
| K3b | Kinnitustehas, tellimus 5 kasti tüübist (40): aluseid 6…22 × konveieri kiirus 15 / 25 / 40 cm/s (näidis: 14 alust, 25 cm/s) |
| K3c | Mootoriosade tehas, tellimus 144 detaili: konnektoreid C↔D 1…5 × viimistluse konveieri kiirus 20 / 40 cm/s (näidis: 5 konnektorit, 40 cm/s). Konnektori eemaldamisel jäävad radade lahtrid sirgeks. |
| Kõigis | Partiid lõpuni, Segamini, seemned 1–10. Detaile süsteemis on sama mis näidises (24, 31, 33), `Kl` arvutatakse ümber nagu K2-s, sest kärud ja konnektorid on ka kohad. |

### Tulemused

Kokku 580 jooksu: ummikuid ega parkimisi ei olnud, invariandid (seeme 1) olid korras.

![K3 Reduktori FMS: AGV-de arv ja kiirus](katsed/k3_reduktor.svg)

| AGV-sid | 40 cm/s: aeg, h | 80 cm/s | 120 cm/s | kõrvalepõikeid (80 cm/s) | käru koormaga (80 cm/s) |
|---|---|---|---|---|---|
| 2 | **15,97** (15,43–16,56) | **11,16** (10,47–12,19) | **9,84** (9,23–11,02) | 19 | 39 % |
| 3 | **12,21** (11,92–13,29) | **9,49** (9,04–10,94) | **8,92** (8,54–9,80) | 103 | 30 % |
| 4 | **10,70** (10,38–12,00) | **9,14** (8,70–10,01) | **8,82** (8,39–9,93) | 297 | 23 % |
| 5 | **10,09** (9,71–11,11) | **9,10** (8,72–10,02) | **8,95** (8,39–10,14) | 549 | 19 % |
| 6 | **9,90** (9,50–10,88) | **9,01** (8,55–10,06) | **8,80** (8,40–9,87) | 823 | 16 % |
| 7 | **9,76** (9,23–10,67) | **9,07** (8,64–10,21) | **8,84** (8,36–10,13) | 1184 | 13 % |
| 8 | **9,75** (9,31–10,71) | **9,09** (8,60–10,01) | **8,81** (8,43–9,92) | 1600 | 11 % |

![K3 Kinnitustehas: aluste arv ja kiirus](katsed/k3_kinnitus.svg)

| aluseid | 15 cm/s: aeg, h | 25 cm/s | 40 cm/s | konveier liigub (25 cm/s) |
|---|---|---|---|---|
| 6 | **7,75** (7,16–8,98) | **5,99** (5,68–6,22) | **5,47** (4,93–6,16) | 73 % |
| 8 | **6,71** (6,36–7,64) | **5,74** (5,22–6,78) | **5,30** (4,77–6,12) | 72 % |
| 10 | **6,30** (5,99–6,80) | **5,56** (5,06–6,19) | **5,29** (4,78–6,19) | 71 % |
| 12 | **6,08** (5,60–6,62) | **5,52** (4,99–5,95) | **5,26** (4,76–5,81) | 71 % |
| 14 | **6,00** (5,50–6,89) | **5,47** (4,96–6,23) | **5,25** (4,79–5,72) | 71 % |
| 16 | **5,99** (5,53–6,38) | **5,51** (5,01–6,45) | **5,30** (4,79–5,83) | 71 % |
| 18 | **6,01** (5,48–6,62) | **5,46** (4,97–5,86) | **5,26** (4,77–5,68) | 71 % |
| 20 | **5,87** (5,47–6,32) | **5,47** (5,00–6,52) | **5,22** (4,75–5,82) | 71 % |
| 22 | **5,93** (5,37–6,49) | **5,49** (5,05–6,86) | **5,22** (4,73–5,78) | 71 % |

![K3 Mootoriosade tehas: konnektorid ja viimistluse konveier](katsed/k3_mootor.svg)

| konnektoreid C↔D | viimistlus 20 cm/s: aeg, h | 40 cm/s | tsükliaeg, min (40) | transport (40) | ootamine (40) | suurim rakendatus (40) |
|---|---|---|---|---|---|---|
| 1 | **24,67** (23,87–26,00) | **23,56** (22,56–25,32) | 265 | 10 % | 75 % | 27 % |
| 2 | **15,50** (14,50–17,72) | **14,37** (13,68–15,92) | 145 | 19 % | 54 % | 43 % |
| 3 | **12,10** (11,24–13,21) | **10,84** (9,93–12,21) | 110 | 26 % | 37 % | 51 % |
| 4 | **11,45** (10,67–12,28) | **9,75** (8,98–10,78) | 101 | 29 % | 31 % | 56 % |
| 5 | **11,06** (10,21–12,06) | **9,18** (8,60–10,21) | 99 | 29 % | 30 % | 57 % |

### Järeldused

1. **AGV-de arv ja kiirus asendavad teineteist.** Määrab transpordivõimsus (kärude arv × kiirus).
   - 80 cm/s juures piisab 4 AGV-st, nagu näidises. 3 AGV-d annavad +4 %, 2 AGV-d +22 % tellimuse täitmise ajale.
   - 40 cm/s juures on vaja 7 AGV-d ja tulemus jääb ikka 7 % halvemaks. 120 cm/s juures piisab 3 AGV-st.
   - Üle küllastuse kärud ainult seisavad: koormaga sõidab 4 AGV-st igaüks 23 % ajast, 8 AGV-st 11 %.
2. **Kõrvalepõiked kasvavad AGV-de arvuga kiiresti**: 2 AGV-ga 19, 8 AGV-ga 1600 (80 cm/s). Kokkupõrkeid ei olnud ja tellimuse täitmise aeg nende pärast ei kasvanud. Ühesuunaline ring hoiab liikluse korras.
3. **Kinnitustehases aitavad alused kuni ~12-ni, edasi mitte. Kiirus mõjub rohkem, kui hüpotees ütles.**
   - 15 → 25 cm/s lühendab tellimuse täitmise aega 9 %, 25 → 40 cm/s veel 4 %.
   - Konveier seisab ikka ~29 % ajast (liigub 71 %) ja see ei sõltu aluste arvust. Iga laadimine peatab ringi (T-6).
4. **Konnektorid C↔D on Mootoriosade tehase peamine kitsaskoht.** 1 → 5 konnektorit lühendab tellimuse täitmise aega 23,6 h → 9,2 h. Ka 4 → 5 annab veel 6 %, seega küllastust veel pole (12b leid 1, T-5).
5. **Konnektorid ja konveier mõjutavad teineteist.** Kui viimistluse konveier on aeglane (20 cm/s), annavad 4. ja 5. konnektor vähe (12,1 → 11,1 h): siis piirab konveier. 40 cm/s juures annavad need 10,8 → 9,2 h.

**Tarkvara vigu K3 ei leidnud.**

---

## K4. Partii suurus ja tüüpide järjekord

### Küsimus ja hüpotees

Kas üht tüüpi järjest tootmine (Partii järjest) tasub ennast ära ja millise partii suuruse juures? Kui pikk peab olema häälestus, et partiid hakkaksid võitma?

Hüpotees:
- Partii järjest vähendab häälestusaega, aga koormab korraga ainult ühe marsruudi pinke (11d leid 1).
- Parim partii suurus on kusagil keskel.
- Pika häälestusega võidab Partii järjest.

### Seaded

| | |
|---|---|
| Mudelid | Allhanketehas (häälestus: treipingid 10 min, 5-teljelised 15 min) ja Mootoriosade tehas (HMC1–HMC4 15 min, HMC5–HMC6 5 min) |
| Režiim | **Kellani 24 h** (läbilaskevõime tk/h). Tellimuse režiimis tähendab „Partii järjest“, et iga tüüp tehakse tervikuna, seega partii suurust ei saa muuta. |
| K4a | Segamini ja Partii järjest partiiga 1…10 (ringiratast `Priority` järgi), häälestus nagu näidises |
| K4b | Allhanketehas: kõigi pinkide häälestusaeg × 0…12 – Segamini, Partii järjest 2 / 4 / 8 |
| Muu | `Kl` nagu näidises, seemned 1–10. *Häälestus* = häälestusega pinkide häälestuse osa ajast keskmiselt. |

### Tulemused

Kokku 640 jooksu: ummikuid ega parkimisi ei olnud, invariandid (seeme 1) olid korras.

![K4 partii suurus](katsed/k4_partii.svg)

| järjekord, partii | Allhanketehas: tk/h | häälestus* | tsükliaeg, min | Mootoriosade tehas: tk/h | häälestus* | tsükliaeg, min |
|---|---|---|---|---|---|---|
| Segamini | **14,51** (14,21–14,75) | 17 % | 92 | **19,80** (19,67–19,92) | 5 % | 93 |
| Partii järjest, 1 | **14,51** (14,21–14,75) | 17 % | 92 | **19,80** (19,67–19,92) | 5 % | 93 |
| Partii järjest, 2 | **14,20** (14,04–14,33) | 15 % | 94 | **18,98** (18,67–19,21) | 2 % | 99 |
| Partii järjest, 3 | **13,49** (13,13–13,71) | 13 % | 98 | **17,54** (17,33–17,71) | 6 % | 106 |
| Partii järjest, 4 | **13,04** (12,83–13,25) | 10 % | 102 | **16,27** (15,96–16,58) | 10 % | 113 |
| Partii järjest, 6 | **12,01** (11,92–12,13) | 9 % | 108 | **14,57** (14,25–14,83) | 6 % | 127 |
| Partii järjest, 8 | **10,90** (10,83–11,00) | 6 % | 119 | **13,26** (13,08–13,46) | 7 % | 140 |
| Partii järjest, 10 | **10,02** (9,92–10,21) | 5 % | 127 | **12,50** (12,33–12,79) | 6 % | 149 |

![K4 häälestusaeg ja järjekord](katsed/k4_haalestus.svg)

| kordaja | Segamini: tk/h | häälestus* | Partii 2 | Partii 4 | häälestus* | Partii 8 | parim |
|---|---|---|---|---|---|---|---|
| 0 | **15,26** (15,08–15,42) | 0 % | – | **13,53** (13,29–13,67) | 0 % | **11,32** (11,08–11,75) | Segamini |
| 0,5 | **14,96** (14,88–15,13) | 9 % | – | **13,36** (13,17–13,58) | 5 % | **11,17** (11,04–11,38) | Segamini |
| 1 | **14,51** (14,21–14,75) | 17 % | – | **13,04** (12,83–13,25) | 10 % | **10,90** (10,83–11,00) | Segamini |
| 2 | **13,28** (13,00–13,50) | 32 % | – | **12,20** (11,96–12,42) | 20 % | **10,42** (10,17–10,67) | Segamini |
| 3 | **11,92** (11,50–12,17) | 40 % | – | **11,13** (10,92–11,42) | 29 % | **9,80** (9,38–10,04) | Segamini |
| 4 | **10,69** (10,29–11,25) | 46 % | – | **10,07** (9,92–10,29) | 36 % | **9,02** (8,71–9,33) | Segamini |
| 6 | **8,71** (8,42–9,08) | – | **7,96** (7,50–8,54) | **8,67** (8,38–8,96) | – | **7,72** (7,33–8,04) | Segamini |
| 8 | **7,23** (6,75–7,83) | – | **6,55** (6,25–7,21) | **7,59** (7,38–8,00) | – | **7,03** (6,67–7,29) | Partii 4 |
| 12 | **5,59** (4,79–5,96) | – | **4,50** (4,33–4,88) | **5,68** (5,58–5,83) | – | **5,70** (5,25–6,46) | Partii 8 |

### Järeldused

1. **Näidiste häälestusaegadega on Segamini alati parim** ja iga suurem partii on halvem.
   - Allhanketehas: partiiga 10 on läbilaskevõime 31 % väiksem, Mootoriosade tehases 37 %.
   - Häälestuse osa küll väheneb (Allhanketehas 17 % → 5 %), aga pingid on jõude, sest süsteemis on korraga üks tüüp ja ainult tema marsruudi pingid töötavad. Hüpotees „parim on keskel“ ei kehti.
2. **Partii järjest partiiga 1 annab sama tulemuse mis Segamini** (kõik näitajad on samad). Kui prioriteedid on võrdsed, on ringiratast järjekord sama mis „kõige vähem sisse toodud“.
3. **Partiid hakkavad võitma alles väga pika häälestusega.**
   - Allhanketehases saab Partii järjest 4 tk Segaminiga võrdseks häälestusaja kordaja ~6 juures (treipink 60 min, 5-teljeline 90 min). Kordaja 8 juures on see 5 % parem, kordaja 12 juures võidab Partii 8 tk.
   - Siis on Segamini häälestuse osa üle 46 %: pingid on peamiselt häälestamisel.
4. **Partii 2 on pika häälestusega halvem kui partii 1 ja 4.** Ilmselt ei kata kaks tükki järjest häälestust, aga tasakaal läheb juba kaotsi. See on oletus, seda ei kontrollinud.
5. **Mootoriosade tehases on Partii järjest 4 tk häälestuse osa suurem kui Segamini oma** (10 % vs 5 %). HMC-d teevad mitut tüüpi ja partii vahetus toob häälestused kokku. Häälestus pole siin kitsaskoht: kordaja 4 juures langeb Segamini ainult 1,7 %.

**Tarkvara vigu K4 ei leidnud.**

---

## K5. Rikete muster ja seemnete arv

### Küsimus ja hüpotees

- **K5a**: kui käideldavus on sama, kas harvad pikad või sagedased lühikesed rikked teevad rohkem kahju? Hüpotees: harvad pikad, ja need suurendavad ka seemnete hajuvust.
- **K5b**: mitu seemet on vaja, et tulemus oleks ±2 % täpne?

### Seaded

| | |
|---|---|
| K5a | Näidis-PTS riketega (MT1, MT2; tellimus 80) ja Reduktori FMS (10 töötlemispinki rikkega; tellimus 70). Igal rikkega pingil on keskmine remondiaeg R = 5 min … 4 h, kõrvalekalle 0,2 R ja rikete vahe 9 R. Käideldavus on seega alati 90 % töötlemisajast. Võrdluseks jooks ilma riketeta. Seemned 1–10. |
| K5b | 50 seemet näidise seadetega: Näidis-PTS, Näidis-PTS riketega, Reduktori FMS, Mootoriosade tehas (tellimused nagu K1-s) |
| Oluline | Simulaatoris (DISAIN.md osa 17) tekib rike ainult töötlemise ajal ja **detail, mida töödeldi, läheb praaki**. Tellimuses asendatakse see uuega. |

### Tulemused

Kokku 340 jooksu: ummikuid ega parkimisi ei olnud, invariandid (seeme 1) olid korras.

![K5 Näidis-PTS riketega](katsed/k5_rike.svg)

![K5 Reduktori FMS](katsed/k5_reduktor.svg)

| remondiaeg (rikete vahe) | Näidis-PTS riketega: aeg, h | std, h | rikkeid = praaki | Reduktori FMS: aeg, h | std, h | rikkeid = praaki |
|---|---|---|---|---|---|---|
| rikkeid pole | **7,94** (7,81–8,06) | 0,08 | 0,0 | **8,93** (8,70–9,13) | 0,14 | 0,0 |
| 5 min (45 min) | **8,84** (8,50–9,52) | 0,29 | 11,1 | **16,71** (13,63–25,57) | 3,37 | 97,4 |
| 15 min (2,3 h) | **8,67** (8,26–9,10) | 0,24 | 3,6 | **10,73** (9,68–12,19) | 0,71 | 24,9 |
| 30 min (4,5 h) | **8,55** (7,81–9,48) | 0,57 | 1,6 | **9,98** (9,07–11,18) | 0,63 | 12,1 |
| 1 h (9,0 h) | **8,82** (7,81–10,04) | 0,96 | 1,1 | **9,97** (8,95–11,84) | 0,92 | 6,4 |
| 2 h (18,0 h) | **8,95** (7,81–10,42) | 1,10 | 0,5 | **10,75** (8,72–12,16) | 1,30 | 3,6 |
| 4 h (36,0 h) | **8,69** (7,81–12,17) | 1,58 | 0,2 | **11,05** (8,97–12,90) | 1,41 | 1,7 |

**K5b. Seemnete arv**: usaldusvahemik ±t · std / √n keskmise suhtes, n esimest seemet. „Seemneid ±2 % jaoks“ = (2 · std / (0,02 · keskmine))².

| mudel | keskmine (50 seemet), h | std, h | std / keskmine | ±95 % usaldusvahemik: 5 seemet | 10 | 20 | 50 | seemneid ±2 % jaoks |
|---|---|---|---|---|---|---|---|---|
| Näidis-PTS | 7,96 | 0,08 | 1,0 % | ±1,5 % | ±0,7 % | ±0,5 % | ±0,3 % | 3 |
| Näidis-PTS riketega | 8,85 | 0,33 | 3,8 % | ±5,2 % | ±2,4 % | ±1,6 % | ±1,1 % | 15 |
| Reduktori FMS | 9,16 | 0,45 | 4,9 % | ±7,3 % | ±3,0 % | ±2,5 % | ±1,4 % | 25 |
| Mootoriosade tehas | 9,01 | 0,37 | 4,1 % | ±8,2 % | ±4,8 % | ±2,4 % | ±1,2 % | 17 |

### Järeldused

1. **Hajuvus kasvab remondiajaga, nagu hüpotees ütles.**
   - Näidis-PTS riketega: standardhälve 0,24 h (15 min remont) → 1,58 h (4 h remont).
   - Reduktori FMS: 0,63 → 1,41 h.
   - Harv pikk rike tabab mõnda seemet ja teist mitte. Seepärast on väikseim aeg sama mis ilma riketeta (7,81 h), aga suurim kuni 12,2 h.
2. **Keskmise järgi on halvimad hoopis sagedased lühikesed rikked, sest iga rike on praak.**
   - Reduktori FMS-is tähendab 5 min remont ja rike iga 45 min töötlemise järel 97 riket 70 tellitud detaili kohta. Iga rike viskab detaili minema ja asendus alustab otsast: tellimuse täitmise aeg on 16,7 h (ilma riketeta 8,9 h).
   - Keskmiselt parim on 30 min – 1 h remont. Pikemaga kasvab kahju uuesti pingi seisaku pärast.
   - Tulemus sõltub simulaatori rikkemudelist (rike = praak). Kui lühike rike detaili ei rikuks, oleks hüpotees tõenäoliselt õige. Seda tarkvara 1.5 ei võimalda; vaata ka T-10 (kvaliteedipraak).
3. **10 seemnest piisab ±2 % täpsuseks ainult riketeta mudelis.**
   - Riketega mudelites on 10 seemnega vahemik ±2,4…4,8 % ja ±2 % jaoks on vaja 15–25 seemet.
   - K1–K4 erinevused, mis on väiksemad kui ~5 %, on seega 10 seemnega ebakindlad. Kõik selles failis tehtud järeldused põhinevad suurematel erinevustel või nähtavalt kattumata vahemikel. K1 Mootoriosade tehase 11–18 % on piiri peal.

**Tarkvara vigu K5 ei leidnud.**

---

## K6. Puhvri distsipliin

### Küsimus ja hüpotees

Kas puhvri distsipliin (FIFO / FILO / RANDOM, originaali valik) mõjutab tulemust?

Hüpotees: läbilaskevõime ei muutu, aga FILO-ga tulevad pikad „unustatud“ detailid.

### Seaded

Näidis-PTS, Reduktori FMS, Allhanketehas: kõigi puhvrite distsipliin FIFO / FILO / RANDOM, **Kellani 24 h**, Segamini, `Kl` nagu näidises, seemned 1–10 (90 jooksu). Tsükliaja jaotus on arvutatud valmis detailidest.

### Tulemused

Ummikuid ega parkimisi ei olnud, invariandid (seeme 1) olid korras.

![K6 puhvri distsipliin](katsed/k6_distsipliin.svg)

| mudel | distsipliin | läbilaskevõime, tk/h | tsükliaeg keskm., min | 95 % detailidest alla, min | pikim, min (keskm. / suurim) |
|---|---|---|---|---|---|
| Näidis-PTS | FIFO | **10,52** (10,42–10,58) | 66 | 115 | 117 / 118 |
| Näidis-PTS | FILO | **10,68** (10,54–10,88) | 65 | 115 | 210 / 291 |
| Näidis-PTS | RANDOM | **10,73** (10,67–10,79) | 65 | 118 | 147 / 166 |
| Reduktori FMS | FIFO | **8,60** (8,13–9,00) | 154 | 266 | 329 / 412 |
| Reduktori FMS | FILO | **8,66** (8,13–9,00) | 137 | 279 | 897 / 1216 |
| Reduktori FMS | RANDOM | **8,64** (8,29–8,88) | 152 | 308 | 523 / 674 |
| Allhanketehas | FIFO | **14,51** (14,21–14,75) | 92 | 145 | 214 / 240 |
| Allhanketehas | FILO | **14,49** (14,13–14,75) | 92 | 147 | 227 / 302 |
| Allhanketehas | RANDOM | **14,52** (14,38–14,67) | 92 | 144 | 217 / 234 |

### Järeldused

1. **Läbilaskevõime ei sõltu distsipliinist** (Reduktori FMS ja Allhanketehas ±1 %, vahemikud kattuvad). Näidis-PTS-is on RANDOM 2 % parem kui FIFO ja vahemikud ei kattu; FILO on 1,5 % parem, aga vahemikud kattuvad veidi. Põhjus on kontrollimata: võib-olla teeb pink nii vähem häälestusi, sest MT1 ja MT2 vahetavad operatsiooni.
2. **FILO teeb pikimad tsükliajad 2–3 korda pikemaks**: Reduktori FMS-is keskmiselt 15 h (FIFO 5,5 h), halvimal seemnel 20 h. Viimasena tulnud detail võetakse esimesena ja varem tulnud jääb ootama.
3. **Keskmine tsükliaeg on FILO-ga lühem (Reduktori FMS 137 vs 154 min), aga see on mõõtmise moonutus.** Kellani-režiimis arvestatakse ainult valmis detaile. FILO-ga jäävad kõige kauem oodanud detailid 24 h lõpuks süsteemi ja keskmisest välja (nagu K1, 11d).
4. RANDOM on vahepeal: pikim tsükliaeg kasvab Reduktori FMS-is 60 %, Allhanketehases peaaegu mitte (seal on puhvrid väikesed).

**Tarkvara vigu K6 ei leidnud.**

---

## Kokkuvõte

| Katse | Peamine tulemus |
|---|---|
| K1 `Kl` | Detailide arvul on murdepunkt (Little'i seadus). Üle selle kasvab ainult tsükliaeg. Näidiste `Kl` on enamasti liiga suur. |
| K2 puhvrid | Ühesuunalise vooga (kõik 7 näidist) on ummiku vältimine puhas kulu. Ristmarsruudiga on see vajalik ja puhvrikohti peab olema rohkem kui detaile süsteemis. |
| K3 transport | Kärude arv × kiirus = võimsus. Kasu kahaneb kiiresti. Mootoriosade tehase kitsaskoht on konnektorid koos viimistluse konveieriga. |
| K4 partiid | Näidiste häälestusaegadega on Segamini parim. Partiid võidavad alles ~6× pikema häälestusega. |
| K5 rikked | Pikad rikked suurendavad hajuvust. Sagedased lühikesed teevad rohkem kahju, sest rike = praak. Riketega mudelis on ±2 % jaoks vaja 15–25 seemet. |
| K6 distsipliin | Läbilaskevõime ei muutu. FILO teeb pikimad tsükliajad 2–3 korda pikemaks. |

Kokku 3020 simulatsiooni, kõik invariandid korras. **Tarkvara 1.5 vigu katsed ei leidnud.**
