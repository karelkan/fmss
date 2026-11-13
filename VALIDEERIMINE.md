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
| **Sild** (`CrossOver`) – kaheksakujuline silmus läbib silda kaks korda risti (pikkus 6 kaart + 4 sirget + 2 × sild), 2 h ilma ummikuta; teine rada ristub H-ga sillal – H1 tsükliaeg jääb **683 s**; sama koht ristmikuna (`Cruise`) on pideval rajal endiselt viga | ✔ |
| **Animaator** – iga raja jaam ekraanil oma ikooni keskel (ka konnektori jaam raja otsas); avatud konveieril pidev joon algusest lõpuni | ✔ |
| **Redaktor, sild** – teise raja sirgest risti üle → sild (`N` W–E, `N2` N–S); naabri kustutamine silda ei muuda; raja kustutamisel jääb teise raja sirge; ristmik ↔ sild paletist; `CheckModel` nõuab `N2` ainult sillal | ✔ |
| **Redaktor** – G2 tühjast ruudustikust: rada otsast konnektorisse, konnektorist silmusele (tekib hargnemine), punktiir hargnemisest konnektorini; kontroll korras ja simulatsioon käib | ✔ |
| **Brauseris** (käsitsi): S EGA-s (kaks silmust, konnektori broneering, rada värvub seistes eraldi, kokkuvõttes „CON1: ülekandeid“), G2 kaasaegses (avatud konveier, alus seisab otsaikooni keskel konnektori ees, Event List), Layout-is „kontroll korras“; kaheksa silla ja paleti uue ikooniga mõlemas välimuses; konsoolis vigu pole | ✔ |

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

## Parandus: puhvri suund

**Leid** (kasutaja tähelepanek katses): suunaga puhvri kaudu liikusid detailid kahes suunas. Põhjuseid oli kaks:

1. Originaalis on puhvri liik **liikumissuund joonisel** (joon. 5.4: `InBuf` üles ▲, `OutBuf` alla ▼) ja redaktor joonistab nii, aga `LinkMachines` luges seda rolliks pingi suhtes („sissetulev“ / „väljaminev“). Tavalises paigutuses (pink raja kohal) need kattuvad, läbival pingil mitte: `MachToolThruDown` nõudis pingi kohale `InBuf`-i ▲, kuigi detailid liiguvad sealt alla, ja keelas õige `OutBuf`-i ▼.
2. Ummiku lahendus pargis ka sissetuleva detaili – see saadeti ühesuunalisest puhvrist tagasi rajale.

**Parandus**: suund tuleb puhvri kohast pingi suhtes (`BUFFER_FLOW`, `RoleFlow`, DISAIN.md 2.1); ühesuunalisest puhvrist pargitakse ainult väljaminevaid detaile; invariant „ühesuunalisest puhvrist saadetakse sissetulev detail tagasi“. Testid ([test/network.test.js](test/network.test.js), „Puhvri suund“):

| Test | Tulemus |
|---|---|
| `ThruDown`: ▼ + ▼ lubatud, ka kahesuunalised; ▲ pingi kohal või all → viga „siin liiguvad detailid alla“ | ✔ |
| `ThruUp`: ▲ + ▲ lubatud, ▼ → viga „siin liiguvad detailid üles“ | ✔ |
| Läbivad pingid, 8 h: ülemistes puhvrites ainult sissetulevad, alumistes ainult väljaminevad detailid | ✔ |
| Ristmarsruudid ühekohaliste ühesuunaliste puhvritega: ummik on lahendamatu (0 parkimist), teade „ühesuunalisest puhvrist ei saa sissetulevat detaili tagasi saata“; kahesuunaliste puhvritega lahendatakse parkimisega | ✔ |
| Varasemad testid (näidismudel, A, C, G, H, S) – tulemused samad (kasutavad `InOutBuf`-i / `TurnBuf`-i või pinki raja kohal) | ✔ |

**Järeldus struktuuri kohta**: ristmarsruutide ja ühekohaliste **eraldi** sisse- ja väljaminevate puhvritega (läbiv pink) ei piisa ummiku vältimisest (`ReserveNextBeforeStart`): kumbki sissetulev detail ootab teise pingi sissetulevat kohta. Kahesuunaliste puhvritega pargiti seetõttu palju (5 seemet: 14–36 parkimist 19–49 valmis detaili kohta, kahel seemnel lõpuks ummik); ühesuunalistega peatub simulatsioon kohe. Tugevam vältimine (nt sissetuleva koha broneerimine alles siis, kui detaili järgmise pingi koht on samuti saadaval) on võimalik hilisem täiendus.


