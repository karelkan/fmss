# Versioon 2 – plaan ja ootel tööd

V2 etapp 1 (arutelu, 2026-11-14). Alus: [PLAAN.md](PLAAN.md) „Versioon 2.0“, dokumentatsiooni peatükk 10 (`site/doc/`), [VALIDEERIMINE.md](VALIDEERIMINE.md) 11c–12b. Siin on kokku lepitud **suund, otsused ja etapid**. Liidese üksikasjad kinnitatakse maketi põhjal (etapp 2) ja iga etapi alguses pildi põhjal (osa 6).

## 1. Eesmärk

- **Kaasaegne ja mugav liides.** EGA välimusest ja selle piirangutest (640 × 350, menüüpuu, vormid, nimed ≤ 20 ja read ≤ 74 märki, ruudustik ≤ 41 × 23) loobutakse.
- **Elu käib ühe ekraani ümber**: joonis on alati ees, andmed ja tulemused on selle kõrval, mitte menüüde taga.
- **Arusaadav**: inimene peab nägema, mis tehases toimub – kus midagi tehakse, kuhu detail liigub ja miks miski ootab. Statistikaks pilti vaja pole, aga mõistmiseks on.
- **Simulaator jääb**: `core/fms_sim.js` on ühine, mudelifail jääb ühilduvaks, 1.x testid kehtivad ja tulemused klapivad. `/v1/` jääb veebi.

## 2. Otsused (kinnitatud 2026-11-14)

| # | Teema | Otsus |
|---|---|---|
| 1 | Koodi paigutus | sama haru `main`, uus kaust `v2/`; ühised moodulid kaustas `core/` (`fms_sim.js`, `fms_glb.js`, `fms_lng.js`), versioon 1 kaustas `v1/` (ümberkorraldus 2026-11-14). Eraldi haru ei tehta |
| 2 | Tehnika | jätkuvalt ilma sõltuvuste ja build-sammuta: HTML-elemendid ja CSS liidese jaoks, Canvas joonisele ja animatsioonile, graafikud SVG-na. Ainus erand võib tulla Claude'i nõustajas (osa 4.9) |
| 3 | Keel | kogu liides eesti keeles, ka menüüd ja nupud (1.x-s olid menüüd originaali järgi inglise keeles) |
| 4 | Maketid | privaatse lehena (Artifact), mitte repo failidena |
| 5 | Claude'i ühendus | (a) kasutaja oma API-võti brauseris + (b) „kopeeri küsimus“; vahendusserver hiljem |
| 6 | Eelvaade | `/dev/` `main`-ist enne 2.0 (push avaldab saidi) |
| 7 | Dokument | see fail; PLAAN.md „Versioon 2.0“ viitab siia |
| 8 | Plaanivaade | eraldi kiht samale mudelile, mille kasutaja sätib (mitte automaatne teisendus) |
| 9 | Detaili värv | vaikimisi tüübi järgi, lülitiga partii järgi |
| 10 | Cruise → Cross | `Cross` kirjutatakse ainult `Meta.Version` 2 faili; Version 1 fail salvestatakse nimega `Cruise` |
| 11 | Versioonid | 2.0 avaldatakse, kui etapid 3–7 on valmis; etapid 8–12 tulevad 2.1, 2.2 … |
| 12 | Konveieri stiil | valitav (rull, lint, lamell), vaikimisi rull |
| 13 | Välimus | hele ja tume (süsteemi järgi või valikuga); 1.x reegel „mõlemas välimuses“ tähendab 2.0-s neid kahte |

## 3. Mis 1.x liideses on ebamugav

