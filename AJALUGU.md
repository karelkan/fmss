# FMSS-i taastamise ajalugu (etapid 0–12)

See dokument räägib, kuidas FMSS taastati: 1993. aasta diplomitöö väljatrükist kuni versioonini 1.5 ja dokumentatsioonini 1.1. Lugu algab esimesest vestlusest „FMSS simulaatori taastamine“. Iga etapi juures on kirjas:

- mida tehti;
- mis otsustati;
- mis läks valesti ja mida sellest õpiti.

Versiooni 2 alustamine siia ei kuulu (vt [PLAAN_TOOD_V2.md](PLAAN_TOOD_V2.md)).

Siin on ainult lugu. Testide tabelid ja leidude täpne sisu on [VALIDEERIMINE.md](VALIDEERIMINE.md)-s, otsuste sisu [DISAIN.md](DISAIN.md)-s ja originaali kirjeldus [originaal.md](originaal.md)-s. Commitide tunnused on praeguse ajaloo järgi. Enne avaldamist eemaldati ajaloost kaks commitit (etapp 10), seepärast on vanemates etapipromptides teised tunnused.

Tarkvara ja dokumentatsioon on arendatud koos Claude'iga. Iga etapp oli eraldi vestlus Claude Code'is. Autor otsustas, Claude pakkus välja, kirjutas, kontrollis ja pani kirja.

## Ülevaade

| Etapp | Aeg (2026) | Mis | Commitid | Versioon |
|---|---|---|---|---|
| 0 | 10.–12.11 | kirjeldus mälu järgi, skaneeringud, `originaal.md`, plaan, disain, nimetamise reeglid | `a3afa93`…`bdd9d6d` | |
| 2 | 12.11 õhtul | prototüüp ja valideerimine | `6698ca3` | |
| 3 | 12.11 | karkass: kaks välimust, menüü, avaekraan, andmemudel | `06076f5` | |
| 4 | 12.11 | täissimulaator ja `Enumerate` | `40f32f3` | |
| 5 | 12.11 | animaator | `745fdf8` | |
| 6 | 12.–13.11 | redaktor (6a Layout, 6b vormid) | `90760bf`, `1b7ca0e`, `c30a18a` | |
| 7a | 13.11 | rajavõrgu graaf, konnektorid, avatud konveier, sild | `028f251`, `fb67949`, `4a2c944` | |
| 7b | 13.11 | diskreetsed rajad (AGV-d), paralleelsed konnektorid | `ce50b88`…`254c971` | |
| 7c | 13.11 | mitu detaili alusel / kärul | `6521768`, `ef1bd6a`, `0bd478b` | |
| 8 | 13.11 | rikked, remont, praak, jaotused | `61ca27a`, `4132a29` | |
| 9 | 13.11 | aruanded | `b567a97` | |
| 10 | 13.11 | avaldamine | `80b3e97`, `5bf8db2` | **1.0** |
| 11a–c | 13.11 | kerimine ja suum, ümardusviga, kolm suurt näidist | `6349ac1`, `96dafcf`, `5c03f74` | 1.1, 1.2, 1.3 |
| 11d | 13.–14.11 | simulatsiooni lõpurežiim | `1e30754`…`34d8cab` | 1.4 |
| 12 | 14.–15.11 | dokumentatsioon, Mootoriosade tehas, Planneri peatükk | `1522216`, `c5938cd`, `62dd2e7` | 1.5, dok 1.1 |

Etapp 1 (simulatsiooniloogika disain) tehti etapi 0 vestluses ja on commitis `aa0391d`.

## Lähtekoht

1993. aastal kirjutas autor TTÜ Arvutitehnika Instituudis diplomitööna paindtootmissüsteemide simulaatori. Programm oli Turbo Pascalis ja koosnes protseduuridest, objekte ei kasutatud. Osi oli kolm:

- **redaktor**, millega joonistati tootmissüsteem ikoonidest;
- **diskreetsündmuste simulaator**, mille sündmused olid ajaliselt järjestatud ahelloendis;
- **animaator**. Autor naljatas, et tegi SimCity.

Töö jäi pooleli.