---

# Etapp 7b: diskreetsed rajad (AGV-d)

## Paralleelsed konnektorid (7a ootel töö)

**Leid** (7a): `Depart` kasutas alati `TransportPaths`-i ühte teed. Kui sama kahe raja vahel oli mitu konnektorit ja tee konnektor oli kinni, jäi detail ootama, kuigi kõrvalkonnektor oli vaba.

**Parandus**: `Depart` arvutab tee teele minnes uuesti (`FreePath` → `ShortestPaths` kinniste konnektoriteta). Testid ([test/network.test.js](test/network.test.js), „P“): kaks silmust, kaks paralleelset konnektorit, mõlema kaudu sama pikk tee.

| Test | Tulemus |
|---|---|
| Kinnise konnektori asemel leitakse teine, sama pikk tee; mõlemad kinni → teed pole | ✔ |
| 8 h täiskoormusel (3 alust kummalgi rajal) kasutatakse mõlemat konnektorit, iga detail ületab 2 korda; varasemad testid (G, G2, S) samad | ✔ |

Mõju (seeme 1, pink 120 s, 8 h):

| Puhvri maht | Kaks konnektorit: valmis / pink | Üks konnektor: valmis / pink |
|---|---|---|
| 1 | 117 / 57 % | 80 / 39 % |
| 2 | 204 / 100 % | 137 / 67 % |
| 3 | 204 / 100 % | 137 / 68 % |

Ühe konnektoriga oli konnektor pudelikael (see on 7a leid 2: konnektor on broneeritud kogu tee ajaks); teine konnektor kaotab selle. Broneerimine alles lähenedes jääb hilisemaks.

## Diskreetne rada (AGV-d)

Uus loogika: [DISAIN.md](DISAIN.md) osa 11. Testid: [test/agv.test.js](test/agv.test.js). Kõik simulatsioonid kontrollivad invariante igal sekundil, nende hulgas uued (`CheckCarts`): igas tsoonis kõige rohkem üks käru ja käru on ainult enda broneeritud tsoonis; broneeritud tsoonid on käru kohal või tema teel; ühesuunalist lõiku läbitakse õiges suunas; koormaga käru sõidab detaili sõidu lõppjaama poole.

Enne täisteostust kontrolliti simulaatorit; alles siis tehti animaator ja redaktor.

### Käsitsi arvutatud ajad

| Test | Tulemus |
|---|---|
| **I1** üks AGV joonel (FromCS, BUF1, SysOut; 50 cm/s, laadimine 10 s), üks detail | tsükliaeg **371 s** – täpselt käsitsi arvutatud (arvutus testi kommentaaris): tühisõit 2 s, 6 laadimist, koormaga 8 s ✔ |
| **E1** kaks käru vastassuunas, kaks haru hargnemiste vahel (lühem 457 cm, pikem 657 cm) | teine käru teeb kohe ümbersõidu pikemat haru mööda; kohal **t=7** ja **t=9** – täpselt sõiduajad, keegi ei oota, `Collision` 0 ✔ |
| **E2** kaks käru vastassuunas joonel, hargnemisest kõrvalharu jaama | mõlemad jõuavad hargnemise ette (t=2), ring → `Collision` → käru 1 läheb kõrvalharule; kohal **t=5** ja **t=7** – nagu käsitsi ✔ |
| **E3** sama joon ilma kõrvalharuta | ring → `Collision` → ümbersõitu ega kõrvalepõiget pole → simulatsioon peatub: „ootavad kärud üksteist (1, 2)“ ✔ |
| **E4** möödasõidurada: pikk üherealine osa (1200 cm) – kaks haru – lühike osa | kahesuunaliste harudega (ümbersõit hargnemisel) ja ühesuunalistega (vastassuunalised nooled) sama: käru 2 ootab haru lõpus, kuni käru 1 on hargnemises; kohal **t=18** ja **t=24** – nagu käsitsi, `Collision` 0 ✔ |

### Koormusega stsenaariumid (8 h, invariandid igal sekundil)

