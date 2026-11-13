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

---

# Etapp 6: redaktor

Redaktori loogika ([src/fms_ed.js](src/fms_ed.js), DISAIN.md osa 15) muudab mudelit ja on brauserist sõltumatu – testid: [test/editor.test.js](test/editor.test.js).

## 6a: Layout ja View

| Test | Tulemus |
|---|---|
| **Automaatne ikoonivalik** – kõik 15 külgede kombinatsiooni; `IconFromPorts` on `CellPorts`-i pöördfunktsioon kõigil 11 raja ikoonil | ✔ |
| **Lohistamine** – vahelahtrid külgnaabrite kaudu (diagonaal vaheldub), tagasi liikudes kaob lõik; L-kujuline rada, raja otsast pööramine (kaar, mitte hargnemine), hargnemine, ristmik, suletud silmus (4 kaart) | ✔ |
| **Reeglid** – rada ei lähe objekti ega punktiiri sisse ega ruudustikust välja; punktiir objektist sirgele rajale annab hargnemise, kaarele ja raja otsa mitte | ✔ |
| **Objektid** – uus kirje vaikeväärtustega, sama liiki ikoon jätab andmed alles, teist liiki asendab; punktiir ↔ rada; `ToCS` loob kesklao | ✔ |
| **Kustutamine** – hargnemine ja ristmik kaotavad haru; puhvri kustutamisel nummerdatakse ülejäänud ümber ja andmed liiguvad kaasa; rada jääb alles; ruudustiku vähendamine kustutab välja jäävad ikoonid ja pingi andmed | ✔ |
| **Suunanool** – E → W → puudub; kaob, kui ikoon muutub hargnemiseks; hargnemisel ja objektil ei saa | ✔ |
| **Iga muudatuse järel** läbib mudel `CheckModel`-i | ✔ |
| **Põhitest**: näidis-PTS tühjast ruudustikust redaktori operatsioonidega (üks lohistamine silmuse jaoks, 7 objekti paletist, 5 punktiirühendust, 1 suunanool) → **samad lahtrid** kui `models/demo.fms.json`; pärast andmete lisamist sama `Enumerate`-i võrk ja **sama 8 h simulatsiooni aruanne** | ✔ |
| **Brauseris** (käsitsi), EGA ja kaasaegne: silmus nelja lohistamisega (nurgad ise), puhver ja punktiir (hargnemine tekib), suunanool, Ctrl-Z / Ctrl-Y, Shift + nooltega rada koos pöördega, kustutamine lohistades, objekti liigutamine, kerimine (13 × 7 EGA-s 6 rida), View, „(muudetud)“ töölaual ja küsimus enne Load-i; konsoolis vigu pole | ✔ |

**Leid.** Esimene versioon võttis lahtri olemasolevad küljed ikoonist. Siis muutus raja ots (sirge, millel üks külg on vaba) juurdejoonistamisel hargnemiseks, mitte kaareks. Parandus: arvesse lähevad ainult naabriga ühendatud küljed (`LinkedPorts`).

## 6b: vormid ja kontrollid