10. novembril 2026 kirjeldas autor programmi mälu järgi. Kaks päeva hiljem leidis ta väljatrüki ja skaneeris selle: 8 peatükki, 63 lehekülge. Selgus, et väljatrükk on varane versioon. Autor arendas programmi ja teksti hiljem edasi, kuid see osa on kadunud. Mälust tulid hiljem juurde mitu asja, mida paberil polnud:

- suure mudeli kerimine;
- `ProcEvent` ja Planner;
- transpordirobotid;
- iseõppiva Adviseri idee.

Eesmärk sõnastati esimesel õhtul: teha töö valmis, panna see veebi ja näidata kunagisele juhendajale. *Läks ainult 33 aastat, aga valmis sai.*

## Etapp 0 – originaal, plaan ja disain (10.–12.11)

**Repo.** Esimene küsimus oli, kas kogu töö mahub ühte pikka vestlusesse. Otsus: ei mahu. Projekt sai eraldi repo (`~/arendusprojektid/fmss`, esialgu ainult kohalik) ja oluline teadmine hoitakse failides, mitte vestluse mälus.

**Originaali ümberkirjutus.** Esimene kokkulepe tekkis kohe: kõigepealt tagasiside, siis sisu. Claude luges skaneeringud läbi ja pakkus välja, mis on taastamiseks oluline:

- ikoonide tabel;
- sündmuste tüübid ja nende graaf;
- Event Listi kirje;
- peatsükkel;
- Planneri ülesanded;
- parameetrite tabelid.

Teooria ja ülevaate osad jäid välja. Kus Claude joonist tõlgendas, on märge **[tõlgendus]**. [originaal.md](originaal.md) on kümnes osas. Skaneeringud on ainult autori kohalikus koopias.

**Plaan.** Plaani põhiotsused ([PLAAN.md](PLAAN.md)):

- HTML ja puhas JavaScript, Canvas, ilma build-sammu ja sõltuvusteta;
- moodulid originaali nimedega;
- protseduurid ja kirjed, mitte klassid;
- sündmused ahelloendis `FirstAtMoment`;
- aeg täisarvuliste sekundite kaupa;
- seemnega juhuarvud;
- mudel JSON-failina.

Autor lisas kaks soovi. Esiteks peab lisaks EGA välimusele olema kaasaegne välimus. Teiseks peab programm töötama veebiserverist.

**Valideeri enne teostust.** Autor ei mäletanud enam, kuidas puuduvad moodulid (Planner, `ProcEvents`, `FindBuf`) töötasid või pidid töötama. Kokkulepe: puuduv loogika mõeldakse välja üldtuntud võtete põhjal ja originaali arhitektuur kontrollitakse enne täisteostust läbi. Claude leidis dokumendist kuus riski:

- sündmus võib vahele jääda;
- võib tekkida ummik;
- sihtkoht võib täis olla;
- `Load`-sündmuses on kaks objekti;
- konveier seisab laadimise ajaks;
- Planner on kirjeldatud ainult kriteeriumidena.

Need said disaini lähteülesandeks.

**Mälu järgi lisandunud asjad.** Kaks asja tulid autori mälust:

- **Rajad.** Originaalis oli igal rajaikoonil oma pikkus. Sisestamine oli tüütu ja kõrvuti ikoonidel liikusid kärud eri kiirusega. Samas sai kauged kohad joonisele lähestikku panna, nagu metrookaardil. Uues versioonis arvutatakse rajavõrk ikoonidest ja pikkus tuleb mõõtkavast. Pikkust saab üle kirjutada terve lõigu kaupa, nii et metrookaardi efekt jääb alles.
- **Transpordirobotid.** Need olid kavas juba siis. Kirja läksid DISAIN.md osas 11 ja tehti etapis 7b.

**Nimed.** Muutujad ja protseduurid peavad olema inimloetavad ja näitama rolli. Kasutatakse originaali nimesid ja uued tehakse samas stiilis. Iga nime päisekommentaaris on päritolu tunnus:

- **[O]** originaal;
- **[T]** täpsustus;
- **[U]** uus.

Sõnastik on DISAIN.md osas 12.

**Kokkulepped kaovad.** Esimese vestluse lõpus ütles autor, et tal on olnud olukordi, kus kokkulepped lähevad kaduma, isegi kui `.md`-failid on olemas. Lahendus oli kolmeosaline:

