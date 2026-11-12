# Etapp 2: prototüüp ja valideerimine

Eesmärk: enne täisteostust kontrollida, kas [DISAIN.md](DISAIN.md) loogika (osad 1–7, pidevad konveierid) töötab. Kus ei töötanud, parandati disaini.

## Mis tehti

| Fail | Sisu |
|---|---|
| [proto/fms_sim.js](proto/fms_sim.js) | simulaatori tuum ilma graafikata: Event List, `MinuteMan`, EventHandlerid, Planner, ummikute vältimine ja tuvastus, statistika, invariandid |
| [proto/scenarios.js](proto/scenarios.js) | stsenaariumid A, B, C |
| [proto/run.js](proto/run.js) | käivitaja: `node proto/run.js B` (valikud `A`, `B`, `C`, `C0`, teine argument = seeme) |
| [proto/test/sim.test.js](proto/test/sim.test.js) | testid: `npm test` |

Prototüübi piirangud: üks suletud pidev konveier; mudel on „kompileeritud“ kujul (rada = pikkus, jaamad = asukohad), ikoonidest rajavõrgu ehitamine (`Enumerate`) tuleb hiljem; rikkeid ja AGV-sid pole.

## Tulemused

Kõik jooksud kontrollivad invariante **igal simulatsiooni sekundil**: detailid ei teki ega kao, iga detaili asukoht on kooskõlas andmestruktuuridega (mõlemas suunas), mahutavused ja broneeringud ei ületa piire, seisval konveieril on põhjus, Event Listis pole töötlemata ega valesti järjestatud sündmusi.

| Test | Tulemus |
|---|---|
| **A1** üks detail korraga | tsükliaeg **440 s** – täpselt nagu käsitsi arvutatud (arvutus testi kommentaaris) ✔ |
| **A2** püsiseisund | pudelikael on pink: 10 + 300 + 10 = 320 s → 67,5 detaili 6 h jooksul; simulaator **67–68** ✔ |
| **B** näidis-PTS (2 pinki, 2 tüüpi, juhuslikud ajad) | 8 h ilma ummikuta, ~10,5 tk/h; MT2 on pudelikael (99 %), MT1 ~61 % – vastab koormusele (freesimist teeb ainult MT2) ✔ |
| **C** ristmarsruudid (A: MT1→MT2, B: MT2→MT1, puhvrid 1 koht) keskladuga | 8 h ilma lahendamatu ummikuta, parkimisi 1–3 ✔ |
| **C0** sama ilma kesklaota | ringootamine tuvastatakse ~160 s pärast ja simulatsioon peatub koos põhjusega ✔ (oodatud: selline struktuur ei saa töötada) |
| **D** korratavus | sama seeme → identne aruanne; teine seeme → erinev ✔ |
| **Invariantide kontroll** | 3 meelega tehtud viga (broneering vabastamata, alus tühjendamata, konveier ei käivitu) – kõik tabati kohe ✔ |

Puhvri mahu mõju stsenaariumis C (seeme 1, 3 alust, ummiku vältimisega):

| Puhvri maht | Läbilaskevõime | Pinkide rakendatus | Parkimisi |
|---|---|---|---|
| 1 | 6,0 tk/h | 38 % | 3 |
| 2 | 10,1 tk/h | 70 % | 1 |
| 3 | 10,9 tk/h | 77 % | 1 |

Läbilaskevõime kasvab puhvri mahuga nagu peab – simulaator käitub mõistlikult.

## Leiud ja disaini muudatused