| 1.x | 2.0 |
|---|---|
| Kõik käib menüüde ja üksteise järel avanevate vormide kaudu (Config → All, Workpiece data → marsruudid → marsruut); joonist ja andmeid ei näe korraga | kolm paani: vasakul mudeli puu, keskel joonis, paremal valitud objekti omadused; muudatus kehtib kohe, kontroll käib samal ajal |
| Marsruut on tabel tabeli sees, seos operatsiooni ja pingi vahel on peidus pingi vormi märkeruutudes | suured tabelid ja maatriks operatsioonid × pingid (osa 4.1) |
| Redaktor, animaator ja aruanne on eraldi režiimid | üks tööruum, ainult režiim vahetub (Muuda / Simuleeri); tulemus joonisel |
| Ikoonid ükshaaval, ruudustik ≤ 41 × 23 | suurem ruudustik, mitme objekti valik, kopeerimine, mallid |
| Aruanne on püsilaiusega tekst, korraga üks jooks | tulemuste paneel graafikutega, katsete võrdlus (osa 4.5) |
| Katsed (seemned, variandid) tehti etappides 11c ja 12b käsitsi Node'is | katsete haldur |
| Kogu liides on üks lõuend: teksti ei saa valida ega kopeerida, ligipääsetavus puudub | liides HTML-elementidega, lõuend ainult joonisele |
| Rajad on joon ja alus täpp – raske jälgida, mis toimub | tööstuslik pealtvaade ja jälgimise abivahendid (osa 4.4) |
| Abi on F1 ja olekurea vihjed | kasutusjuhend veebis ja rakenduse kõrvalpaneelis (osa 4.10) |

## 4. Võimalused

### 4.1 Tööruum ja tabelid

- **Tööruum**: mudeli puu (pingid, puhvrid, rajad, detailid, tsehhid), joonis, omaduste paneel (inspektor). Ülal režiim ja simulatsiooni juhtimine; all tulemused või Event List.
- **Tabelid** kõige jaoks: pingid, detailid, marsruudid, puhvrid, rajad, lõigud (pikkused), seaded. Redigeerimine nagu tabelarvutuses (Tab / Enter, kleepimine Excelist), rühmitus liigi järgi – sisestamisel tekib ülevaade („mul on sellised ja sellised pingid“).
- **Maatriks operatsioonid × pingid**: näha on, mis pink mida teeb ja millist operatsiooni teeb ainult üks pink.
- **Kontroll muutmise ajal**: viga on välja juures ja vigade nimekiri viib vea kohale (nagu 1.x `ModelProblems`).
- **Mudeli kirjeldus** (`Meta.Description`, valikuline): näha töölaual ja näidiste nimekirjas.
- **Käsupalett** (Ctrl-K) ja kiirklahvid; tühi seis juhendab („ava näidis“).

### 4.2 Metrooskeem ja plaan

- **Kaks vaadet samale mudelile**, lülitiga: **metrooskeem** (ruudustik, loogika analüüsiks – nagu praegu) ja **plaan** (tegelikud mõõdud meetrites).
- **Plaan on teine kiht**: alguses paigutatakse metrooskeemi järgi mõõtkavas, siis lohistab kasutaja objektid ja raja käänupunktid õigesse kohta. Täiesti automaatne teisendus ei toimi (suletud ringi ei saa üldjuhul joonistada nii, et kõik antud pikkused klapiksid).
- **Taustaks tehase plaan** (pilt); mõõtkava antakse kahe punkti ja nende vahemaaga. Plaani saab alla laadida SVG / PNG-na, et see teise plaani peale panna.
- **Pikkuste sisestamine** – kolm viisi, kõik muudavad samu andmeid:
  1. **lõik joonisel või tabelis** (põhiviis): klõps lõigul avab välja; lõikude tabel „sõlmest → sõlme“ (pikkus, sõiduaeg, allikas); käsitsi antud pikkus on joonisel teise värviga, pikkuse saab sildina näidata;
  2. **kaks punkti**: märgid kaks sõlme või jaama, tee nende vahel tõstetakse esile ja küsitakse vahemaad; mitme lõigu korral jaotub pikkus praeguste pikkuste suhtes. Sama tööriist on joonlaud (teekonna pikkus ja sõiduaeg);
  3. **plaanilt**: plaanivaates tulevad pikkused geomeetriast.
- **Allika reegel**: igal lõigul on üks allikas – mõõtkava, käsitsi või plaan; tabel näitab, milline kehtib. Plaan kehtib mõõtkava asemel, käsitsi antud pikkus jääb plaani üle.
- **1.x piirang kaob**: kahe kõrvuti hargnemise vahelist lõiku saab üle kirjutada. Selleks on vaja uut valikulist kirjeviisi (sõlmede kaudu); vana `EdgeLengths` jääb kehtima ja test kontrollib, et vanade mudelite tulemus ei muutu.
- **Simulaator ei muutu**: ta saab ka praegu ainult lõikude pikkused.

### 4.3 Tsehhid