- **`CLAUDE.md`**: lugemisjärjekord ja reeglid, mida iga uus vestlus kõigepealt loeb;
- **etapp = eraldi vestlus + eraldi commit**;
- **etapi lõpus kopeeritav prompt järgmise etapi jaoks.**

## Etapp 2 – prototüüp (12.11)

Minimaalne simulaator ilma graafikata, ainult ühe suletud pideva konveieriga ([test/proto/](test/proto/)). Kontrolliti kolmel viisil:

- **käsitsi arvutus**: ühe detaili tsükliaeg 440 s klappis sekundi täpsusega;
- **näidis-PTS joonise 5.5 järgi**;
- **stressitest ummiku esilekutsumiseks.**

Invariante kontrolliti **igal simulatsiooni sekundil**: detailid ei teki ega kao ja mahutavused ei ületa piire.

See etapp õigustas reeglit „valideeri enne teostust“. Ummiku käsitlus tuli ümber teha kolm korda:

1. **Valehäired.** Ummiku tuvastus ooteaja järgi andis valehäireid, sest pudelikaela taga ootamine on normaalne. See asendati tegeliku ummiku tuvastusega (püsipunkti arvutus).
2. **Parkimisest ei piisanud.** Ristmarsruutidel pargiti peaaegu iga detail ja süsteem jäi lõpuks kinni. Lisati ummiku vältimine: pink alustab alles siis, kui detaili järgmise pingi koht on broneeritud (`ReserveNextBeforeStart`).
3. **Uut tüüpi ummik.** Vältimine tõi sisse uut tüüpi ummiku, mistõttu laiendati tuvastust.

Planner sai lihtsa kuju, mis osutus töökindlaks: igal kutsel vaadatakse kogu süsteem üle (pingid → sihtkohad → sissetoomine). Prototüüp jäi muutmata võrdluseks. Hiljem kontrollib test, et tootekood annab sama tulemuse.

## Etapp 3 – karkass (12.11)

Selles etapis tehti:

- kaks välimust: **EGA** (640 × 350, 16 värvi, PxPlus IBM EGA 8×14 font) ja **kaasaegne** (hele / tume), vahetab `F2`;
- originaali peamenüü;
- DOS-stiilis avaekraan „TTÜ 1993 … valmis 2026“;
- andmemudel ja näidismudel JSON-ina.

Autor küsis kõrvalvestluses, kas töö jooksis kinni, sest samm „EGA fondi allalaadimine“ jäi pooleli. Ei jooksnud: font oli ammu kohal, samm oli lihtsalt tehtuks märkimata.

## Etapp 4 – täissimulaator (12.11)

Prototüübi loogika viidi muutmata kujul tootekoodi (`core/fms_sim.js`). Uus oli `Enumerate`, mis teeb joonise ruudustikust simulatsiooni võrgu. Kontroll: näidismudeli silmus tuli täpselt käsitsi arvutatud 2114,159 cm. Lisandusid ka originaali 8 andmekontrolli ja statistika.

Arutelu käigus tulid autorilt ideed kaasaegse välimuse animaatorile:

- Event List ekraanil ajateljena;
- pingi pilt muutub olekuga;
- puhvrite ja aluste seis on näha.

Need läksid etapi 5 plaani.

## Etapp 5 – animaator (12.11)

Kärud liiguvad radadel, pinkidel ja puhvritel on olekud. Kiirust saab muuta ×1…×1000. Saab liikuda sammu ja järgmise sündmuse kaupa. Autori soovil on kaasaegses välimuses nupud ja liugur, et kiirust saaks käigu pealt muuta. Event List on ekraanil kaartidena ja ka ahelloendina, nagu diplomitöö joonisel.

Animaator ainult loeb simulaatori olekut. Test kinnitas, et 4 h sammhaaval animeerimine annab sama aruande kui jooks lõpuni.

Algul tundus, et detailid jõuavad puhvrisse liiga aeglaselt. Kontroll näitas, et see on mudeli käitumine: konveier seisab iga laadimise ajal.

Samal õhtul küsis autor kõrvalvestluses, kas diplomitöö võrdlus 1980. aastate lõpu tootega PROMOD on pädev. Vastus: enamasti on, aga see võrdleb valmis toodet kavandiga, sest Planner oli 1993. aastal alles plaan.