1. **Peatsükli järjekord** (`Inc` → `MinuteMan` → sündmused) ja `GetEvent` (`Time ≤ SYSTEM_TIME`) töötavad: ükski sündmus ei jää vahele, tsükliaeg klapib sekundi täpsusega. Disain kinnitatud.
2. **Ummiku tuvastus ooteaja järgi andis valehäireid.** Stsenaariumis B pargiti 19 detaili kesklattu, kuigi ummikut polnud – pudelikaela taga ootamine on normaalne. Asendatud **tegeliku ummiku tuvastusega**: püsipunkti arvutus, millised täis puhvrid ei saa kuidagi edasi liikuda (DISAIN.md 5.3).
3. **Ainult lahendamisest (parkimisest) ei piisa.** Ilma vältimiseta pargiti ristmarsruutidel peaaegu iga detail (42 parkimist 48 valmis detaili kohta) ja kesklao täitumisel jäi süsteem lõplikult kinni – iga puhvri suuruse juures. Lisatud **ummiku vältimine**: pink alustab alles siis, kui detaili järgmise pingi koht on broneeritud (`ReserveNextBeforeStart`, vaikimisi sees). Tulemus: parkimisi 1–3, läbilaskevõime kasvas (B: 10,0 → 10,5 tk/h).
4. **Vältimine tõi uut tüüpi ummiku**: kahe pingi puhvrites on sissetulevad detailid, kumbki ootab teise pingi kohta. Tuvastus ja parkimine laiendati ka sissetulevatele detailidele.
5. **Viga `LoadMachines`-is**: pink proovis ainult järjekorras esimest detaili ja kui sellega ei saanud alustada, jäi tühjaks, kuigi teisega oleks saanud. Parandatud: võetakse esimene, millega saab alustada.
6. **Kesklao täitumine**: valmis detailid täitsid kesklao ja parkimiseks ei jäänud ruumi. Lisatud `ParkingReserve` (vaikimisi 2 kohta).
7. **Planner kui täielik ülevaatus** igal kutsel (pingid → sihtkohad → sissetoomine) osutus lihtsaks ja töökindlaks; kiirus on piisav (8 h simulatsioon ~30 ms).
8. **Struktuurne järeldus**: ühekohaliste puhvritega ristmarsruudid ilma kesklaota ummistuvad paratamatult – see on mudeli tulemus, mitte simulaatori viga. Simulaator teatab sellest selgelt.

## Mida see EI kontrolli

- Ikoonidest rajavõrgu ehitamist (`Enumerate`), mitut rada ja konnektoreid.
- Avatud konveierit.
- AGV-sid / transpordiroboteid (DISAIN.md osa 11) – stsenaariumid E ja F tulevad etapis 7.
- Rikkeid (`Crash`).
- `PlacesPerCart > 1`.

## Järeldus

Disaini osad 1–7 on pidevate konveierite jaoks **valideeritud**: loogika on analüütiliselt õige, stressi all stabiilne ja korratav. Parandused on viidud DISAIN.md-sse. Prototüübi koodi saab etapis 4 kasutada täissimulaatori alusena.

---

# Etapp 4: tootekood ja `Enumerate`

Prototüübi loogika viidi muutmata kujul faili [src/fms_sim.js](src/fms_sim.js). Uus osa on `Enumerate`, mis teeb mudelifaili ruudustikust simulatsiooni võrgu (DISAIN.md 2.1), ja andmekontroll (2.2). Testid: [test/sim.test.js](test/sim.test.js).

| Test | Tulemus |
|---|---|
| **Näidismudel** (`models/demo.fms.json`) läbi `Enumerate` | silmus 18 sirget + 4 kaart = **2114,159 cm**; jaamad FromCS 0, ToCS 700, SysOut 800, BUF2 1357,08, BUF1 1757,08 – täpselt käsitsi arvutatud ✔ |
| **A** joonisena (metrokaardi pikkustega 500 + 500 + 1000 cm) | võrk = prototüübi stsenaarium A; tsükliaeg **440 s** ja kõik valmis detailid identsed prototüübiga ✔ |
| **C** joonisena | valmis detailid ja parkimised identsed prototüübiga; **C0** (ilma kesklaota) – ummik tuvastatakse ✔ |
| Näidismudel 8 h | ilma ummikuta, **10,5 tk/h**, MT2 99 % (pudelikael), MT1 63 %, konveier liigub 76 % ajast; ~50 ms koos invariantidega ✔ |
| Suunanool | vastassuunaline nool pöörab jaamade järjekorra ümber; mitu kooskõlas noolt on lubatud, vastuolulised annavad vea ✔ |
| `EdgeLengths` | lõigu pikkuse muutmine nihutab järgmisi jaamu täpselt nii palju ✔ |
| Andmekontroll | originaali vead 1–8 ja lisakontrollid annavad vea või hoiatuse (14 negatiivset testi) ✔ |
| Statistika | pinkide olekute osakaalud ja konveieri liikumine/seis summeeruvad 1-ks; tüüpide kaupa valmis = kokku valmis; aegrida 481 punkti (0 … 28 800 s, iga 60 s) ✔ |
| Korratavus | sama seeme → identne aruanne ✔ |