- Nimega ala (punktiir, värv, nimi) mõlemas vaates, nt Mootoriosade tehase neli osakonda.
- Tulemused ka tsehhi kaupa (rakendatus, läbilaskevõime, detaile sees).
- Ainult joonis ja statistika rühmitus – simulaatorit ei muuda.

### 4.4 Visualiseerimine

**Rajad** (eeskuju: alustega transpordisüsteemid, nt Bosch Rexroth TS 2plus – kaks paralleelset rada, alused peal, jaamas stopper, harudel tõste-ülekandeseade, kurvid 90° / 180°; simulatsioonitööriistades on välimus valitav):
- **pidev konveier**: kaks külgrööbast, vahel põikkriipsud (rullid või lindi muster); muster liigub konveieri kiirusega, seistes seisab ja rööpad muudavad värvi. Stiil valitav: rull, lint, lamell (pagasilindi moodi);
- **jaam**: stopper-märk (punane, kui alus seisab), laadimise ajal nool, kummas suunas detail liigub;
- **avatud konveier**: otstes trummel; alus hajub otsas ja ilmub algusesse (tagasiteed võib näidata tuhmi punktiirina);
- **AGV rada**: põrandamärgistus (kollane joon), ühesuunalisel lõigul nooled, sõlmed märgistena, jaamas peatusjoon.

**Alus ja käru**: ruut õiges mõõtkavas, kohad lahtritena, detail istub oma kohal, broneeritud koht kontuuriga. **AGV**: suunaga ristkülik, koorem peal, oleku tuli (roheline sõidab, kollane ootab, punane `Collision`), ees poolläbipaistev ohutusväli ja helendav broneeritud teelõik – näha on, miks käru ootab.

**Tööpink**: pealtvaate siluett liigi järgi (treipink, töötluskeskus, lihvpink, pesumasin, mõõtemasin …), nimi ja mida ta teeb (operatsioonid), olek ja töötlemise edenemisriba; kohtspikker oleku ja statistikaga.

**Detail**:
- värv tüübi või partii järgi (lüliti); partii sees eristab tükki number (nt „3/8“) või muster;
- **edenemise rõngas** detaili ümber: mitu protsenti marsruudist on tehtud (töötlemisaja järgi);
- **edenemise skaala** – eraldi vaade: kõik detailid teljel 0…100 %, näha on, kuidas valmivad detailid liiguvad lõpu poole.

**Jälgimise abivahendid**:
- **jälgi detaili**: klõps detailil – kaamera liigub kaasa, marsruut on joonisel esile tõstetud, kõrval info;
- **tüübi marsruut**: valitud tüübi tee nooltega, teised tuhmid;
- **voolujooned** pärast jooksu: pinkide vahel joone paksus keskmise voo järgi;
- **rahulik režiim**: vaikimisi aeglasem kiirus, laadimine sujuva liikumisena.

**Jõudlus**: liikumatu osa joonistatakse üks kord valmis, igas kaadris ainult liikuvad asjad; lindi muster on nihkuv katkendjoon; detailsus sõltub suumist (kaugelt joon, lähedalt rööpad ja rullid); max-kiirusel joonist ei uuendata. Eesmärk 60 kaadrit sekundis Mootoriosade tehase suuruses mudelis – mõõdetakse etapis 3.

**Andmed**: uued väljad ainult välimuse jaoks ja valikulised (rajal stiil, pingil liik); ilma nendeta üldine välimus. Edenemine ja partii number loetakse simulaatori olekust (`SimState`) – simulaator ei muutu.

### 4.5 Tulemused ja katsete haldur

- **Tulemuste paneel**: pinkide olekud ajaribana, rakendatus, detaile süsteemis ajas, tsükliaja osad (diplomitöö valem), tüüpide ja tsehhide kaupa; tulemus ka joonisel (värv, järjekorrad). Allalaadimine CSV / JSON (1.x aruande tekstifail jääb).
- **Katsete haldur**: variandid (muudatused mudeli koopiale) × seemned, jooksevad taustal (Web Worker), võrdlustabel ja vahemikud. Sellele toetuvad Adviser ja Claude'i nõustaja.

### 4.6 Mitu sisendit, ladu ja väljundit