## Etapp 6 – redaktor (12.–13.11)

- **6a Layout.** Rada joonistatakse lohistades ja õige ikoon valitakse ise. Põhitest: näidis-PTS joonistati tühjast ruudustikust redaktori operatsioonidega ja tulemuseks tuli sama mudel ning sama 8 h aruanne.
- **6b vormid.** Pinkide, puhvrite, raja, detailide ja marsruutide andmed ning vigade ja hoiatuste nimekiri.

Mõlemas osas leiti viga, mis tuleks hiljem kasutajal välja:

- raja ots muutus juurdejoonistamisel hargnemiseks, mitte kaareks;
- pärast pingi kustutamist ei saanud salvestatud mudelit enam avada.

Järgmisel hommikul tuli autori soov: Event Listi ajatelg peab näitama aega kujul h:mm:ss, mitte sekundites (`c30a18a`).

Töökorralduse õppetund: etappide 6 ja 7 vestlused alustati eelmisest vestlusest ja need jäid kõrvalaknas üksteise alla. Edaspidi alustas autor iga etappi „+ New“-ga ja Claude andis lõpus kopeeritava prompti. Selles etapis katkes töö esimest korda kasutuslimiidi tõttu ja jätkus järgmisel päeval.

## Etapp 7 – rajavõrk ja diskreetsed rajad (13.11)

Etapp oli nii suur, et see jagati kolmeks.

**7a – rajavõrgu graaf.** Tuli toetada mitut rada, konnektoreid ja avatud konveierit. Konnektor broneeritakse koos sihtkohaga kogu tee ajaks, et konnektorites ei tekiks ringootamist. Juba siis märgiti, et suurel koormusel võib see saada pudelikaelaks (vt 12b). Käsitsi arvutatud tsükliajad 625 s ja 683 s klappisid.

Lisandus sild (`CrossOver`): kaks rada ristuvad ilma ühenduseta.

Autor märkas katses, et suunaga puhvri kaudu liiguvad detailid kahes suunas. Põhjus oli originaali lugemises. Puhvri liik (`InBuf` ▲, `OutBuf` ▼) on **liikumissuund joonisel**, mitte roll pingi suhtes. Parandatud (`4a2c944`).

**7b – diskreetsed rajad.** Rada on teedevõrk: harud, ristmikud ja ühesuunalised lõigud. Kärudel on tsoonid ja plokid, kasutusel on `ProgTM`, `FindPal` ja `Collision`, ümbersõit ja kõrvalepõige. Autori küsimus, kas saab teha möödasõiduradu, muutis ploki definitsiooni: käru ootab lõigu lõpus, mitte sõlmes. Koormusega testid leidsid kuus olukorda, kus kärud jäid kinni või ringlesid lõputult. Kõik said lahenduse või selge ummikuteate.

Struktuuri kohta tehti järeldus: kahesuunalisel ringil ilma möödumiskohtadeta saab hakkama kuni kahe käruga. Kolme ja enama käru korral on vaja suunanooli või möödasõiduradu.

Lisandusid paralleelsed konnektorid. Autor tahtis tulemust oma silmaga näha, nii tekkis näidis **Näidis-AGV**.

**7c – mitu detaili alusel.** Muudatused:

- alusel on kohad;
- jaamas tehakse mitu peale- ja mahalaadimist;
- käru teeb kogumissõidu.

Originaali valem `Kl` loeb transpordil olevaid kohti. Mitme kohaga kasvas tsükliaeg, aga läbilaskevõime mitte. **Autori otsus:** valem loeb aluste arvu.

Selle etapi lõpus tehti oluline otsus: **versioon 1.0 on omaaegne lahendus valmis kujul.** Sellel on originaali menüüd, vormid ja EGA välimus. Kaasaegne ja mugav liides ning Adviser tulevad versioonis 2.0, mis algab aruteluga. Autor lisas ka 1993. aasta idee, mis dokumenti ei jõudnud: **iseõppiv Adviser**. Simulatsioonide tulemuste põhjal häälestatakse Adviseri kaalutabelid. Tookord tundus see revolutsioon (`0bd478b`).

## Etapp 8 – rikked ja juhuslikkus (13.11)

