# Originaali kirjeldus

Ümberkirjutus diplomiprojektist **„Paindautomatiseeritud tootmise simulatsioonisüsteem“** (K. Kannel, TTÜ Arvutitehnika Instituut, 1993; juhendaja J. Riives, konsultant V. Leppikson). Skaneeritud diplomitöö (mittelõplik versioon, lisad puuduvad) on autori juures, avalikus repos seda pole; viited „lk N“ ja „joon. N“ on selle järgi.

Siia on võetud ainult taastamiseks olulised osad. Viited `lk N` on originaali leheküljenumbrid. Märge **[tõlgendus]** tähendab, et see on minu lugemine joonisest või tekstist, mitte originaali otsene väide.

Dokument ei ole lõplik versioon: hilisem edasiarendus ja täiendatud kirjeldus on kadunud. Lisad 1–2 (lk 69–71, näidis-PTS) puuduvad.

Lühendid: **PTS** – paindtootmissüsteem, **MT** – tööpink, **BUF** – puhver, **CS** – keskladu (tsentraalladu), **TR** – transpordirada, **TM** – transpordivahend (käru / konveieri koht), **WP** – detail (workpiece).

---

## 1. Üldarhitektuur

- Turbo Pascal 5.5, protseduurne, moodulid (unit'id), osa assembleris. MS-DOS, EGA graafika. Graafikateek (aknad, menüüd, hiir) – J. Raidi `WINDOWS.PAS`.
- **Kahetasemeline** süsteem (lk 28–29, joon. 4.1):
  - **Planeerimistase – Adviser**: staatilise info (komponentide parameetrid) põhjal soovitab süsteemi struktuuri (transpordiprintsiip, tööpinkide paigutus).
  - **Operatiivtase – Planner + simulaator**: konkreetse detailide nomenklatuuri simuleerimine antud struktuuril; dünaamiline info → statistika → analüüs → muudatused, korduskatse.

### Moodulid (lk 36)

| Moodul | Sisu |
|---|---|
| `FMS.PAS` | peaprogramm |
| `FMS_FILE.PAS` | failifunktsioonid |
| `FMS_ED1.PAS` | PTS-i struktuuri redaktor |
| `FMS_ADV.PAS` | planeerimistase (Adviser) |
| `FMS_SIM.PAS` | operatiivtase ehk simulaator (+ `SUPPORT.INC`, `ANIMA.INC`) |
| `FMS_REP1.PAS` | aruannete generaator |
| `FMS_OPT.PAS` | keskkonna parameetrid |
| `FMS_GLB1.PAS` | globaalsed tüübid ja muutujad |
| `WINDOWS.PAS` | graafikateek |
| `MISC.PAS` | abifunktsioonid |
| `FMS_LNG.INC` | kõik kasutajale näidatavad tekstid (keel valitakse tingimusliku kompileerimisega) |

Mudelifailid: `*.FMS` (näiteks `DEMOTRAK.FMS`, `THREETRA.FMS`), varukoopia `*.OLD`, seaded `FMSS.CFG`, Adviseri variantide kirjeldused `FMS_LAY.DSC`.

---

## 2. PTS-i komponendid ja parameetrid (ptk 4.3)

PTS koosneb: transpordisüsteem (TRSYS), tööpingid (MT), puhvrid (BUF), keskladu (CS), muud komponendid (konnektor, süsteemi väljund).

### 2.1 Transpordirada (tabel 4.1, lk 29–30)

Rajad jagunevad:
- **pidevad** (konveierid, CONTRACK): **avatud** või **suletud**; neil on liikumissuund;
- **diskreetsed** (DISCTRACK): transpordirobotid (TRB) või AGV-d.

Transpordivahendi parameetrid on ühe raja piires konstantsed.

| Parameeter | Ühik | Märkus |
|---|---|---|
| Transpordivahendite liikumise kiirus | cm/s | |
| Transpordivahendite arv rajal | tk | pideval rajal kohtade arv konveieril; diskreetsel robotite/AGV-de arv |
| Kohtade arv transpordivahendil | tk | mitu detaili mahub korraga |
| Transpordiraja tüüp | pidev / diskreetne | |
| Keskmine pöördusaeg | s | esmakordse pöördumise aeg |
| Keskmine laadimisaeg | s | detaili peale- või mahalaadimise aeg |
| Transpordiraja pikkus | cm | lõikude pikkus sõlmest sõlmeni |

### 2.2 Tööpink (tabel 4.2, lk 31)

| Parameeter | Ühik | Märkus |
|---|---|---|
| Tööpingi nimi | | ainult kirjeldamiseks ja statistikaks |
| Mudel | | sama |
| Laadimisaeg | s | detaili laadimine tööpinki |
| Ümberhäälestusaeg | s | üleminek ühelt operatsioonilt teisele |
| Sooritatavad operatsioonid | nimekiri | |

Operatsioonid (piiratud hulk): treimine, puurimine, sisetreimine, freesimine, lihvimine, kammlõikamine, hambalõikamine, erosioontöötlus; lisaks pesemine ja mõõtmine. Simulatsioonile on oluline ainult see, et need on erinevad ja tehtavad kindlates pinkides.

### 2.3 Ladu, puhver, konnektor, väljund (tabel 4.3, lk 31–32)

| Parameeter | Ühik | Märkus |
|---|---|---|
| Kohtade arv | tk | mitu detaili mahub |
| Pöördusmeetod | nimekiri | FILO, FIFO, RANDOM |
| Laadimisaeg | s | detaili sisse- või väljalaadimine |

- **Keskladu (CS)**: hoiab sisenevaid ja töödeldud detaile; seotud süsteemiga **sisend- ja väljundpositsioonide** kaudu.
- **Puhver**: süsteemisisene väike ladu, lühike laadimisaeg. Tööpingid on transpordiga seotud puhvrite kaudu. Puhver on **ühesuunaline** või **kahesuunaline** (pöördpuhver); kahesuunalisel 1 või 2 ühenduspunkti.
- **Konnektor (ühenduslüliti)**: ühendab radu omavahel; sisuliselt nullmahutavusega puhver.
- **Süsteemi väljund**: detail lahkub süsteemist (mitte lattu tagasi); lao detailide arv väheneb.

### 2.4 Detail (tabel 4.4, lk 33–34)

| Parameeter | Ühik | Märkus |
|---|---|---|
| Nimi | | statistikaks |
| Detaili prioriteet | | partii prioriteet |
| Partii suurus | tk | mitmest analoogsest detailist partii koosneb |
| Alternatiivsed marsruudid | | milliseid operatsioone tuleb teha enne väljasaatmist |
| Marsruudi operatsioonid | nimekiri | |
| Keskmine operatsiooni kestus | s | ei sõltu tööpingist |
| Võimalik kõrvalekalle kestusest | s | ei sõltu tööpingist |
| Alternatiivsete marsruutide prioriteedid | | |

Prioriteet otsustab ainult võrdsete võimaluste korral. Kui kõrgema prioriteediga marsruudi ressursid on kinni, valitakse madalama prioriteediga marsruut.

### 2.5 Tegevused komponentidega (ptk 4.3.6, lk 34)

| Komponent | Tegevused |
|---|---|
| Transpordisüsteem | pealelaadimine, mahalaadimine, transportimine, kärude kokkupõrge, rike |
| Tööpink | pealelaadimine, mahalaadimine, töötlemine, ümberhäälestus, rike |
| Ladu / puhver | sisselaadimine, väljalaadimine, häälestumine laadimiseks, rike |
| Konnektor | sisselaadimine, väljalaadimine, häälestumine laadimiseks, rike |
| Süsteemi väljund | sisselaadimine, rike |

Tabel 4.5 (lk 35) koondab sama maatriksina komponentide TR, MT, BUF, INPOS, OUTPOS, SYSOUT kaupa: INPOS ainult välja + rike, OUTPOS ja SYSOUT ainult sisse + rike. **[tõlgendus]** Tabeli TR- ja MT-rea ristid on ilmselt nihkes (TR-il „töötlemine“, MT-l puudub) – usaldada tuleb ülaltoodud loetelu.

---

## 3. Mudeli objektid ja andmestruktuurid (ptk 5.6, 5.10)

### 3.1 Objektid (tabel 5.6, lk 47)

| Objekt | Kirjeldus |
|---|---|
| `Void` | tühi objekt (sündmuse `DoNothing` parameeter) |
| `SysInput` | süsteemi sisend (keskladu sisendpositsioonid) |
| `SysOutput` | süsteemi väljund (keskladu väljundpositsioonid **ja** süsteemi väljundpositsioonid – ühendatud üheks objektiks) |
| `Buffer` | süsteemisisene puhver |
| `Machine` | tööpink |
| `Pallette` | konkreetne transpordivahend (koht konveieril või transpordikäru) |

Transpordirajad **ei ole** mudelis eraldi objekt – seepärast on sündmusel väli `Track`.

### 3.2 Andmestruktuurid (lk 51–53)

Jagunevad **staatilisteks** (parameetrid) ja **dünaamilisteks** (olekud). Kõik globaalsed tüübid on `FMS_GLB1.PAS`-is.

- **Paigutus (layout)**: ikoonide maatriks, kõrgus × laius ikoonides; mälus vektor, `Pos = Y * LayoutDim.X + X` (koordinaadid ikoonides, alates ülalt vasakult). Element on kirje:
  - `T: IconType` – ikooni tüüp
  - `P: Pointer` – viit ikooni kirjeldavale struktuurile (alati sisaldab asukoha koordinaate, ülejäänu sõltub ikoonist)
  - `U: Byte` – mis raja numbrile ikoon kuulub
  - `N: Byte` – ikooni järjenumber
- **`Workpieces`** – detailitüübid, max **16**. Kirje: nimi, partii prioriteet, partii suurus, lipp „tüüpi kasutatakse“, alternatiivsed marsruudid ja nende prioriteedid.
- **`SysWPArray`** – süsteemis olevad konkreetsed detailid; luuakse simulatsiooni alguses. Suurus = kõigi kohtade summa: `Σ MTplac(i) + Σ BUFplac(i) + Σ_rajad Σ_kärud TMplac(i,j)` (süsteemis ei saa olla rohkem detaile kui kohti).
- **`MachineArray`** – tööpingid, dünaamiline massiiv; nii parameetrid kui olek. Seos ikooniga unikaalse koodiga (= tööpingi järjenumber).
- **`BufferArray`** – puhvrid, analoogselt.
- **`Tracks`** – rajad. Kirje: nimi, mood (pidev/diskreetne), kärude arv, kohtade arv kärul, pöördumisaeg, laadimisaeg. Pideval rajal ka liikumissuund – määratakse kogu rajale, kirjeldatakse ühel raja ikoonil.
- Rada = omavahel ühendatud rajaikoonide kogum; naaberikoonide ühendused peavad kokku langema. Rada lõpeb tühja või mitte-rajaikooniga. Rajad on seotud konnektorite, tööpinkide või puhvrite kaudu. Igal rajal unikaalne number; radade arv on piiratud. Pideva raja avatus/suletus tuleneb ikoonide paigutusest.

---

## 4. Ikoonid (joon. 5.4, lk 55)

Ikoonitüübid on Pascali ordinaaltüüp. Sama objekti erinevad ühendusviisid (eri ikoonid) grupeeritakse ikoonitüübi tüüpideks (`IconTypeType`). Ikoonile saab seada koodi, kus on kodeeritud tüübitüüp ja ühendused radadega.

| Tüüp | Kirjeldus |
|---|---|
| `Empty` | tühi ikoon |
| `VertTr` | vertikaalne rajalõik |
| `HorTr` | horisontaalne rajalõik |
| `ArcNE` | kaar üles ja paremale |
| `ArcSE` | kaar alla ja paremale |
| `ArcNW` | kaar üles ja vasakule |
| `ArcSW` | kaar alla ja vasakule |
| `TeeN` | hargnemine ülalt |
| `TeeE` | hargnemine paremalt |
| `TeeS` | hargnemine alt |
| `TeeW` | hargnemine vasakult |
| `Cruise` | teede ristumine |
| `VertCon` | vertikaalne konnektor |
| `HorCon` | horisontaalne konnektor |
| `InBuf` | puhver, detailid liiguvad üles |
| `OutBuf` | puhver, detailid liiguvad alla |
| `InOutBuf` | puhver, detailid liiguvad üles ja alla |
| `TurnBuf` | pöördpuhver (sisuliselt sama mis `InOutBuf`) |
| `FromCS` | keskladu sisendpositsioon |
| `ToCS` | keskladu väljundpositsioon |
| `SysOut` | süsteemi väljund |
| `MachToolDown` | tööpink, ühendus alla |
| `MachToolUp` | tööpink, ühendus üles |
| `MachToolThruDown` | tööpink, ühendus alla ja üles; detailid liiguvad ülalt alla |
| `MachToolThruUp` | tööpink, ühendus alla ja üles; detailid liiguvad alt üles |

Rajalõigu pikkused sisestatakse ikoonikaupa (lk 54):
- pikkus > 0 → **pidev joon**, tähistab automaatselt rajalõiku;
- pikkus = 0 → **punktiirjoon**, loogiline ühendus: objekt on selles kohas rajaga ühendatud, kärud peatuvad seal ja laadimine toimub neid harusid pidi.

Topoloogias ei tohi jääda vabu otsi; kõik objektid peavad olema ühendatud kas otse või radade kaudu.

Ikoonide graafiline kuju: vt skaneering `5-pts-realisatsioon.pdf` lk 20 (originaali lk 55).

---

## 5. Sündmused (ptk 5.5, lk 44–46)

### 5.1 Sündmuste tüübid (tabel 5.5)

| Sündmus | Tähendus |
|---|---|
| `DoNothing` | tühi sündmus, testimiseks |
| `InSys` | süsteemi on vaja tuua uus detail. Tekitab Planner; detaili tüüp ja sisselaadimise koht antakse parameetrina. Alustab töötlemist simuleerivat sündmuste ketti |
| `OutSys` | detail on vaja süsteemist välja saata (töödeldud või praak). Planeerib Planner |
| `Load` | laadimine; peale- ja mahalaadimine on üks sündmus, erinevus on ainult objektis, kuhu laaditakse |
| `MoveZ` | transpordivahendi liikumise algus |
| `StopMov` | transport lõppes. Vajalik, sest transpordi lõppaega ei saa alati ette määrata |
| `Collision` | diskreetsel rajal kahe käru ohtlik lähenemine |
| `Process` | detaili töötlemine tööpingis |
| `Turn` | tööpingi ümberhäälestus järgmisele operatsioonile |
| `Crash` | transpordikäru, tööpingi, puhvri või konnektori rike |

Miks `StopMov`: pidevad konveierid seiskuvad kogu ulatuses, kui toimub peale- või mahalaadimine, mistõttu nihkuvad ka teiste detailide saabumisajad. Diskreetsetel radadel ei saa kokkupõrkeid ette ennustada. Transport seiskub ka rikke korral.

Sündmuste põhjused:
1. teised sündmused → sündmuste **ketid**;
2. sõltumatud sündmused, nt `Crash` – rikke toimumine objektil määratakse **tõenäosusega ajaühikus**;
3. juhtalgoritmide planeeritud sündmused (Planner): uue detaili sissetoomine, väljasaatmine, järgmise keti alustamine pärast töötlemist.

### 5.2 Sündmuste omavahelised seosed (joon. 5.1, lk 46)

Graaf jaguneb **transpordipooleks** ja **töötlemispooleks**; üleminek ühest teise käib **ainult läbi Planneri**.

**[tõlgendus]** joonisest:

```
Start → InSys → Move ─┬────────────────→ StopMov → Load ─┬→ Move (järgmine transport)
                      └→ Collision → StopMov ────────────┴→ Planner

Planner → InSys | Move | OutSys | Turn

Turn → Process ─┬→ Turn (järgmine operatsioon samas pingis)
                └→ Load → Move
```

Joonisel on sündmus nimega `Move`, tabelis `MoveZ` – sama sündmus.

---

## 6. Event List (ptk 5.8–5.9, lk 48–51)

### 6.1 Kirje (tabel 5.7)

| Väli | Sisu |
|---|---|
| `Event` | sündmuse tüüp |
| `WP` | osaleva detaili number (kui on) |
| `ObjType` | objekti tüüp, millega sündmus toimub |
| `ObjCode` | objekti number |
| `Track` | rada, kus sündmus toimub |
| `Time` | sündmuse toimumisaeg |
| `Next` | viit järgmisele sündmusele |

- Ahelloend, järjestatud **algusaja järgi**. Uus sündmus lisatakse ajaliselt eelneva ja järgneva vahele; **sama aja korral hiljem lisatu läheb taha** (FIFO).
- Sündmusi saab lisada igal ajahetkel; töödeldud sündmus kustutatakse.
- Algusviit: **`FirstAtMoment`**.

Näide (joon. 5.2):

```
FirstAtMoment → [MoveZ   WP12 Machine  2 Track1 t=123]
              → [Load    WP7  Pallette 1 Track1 t=145]
              → [StopMov WP12 Machine  1 Track1 t=180]
              → [Move    WP7  Buffer   1 Track1 t=207] → NIL
```

### 6.2 Aeg (ptk 5.7, lk 47–48)

- Ajaühik **1 sekund**; kõik ajalised parameetrid sekundites, kiirused cm/s.
- Üks globaalne aeg **`SYSTEM_TIME`** (reaalaeg ja mudeliaeg on ühendatud), loetakse simulatsiooni algusest.
- Ajasamm on **konstantne („time mapping“)**, mitte „next event“. Põhjus: transpordiprotsessi lõpuaega ei tea ette, ja next-event'iga võiks transpordi lõpu sündmusest „mööda“ minna. Lisaks on nii lihtne ehitada animaatorit.
- Event List on sellegipoolest kasutusel: igal sekundil töödeldakse kõik sellele hetkele planeeritud sündmused.

### 6.3 Peatsükkel (joon. 5.3)

```
Algus
  ┌→ ProcEvent ──(NO_EVENTS = False)──┐
  │      ↑____________________________┘
  │  (NO_EVENTS = True)
  │  MinuteMan
  │  Animator
  │  SimStat
  │  Inc(SYSTEM_TIME)
  └─(SIMULATION_DONE = False)
     (SIMULATION_DONE = True) → Lõpp
```

- **`ProcEvent`** otsib Event Listist käesolevale hetkele vastava esimese sündmuse. Kui ei leia → `NO_EVENTS := True`. Kui leiab → kutsub vastava **EventHandleri**, mis muudab osalevate objektide olekuid ja lisab Event Listi uusi sündmusi.
- **EventHandlerid** on protseduuritüüpi massiivis `EventHandlers`; nimi = sündmuse nimi + `Proc` (nt `StopMovProc`).
- Sündmuse kestus = aeg sama objekti järgmise sündmuseni. Sündmused ei saa toimumise ajal üksteist mõjutada – erand on transport (käru blokeerib teise tee).
- Handlerid annavad tingimuste täitumisel juhtimise **Plannerile**; mõni handler (`InSys`) sisuliselt ainult kutsub Plannerit. Event Listi lisavad sündmusi **ainult EventHandlerid ja Planner**.
- **`MinuteMan`** nihutab transpordivahendeid (muudab koordinaate). Võib tekitada: `StopMov` (jõudis sihtkohta) käesolevale hetkele; `Collision` (kaks vahendit põrkusid).
- **`Animator`** joonistab kärude asukohad, tööpinkide ja puhvrite olekud (kas detail on sees / laaditakse sisse/välja). Side on ühepoolne: animaator ei mõjuta simulatsiooni; simulaator töötab ka ilma.
- **`SimStatus`** kuvab üldisemad statistilised suurused.

### 6.4 Simulatsiooni algoritmid (ptk 5.3, lk 40–41)

| Protseduur | Ülesanne |
|---|---|
| `ProcEvents` | töötleb sündmuste listi |
| `MinuteMan` | liigutab transpordikärusid |
| `Planner` | juhib sündmuste töötlemist, lahendab konfliktid |
| `GetEvent` | otsib listist käesoleval hetkel toimuva sündmuse |
| `PutEvent` | lisab sündmuse listi |
| `ProgTM` | programmeerib diskreetse transpordisüsteemi käru |
| `FindMach` | otsib kriteeriumi põhjal sobivaima tööpingi |
| `FindPal` | otsib sobivaima transpordivahendi |
| `FindBuf` | otsib sobivaima vahelao |
| `FindSysPos` | otsib sobivaima süsteemi väljundpositsiooni |
| `SimStatus`, `Animator`, `Transport` | kuvamine: üldseisund; detailid pinkides ja puhvrites; kärude asukohad |

**Andmete kontroll** (`Enumerate`, `DetectOpenCons`, `FindConflicts`) – vead:
1. topoloogia ei ole suletud;
2. pidevatel radadel on harusid;
3. süsteemsel laol on liiga vähe positsioone;
4. tööpingid ei soorita marsruudis ette nähtud operatsioone;
5. pidevatel radadel pole liikumissuunda;
6. radadel on rohkem kohti kui süsteemsetel puhvritel;
7. kaks või enam puhvrit on ühendatud järjestikku;
8. tööpinkidel on puhvrid puudu.

**Initsialiseerimine**: dünaamiliste massiivide mälueraldus, muutujate algväärtused, kärude algpositsioonid radadel.

---

## 7. Planner – operatiivtaseme juhtimine (ptk 5.4, lk 41–44)

1. **Süsteemi koormamine detailidega**
   - I – *millal* tuua uus detail:
     1. süsteemi üldkoormus langeb alla piiri: `Ndet / (Ntm + Nmt + Nbuf) < Kl`, `Kl ≈ 0.85` (detailide arv / kohtade arv transpordil + tööpinkidel + puhvrites);
     2. mõne alamsüsteemi (transport, tööpingid, puhvrid) koormus langeb alla piiri (samuti 0.85);
     3. alati, kui mõni detail on süsteemist lahkunud;
     4. kindlate ajavahemike tagant;
     5. ajakava järgi;
     6. partiidena.
   - II – *mis tüüpi* detail (kui hetk on määratud statistiliselt, punktid 1–4):
     1. tüüp, mida on kõige vähem töödeldud;
     2. üht tüüpi detailid järjest;
     3. tüüp, mille marsruudis on enim vabu tööpinke.
     
     Punktide 5–6 korral on tüüp ette antud.
2. **Tehnoloogilise marsruudi valik** (kui detail on süsteemis): marsruut, millel on enim hetkel vabade pinkide operatsioone; mille esimese operatsiooni pink on lähim; mille võimalikult palju operatsioone tehakse samal pingil. Võrdsete korral otsustab prioriteet.
3. **Väljasaatmine**, kui kõik marsruudi operatsioonid on tehtud. Valik ainult väljundpositsioonide vahel, kui neid on mitu.
4. **Järgmise operatsiooni valik**: kui järgmist saab teha samas pingis, tehakse seal; muidu leitakse järgmine sobiv pink ja tee selleni.
5. **Konfliktid**: kahe käru ohtlik lähenemine → kärud seisatakse, juhtimine Plannerile, Planner otsustab, kes läheb edasi; tavaliselt programmeeritakse kärud ümber.
6. **Eriolukorrad (rikked)**: rike võib toimuda suvalisel hetkel (graafis pole). Seade seiskub mingiks ajaks (remont). Olenevalt objektist kas oodatakse ja korratakse pooleli jäänud tegevust või tehakse alternatiivne tegevus. **Rike tööpingis → töödeldav detail on praak ja saadetakse välja.**

---

## 8. Kasutajaliides (ptk 6, lk 57–63)

### 8.1 Peamenüü (joon. 6.1–6.2)

```
File      Load, Pick (10 viimast), New, Save, Write as, Directory, Change dir, Rename, Delete
Edit      Layout, View, Config (All | Choose), Transport (Track1..n),
          Workpiece Data (WP1..n → Edit | Copy | Flush), Storage data
Advise    Layout Chooser, Layout Finder
Simulate
Report    Static, Dynamic, Output (Display | File)
Options
Quit
```

Valikud nii klaviatuurilt kui hiirega. Peamenüü horisontaalselt üleval, alammenüüd vertikaalselt, nende alammenüüd nihkega.

### 8.2 Mudeli redaktor (`FMS_ED1.PAS`, ptk 5.11, 6.4)

Protseduurid: `EditLayout` (topoloogia), `EditConfig` (`EditMachTool`, `EditBuffer`), `EditTransportSystem`, `EditWorkpieceData`, `EditStorageData`.

- **Layout** – kaks akent: üleval redigeeritav mudel (korraga nähtav **13 × 4** ikooni, ruudustik), all ikoonipalett. Vali paletist ikoon hiirega, siis klõpsa mudelis ruutu. Aknal kerimisnooled servades.
- **View** – sama suuremas mastaabis: **41 × 23** ikooni, ilma ruudustikuta.
- **Config** – kas kõik struktuuris leiduvad objektid järjest või valitud objekt. Objekt tõstetakse esile teise värviga; ekraani alla avaneb aken objekti tüübile vastavate väljadega.

### 8.3 Aruanded (`FMS_REP1.PAS`, ptk 6.5)

- **Static** – staatilise info (komponentide parameetrid) teemad aruandesse;
- **Dynamic** – dünaamilised parameetrid ja simulatsiooni käigus kogutud statistika;
- **Output** – ekraanile või faili.

### 8.4 Näidis-PTS (joon. 5.5 ja 6.4)

**[tõlgendus]** ekraanipildist: hall ruudustik. Vasakul `FromCS`, punktiirühendusega suletud konveieri silmuse külge. Silmusel kaared mõlemas otsas, liikumissuuna nool alumisel lõigul paremale. Üleval kaks tööpinki (`MachToolDown`): esimese all `InOutBuf` (↕), teise all `TurnBuf`; mõlemad punktiiriga silmuse ülemise lõigu külge. Paremal `ToCS` ja `SysOut`, punktiiriga silmuse külge.

### 8.5 Tsükliaeg ja statistika (ptk 2, lk 12)

Detaili tsükliaeg (aeg süsteemis):

```
Tts = Σi Σj (Tm_ij + Tp_ij + Tturn_ij + Tprep_ij) · x_i
    + Tin + Tout + Σ Ttrans + Σ Tload + Σ Twash + Σ Tmeas + Σ Twait
```

Tm – töötlemisaeg, Tp – positsioneerimine, Tturn – instrumendi vahetus, Tprep – ettevalmistus, x – operatsiooni sooritamise indikaator, Tin/Tout – sisenemine/väljumine, Ttrans – transport, Tload – laadimine pinki ja tagasi, Twash – pesemine, Tmeas – mõõtmine, Twait – summaarne ootamine.

Olulisemad suhtarvud: **töötlemise osakaal** `(Tm+Tp+Tturn+Tprep)/Tts`, **ootamiste osakaal** `ΣTwait/Tts`, **transpordi osakaal** `ΣTtrans/Tts`. Nende põhjal graafikud, kuidas struktuur sobib eri nomenklatuuride ja parameetritega.

### 8.6 Struktuurivariandid (ptk 2, lk 10–11) – Adviseri jaoks

- Transpordiprintsiip: **lineaarne, harudega, täht, võrk** (joon. 2.1).
- Tööpinkide paigutus: järjestikune, paralleelne, vaba. Tööpinkide tüüp: ühe- või mitmefunktsioonilised.
- Side kesklaoga: operatiivne (detail saab igast pingist otse lattu) või mitteoperatiivne.
- Variandikood tähtedest (joon. 2.2–2.3, nt `OLZN`, `OPZN`, `MLZN`, `OLGN`, `OPGS`, `MSGS`): töötlemine (O/S/M), paigutus (L/S/P), transport (Z – paindlik / G – jäik), side kesklaoga (N – operatiivne / S – mitteoperatiivne). Koos transpordiprintsiipidega annavad kombinatsioonid **48** lahendust (lk 37).

Adviser (ptk 5.2, tabelid 5.1–5.4): `LayoutChooser` näitab variandi kirjeldust failist `FMS_LAY.DSC`; `LayoutFinder` summeerib kriteeriumide kaalud nelja hindamistabeli järgi (paigutus, transpordiprintsiip, pidev/diskreetne, side kesklaoga) ja valib parima. Kaalutabelid: vt skaneering `5-pts-realisatsioon.pdf` lk 2–4. **Jääb hilisemaks etapiks.**

---

## 9. Poolikuks jäänud osa

- Lk 41: algoritmidest olid valmis ainult **`MinuteMan`, `GetEvent`, `PutEvent`, `ProgTM`, `FindMach`, `FindPal`**. Tegemata: **`Planner`, `ProcEvents`, `FindBuf`, `FindSysPos`**.
- Lk 8: valmis oli **osa simulaatorist** ja **osa aruandegeneraatorist**; graafiline liides, failisüsteem, Adviser, redaktor ja Animator olid tehtud.
- Lk 65: autori nägemus jätkuks – Adviseri ja Planneri täiustamine (nt ekspertsüsteemiga, reeglite kirjeldamine), objektorienteeritud lähenemine, olemasolev graafiline keskkond.
- Hilisem edasiarendus ja täiendatud dokument on kadunud.

## 10. Tuleb ise välja mõelda

- Planneri täpne loogika ja kõik EventHandlerid (`*Proc`).
- `FindBuf`, `FindSysPos`; `FindMach`, `FindPal` kriteeriumid.
- `MinuteMan`: kärude liikumine mööda ikoone, pidevate konveierite seiskumine laadimise ajal, kokkupõrke tuvastus.
- `Crash`: rikete tõenäosus ja remondiaeg (parameetrid puuduvad tabelitest).
- Operatsiooni kestuse kõrvalekalde jaotus (juhuslikkus).
- Kesklao (FromCS/ToCS) ja `SysOut` vaheline loogika.
- Näidis-PTS-i parameetrite väärtused.