- Mitu FromCS-i, ToCS-i ja SysOut-i ning **suunamise reeglid** (nt praak → praagiväljund, tüüp → väljund).
- Praegu on igaüht täpselt üks (`Enumerate`, DISAIN.md osa 2). Muutuvad Planner, `FindSysPos`, `OutSys`, `Enumerate` – **simulaatori muudatus**: disain, prototüüp, valideerimine (invariandid, käsitsi arvutus) enne teostust.
- Mudel, mis seda kasutab, saab `Meta.Version` 2 (osa 5).

### 4.7 Muud simulaatori lisad

- **Konnektori mahutavus > 1** või broneering alles lähenedes – Mootoriosade tehase peamine kitsaskoht (VALIDEERIMINE.md 12b leid 1).
- **Konveierijaama ülekandekoht** – tõste-ülekandeseadme eeskujul: alus tõstetakse liinilt kõrvale ja ring ei seisa iga laadimise ajal (11c leid 5, 12b leid 2). Simulatsioon ja joonistus koos.
- Iga lisa on valikuline väli; ilma selleta on tulemus bitt-täpselt sama mis enne.

### 4.8 Adviser

- **LayoutChooser**: 48 struktuurivarianti (kood OLZN …: töötlemine, paigutus, transport, side kesklaoga – originaal.md 8.6) kaartidena, kirjeldus ja skeem; kui vastav näidis on olemas, saab selle mudelina avada.
- **LayoutFinder**: kasutaja annab kriteeriumid, kaalud tabelitest 5.1–5.4 summeeritakse; tulemus on järjestus koos põhjendusega (mis kaal mida andis). Kaalutabeleid saab muuta. Tabelid loetakse skaneeringust (`5-pts-realisatsioon.pdf` lk 2–4).
- **Seos simulaatoriga**: variant → mudeli toorik → katsete haldur.
- **Iseõppiv Adviser** (T-16, hiljem) – autori tollane idee, dokumentatsiooni ei jõudnud (originaalis lk 65 on jätkuna mainitud Adviseri täiustamine ekspertsüsteemiga): kaalutabeleid ei anta ainult käsitsi, vaid häälestatakse simulatsioonide tulemuste põhjal. Ring: Adviser soovitab struktuuri kaalude järgi → simulaator jooksutab selle ja teised variandid läbi (eri koormused, seemned) → tulemusi võrreldakse (läbilaskevõime, tsükliaeg, rakendatus, ummikud) → kaale korrigeeritakse nii, et Adviseri järjestus läheneks simulatsiooni omale. Tänapäeval: simulatsioonipõhine optimeerimine, metamudelid (*surrogate models*), järjestuse õppimine (*learning to rank*). Eeldused on olemas: simulaator on deterministlik (seeme), kiire (8 h alla sekundi) ega sõltu liidesest; näitajad tulevad `SimReport`-ist. Arutelu küsimused: kas kaalud õpitakse kasutaja mudelite või ette genereeritud variantide põhjal; kuidas õpitud kaalud kasutajale lahti seletada.

### 4.9 Claude'i nõustaja

- **Eesmärk** (kasutaja idee etapis 11): simulaatori mõte on aru saada, mis mida mõjutab ja mida tehase seadistuses häälestada. Claude loeb tulemust ja mudelit, annab sisulise kokkuvõtte (kitsaskoht ja põhjus, nt häälestus, broneeringud, transport) ja soovitused; simulaator on tema tööriist what-if katseteks (puhvri maht, `Kl`, pinkide või kärude arv, marsruudid, partii suurus ja järjekord), nagu etappides 11c ja 12b käsitsi tehti. Kuulub menüüsse *Advise* koos LayoutChooseri ja LayoutFinderiga.
- **Ühendus** (sait on staatiline):
  - (a) **kasutaja oma API-võti**: päring läheb brauserist otse Anthropicu API-sse, võti on ainult tema brauseris (valikuna ainult seansi ajaks), kulu tema kontol. Brauserist otsepäringu tingimused kontrollitakse etapi alguses;
  - (b) **„kopeeri küsimus“**: rakendus paneb kokku mudeli kokkuvõtte, tulemused ja juhise, kasutaja kleebib claude.ai-sse. Kulu ega sõltuvust pole, aga katseid Claude ise ei tee;
  - (c) vahendusserver – hiljem, mitte 2.x esimestes versioonides.
