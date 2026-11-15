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

*11b.* **Parandus – versioon 1.2**: suur mudel paljastas teede arvutuse ümardusvea (`ShortestPaths`); parandus ja test, tag `v1.2`. *11c* – mudelid; nendega leitud EGA kokkuvõtte viga parandati versioonis 1.3.

*11d.* **Simulatsiooni lõpp – versioon 1.4** (kasutaja otsus 2026-11-13). Praegu lõpeb simulatsioon ainult kestuse (`Sim.Duration`) täitumisel või lahendamatu ummiku korral ning detailid jäävad süsteemi (rajale, pinkidesse, puhvritesse). Originaal lõpu tingimust ei määranud (ainult `SIMULATION_DONE`), aga Planneril oli sissetoomise reegel „partiidena“ (originaal.md osa 7, I.6) ja detailil „partii suurus“ – seda pole tehtud (VALIDEERIMINE.md 11c leid 2: `Batch` ei mõjuta midagi).

**Otsus (kasutajaga läbi arutatud 2026-11-14): lõpurežiim `Sim.EndMode`, viis varianti.** „Sisend“ on kaks asja: allikas (Planner loob `Kl` järgi uusi detaile – lõpmatu) ja FromCS-i järjekord (loodud, veel pinkidesse jõudmata detailid; sinna tulevad ka pargitud). T = `Sim.Duration`.

| | `Sim.EndMode` | Nimi liideses | Sisestamine kuni T | Sisestamine pärast T | FromCS järjekord ja pargitud | Pinkides | Transport | Lõpeb | Kestab pärast T |
|---|---|---|---|---|---|---|---|---|---|
| A | `Time` (vaikimisi) | **Kellani** | `Kl` järgi | – | jäävad | seisab poolelt | seisab | kell T | 0 |
| B | `FinishOps` | **Kellani ja pink tühi** | `Kl` järgi | ei | jäävad | alustatud töö (laadimine, häälestus, töötlemine) lõpetatakse, detail puhvrisse; uut ei alustata | seisab | kui pingid on tühjad | minutid |
| C | `Ship` | **Kellani ja liin tühi** | `Kl` järgi | ei | jäävad | nagu B | alustatud sõidud lõpetatakse, valmis detailid lattu / välja; pooleli jäävad puhvritesse | kui pingid ja liin on tühjad ja valmis detaile pole väljas | minutid |
| D | `Drain` | **Tehas tühjaks** | `Kl` järgi | ei | tehakse lõpuni | kõik lõpuni | käib | kui süsteem on tühi | tunnid |
| E | `Order` | **Partiid lõpuni** | `Kl` järgi, kuni tellitud kogus (igast tüübist `Batch` tükki, originaali reegel I.6) on sees | – (T on ülempiir) | tehakse lõpuni | kõik lõpuni | käib | kui kogus on tehtud ja süsteem tühi | – |

- **E järjekord** `Sim.OrderSequence`: `Mixed` – **Segamini** (vähim alustatud tüüp, nagu praegu) / `Batch` – **Partii järjest** (üks tüüp korraga, originaali reegel II.2; vähem häälestust – 11c leid 2). Kui T saabub enne lõppu, käitub nagu A ja kokkuvõte ütleb „tellimus jäi pooleli: valmis n / N“. Tulemus on tellimuse täitmise aeg (makespan); hea küsimus ka 2.0 Claude'i nõustajale (partiide järjekord).
- **Põhjendused**: B on alati võimalik ilma ummikuta – pink alustab ainult broneeritud väljumiskohaga (DISAIN.md 3.3). C-s peab transport käima, muidu sõidaks alusel olev detail igavesti; C sisaldab B-d. D-s tehakse lõpuni ka FromCS-is ootavad (kõik, mis sisse tuli, tuleb välja). D ja E vajavad ülempiiri (nt veel `Duration` või seisu tuvastus `StallTime`); ummiku tuvastus töötab edasi.
- **Statistika**: läbilaskevõime ja rakendatus perioodi 0…T järgi (tühjenemine ei tohi neid langetada); eraldi rida „lõpetamine kestis X, lisaks valmis n“. Tsükliaeg on B–E korral ausam (A-s jäävad pikad pooleli detailid välja).
- **Liides**: Model data vormis valik (nimed ≤ 20 märki EGA vormi jaoks) ja E järjekord; animaatori olekurida pärast T „lõpetab“; kokkuvõttes ja aruandes lõpurežiim ja lõpetamise rida.
- **Ühilduvus**: vaikimisi `Time` – vanad mudelid ja testid annavad sama tulemuse (`MODEL_VERSION` jääb 1, uued väljad on valikulised).
- Enne teostust ettepanek: kas B „alustatud töö“ hõlmab laadimist ja häälestust (ettepanek: jah), D ja E ülempiir, `Batch` vormis ja aruandes kogusena.
- **Tehtud (2026-11-14)**, ettepaneku otsused: B hõlmab laadimist ja häälestust; ülempiir B–D 2T (uut välja pole), E-s T; C-s võtab juba teel olev käru pooleli detaili peale; Partii järjest kehtib kõigis režiimides (ringiratast); `Batch` 0 = tüüpi ei toodeta; Allhanketehas on tellimus. Leid: partii järjest vähendab häälestust, aga makespan kasvab (VALIDEERIMINE.md 11d). [DISAIN.md](DISAIN.md) osa 20.