| Test | Tulemus |
|---|---|
| **F** ristmik (`Cruise`), neli haru, igaühe otsas jaam – iga sõit läbib ristmikku; 1–3 käru, 5 seemet | ilma ummikuta, ristmikul korraga üks käru (invariant), suurim ootamine 32–40 s; korratav ✔ |
| **I2** kaks käru üherealisel joonel (transport on pudelikael) | ilma ummikuta; teine käru on varuks – valmis sama palju kui ühega (513) ✔ |
| **R** linnavõrk: kahesuunaline ringtee + põiktee, 3 pinki, ristmarsruudid, puhvrid 1 koht, keskladu (nagu 7a S); 1–4 käru, 5 seemet | ilma lahendamatu ummikuta, 58–60 valmis (pinkide ja puhvrite piir), parkimisi 1; korratav ✔ |
| **M** segavõrk: pidev silmus (FromCS, SysOut) – konnektor – AGV-joon (MT1, MT2) | 115 valmis, iga detail läbib konnektorit kaks korda (232 ülekannet) ✔ |
| **N** näidismudel diskreetse rajana, **ühesuunaline ring** (nool igal lõigul) | 1–5 käru (5 käru 5 sõlmel) ilma ummikuta ja ilma `Collision`-ita, 79–85 valmis ✔ |
| **N** näidismudel nagu failis (üks nool – üks ühesuunaline lõik, muu kahesuunaline, möödumiskohti pole) | 1–2 käru: 83 valmis (pidevana 84); 3 käru: ummik ~40 min pärast, selge teade ✔ (vt leid 6) |
| **P** paralleelsed konnektorid, **G, G2, H, S, A, C** jm – pidevad rajad pärast teede ajakaalu | tulemused samad ✔ |
| **Invariantide kontroll** – meelega vead: tsoon ilma broneeringuta, kaks käru ühes tsoonis, käru vastu ühesuunalist lõiku | kõik tabati kohe ✔ |
| **Andmekontroll** – vastuolulised nooled samal lõigul, rada kahes tükis, kärusid rohkem kui sõlmi, ühesuunaline lõik teeb pingi kättesaamatuks | viga ✔ |

**Näidis-AGV** (`models/agv.fms.json`, File → Load): ühesuunaline ringtee päripäeva (nool igal lõigul), kahesuunaline põiktee keskel, parkimisharu vasakul; 3 pinki, FromCS, ToCS, SysOut; 3 käru, 25 cm/s. 1–4 käru × 5 seemet 8 h: ilma ummikuta, 0 `Collision`-it, suurim ootamine < 40 s. Valmis (seeme 1): 1 käru 107, 2 käru 132, 3 käru 139, 4 käru 140 – siis on pudelikael MT2 (~90 %).

Kärude arvu mõju, kui transport on pudelikael (**F**, seeme 1):

| Kärusid | Valmis 8 h | Pingid MT1 / MT2 | Käru keskmiselt: tühi / koormaga / laadib / ootab / vaba |
|---|---|---|---|
| 1 | 196 | 54 % / 48 % | 17 / 41 / 41 / 0 / 1 % |
| 2 | 248 | 69 % / 60 % | 13 / 26 / 26 / 3 / 33 % |
| 3 | 251 | 69 % / 62 % | 13 / 18 / 18 / 5 / 47 % |

Teine käru annab +27 %, kolmas peaaegu mitte midagi: kõik sõidud läbivad sama ristmikku ja harud on üherealised (iga haru on korraga ühe käru käes) – pudelikael on rajavõrk, mitte kärud.

### Leiud