- **Mida saadetakse**: kompaktne kokkuvõte (~5–10 tuhat tokenit), mitte toores `SimReport` (Mootoriosade tehases 115 KB JSON, mudel 47 KB). Kasutaja näeb enne saatmist, mis läheb. Nõustaja on vaikimisi väljas ja liides ütleb, et andmed lähevad Anthropicu API-sse.
- **Tööriistad** (jooksevad brauseris): katse (muudatused mudeli koopiale × seemned), tulemuste teema, objekti andmed. Claude ei muuda kasutaja mudelit – soovitus tuleb nupuga „Rakenda“, mille saab tagasi võtta.
- **Mudel ja kulu**: vaikimisi Claude Opus 5.5 ($4 / $20 miljoni tokeni kohta), valikuna Sonnet 5.5 ($2 / $10); hinnang ~0,5–1,5 $ analüüsi kohta (~10 katset) Opusega. Täpsustub prototüübiga.
- **Valideerimine**: kas nõustaja leiab teadaolevad kitsaskohad (12b konnektor ja konveier, 11c puhvrid, 11d partii järjekord); tulemused VALIDEERIMINE.md-sse.
- Hiljem saab nõustaja vastata ka „kuidas teha“ küsimustele kasutusjuhendi põhjal.

### 4.10 Kasutusjuhend (abi)

- **Üks allikas, kaks kohta**: HTML-lehed (nt `v2/abi/`) – veebis oma aadressil, rakenduses samas kõrvalpaneelis (ei kata joonist).
- **Kontekst**: igal paneelil ja vormil „?“, mis avab juhendi õige koha; väljadel kohtspikker ja „Rohkem“; F1 – abi valitud asja kohta.
- **Sisu**: alustamine (5 minutit näidismudeliga); ülesanded („Kuidas lisan pingi“, „… sisestan pikkuse“, „… teen marsruudi“, „… võrdlen katseid“, „… joonistan tsehhi“) lühikeste sammude ja kuvatõmmisega; väljade sõnastik (mida väli simulatsioonis mõjutab); kiirklahvid; korduma kippuvad küsimused; otsing.
- `/doc/` jääb teooriaks ja arhitektuuriks; avalehe lühijuhend viitab abile.
- **Ajakohasus**: käsitsi kirjutatud; test kontrollib, et iga „?“ viide leiab oma koha ja pildid on olemas.

### 4.11 Cruise → Cross

- Diplomitöös ja 1.x-s on ristmiku nimi `Cruise`; õige on `Cross`. 1.x jääb vana nimega (`/v1/` on tag'is külmutatud).
- Koodis, liideses, sõnastikus ja dokumentatsioonis tuleb `Cross`. Failist loetakse mõlemat; salvestamine – otsus 10.
- `Cruise` on praegu 7 failis (src, testid, DISAIN.md, dokumentatsioon); näidismudelid seda ei kasuta. Sõnastikus märge „originaalis `Cruise`“.

### 4.12 Planner

Dokumentatsioon 1.1 peatükk 6 (teooria, originaali reeglid, vastavus, realisatsioon). Versioonis 1.5 on Planner üks protseduur, aga osa otsuseid on käsitlejates (`ChooseRoute` – `InSysProc`, väljundi valik – `OutSysProc`, ette broneeritud sihtkoht – `LoadProc`) ning kõik on 3400-realises `core/fms_sim.js`-is.

- **Planneri moodul** `core/fms_plan.js`: kõik juhtimisotsused ühes moodulis; käsitlejad ainult teatavad Plannerile, mis juhtus. Tulemused bitt-täpselt samad (testid, prototüübi võrdlus).
- **Originaali tegemata reeglid valikuliste seadetena** (vaikimisi vana käitumine): marsruudi kriteeriumid „lähim esimese operatsiooni pink“ ja „enim operatsioone samal pingil“ (näide: Näidis-PTS-is ootab MT1 536 s – dokumentatsiooni peatükk 6.5); sissetoomine alamsüsteemi koormuse (I.2), kindla intervalli (I.4) ja ajakava (I.5) järgi; tüübivalik „enim vabu pinke marsruudis“ (II.3).
- **Hindamine simulatsiooniga** nagu jaotusreeglite puhul tavaks: reeglite mõju näidismudelitel (läbilaskevõime, tsükliaeg, rakendatus); sobib ka Claude'i nõustajale (4.9).

## 5. Tehniline ülesehitus

- **Kaust `v2/`**: `v2/index.html`, `v2/src/` (liides), `v2/abi/`. Impordib ühised moodulid `../core/`-ist – nagu `v1/`: `v2/core` ja `v2/models` on lingid (`../core`, `../models`), saidil koopiad, nii et iga versiooni kaust on iseseisev (DISAIN.md osa 19).
- **Sait**: `tools/site.sh` paneb `/dev/` `main`-ist; alates tag'ist `v2.0` ka `/v2/` (kood tag'ist, näidised `main`-ist nagu `/v1/`-l). `/v1/` ei muutu.
- **Simulaator Web Workeris**: `fms_sim.js` hoiab olekut moodulis (üks jooks korraga) – Workeris saab iga jooks oma eksemplari. Mootoriosade tehas 8 h ≈ 0,5 s.
- **Ühised joonistusfunktsioonid** (`LayoutView`, `TrackGeometry`, `InterpolateCart` jt `v1/src/anima.js`-ist) – kas tõsta ühiseks või kirjutada uus, otsustatakse etapis 3 (`anima.js` sõltub teemast ja `ROW_HEIGHT`-ist).
- **Brauseri mälu**: võtmed `fmss2.*`; 1.x `fmss.recent` loetakse ainult sisse.
- **Ühilduvus**:
  - simulaatori lisad on valikulised väljad, vaikimisi tulemus bitt-täpselt sama;
  - `/v1/` võtab näidised `main`-ist – mudel, mis kasutab 2.x simulaatori lisasid, saab `Meta.Version` 2 (1.x lükkab selle selge veaga tagasi), näidiste nimekirjas `MinVersion`, et 1.x neid ei näitaks;
  - ainult välimuse väljad (stiil, liik, tsehhid, plaan) ei muuda simulatsiooni – 1.x jätab need vahele ja mudel jääb Version 1.