Selles etapis tehti:

- tööpingi rike töötlemise ajal (`Crash`), remont (`Repair`) ja praak SysOut-i;
- rikete vahe eksponentjaotusega ja igal pingil oma juhuarvujada;
- kestuse jaotus ühtlane, kolmnurkne või normaalne.

Autor küsis, mille jaoks SysOut on, sest ise ta seda enam ei mäletanud.

Rikete test leidis vana vea, mis oli olnud ka prototüübis: kui konveier peatus ja teine alus jõudis samal sekundil täpselt jaama, sõitis see jaamast mööda. **Autori otsus:** parandus jääb. Võrdlus prototüübiga lubab nüüd kuni 1 % lühemat tsükliaega.

## Etapp 9 – aruanded (13.11)

Menüüs Report on kolm vaadet:

- **Static**: algne seis ja lõppseis;
- **Dynamic**: tsükliaeg ja selle osad, tüüpide kaupa, aegrida graafikuga, sündmused;
- **Output**: ekraanile või tekstifaili.

Autori valikud: Static näitab mõlemat seisu, CSV-d ei tehta, kokkuvõttes on nupp „Aruanne“.

Aegrea graafik näitas algul detailide arvu süsteemis. Kuna `Kl` hoiab selle arvu peaaegu konstantsena, oli graafik kasutu. Nüüd näitab see valmis detaile kokku.

## Etapp 10 – avaldamine, versioon 1.0 (13.11)