| Test | Tulemus |
|---|---|
| **Vormi kontroll** – väärtused rakenduvad ja muudatusest teatatakse (Undo); `CheckModel`-i piirid (nt 0 kohta, murdarv) tulevad õige välja juurde, mudel jääb muutmata; „pole arv“ enne `CheckModel`-i; koma ja punkt | ✔ |
| **Raja kustutamine** – ikoonid ja andmed kaovad, järgmise raja number nihkub, teised objektid jäävad | ✔ |
| **Lõik ja metrokaart** – `SegmentCells` leiab sama lõigu mis `Enumerate` (ka kaartega); pikkuse muutmine muudab silmuse pikkust täpselt `uus − mõõtkavast` võrra; tulemus on sama mis käsitsi kirjutatud `EdgeLengths` (animaatori test); asendamine ja eemaldamine | ✔ |
| **Detailid** – Copy (sügav koopia, nimi „(koopia)“), New, Flush, 16 piir; kõik läbivad `CheckModel`-i | ✔ |
| **Config → All** järjekord (pingid, puhvrid, rada, keskladu – igaüks üks kord) | ✔ |
| **Kontroll** – näidismudel korras; katkine silmus annab vea koos lahtriga; pingi / puhvri / lahtri tee → lahter | ✔ |
| **Pooleli mudel** – pingi kustutamise järel on fail laaditav (`ParseModelText`), puuduva operatsiooni viga annab `Enumerate` | ✔ |
| **Brauseris** (käsitsi), EGA ja kaasaegne: Config → All (MT1 → MT2 → BUF1, objekt esile tõstetud, vorm ei kata), vigane väärtus → teade välja juures, Config → Choose raja lahtril koos lõigu pikkusega, detail → marsruudid → marsruut (+ op), Model data, kontrolli nimekiri (infureal punane arv), Undo pärast kustutamist, Simulate pärast redigeerimist; konsoolis vigu pole | ✔ |

**Leid.** Esimese versiooniga muutus mudel pärast pingi kustutamist **laadimatuks**: `CheckModel` nõudis, et iga marsruudi operatsiooni teeks mõni pink, ja salvestatud faili ei saanud enam avada. Parandus: see on andmete kooskõla, mitte faili struktuur – kontroll jäi ainult `Enumerate`-i (seal oli see juba olemas „joonisel olevate pinkide“ kohta). Test `model.test.js` muudeti vastavalt.

**Leid.** Kõrge vorm (rada koos lõigu pikkusega) kattis EGA-s valitud lahtri. Parandus: vorm valib koha (all või üleval), mis katab objekti kõige vähem.

**Mida see EI kontrolli:** vormide joonistust automaatselt (kontrolliti silmaga); diskreetseid radu ja konnektoreid (redaktor lubab need joonistada, Simulate annab etapi 7 teate).


---

# Etapp 7a: rajavõrgu graaf (mitu rada, konnektorid, avatud konveier)

Uus loogika (DISAIN.md osa 2.3): `Enumerate` teeb igast raja numbrist silmuse või avatud konveieri, konnektorid seovad radu, `StationPaths` annab lühima tee jaamast jaama, `Depart` broneerib tee konnektorid koos sihtkohaga. Testid: [test/network.test.js](test/network.test.js), redaktor [test/editor.test.js](test/editor.test.js).

Enne täisteostust kontrolliti simulaatorit (stsenaariumid kirjutatud joonisena, invariandid igal sekundil), alles siis tehti animaator ja redaktor.