**Leid.** Kui pideva raja haru on tehtud päris rajaikooniga, tuli esialgu hulk kaasvigu (kõik punktiirühendused „ühendamata“), aga mitte põhiviga. Parandus: katkise silmuse korral teisi kontrolle ei tehta ja haru lahter ei saa teadet „pole ühendatud“. Nüüd on teade lühike ja täpne: „pideval rajal … on haru“.

**Mida see EI kontrolli** (etapp 7): mitu rada, konnektorid, avatud konveier, diskreetsed rajad, `PlacesPerCart > 1`. Need annavad praegu selge vea „… pole veel toetatud (tuleb etapis 7)“.

---

# Etapp 5: animaator

Animaator ([src/anima.js](src/anima.js), DISAIN.md osa 14) ainult loeb simulaatori olekut. Arvutusosa on brauserist sõltumatu ja seda testitakse Node'iga: [test/anima.test.js](test/anima.test.js).

| Test | Tulemus |
|---|---|
| **Jaam ekraanil** – iga jaama asukoht rajal → hargnemisikooni keskpunkt (näidismudel ja metrokaardi lõiguga mudel) | täpsusega 0,001 ikooni ✔ |
| **Pidevus** – 20 000 punkti ümber silmuse: naaberpunktide vahe < 0,01 ikooni, ring sulgub; metrokaardi lõigul (eri pikkusega hargnemise pooled) samuti | ✔ |
| **Raja joon** – kaare punktid on nurgast kaugusel 1/2, ikooni algus ja lõpp on sisenemis- ja väljumiskülje keskel | ✔ |
| **Animaator ei mõjuta simulatsiooni** – 4 h näidismudelit sammhaaval, igal sekundil olekut lugedes | aruanne identne `SimRun`-iga ✔ |
| **Detailide kohad** – igal sekundil on iga süsteemis olev detail täpselt ühes kohas; laadimisel olev detail leiab oma `Load`-sündmuse (üle 1000 laadimise) | ✔ |
| **Event List** – võrdlus eelmise seisuga (lisandunud − kadunud = muutus), aja järjekord; kaardid: sama aeg ühes veerus FIFO, veerud ei kattu, kõik on näidatud või kokku loetud | ✔ |
| **Kiirus** – liugur ↔ kiirus, `+` / `−` sammud, ×1 ja ×1000 piirid | ✔ |
| **Brauseris** (käsitsi): EGA ja kaasaegne (hele, tume), start / paus, ×10 … ×272 liuguriga, max (8 h alla sekundi, kokkuvõte sama mis etapis 4: 10,5 tk/h), samm, järgmine sündmus, ahelloend, kaardi esiletõstmine, ⏹ → kokkuvõte → töölaud; konsoolis vigu pole | ✔ |

**Leid.** Alguses tundus, et detailid jõuavad puhvrisse aeglaselt (3 min pärast polnud ükski kohal). Kontroll Node'iga näitas, et see on mudeli käitumine: konveier seisab iga FromCS-i laadimise ajal 15 s, nii et esimene alus jõuab BUF1-ni alles ~3,5 min pärast. Animaator näitas seda õigesti (puhvri kohad broneeritud, konveier „seisab (1)“).

**Mida see EI kontrolli:** pilti ennast automaatselt (joonistamist kontrolliti silmaga), puutetundlikku ekraani, mitut rada ja diskreetseid radu (etapp 7).