1. **Plokk koos lõpusõlmega takistas möödumist** (ettepaneku arutelus): kui käru ootab ainult sõlmes, ei saa möödasõiduraja harul oodata. Plokk lõpeb nüüd hargnemise ees ja käru ootab lõigu lõpus (E4).
2. **Teine käru üherealisel joonel vähendas läbilaskevõimet** (378 vs 513, −26 %, 378 `Collision`-it): vaba käru seisis teise käru sihtjaamas, sai töö teisel pool teda ja pidi mööda pääsema. Parandus `FindPal`-is: eelistatud on käru, kelle teel pole teist käru, ja muidu ootab soov kuni 30 s (`REQUEST_PATIENCE`) – nüüd 513 ja 0 `Collision`-it.
3. **Näiline ummik** (R, 4 käru): `CollisionProc` pidas ümbersõidu takistuseks ka ringist väljas olevaid kärusid (liikuv käru, vaba käru hargnemises). Parandus: arvesse lähevad ainult ringi kärude tsoonid; vaba käru ei jää seisma hargnemisse.
4. **Vabade kärude ahel**: koormaga käru ootas vaba käru oma sihtjaamas, kelle ainsa väljapääsu sulges teine vaba käru – ringi polnud, ootamine kestis lõputult (25 000 s). Parandus: kõrvale mineva vaba käru teed takistavad ainult seisvad (ootavad, laadivad) kärud; teised vabad kärud lükatakse järgmisel sekundil edasi; kõrvale saamata vaba käru on ootegraafis ootaja (tema väljapääsude hoidjate järel) – nii leitakse ka „tühi käru taskus“ ring.
5. **Ühesuunaline ring jäi tihedalt kinni** (4 käru 5 sõlmel): plokk nõudis koos sõlmega järgmist lõiku, nii et kärud ei saanud tühja sõlme oodata. Ühesuunalise lõigu ees on nüüd plokk ainult sõlm; ühesuunalise lõigu lõpus võib oodata ka siis, kui järgmine sõlm on tee lõpp. Tulemus: 5 käru 5 sõlmel töötab.
6. **Lõputu ringlemine** (näidismudel, 3 käru, kahesuunaline ring): igal sekundil `Collision` ja ümbersõit, mis ei aidanud (26 599 korda 8 h jooksul). Parandus: kui ring (mõne samaga kärudest) kordub kohe, ümbersõitu ei proovita; 10 korda järjest → ummik ja selge teade. **Järeldus struktuuri kohta**: kahesuunalisel ringil, kus pole möödumiskohti, ei leia kohalikud reeglid 3 käru korral lahendust, mis vajaks mitme sammu plaani – selline paigutus sobib kuni kahele kärule; suunanooled (ühesuunaline ring) või möödasõidurajad lahendavad selle.

### Animaator ja redaktor

| Test | Tulemus |
|---|---|
| **Lõigu geomeetria** (E4, F, R, M) – lõigu otsad on sõlmede punktides, 400 punkti lõigul ilma hüpeteta; jaam hargnemisikooni keskel | ✔ |
| **Sujuv liikumine** – R 1 h sammhaaval: käru punkt sekundi sees ei hüppa (ka sõlme kaudu ja ümber pöörates), lõpp on käru tegelik koht; aruanne sama mis `SimRun`-iga | ✔ |
| **Redaktor** – E4 tühjast ruudustikust (kolm lohistamist, objektid, punktiirid, kaks noolt): samad lahtrid kui testis; pideva rajana viga (haru), diskreetsena korras; simulatsioon käib; metrokaart raja otsa lõigule (`SegmentCells` = 2 ikooni) annab sama lõigu pikkuse `Enumerate`-s | ✔ |
| **Brauseris** (käsitsi): EGA – R, E4 (möödasõidurada: harude nooled, ootav käru pruuni raamiga haru lõpus, raja-harud pideva joonena), M (konveier + konnektor + AGV, detail konnektorist kärule), kokkuvõte (AGV kahel real); kaasaegne – F (broneeritud plokk: ristmik ja haru katkendjoone ja ringidega, ootavad kärud oranži raamiga, olek klapib simulaatoriga), redaktor (F, „kontroll korras“), lohistades uus parkimisharu ristmiku harust → pidev joon, kontroll korras, 8 h max: 250 valmis, 0 `Collision`-it; konsoolis vigu pole | ✔ |

**Leid** (brauseris): hargnemise haru joonistati alati punktiirina – diskreetse raja raja-haru nägi välja nagu punktiirühendus. Parandus: `BranchIsTrack` (haru naaber on sama raja rajaikoon → pidev joon). **Leid**: EGA-s jäi AGV kokkuvõtte rida ja olekurea „ootab“ ekraanist välja – kokkuvõte kahel real, olekureal ootajatega „AGV ootab 1/3“. **Leid**: diskreetse raja otsalahter on sõlm, redaktor luges selle lõigu metrokaardis terveks ikooniks – `SegmentCells` ja `MeasureGraph` nüüd kooskõlas.

**Mida see EI kontrolli:** tsoonide tükeldamist (`ZoneLength`), parkimiskohti, kärude kiirendust ja pikkust (käru on punkt), mitut detaili kärul (7c), rikkeid (8).