| Test | Tulemus |
|---|---|
| **Võrdlus prototüübiga** – A ja C (üks silmus) | aruanded identsed nagu varem: ühe silmuse korral on tee pikkus sama mis vana kaugus konveieri suunas ✔ |
| **G1** kaks silmust + konnektor, üks detail, üks alus kummalgi rajal | tsükliaeg **625 s** – täpselt käsitsi arvutatud (arvutus testi kommentaaris), 10 laadimist, konnektoris 2 ülekannet ✔ |
| **H1** avatud konveier, kaks pinki järjest, üks alus | tsükliaeg **683 s** – täpselt käsitsi arvutatud ✔ |
| **G** täiskoormusel (3 alust rajal) 8 h | 11,1 tk/h (pink: 3600 / 320 = 11,25), pink 100 %, iga detail ületab konnektori 2 korda ✔ |
| **H** täiskoormusel 8 h | 11,0 tk/h (MT1 pudelikael 100 %, MT2 68 %); koormaga alus ei jõua kunagi raja lõppu (invariant igal sekundil) ✔ |
| **G2** avatud sisendkonveier lõpeb konnektoris, edasi silmus | konnektori jaam otsaikooni keskel (250 cm), 4 h ilma ummikuta, pink 99 % ✔ |
| **S** (stress) kaks silmust, 3 pinki, ristmarsruudid, puhvrid 1 koht, `Kl` 0,95, 5 seemet | 8 h ilma lahendamatu ummikuta, parkimisi 1, 5,9–6,1 tk/h; korratav ✔ |
| **Invariantide kontroll** – meelega viga: detaili sõidu lõpp viidi olematusse jaama | „koormaga alus läbis avatud konveieri lõpu“ tabati kohe ✔ |
| **Andmekontroll** – konnektori üks külg vaba, konnektor ühendab raja iseendaga, kaks rada puutuvad ilma konnektorita, järgmise operatsiooni pink vastuvoolu, SysOut vastuvoolu, `EdgeLengths` ühelgi rajal | kõik annavad vea ✔ |
| **Animaator** – iga raja jaam ekraanil oma ikooni keskel (ka konnektori jaam raja otsas); avatud konveieril pidev joon algusest lõpuni | ✔ |
| **Redaktor** – G2 tühjast ruudustikust: rada otsast konnektorisse, konnektorist silmusele (tekib hargnemine), punktiir hargnemisest konnektorini; kontroll korras ja simulatsioon käib | ✔ |
| **Brauseris** (käsitsi): S EGA-s (kaks silmust, konnektori broneering, rada värvub seistes eraldi, kokkuvõttes „CON1: ülekandeid“), G2 kaasaegses (avatud konveier, alus seisab otsaikooni keskel konnektori ees, Event List), Layout-is „kontroll korras“; konsoolis vigu pole | ✔ |

Puhvri mahu ja konnektori mõju stsenaariumis S (seeme 1):

| Puhvri maht | Valmis 8 h | Konnektor hõivatud | sellest ainult broneering (detail alles teel) |
|---|---|---|---|
| 1 | 49 | 30 % | 23 % |
| 2 | 86 | 55 % | 43 % |
| 3 | 107 | 71 % | 55 % |

## Leiud

1. **Katkine silmus on nüüd avatud konveier.** Originaali viga 1 („topoloogia pole suletud“) ei saa enam tähendada lihtsalt „rada katkeb“, sest avatud konveier on lubatud. Kui katkestus on kogemata, jääb osa objekte vastuvoolu ja kättesaadavuse kontroll annab vea; teates on konveieri otsad („konveier … on avatud: algus (5, 3), lõpp (7, 3)“). Test „Kontroll 1“ muudeti vastavalt.
2. **Konnektor broneeritakse kogu tee ajaks.** Nii ei teki konnektorites ringootamist ja avatud konveieri koormaga alus ei pea lõpust mööda sõitma. Hind: ~¾ konnektori hõivatusest on broneering ajal, mil detail alles ootab alust või sõidab (tabel). Testides polnud see pudelikael (S-is piirasid ühekohalised puhvrid), aga suurel koormusel võib olla. Võimalik hilisem parandus: silmusel broneerida konnektor alles lähenedes (alus võib ringi teha) või anda konnektorile mahutavus.
3. **Avatud konveier ilma tagasiteeta** (alused lõpust otse algusesse) töötab sama `MinuteMan`-iga, mis silmus – muudatust polnud vaja. Ohutuse tagab Planner (ainult allavoolu); invariant kontrollib seda igal sekundil.
4. **Kättesaadavus tuleb kontrollida kõigist võimalikest kohtadest**, mitte ainult FromCS-ist: kui operatsiooni teeb mitu pinki, võib detail jõuda pinki, kust järgmise operatsiooni pinki ei saa. `CheckReachability` käib marsruudi läbi kõigi võimalike kohtadega (ja kesklao korral ka FromCS-iga, sest pargitud detail tuleb sealt tagasi).

**Mida see EI kontrolli:** diskreetseid radu (etapp 7b), mitut detaili alusel (7c), konnektori mahutavust üle 1.
