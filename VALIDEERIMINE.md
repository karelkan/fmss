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