Tehti avaleht koos lühijuhendiga, rakendus aadressil `/v1/` (kood tag'ist, näidismudelid `main`-ist) ja GitHub Pages'i töövoog. Näidiste nimekiri viidi koodist faili `models/index.json`, et hilisemad näidised ilmuksid ka külmutatud versioonis.

**Litsents.** Autor ei tahtnud MIT-litsentsi, sest töö oli suures osas tema mõttetöö tulemus. Kehtib: kõik õigused kaitstud, lähtekood avalik tutvumiseks.

**Ajaloo puhastus.** Skaneeringud ja `CLAUDE.md` eemaldati ajaloost enne esimest pushi (`git filter-branch`, varukoopiaga). Repo maht langes 59 MB-lt 354 KB-le.

Avalik repo `karelkan/fmss` ja sait https://karelkan.github.io/fmss/ läksid veebi tag'iga `v1.0`. Esimene töövoo käivitus kukkus, sest Pages polnud veel sisse lülitatud.

Samas vestluses planeeris autor veel kaks etappi:

- **11**: suured realistlikud näidismudelid, mis tarkvara versiooni ei muuda;
- **12**: diplomitööga sarnane dokumentatsioon.

## Etapp 11 – suured mudelid ja versioonid 1.1–1.4 (13.–14.11)

**11a – kerimine ja suum (1.1).** Enne mudelite tegemist meenus autorile, et originaalis sai suurt mudelit ekraanil kerida. Väljatrükk oli varane ja seda seal polnud. Nüüd kerib EGA animaator ning kaasaegne kahandab ja suumib. Mudelid tulid alles pärast seda.

**11b – ümardusviga (1.2).** Esimene suur mudel (Kinnitustehas) katkes veidi üle tunni simulatsiooniaja möödudes erindiga. Põhjus: `ShortestPaths` ümardas aega igal sammul. Seetõttu tuli tee vahejaama kaudu 0,001 s „kiirem“ ja teele sattus kaks sõitu samal rajal. Väikestes testides sellist arvude kombinatsiooni ei tekkinud. Parandus on `PATH_TIME_EPSILON`, lisaks test.

**11c – kolm suurt näidist (1.3).** Mudelid on tehtud avalike lugude põhjal, tööajad on enamasti hinnatud:

- **Kinnitustehas**: 16 pinki, poldid ja mutrid;
- **Allhanketehas**: 15 pinki, 3 konveierit konnektoritega;
- **Reduktori FMS**: 12 pinki, 4 AGV-d, rikked.

Kontrolliti käsitsi arvutatud ülempiiriga ja kitsaskohad olid usutavad:

- kinnitustehases konveier, mis seisab iga laadimise ajal;
- allhankes väikeste partiide häälestus;
- reduktoritootmises korpuse töötlus.

Mudelid leidsid veel kaks asja:

- **EGA kokkuvõte ei mahtunud ekraanile.** Parandati versioonis 1.3.
- **Detaili väli „partii“ ei mõjutanud simulatsiooni.** Sellest tuli hiljem etapp 11d.

Autor nägi Claude'i järeldustes kitsaskohtade kohta seda, milleks süsteem kunagi loodi. Nii tekkis versiooni 2 Claude'i nõustaja idee.

**11d – lõpurežiim (1.4).** Autor küsis, mis tingimustel simulatsioon lõpeb, sest detailid jäid lõpus liinile, pinkidesse ja puhvritesse. Originaal lõpu tingimust ei määranud. Arutelu tulemusel tuli viis režiimi ja nimed andis autor:

- **A – Kellani**;
- **B – Kellani ja pink tühi**;
- **C – Kellani ja liin tühi**;
- **D – Tehas tühjaks**;
- **E – Partiid lõpuni** (tellimus, tulemus on makespan).

Lisaks tehti tüüpide järjekord Segamini / Partii järjest, mis on originaali reegel II.2. Otsuste tabel on PLAAN.md-s ja disain DISAIN.md osas 20.

Leid: partii järjest vähendab häälestust, aga makespan kasvab. Selle põhjus on, et pingid jäävad tasakaalust välja.

Samas etapis eemaldati tiitellehe andmetest konsultandi rida, sest tal polnud tööga seost. Avalehele lisati juhend, kuidas lõpurežiimi valida. Töö katkes korra limiidi tõttu ja pooleli jäänud otsus pandi enne katkestust promptina kirja.

## Etapp 12 – dokumentatsioon ja versioon 1.5 (14.–15.11)

**Dokumentatsioon.** Saidil `/doc/` on diplomitööga sarnane dokument, mida saab printida PDF-iks. Selles on:

- teooria koos täiendustega, mis on märgitud [O]/[T]/[U] järgi;
- arhitektuur käsitsi tehtud SVG-joonistega;
- kirjed, EventHandlerid ja sõnastik;
- valideerimine ja näidismudelid.

**Autori otsus:** dokument on käsitsi kirjutatud ja test `test/doc.test.js` hoiab selle koodiga kooskõlas. Mudelite joonised teeb skript `tools/layout_svg.js`. Dokumendis on kirjas, et tarkvara ja dokumentatsioon on arendatud koos Claude'iga.

**12b – Mootoriosade tehas (1.5).** Autor tahtis jooksutada tõeliselt keerukat mudelit. Kaaluti ka linna bussivõrku ja Eesti raudteevõrku, aga valiti tehas: 32 pinki, neli osakonda, 11 konnektorit, 16 tüüpi.

Läbilaskevõime oli algul 4 tk/h. Kitsaskohti otsiti mõõtmise teel, iga muudatuse järel:

- **puhvrite suurendamine ja `Kl` muutmine** ei aidanud;
- **konnektorid olid 100 % kinni.** Põhjus oli broneering kogu tee ajaks, mis oli 7a teadaolev piirang. Lahendus: paralleelsed konnektorid;
- **viimistluse konveier oli liiga aeglane.** Lahendus: kiiremad konveierid ja rohkem aluseid.

Tulemus: 19,8 tk/h. Ka siin ei mahtunud EGA kokkuvõte ekraanile. Parandus: konnektorite kohta üks koondrida, kusjuures varasemate näidiste kokkuvõte jäi bitt-täpselt samaks.

**Dokumentatsioon 1.1 (15.11).** Autor märkas, et Planner on arhitektuuri keskne osa, aga dokumendis oli see kirjeldatud lühidalt. Originaalis oli sellest mitu lehekülge teooriat. Juurde tuli peatükk 6 „Planner“:

- operatiivjuhtimise teooria;
- originaali reeglid;
- vastavus;
- realisatsioon pseudokoodina;
- näide logist.

Kirjutamise käigus selgus, et osa originaali valikureegleid on tegemata ja DISAIN.md kirjeldas marsruudi valikut valesti. Tegemata reeglid dokumenteeriti ausalt ja viga parandati.

**Autori otsus:** versiooni 1 enam ei arendata. Viimane tarkvara on 1.5, dokumentatsioon 1.1 kirjeldab seda ja edasine töö läheb versiooni 2.

## Mis puudus originaalist ja kuidas see välja mõeldi

| Originaalis | Lahendus | Kus |
|---|---|---|
| sündmus võis peatsüklis vahele jääda | järjekord `Inc` → `MinuteMan` → sündmused, `GetEvent` võtab `Time ≤ SYSTEM_TIME` | DISAIN.md 1, etapp 2 |
| ummiku käsitlust polnud | vältimine (`ReserveNextBeforeStart`), tegeliku ummiku tuvastus, parkimine kesklattu | DISAIN.md 3.3, 5.3 |
| polnud kirjas, mis saab, kui sihtkoht on täis | sihtkoht ja konnektorid broneeritakse enne teeleminekut | DISAIN.md 2.3 |
| igal rajaikoonil oma pikkus | võrk arvutatakse ikoonidest, pikkus tuleb mõõtkavast, metrookaardi lõik | DISAIN.md 2.1 |
| Planner kirjeldatud ainult kriteeriumidena | täielik ülevaatus igal kutsel, 7 kutsepõhjust, leksikograafilised võtmed | DISAIN.md 5.2, dok peatükk 6 |
| transpordirobotid ainult ideena | teedevõrk, tsoonid ja plokid, `Collision`, ümbersõit | DISAIN.md 11 |
| üks rada | mitu rada, konnektorid, avatud konveier, sild | DISAIN.md 2.3 |
| `Kl` loeb kohti transpordil | `Kl` loeb aluseid (autori otsus) | etapp 7c |
| lõpu tingimust polnud, „partii“ oli kasutuseta | lõpurežiim ja tellimus, Partii järjest | DISAIN.md 20 |

## Mida töö käigus õpiti

**Mis toimis:**

- **Valideeri enne teostust.** Prototüüp, invariandid igal sekundil, käsitsi arvutatud ajad ja võrdlus muutmata prototüübiga leidsid vead varakult. Ummiku käsitlus tehti prototüübis ümber kolm korda, mitte tootekoodis.
- **Suured realistlikud mudelid** leidsid asju, mida väikesed testid ei leidnud:
  - ümardusviga;
  - kokkuvõtte mahtumine ekraanile;
  - kasutuseta partii väli;
  - konnektori broneeringu piirang.
- **Kõigepealt ettepanek, siis otsus, siis teostus.** Sisulised valikud jäid autorile, näiteks `Kl` valem, lõpurežiimide nimed ja litsents.
- **Autori mälu täiendas paberit.** Kerimine, transpordirobotid, metrookaart ja iseõppiv Adviser tulid mälust, mitte väljatrükist.
- **Päritolu tunnused [O]/[T]/[U]** näitavad koodis ja dokumendis, mis on originaalist ja mis on uus.

**Mis ei toiminud ja kuidas parandati:**

- **Kokkulepped kadusid vestluste vahel.** Parandati `CLAUDE.md`-ga, etapi lõpu promptiga ja Claude'i mäluga.
- **Vestlused jäid ahelasse.** Edaspidi alustati iga etappi „+ New“-ga.
- **Limiit katkestas tööd.** Pooleli olev otsus pandi enne katkestust kirja (PLAAN.md, prompt).
- **Dokument ja kood võivad lahkneda.** Parandati testiga `test/doc.test.js`. Planneri kirjelduse viga leiti alles käsitsi lugedes (dok 1.1).

## Arvudes

| | |
|---|---|
| aeg | 10.11 kirjeldus mälu järgi; töö 12.11 õhtust 14.11 õhtuni, dokumentatsioon 1.1 15.11 |
| vestlusi | 17: 14 etapivestlust ja 3 kõrvalvestlust |
| commiteid | 37 (etappidest 0–12) |
| versioone | 1.0–1.5, tag'id `v1.0`…`v1.5` |
| koodi (v1.5) | rakendus 11 083 rida JS-i, testid 4015 rida, prototüüp 1216 rida |
| teste | 224 |
| näidismudeleid | 7 (2…32 pinki) |
| dokumentatsioon | 11 peatükki, umbes 3000 rida HTML-i |
| originaal | 8 peatükki, 63 lehekülge skaneeritud väljatrükki |