- **Testid**: 1.x testid jäävad; 2.0 loogika (ilma DOM-ita) `node --test`-iga; brauseris no-store serveriga.

## 6. Kokkulepped V2 etappides

Kehtivad 1.x kokkulepped (CLAUDE.md): etapp = eraldi vestlus ja commit, commit ja push ainult kasutaja loal, valideeri enne teostust, README „Seis“, etapi lõpus kopeeritav prompt. Uued globaalsed nimed lähevad [DISAIN_V2.md](DISAIN_V2.md) sõnastikku (nimetamise reeglid DISAIN.md osa 12.1). Dokumentatsiooni (`site/doc/`, versioon 1.1 → tarkvara 1.5) ei uuendata iga etapi järel; versiooni 2 dokumentatsioon tehakse, kui V2 on enam-vähem valmis (etapp 7). Lisaks:

- **Pilt enne koodi**: iga liidest puudutav etapp algab 1–3 prototüübipildi või klõpsatava maketiga (privaatne leht); kasutaja annab tagasisidet, alles siis kirjutatakse kood. Etapi lõpus kuvatõmmis samast kohast võrdluseks.
- **Abi uueneb**: iga etapp kirjutab oma ülesanded kasutusjuhendisse.
- **Välimus**: uus asi töötab heledas ja tumedas.
- **Prompt**: järgmise etapi prompti esimene rida on „V2 etapp N – …“; ootel töid ei kopeerita, vaid viidatakse osale 8.
- **Ootel tööd**: iga uus leid, tegemata kontroll või edasi lükatud idee saab kohe osas 8 numbri (T-n); mujal ainult viide numbrile.

## 7. Etapid

Seis uueneb iga etapi lõpus (CLAUDE.md „Valmis etapp“); README „Seis“ on lühikokkuvõte.

