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

## Etapid

Iga etapp on eraldi vestlus ja eraldi commit. README „Seis“ uueneb etapi lõpus.

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
10. **Avaldamine** – GitHub Pages, demomudel ja lühijuhend juhendajale näitamiseks.
11. **Adviser** (hilisem) – LayoutChooser, LayoutFinder, kaalutabelid.

Kui etapp 3 on valmis, saab etappe 4 ja 6 teha paralleelselt.
