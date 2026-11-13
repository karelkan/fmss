# Teostusplaan

Eesmärk: FMSS-i uus versioon brauseris, staatilise veebilehena (saab avada näiteks GitHub Pages'ist). Hoiame originaali vaimu ja ülesehitust ([originaal.md](originaal.md)), aga puuduvad ja nõrgad kohad mõtleme välja üldtuntud diskreetsündmuste simulatsiooni võtete abil. Enne täisteostust valideerime loogika prototüübiga.

## Põhiotsused

| Teema | Otsus |
|---|---|
| Keel ja keskkond | HTML + puhas JavaScript (ES moodulid), Canvas. Build-sammu ega sõltuvusi pole. |
| Käivitamine | Ainult staatilised failid. Kohalikult `python3 -m http.server`, avalikult GitHub Pages. |
| Ülesehitus | Moodulid originaali nimedega (`fms_glb.js`, `fms_sim.js`, `fms_ed.js`, `fms_file.js`, `fms_rep.js`, `anima.js`, `fms_lng.js`). Protseduurid ja kirjed (lihtsad objektid), klasse ei kasuta. |
| Sündmuste nimekiri | Ahelloend `FirstAtMoment`, protseduurid `PutEvent` / `GetEvent`. |
| Aeg | `SYSTEM_TIME` liigub täisarvuliste sekundite kaupa (time mapping), nagu originaalis. Kiirus ×1…×1000 või maksimumkiirus ilma animatsioonita. |
| Juhuslikkus | Seemnega juhuarvugeneraator, nii et katse on korratav. |
| Rajavõrk | Ikoonid on ainult joonis. Rajavõrk (sõlmed + lõigud) arvutatakse ikoonidest. Pikkus tuleb mõõtkavast ja seda saab üle kirjutada terve lõigu kaupa (metrokaardi efekt jääb). Rada joonistatakse hiirega lohistades, õige ikoon valitakse automaatselt. |
| Välimus | Kaks vahetatavat teemat: **EGA** (640×350, 16 värvi, pikslifont) ja **kaasaegne** (vektor, HiDPI, hele/tume). Simulaator ei sõltu joonistamisest. |
| Mudelifail | JSON (`*.fms.json`), alla- ja üleslaadimine. Kasutaja mudelid jäävad tema brauserisse. Näidismudelid tulevad kaasa. |
| Keel | Eesti keel, tekstid failis `fms_lng.js` (nagu originaali `FMS_LNG.INC`). |
| Testid | `node --test` simulaatori tuumale, töötab ilma brauserita. |

## Etapid (versioon 1.0)

Iga etapp on eraldi vestlus ja eraldi commit. README „Seis“ uueneb etapi lõpus.

Versioon 1.0 on **omaaegne lahendus valmis kujul** (originaali menüüd, vormid ja EGA välimus koos kaasaegsega) – see näidatakse juhendajale. Suuremaid liidese muudatusi 1.0-s ei tehta; ideed kirjutatakse üles versiooni 2.0 jaoks.

1. **Simulatsiooniloogika disain** – [DISAIN.md](DISAIN.md): objektide olekumasinad, sündmuste täpne tähendus, Planneri reeglid, aja käsitlus, ummikute vältimine, rajavõrk, andmemudel. Iga otsus on märgitud: originaal / täpsustus / uus.
2. **Prototüüp ja valideerimine** – minimaalne simulaator ilma graafikata (ainult pidevad konveierid) ja teststsenaariumid:
   - analüütiline kontroll (üks tööpink, kindlad ajad – tulemus peab klappima käsitsi arvutusega);
   - näidis-PTS (joon. 5.5);
   - stressitest ummiku esilekutsumiseks;
   - invariandid igal sammul: detailid ei teki ega kao, ühel kohal on üks detail, aeg ei liigu tagasi, ükski sündmus ei jää töötlemata.

   Kui loogika ei pea, parandame disaini ja alles siis läheme edasi.
3. **Karkass** – `index.html`, teemade süsteem (EGA / kaasaegne, F2), peamenüü (File Edit Advise Simulate Report Options Quit), DOS-stiilis avaekraan („TTÜ 1993 … valmis 2026“), andmemudel, näidismudel JSON-ina.
4. **Täissimulaator** – prototüübist tootekood: kõik EventHandlerid, Planner, statistika kogumine; `Enumerate` (ruudustikust simulatsiooni võrk) ja andmekontroll. Ulatus: üks suletud pidev konveier.
5. **Animaator** – ikoonid, kärud radadel, tööpinkide ja puhvrite olekud, `SimStatus`, start/paus/kiirus, sammurežiim („järgmine sündmus“). Ainult kaasaegses välimuses (EGA jääb originaalilähedaseks):
   - **Event List ekraanil** – riba all, ajatelg alates `SYSTEM_TIME`-st: sündmused kaartidena (tüübi värv, nt `Load WP12`), sama aja sündmused virnas FIFO järjekorras; lisandunud sündmus libiseb kohale, töödeldu kaob. Kaardile osutades tõstetakse esile seotud pink / alus / detail. Lisavaatena ahelloend (kastid ja `Next`-nooled nagu diplomitöös). Suurel kiirusel ainult sündmuste arv. Animaator loeb `FirstAtMoment`-i ja võrdleb eelmise kaadriga – simulaatorit ei muudeta.
   - **Tööpingi pilt muutub olekuga** – laadimine, häälestus, töötlemine (liikuv pilt, nt pöörlev spindel), mahalaadimine, jõude; hiljem rike (etapp 8).
   - **Kõigi objektide seis on näha**:
     - **puhver**: kohad eraldi lahtritena – detail sees (tüübi värv, sissetulev / väljaminev), broneeritud (kontuur), vaba;
     - **alus / käru**: tühi, detailiga või broneeritud; laadimise ajal liigub detail jaama ja aluse vahel;
     - **konveier**: liigub või seisab (ja miks: mitu laadimist käib);
     - **FromCS**: ootavate detailide järjekord; **ToCS**: täituvus (valmis + pargitud + varu); **SysOut**: lahkunute arv;
     - ummikus olevad detailid ja pargitud detailid on esile tõstetud.
6. **Redaktor** – Layout (lohistamisega rajad, automaatne ikoonivalik), View, Config, Transport, Workpiece data, Storage data, andmekontrollid ja hoiatused.
7. **Diskreetsed rajad** – AGV-d ja robotid, `ProgTM`, `Collision`, konfliktide lahendamine; rajavõrgu graaf, mis toob ka mitu rada, konnektorid ja avatud konveieri.
8. **Rikked ja juhuslikkus** – `Crash`, remondiaeg, praak, kestuste kõrvalekalded.
9. **Aruanded** – Static, Dynamic, tsükliaeg ja osakaalud, ekraanile või faili.
10. **Avaldamine** – GitHub Pages, demomudel ja lühijuhend juhendajale näitamiseks. 1.0 lõpus git-tag `v1.0`; 1.0 jääb veebis eraldi aadressile (`/v1/`), et seda saaks alati näidata. Avaleht ja lühijuhend on saidi juures (`/`); kood tuleb tag'ist, näidismudelid `main`-ist ([DISAIN.md](DISAIN.md) osa 19).

## Pärast 1.0 (versioon ei muutu)

*11a.* **Kerimine ja suum – versioon 1.1** (lisandus etapi 11 alguses): suured mudelid ei mahtunud EGA animaatorisse; autori mälestuse järgi oli originaalis kerimine. Animaator kerib (EGA) ja suumib (kaasaegne), redaktoris kaasaegne suum. `/v1/` võtab koodi tag'ist `v1.1` ([DISAIN.md](DISAIN.md) osa 14, 19). Mudelifaili vorming ei muutu.

*11b.* **Parandus – versioon 1.2**: suur mudel paljastas teede arvutuse ümardusvea (`ShortestPaths`); parandus ja test, tag `v1.2`. *11c* – mudelid.

11. **Näidismudelid** – 2–3 suurt ja tõsiseltvõetavat tootmissüsteemi (10 või enam tööpinki), mille taust tuleb avalikest allikatest. Näiteks kruvide ja mutrite tootmine (külmpressimine, keermerullimine, termotöötlus, pinnakate, kontroll); Eestis toodetava toote detailid (metallitöötluse allhange, mitu tüüpi ja väikesed partiid); klassikaline FMS (reduktori võllid, hammasrattad, korpus) AGV-de ja riketega. Simulaatoris pole koostamist, seega sobivad mehaanilise töötlemise süsteemid. Mudelid lähevad kausta `models/` ja nimekirja `models/index.json`, nii et need ilmuvad ka `/v1/`-s ilma koodi muutmata. Tööaegade ja muude andmete allikad kirjutatakse VALIDEERIMINE.md-sse; iga mudel jookseb testis 8 h ilma ummikuta.
12. **Dokumentatsioon** – diplomitööga sarnane dokument: **teooria** (diskreetne simulatsioon, PTS-i kontseptsioon, tsükliaeg) koos täiendustega, mis on märgitud [O]/[T]/[U] järgi (rajavõrgu graaf, ummikute vältimine, AGV-d ja `Collision`, mitu kohta alusel, rikked ja jaotused); **tarkvara arhitektuur** diagrammide ja skeemidega (moodulid, sündmuste ahelloend, olekumasinad, Planner, andmevoog mudel → `Enumerate` → simulaator → animaator ja aruanne); **loetelud** – olulised andmeobjektid (kirjed), protseduurid ja EventHandlerid (DISAIN.md sõnastiku põhjal); valideerimine ja näidismudelid. Vorming ja diagrammide tööriist otsustatakse etapi alguses.

Kui etapp 3 on valmis, saab etappe 4 ja 6 teha paralleelselt.

## Versioon 2.0

Pärast 1.0 valmimist. Eesmärk: **kaasaegne ja mugav kasutajaliides**; EGA välimusest ja selle piirangutest (640 × 350, originaali menüüd ja vormid) loobutakse.

- **Simulaator jääb**: `fms_sim.js` ei sõltu joonistamisest ja mudelifail (JSON) jääb ühilduvaks – 1.0 mudelid avanevad 2.0-s. 1.0 testid kehtivad edasi, nii et 2.0 tulemused peavad klappima 1.0-ga.
- **Veebis** aadressil `/v2/` (tag `v2.0`), 1.0 jääb `/v1/`-le. Brauseri mälu on samal originil ühine: 2.0 kasutab oma `localStorage` võtmeid (1.0-l `fmss.recent`, `fmss.options`) – vt [DISAIN.md](DISAIN.md) osa 19.
- **Algab diskussiooniga** – enne teostust:
  1. arutelu: mis on 1.0 liideses ebamugav (menüüstruktuur, tööpinkide, detailide ja marsruutide sisestamine jm) ja kuidas seda tänapäeval tehakse;
  2. näidised ja ideed (sarnased tööriistad, maketid, prototüübid), nende ülevaatus;
  3. spetsifikatsiooni täpsustamine nende põhjal;
  4. kasutaja **kinnitab** spetsifikatsiooni – alles siis läheb teostusse (etappideks jaotatult nagu 1.0-s).
- **Adviser** (originaali osa: LayoutChooser, LayoutFinder, kaalutabelid) tehakse 2.0-s, uue liidese peal.
- **Ideed etapist 8** (1.0-s tegemata): transpordi (käru, konveier), puhvri ja konnektori rike (originaali tabel 4.5); kvaliteedipraak (tõenäosus operatsiooni kohta); rike ka jõudeolekus (kalendriaeg); laadimis- ja häälestusaegade kõrvalekalded.
- **Iseõppiv Adviser** – autori tollane idee, dokumentatsiooni ei jõudnud (originaalis lk 65 on jätkuna mainitud Adviseri täiustamine ekspertsüsteemiga): kaalutabeleid ei anta ainult käsitsi, vaid häälestatakse simulatsioonide tulemuste põhjal. Ring: Adviser soovitab struktuuri kaalude järgi → simulaator jooksutab selle ja teised variandid läbi (eri koormused, seemned) → tulemusi võrreldakse (läbilaskevõime, tsükliaeg, rakendatus, ummikud) → kaale korrigeeritakse nii, et Adviseri järjestus läheneks simulatsiooni omale. Tänapäeval: simulatsioonipõhine optimeerimine, metamudelid (*surrogate models*), järjestuse õppimine (*learning to rank*). Eeldused on olemas: simulaator on deterministlik (seeme), kiire (8 h alla sekundi) ega sõltu liidesest; aruande näitajad tulevad `SimReport`-ist (etapp 9 – ka faili).
  Arutelu küsimused: kas kaalud õpitakse kasutaja mudelite või ette genereeritud variantide põhjal; kuidas õpitud kaalud kasutajale lahti seletada.