| Etapp | Sisu | Versioon | Seis |
|---|---|---|---|
| **1** | Arutelu ja tööplaan (see dokument) | – | tehtud (`e0331c8`) |
| **2** | Maketid ja ülevaatus, siis liidese spetsifikatsiooni kinnitus: (a) tööruum, metrooskeemi ja plaani lüliti, tsehhid; (b) tabelid ja maatriks; (c) animatsioon detailide tunnuste, edenemise rõnga ja skaalaga; (d) tulemused, katsed ja nõustaja paneel; (e) visuaalne stiil – konveier, alus, AGV ja pink kahes suumis | – | pooleli – makettide ettepanek tehtud 2026-11-14, ootab kasutaja otsust |
| **3** | Karkass: kaust `v2/`, tööruum ja paneelid, failid, `fmss2.*`, simulaator Web Workeris, `/dev/`; abi raamistik (kõrvalpaneel, „?“, otsing, alustamine); Cruise → Cross; joonistuse jõudluse mõõtmine | – | ootel |
| **3b** | Planneri moodul `core/fms_plan.js` (4.12), tulemused bitt-täpselt samad | – | ootel |
| **4** | Tabelid ja maatriks, kontroll muutmise ajal, `Meta.Description` | – | ootel |
| **5** | Metrooskeemi redaktor: suurem ruudustik, mitme objekti valik, kopeerimine, mallid; pikkused (lõik, kaks punkti), kõrvuti hargnemiste piirang; tsehhid | – | ootel |
| **6a** | Joonistus: rajad, alused, kärud, pingid, detailsus suumi järgi | – | ootel |
| **6b** | Detailid ja jälgimine: tunnused, edenemise rõngas ja skaala, detaili jälgimine, tüübi marsruut, voolujooned; Event List | – | ootel |
| **7** | Tulemused ja katsete haldur (ka tsehhide kaupa); avaleht, dokumentatsioon, tag `v2.0`, `/v2/` | **2.0** | ootel |
| **8** | Plaanivaade: meetrid, taustapilt ja mõõtkava, pikkused plaanilt, allalaadimine | 2.1 | ootel |
| **9a / 9b** | Mitu sisendit, ladu ja väljundit: disain ja valideerimine (prototüüp) / teostus ja liides | 2.2 | ootel |
| **10** | Konnektori mahutavus, konveierijaama ülekandekoht | 2.3 | ootel |
| **10b** | Planneri reeglid valikuliste seadetena ja nende hindamine (4.12) | 2.3 | ootel |
| **11** | Adviser | 2.4 | ootel |
| **12** | Claude'i nõustaja | 2.5 | ootel |
| **13** | Kasutusjuhendi ja dokumentatsiooni terviklik ülevaatus | – | ootel |

Versioonide järjekord pärast 2.0 võib muutuda; iga versioon saab oma tag'i nagu 1.x-s.

## 8. Ootel tööd

**Ainus koht, kus ootel tööd on kirjas** (CLAUDE.md). Uus leid, tegemata kontroll või edasi lükatud idee saab siia kohe numbri; mujal viidatakse numbrile. Tehtud töö jääb tabelisse seisuga „tehtud“ ja commitiga. Osa 4 võimalused on etappide (osa 7) sisu ja siin on neist ainult need, mis tulid leiust. Inventuur 2026-11-15: kokku korjatud PLAAN.md-st, dokumentatsiooni peatükist 11.2, VALIDEERIMINE.md leidudest ja „Mida see EI kontrolli“ lõikudest ning etappide promptidest – uusi töid juurde ei lisatud.

Koht: V2 etapp (osa 7), **hiljem** (2.x või edasi) või **otsustada**.