*12b.* **Suurim näidis – versioon 1.5** (kasutaja soov pärast etappi 12): Mootoriosade tehas, 32 pinki neljas osakonnas, 11 konnektorit, 16 tüüpi. Leiti, et konnektori broneering kogu tee ajaks on suures mudelis peamine kitsaskoht (lahendus mudelis: paralleelsed konnektorid), ja et EGA kokkuvõte ei mahtunud ekraanile – parandatud (koondrida), tag `v1.5`. [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 12b.

11. **Näidismudelid** – 2–3 suurt ja tõsiseltvõetavat tootmissüsteemi (10 või enam tööpinki), mille taust tuleb avalikest allikatest. Näiteks kruvide ja mutrite tootmine (külmpressimine, keermerullimine, termotöötlus, pinnakate, kontroll); Eestis toodetava toote detailid (metallitöötluse allhange, mitu tüüpi ja väikesed partiid); klassikaline FMS (reduktori võllid, hammasrattad, korpus) AGV-de ja riketega. Simulaatoris pole koostamist, seega sobivad mehaanilise töötlemise süsteemid. Mudelid lähevad kausta `models/` ja nimekirja `models/index.json`, nii et need ilmuvad ka `/v1/`-s ilma koodi muutmata. Tööaegade ja muude andmete allikad kirjutatakse VALIDEERIMINE.md-sse; iga mudel jookseb testis 8 h ilma ummikuta.
12. **Dokumentatsioon** – diplomitööga sarnane dokument: **teooria** (diskreetne simulatsioon, PTS-i kontseptsioon, tsükliaeg) koos täiendustega, mis on märgitud [O]/[T]/[U] järgi (rajavõrgu graaf, ummikute vältimine, AGV-d ja `Collision`, mitu kohta alusel, rikked ja jaotused); **tarkvara arhitektuur** diagrammide ja skeemidega (moodulid, sündmuste ahelloend, olekumasinad, Planner, andmevoog mudel → `Enumerate` → simulaator → animaator ja aruanne); **loetelud** – olulised andmeobjektid (kirjed), protseduurid ja EventHandlerid (DISAIN.md sõnastiku põhjal); valideerimine ja näidismudelid. Vorming ja diagrammide tööriist otsustatakse etapi alguses.
    - **Tehtud (2026-11-14)**, otsused: üks HTML-leht saidil `/doc/` (avalehe stiilis, prinditav PDF-iks), joonised käsitsi SVG-na (mudelite paigutus `tools/layout_svg.js`), ekraanipildid; dokument on käsitsi kirjutatud ja test `test/doc.test.js` hoiab selle sõnastiku, EventHandlerite, mudelite ja versiooniga kooskõlas; dokumendis on kirjas, et tarkvara ja dokumentatsioon on arendatud koos Claude'iga. [DISAIN.md](DISAIN.md) osa 21.

Kui etapp 3 on valmis, saab etappe 4 ja 6 teha paralleelselt.

## Versioon 2.0

Versiooni 1 enam ei arendata (viimane tarkvaraversioon 1.5, kasutaja otsus 2026-11-15). Versiooni 2 plaan, otsused, etapid ja ootel tööd: **[PLAAN_TOOD_V2.md](PLAAN_TOOD_V2.md)**; disaini muudatused: [DISAIN_V2.md](DISAIN_V2.md). Siin varem olnud algsed ideed (simulaator jääb, `/v2/`, arutelu enne teostust, Adviser, Claude'i nõustaja, etapi 8 ideed, iseõppiv Adviser) on seal – osad 1, 4.8, 4.9, 5 ja ootel tööd T-9…T-12, T-16.