| Nr | Töö | Allikas | Koht | Seis |
|---|---|---|---|---|
| T-1 | Kahesuunalisel ringil 3+ käruga mitme sammu planeerimine (kohalikud reeglid lahendust ei leia) | VALIDEERIMINE 7b leid 6; dok 11.2 | hiljem | ootel |
| T-2 | Parkimiskohad vabadele kärudele (`Parking`) | DISAIN 11.2, 11.8; dok 11.2 | hiljem | ootel |
| T-3 | Tsooni tükeldamine (`ZoneLength`) | DISAIN 11.5, 11.8; dok 11.2 | hiljem | ootel |
| T-4 | Käru valiku reegel valitavaks (`Dispatch`; praegu alati kiireim käru) | DISAIN 11.8; dok 11.2 | hiljem | ootel |
| T-5 | Konnektor on broneeritud kogu tee ajaks – mahutavus > 1 või broneering alles lähenedes (osa 4.7) | VALIDEERIMINE 7a leid 2, 12b leid 1 | etapp 10 | ootel |
| T-6 | Pidev konveier seisab iga laadimise ajal – jaama ülekandekoht (osa 4.7) | VALIDEERIMINE 11c leid 5, 12b leid 2 | etapp 10 | ootel |
| T-7 | Planner eraldi moodulina `core/fms_plan.js` (osa 4.12) | dokumentatsioon 1.1 peatükk 6.4 | etapp 3b | ootel |
| T-8 | Planneri originaali tegemata reeglid valikuliste seadetena ja nende hindamine (osa 4.12) | dokumentatsioon 1.1 peatükk 6.3, DISAIN 5.2 | etapp 10b | ootel |
| T-9 | Transpordi-, puhvri- ja konnektoririke (originaali tabel 4.5) | DISAIN 17; VALIDEERIMINE 8; dok 11.2 | hiljem | ootel |
| T-10 | Kvaliteedipraak (tõenäosus operatsiooni kohta) | DISAIN 17; dok 11.2 | hiljem | ootel |
| T-11 | Rike ka jõudeolekus (kalendriaeg) | PLAAN „Versioon 2.0“; VALIDEERIMINE 8 | hiljem | ootel |
| T-12 | Laadimis- ja häälestusaegade kõrvalekalded | PLAAN „Versioon 2.0“; VALIDEERIMINE 8 | hiljem | ootel |
| T-13 | Pingis mitu detaili korraga | DISAIN 10.4; dok 11.2 | hiljem | ootel |
| T-14 | Lõpetamise ülempiir 2T on lühikese kestuse korral tihe (valitav ülempiir) | VALIDEERIMINE 11d leid 3; dok 11.2 | hiljem | ootel |
| T-15 | Kinnitustehases tähendab partii tükke kastis – partiirežiimid seal ei sobi (mudeli kirjeldus või andmed) | VALIDEERIMINE 11d leid 2; dok 11.2 | otsustada | ootel |
| T-16 | Iseõppiv Adviser (kaalud simulatsiooni tulemustest) | PLAAN „Versioon 2.0“ | hiljem | ootel |
| T-17 | Claude'i nõustaja vahendusserver | osa 4.9 | hiljem | ootel |
| T-18 | Tulemuse või aruande allalaadimine päris brauseris kontrollimata | VALIDEERIMINE 9; dok 11.2 | etapp 7 | ootel |
| T-19 | Puutetundlik ekraan ja puuteplaadi näpistus päris seadmel kontrollimata | VALIDEERIMINE 5, 11a | etapp 3 | ootel |
| T-20 | Joonistust kontrollitakse ainult silmaga (automaatne kuvatõmmise võrdlus puudub) | VALIDEERIMINE 5, 6a, 6b | otsustada | ootel |
| T-21 | Käru on punkt – kiirendus ja pikkus puuduvad | VALIDEERIMINE 7b | hiljem | ootel |
| T-22 | Kärul olevate detailide tähtajad (soovi lisamise piir on ainult sõiduaja kasv) | VALIDEERIMINE 7c | hiljem | ootel |
| T-23 | `AccessTime` (pöördusaeg) – tähendus ebaselge, ei kasutata | DISAIN 10.3; dokumentatsioon tabel 4.2 | otsustada | ootel |
| T-24 | `LayoutSvg` joonistab kaare suunanoole lahtri keskele (rajast kõrvale) | VALIDEERIMINE 12b leid 5 | etapp 7 | ootel |
| T-25 | Kaasaegse juhtriba olekurida lühendatakse mitme raja või rikete korral („..“) – V2 uues liideses ei tohi korduda | VALIDEERIMINE 7c, 8; dok 11.2 | etapp 6a | ootel |
| T-26 | Versiooni 2 dokumentatsioon (dokumentatsioon 1.1 kirjeldab tarkvara 1.5) | kasutaja otsus 2026-11-15 | etapp 7 | ootel |

## 9. Allikad

- [Bosch Rexroth – Transfer System TS 2plus](https://www.boschrexroth.com/en/us/c/transfer-system-ts-2plus/); komponendid (stopperid, ülekandeseadmed, kurvid): [esd.equipment](https://esd.equipment/en/arbeitsplatzsysteme/bosch-rexroth/transfersysteme-1/transfersystem-ts-2plus.html?p=4)
- [FlexSim – Introduction to conveyors](https://flexsim.cloud.answerhub.com/articles/23477/introduction-to-conveyors.html), [AnyLogic – Conveyor](https://anylogic.help/markup/conveyor.html)
- AGV-de juhtimistarkvara: [MDPI](https://mdpi.com/2076-3417/15/13/7235), [Fuselab](https://fuselabcreative.com/robot-fleet-management-interface/), [ABB AMR Studio](https://www.abb.com/global/en/areas/robotics/products/software/amr-studio-suite/amr-studio)
