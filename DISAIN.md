# Simulatsiooniloogika disain

Etapp 1 ([PLAAN.md](PLAAN.md)). Alus: [originaal.md](originaal.md). Osad 1–7 (pidevad konveierid) on **valideeritud prototüübiga** (`proto/`); tulemused ja tehtud muudatused: [VALIDEERIMINE.md](VALIDEERIMINE.md). Tootekood on `src/fms_sim.js` (etapp 4): sama loogika + `Enumerate` (osa 2.1) ja andmekontroll (osa 2.2). Animaator (etapp 5): osa 14. Redaktor (etapp 6): osa 15 (`src/fms_ed.js`, `src/fms_ed_data.js`). Osa 11 (AGV-d) on veel valideerimata.

Nimetamise reeglid ja globaalsete nimede sõnastik: osa 12.

Iga otsuse juures on märge:
- **[O]** – originaal, nagu dokumendis;
- **[T]** – originaali täpsustus (dokumendis puudu või ebaselge, lahendus on originaali vaimus);
- **[U]** – uus lahendus (originaalist erinev või lisatud).

Ulatus: esimeses järgus ainult **pidevad konveierid** (suletud silmus). Diskreetsed rajad (transpordirobotid, AGV-d – osa 11), kokkupõrked ja rikked tulevad hiljem (etapid 7–8), aga andmemudel arvestab nendega.

---

## 1. Aeg ja peatsükkel

- Aeg on täisarvulised sekundid, globaalne `SYSTEM_TIME`. **[O]**
- Kell liigub 1 s kaupa (time mapping), sündmused on Event Listis. **[O]**
- `GetEvent` võtab sündmuse, mille `Time ≤ SYSTEM_TIME` (mitte ainult `=`). Nii ei jää ükski sündmus vahele. **[T]**
- **Peatsükli järjekord on muudetud**: `MinuteMan` töötab enne sündmuste töötlemist. Originaalis (joon. 5.3) oli `ProcEvent` enne `MinuteMan`-i, mistõttu `MinuteMan`-i tekitatud `StopMov` oleks töödeldud alles järgmisel sekundil. **[U]**

```
SimInit                        { algväärtused; Planner; hetke 0 sündmused }
repeat                         { SimStep }
  Inc(SYSTEM_TIME)
  MinuteMan                    { liigutab konveiereid ajavahemikus [t-1, t]; võib lisada StopMov }
  repeat
    ProcEvent                  { võtab esimese sündmuse Time <= t, kutsub EventHandleri }
  until NO_EVENTS
  DetectDeadlock               { ummiku tuvastus ja lahendus (5.3) }
  CheckInvariants              { ainult testides }
  Animator; SimStat            { ainult brauseris }
until SIMULATION_DONE
```

Valideeritud: ühe detaili tsükliaeg klapib käsitsi arvutusega sekundi täpsusega (VALIDEERIMINE.md, test A1).

- Sama aja sündmused töödeldakse lisamise järjekorras (FIFO). **[O]**
- Handler võib lisada sündmuse ka käesolevale hetkele – see töödeldakse samas sisetsüklis. **[T]**
- Täpsus: konveieri peatumine „klõpsatakse“ jaama kohale, viga on alla 1 s ühe peatumise kohta. Kui see osutub liiga suureks, saab sammu hiljem väiksemaks teha. **[T]**

---

## 2. Rajavõrk ja asukohad **[U]**

Originaalis oli igal rajaikoonil oma pikkus ja ikoonid olid mälus ahelloendites. Tulemus: tüütu sisestamine ja kiiruse hüpped ikoonide vahel.

Uus lahendus:

- Ruudustik ja ikoonid jäävad (joon. 5.4). Need on **ainult joonis**.
- Protseduur `Enumerate` **[O nimi, U sisu]** käib ruudustiku läbi ja koostab **rajavõrgu**:
  - **sõlm** (`Node`): hargnemine (`Tee*`), ristmik (`Cruise`), raja ots, **jaam**;
  - **jaam** (`Station`): koht, kus 0-pikkusega punktiirühendus seob raja objektiga (puhver, `FromCS`, `ToCS`, `SysOut`, konnektor). Kärud peatuvad ainult jaamades. **[O]** (lk 54)
  - **lõik** (`Edge`): järjestikused rajaikoonid kahe sõlme vahel; teab oma rada, ikoone (joonistamiseks) ja pikkust cm-tes.
- Pikkus:
  - mudelil on mõõtkava (`Scale`, cm ikooni kohta). Sirge ikoon = 1 ühik, kaar = π/4 ühikut;
  - lõigule saab anda käsitsi pikkuse (**metrokaart**). See jaotub lõigu ikoonidele ühtlaselt, nii et lõigu sees on kiirus ekraanil ühtlane. Kokkusurutud lõik tähistatakse kaardil katkestusmärgiga `≈`.
- Asukoht rajal = (lõik, kaugus lõigu algusest cm). Suletud konveieril lihtsalt kaugus silmuse algusest `0 … L`.
- Lõigul on suund: pidevatel radadel alati raja liikumissuund; diskreetsetel radadel kas **ühesuunaline** või **kahesuunaline** (vt osa 11).
- Pidevatel radadel hargnemisi ei tohi olla (originaali kontroll nr 2), diskreetsetel on hargnemised ja ristmikud lubatud. **[O]**
- Kõik on massiivides ja viidatakse indeksiga; ikoonide ahelloendeid pole vaja.

### 2.1 `Enumerate` – teostus (etapp 4) **[T + U]**

Etapis 4 toetab `Enumerate` **ühte suletud pidevat konveierit**. Mitu rada, konnektorid ja avatud konveier tulevad etapis 7 koos rajavõrgu graafiga; seni annab kontroll selge vea „… pole veel toetatud“.

- **Ikoonide küljed** (`IconTypes[...].Ports`, `fms_glb.js`): `HorTr` W–E, `VertTr` N–S, kaared oma kahe küljega (`ArcSE` = S, E), `Tee*` läbib W–E või N–S ja haru (`Branch`) on nimes olev külg (`TeeN` → haru N), `Cruise` neli külge. Y kasvab alla.
- **Suunanool** **[O]**: originaalis oli pideva raja liikumissuund nool ühe raja ikooni kõrval („kirjeldatakse ühel raja ikoonil“). Mudelis on see lahtri väli `"Dir": "N" | "E" | "S" | "W"` – **külg, kust kärud ikoonist väljuvad**. Lubatud ainult raja sirgel ja kaarel ning ainult ikooni külgede suunas (`DirectionPorts`): `HorTr` → `E`/`W`, `ArcSE` → `S`/`E`; hargnemisel, ristmikul ja punktiirühendusel noolt ei ole (`CheckModel`). Diskreetsel rajal noolt ei kasutata.
- **Mitu noolt** **[T]**: lubatud, kui need on kooskõlas (sama ringi suund); vastuolu on viga. Originaali lahendust me ei tea.
- **Silmus** (`TraceLoop`): alustatakse esimesest noolega ikoonist, väljutakse noole küljest ja liigutakse naabrite kaudu, kuni jõutakse tagasi. Vead: naaber puudub või ei sobi (rada pole suletud, viga 1), ristmik või haru, mis pole punktiirühendus (viga 2), sama lahter kaks korda, raja ikoon silmusest väljas.
- **Jaam** (`FindStations`, `FollowDotLink`): igal hargnemisel peab haru olema punktiirühendus (üks või mitu `Dot`-ikooni, võib ka kohe objekt olla), mis viib puhvri, `FromCS`, `ToCS` või `SysOut`-ini. Jaama asukoht on hargnemisikooni keskpunkt.
- **Pink ↔ puhver** (`LinkMachines`) **[T]**: puhver on vahetult pingi all või kohal. `MachToolDown` – üks puhver all (sisse ja välja), `MachToolUp` – üks puhver kohal, `MachToolThruDown` – sissetulev kohal, väljaminev all, `MachToolThruUp` – vastupidi. Sissetulev puhver on `InBuf`, `InOutBuf` või `TurnBuf`, väljaminev `OutBuf`, `InOutBuf` või `TurnBuf`.
- **Lõik ja pikkus** (`MeasureTrack`): lõik on rada kahe järjestikuse hargnemise keskpunkti vahel (hargnemisikoonist pool kummalegi poole). Sirge = 1, kaar = π/4 ikooni, korda `Scale`. `EdgeLengths` kirje leiab lõigu, mille sisemiste lahtrite hulgas on **kõik** kirje lahtrid (piisab näiteks esimesest ja viimasest); käsitsi pikkus jaotub lõigu ikoonidele (ka hargnemise poolele) ühtlaselt. Kahe kõrvuti hargnemise vahelist lõiku ei saa üle kirjutada (sisemisi lahtreid pole).
- **Nullpunkt** **[T]**: asukoht 0 on `FromCS` jaam; alguses on seal alus 0 (nagu prototüübis). Asukohad ümardatakse 0,001 cm-ni, et ujukomavead ei mõjutaks peatumist.
- **Tulemus** – simulatsiooni võrk (`SimInit`-i sisend): `Tracks` (pikkus, ikoonid koos asukohtadega, lõigud), `Stations` (asukoha järjekorras), `Buffers` ja `Machines` – ainult need, mis on joonisel (`ModelIndex` = indeks mudelifailis), `Storage` (null, kui `ToCS`-i pole), `Workpieces`, `Sim`. Animaator (etapp 5) kasutab ikoonide asukohti kärude joonistamiseks.

### 2.2 Andmekontroll (originaali vead 1–8) **[O + T]**

`CheckModel` kontrollib faili struktuuri laadimisel, `Enumerate` (`TraceLoop`, `DetectOpenCons`, `CheckObjects`, `LinkMachines`, `FindConflicts`) võrku enne simulatsiooni. Vead peatavad, hoiatused mitte.

| Originaali viga | Kontroll | |
|---|---|---|
| 1. topoloogia pole suletud | rada katkeb, ikoonid ei sobi kokku, punktiirühendus ei vii objektini / pole rajaga ühendatud | viga |
| 2. pidevatel radadel on harusid | haru, mis pole punktiirühendus; ristmik | viga |
| 3. kesklaos liiga vähe kohti | `Capacity ≤ ParkingReserve` | hoiatus |
| 4. pingid ei tee marsruudi operatsioone | operatsiooni ei tee ükski **joonisel olev** pink (`FindConflicts`; etapist 6 mitte enam `CheckModel`-is, et redaktoris pooleli mudel jääks salvestatavaks) | viga |
| 5. pideval rajal pole suunda | noolt pole; nooled vastuolus | viga |
| 6. radadel rohkem kohti kui puhvrites | `Carts × PlacesPerCart > Σ Capacity` | hoiatus |
| 7. puhvrid järjestikku | puhver vahetult teise puhvri kohal | viga |
| 8. pingil puhver puudu | pingi ikooni järgi oodatud puhver puudub või on vale liiki | viga |
| lisaks **[T]** | `FromCS` ja `SysOut` täpselt üks, `ToCS` kõige rohkem üks (ja siis `Storage` olemas); objekt joonisel üks kord ja ühendatud ühe jaamaga; puhver seotud ühe pingiga; detailitüübid ja pingid olemas; `EdgeLengths` leiab lõigu; joonisel puuduv rada / pink / puhver → hoiatus | |

---

## 3. Objektid ja olekud

### 3.1 Konveier (pidev rada, suletud) **[O + T]**

| Parameeter | Tähendus |
|---|---|
| `Speed` | cm/s |
| `Carts` | kohtade (alustade, `Pallette`) arv konveieril |
| `PlacesPerCart` | mitu detaili alusele mahub (esimeses järgus 1) |
| `LoadTime` | detaili peale- või mahalaadimise aeg, s |
| `AccessTime` | esmakordse pöördumise aeg, s (esimeses järgus ei kasuta) |
| `Direction` | liikumissuund |

- Alused on konveieril võrdsete vahedega `Length / Carts` ja liiguvad koos: konveieril on üks nihe `Offset`, alus `palletIndex` asub kohal `(Offset + palletIndex · Length / Carts) mod Length`. **[T]**
- Olek: `StopCount` – mitu laadimist parasjagu käib. Kui `StopCount > 0`, seisab **kogu konveier** (lk 45). **[O]**
- Alus peatub jaamas ainult siis, kui seal on **tegevus**:
  - **mahalaadimine**: alusel on detail, mille sihtkoht on see jaam;
  - **pealelaadimine**: alus on tühi ja jaamas ootab detail, millele on sihtkoht juba broneeritud (vt 5.2).

  Muidu sõidab alus mööda. **[T]**
- Kui samas jaamas on mõlemad, tehakse enne maha- ja siis pealelaadimine, konveier seisab vahepeal edasi. **[T]**

### 3.2 Puhver **[O + T]**

- Parameetrid: `Capacity`, `Discipline` (FIFO / FILO / RANDOM), `LoadTime`, `Kind` (`InBuf`, `OutBuf`, `InOutBuf`, `TurnBuf`).
- Puhver seob tööpingi raja jaamaga: rada ↔ puhver ↔ tööpink. **[O]** (lk 32)
- Puhvri kohtadel on suund:
  - **sisse** (rajalt pingi poole) – detail ootab tööpinki;
  - **välja** (pingilt raja poole) – detail ootab transporti.

  `InBuf` ainult sisse, `OutBuf` ainult välja, `InOutBuf` ja `TurnBuf` mõlemat (ühine mahutavus). **[T]**
- Igal kohal on **broneering**: koht loetakse hõivatuks juba siis, kui sinna on detail teele saadetud. **[U]**

### 3.3 Tööpink **[O + T]**

- Parameetrid: `Name`, `Model`, `LoadTime`, `SetupTime`, `Ops` (sooritatavad operatsioonid). Esimeses järgus mahub pinki 1 detail.
- Olekud:

```
         Load (puhvrist)            Turn              Process
IDLE ───────────────► LOADING ──► SETUP ──► PROCESSING ──┬─► SETUP (järgmine op samas pingis)
  ▲                                                       └─► UNLOADING ──► IDLE
  └──────────────────────────────────────────── Load (puhvrisse) ┘
                       DOWN – rike (etapp 8)
```

- `SETUP` kestus: `SetupTime`, kui operatsioon erineb pingi eelmisest operatsioonist, muidu 0. **[T]**
- Pink võtab detaili puhvrist **ainult siis, kui selle detaili jaoks on puhvris väljumise koht broneeritud**. Nii ei jää pink kunagi töödeldud detailiga kinni. **[U]**
- **Ummiku vältimine** (`ReserveNextBeforeStart`, vaikimisi sees): pink alustab detailiga alles siis, kui detaili **järgmise pingi** sissetulev koht on broneeritud (kui järgmine operatsioon on mujal). Valideerimine näitas, et ilma selleta tekivad ristmarsruutidel ummikud igasuguse puhvri suuruse juures. **[U]**
- Pink käib ootavad detailid läbi distsipliini järjekorras ja võtab **esimese, millega saab alustada** (mitte ainult esimese). **[T]**
- Laadimise alguses viiakse detail puhvrist kohe pingi juurde (`Location` = pink); nii vabaneb koht väljamineva broneeringu jaoks ka ühise mahutavusega puhvris. **[T]**

### 3.4 Keskladu ja süsteemi väljund **[T]**

- `FromCS` – uute detailide allikas. Esimeses järgus on toorikuid piiramatult; määrav on Planneri sissetoomise reegel.
- `ToCS` – valmis detailide ladu (mahutavus `Capacity`).
- `SysOut` – süsteemist väljumine, piiramatu.
- Valmis detail läheb `ToCS`-i, kui see on olemas ja seal on ruumi, muidu `SysOut`-i. Praak läheb alati `SysOut`-i.
- Kesklaos jääb `ParkingReserve` kohta (vaikimisi 2) vabaks ummiku lahendamiseks (5.3): valmis detailid neid ei täida. **[U]**

### 3.5 Detail (`SysWP`) **[O + T]**

| Väli | Sisu |
|---|---|
| `Id` | number |
| `Type` | detailitüüp (`Workpieces`, max 16) |
| `Route` | valitud marsruut |
| `OpIndex` | järgmine operatsioon marsruudis |
| `Location` | kus on: (objekt, koht) – jaam, alus, puhver, pink |
| `Destination` | broneeritud sihtkoht või puudub |
| `TimeIn`, `TimeOut` | sisenemise ja väljumise aeg |
| `TimeProcess`, `TimeSetup`, `TimeTransport`, `TimeLoad`, `TimeWait` | kogunenud ajad tsükliaja jaoks |

---

## 4. Sündmused ja EventHandlerid

### 4.1 Kirje **[O + U]**

Originaali väljad `Event`, `WP`, `ObjType`, `ObjCode`, `Track`, `Time`, `Next` jäävad. Lisandub:
- `SrcType`, `SrcCode` – laadimise lähteobjekt. Originaalis oli `Load` ühe objektiga, aga laadimisel osaleb kaks objekti (nt alus ja puhver). **[U]**
- `Pal` – aluse number konveieril. **[U]**

### 4.2 Sündmused (pidevad konveierid)

| Sündmus | Kes lisab | Mida handler teeb |
|---|---|---|
| `InSys` | Planner | Loob detaili `FromCS`-i jaama, valib marsruudi, kutsub Plannerit sihtkoha valimiseks. |
| `MoveZ` | `LoadProc` | `StopCount--`; kui 0, konveier liigub edasi. |
| `StopMov` | `MinuteMan` | Alus seisab jaamas. Määrab, kas maha- või pealelaadimine, ja lisab `Load` ajaks `t + loadTime`. |
| `Load` | `StopMovProc`, Planner, `ProcessProc` | Viib detaili lähtekohast sihtkohta, vabastab broneeringu. Edasi oleneb sihtkohast (vt 4.3). Kui detailil on juba broneeritud järgmine sihtkoht (3.3), saab ta selle kohe. |
| `Turn` | `LoadProc`, `ProcessProc` | Ümberhäälestus läbi → `Process` ajaks `t + kestus`. |
| `Process` | `TurnProc` | Operatsioon läbi, `opIndex++` → järgmine operatsioon samas pingis (`Turn`) või mahalaadimine puhvrisse (`Load`). Kutsub Plannerit. |
| `OutSys` | Planner | Kõik operatsioonid tehtud: määrab sihtkohaks `ToCS` / `SysOut`. |
| `DoNothing` | testid | Ei tee midagi. |

Operatsiooni kestus: ühtlane jaotus vahemikus `mean ± dev`, ümardatud täissekunditeks, vähemalt 1 s. **[T]**

### 4.3 `Load` – kuhu edasi **[T]**

| Sihtkoht | Järgmine samm |
|---|---|
| alus | `MoveZ` (konveier jätkab) |
| puhvri sissetulev koht | `MoveZ`; Planner (pink võib detaili võtta) |
| tööpink | `Turn` |
| puhvri väljaminev koht (pingist) | Planner (pink vaba, detailile otsitakse sihtkoht) |
| `ToCS` / `SysOut` | detail lahkub, statistika; `MoveZ`; Planner (võib tuua uue detaili) |

Laadimise kestus **[T]**: rada ↔ jaam – raja `LoadTime`; puhver ↔ tööpink – pingi `LoadTime`; rada ↔ keskladu – lao `LoadTime`.

### 4.4 Seos originaali graafiga (joon. 5.1)

```
InSys → (MoveZ) → StopMov → Load → MoveZ … StopMov → Load → Planner
Planner → Load (puhver → pink) → Turn → Process ─┬→ Turn
                                                  └→ Load (pink → puhver) → Planner → … → OutSys
```

Üleminek transpordipoolelt töötlemispoolele käib **ainult läbi Planneri**. **[O]**

---

## 5. Planner

### 5.1 Millal kutsutakse **[T]**

`Planner(põhjus)` kutsutakse:
- simulatsiooni alguses;
- kui detail jõudis puhvri sissetulevale kohale;
- kui pink vabanes;
- kui detail jõudis puhvri väljaminevale kohale;
- kui detail lahkus süsteemist.

Igal kutsel teeb Planner **täieliku ülevaatuse** samas järjekorras: (1) laadib vabad pingid (`LoadMachines`), (2) leiab ootavatele detailidele sihtkoha (`AssignDestinations`), (3) toob uusi detaile (`AdmitWorkpieces`). See on lihtsam ja töökindlam kui põhjusepõhine loogika ning prototüübis piisavalt kiire. **[T]**

Planner otsustab ja lisab sündmusi (`InSys`, `Load`, `OutSys`). **[O]** (lk 51) Täpsustus: broneeringud ja pingi laadimise alguse olek (`LOADING`) seab Planner ise, sest need peavad kehtima kohe, mitte alles sündmuse ajal. **[T]**

### 5.2 Mida otsustab

1. **Uue detaili sissetoomine** (`InSys`). **[O]**
   - Millal: kui `Ndet / (Ntm + Nmt + Nbuf) < Kl`, vaikimisi `Kl = 0.85`. Lisaks igal lahkumisel kontrollitakse uuesti. Teised originaali reeglid (kindel intervall, ajakava, partiid) on valitavad seadetes.
   - Mis tüüp: kõige vähem töödeldud tüüp (vaikimisi); valitavad ka „üks tüüp järjest“ ja „kõige rohkem vabu pinke marsruudis“.
2. **Marsruudi valik** sisenemisel. **[O]** Kriteeriumid: enim hetkel vabade pinkide operatsioone → lähim esimese operatsiooni pink → enim operatsioone samas pingis. Viik → marsruudi prioriteet.
3. **Sihtkoha valik ja broneerimine** (`FindMach`, `FindBuf`, `FindSysPos`). **[T + U]**
   - Kui detailil on järgmine operatsioon: sobivad pingid on need, mis teevad seda operatsiooni ja mille puhvris on vaba sissetulev koht. Valik: vaba pink → lühim järjekord → lähim konveieri liikumissuunas.
   - Kui operatsioone pole: `OutSys` → `ToCS` või `SysOut`.
   - **Detail läheb teele ainult siis, kui sihtkoht on broneeritud.** Seni ootab ta oma kohal. **[U]** See tagab, et alus ei jää kunagi detailiga tiirlema ja konveier ei ummistu.
4. **Pingi laadimine puhvrist**: kui pink on `IDLE` ja puhvris ootab detail, valitakse see puhvri distsipliini järgi (FIFO / FILO / RANDOM) ja broneeritakse väljaminev koht. **[O + U]**
5. **Järgmine operatsioon**: kui seda saab teha samas pingis, tehakse seal. **[O]**

### 5.3 Ummikud **[U]**

Ka broneerimisega võib tekkida ringootamine: pingi A väljaminev detail ootab kohta pingi B puhvris ja vastupidi, ning kõik puhvrid on täis.

- **Vältimine**: sissetoomise piir `Kl`, broneerimine, reegel „pink ei alusta ilma väljaminevat kohta broneerimata“ ja **järgmise pingi koha broneerimine enne töötlemist** (3.3). Valideerimine: vältimisega ei tekkinud stressitestis ühtegi lahendamatut ummikut ja parkimisi oli 1–3; ilma selleta ummistus süsteem igasuguse puhvri suuruse juures.
- **Avastamine** (`FindDeadlockedWorkpieces`): igal sekundil arvutatakse püsipunktini, millised puhvrid **saavad edasi liikuda** – neis on vaba koht või broneering, nende pink töötab, sissetuleva detaili saab pink võtta (sh järgmise koha broneering) või väljaminev detail saab sihtkoha mõnes vabas / edasi liikuvas puhvris. Täis puhvrid, mis edasi liikuda ei saa, on ummikus. Esimene versioon (ummik = `StallTime` sekundit ootamist) andis koormuse all **valehäireid** (stsenaariumis B pargiti 19 detaili ilma tegeliku ummikuta) ja asendati.
- **Lahendus**: ummikus puhvri kauem oodanud detail (väljaminev või sissetulev) saadetakse ajutiselt kesklattu (`ToCS`, pargitakse) ja Planner toob selle hiljem `FromCS` kaudu tagasi. Kui keskladu puudub või on täis, simulatsioon peatub ja teatab ummikust – see on ka kasulik tulemus: struktuur ei sobi antud koormusele.
- **Varukontroll**: kui midagi ei toimu `StallTime` sekundit (vaikimisi 600) ja süsteemis on detaile → peatub ja teatab.

---

## 6. `MinuteMan` (pidevad konveierid) **[O + T]**

Iga konveieri kohta, kui `StopCount = 0`:

1. uus nihe `newOffset = Offset + Speed · 1 s`;
2. iga aluse kohta vaadatakse, kas ta ületas selle sekundi jooksul mõne jaama, kus on tema jaoks tegevus (3.1);
3. kui jah, võetakse **lähim** selline ületus: nihe pannakse nii, et alus seisab täpselt jaamas, `StopCount++`, lisatakse `StopMov` käesolevale hetkele;
4. muidu `Offset := newOffset`.

Korraga peatub konveier ainult ühe aluse pärast. Teised tegevused tulevad järgmistel sekunditel.

---

## 7. Statistika **[O + T]**

- Detaili kohta: `TimeIn`, `TimeOut`, töötlemis-, häälestus-, transpordi-, laadimis- ja ooteaeg. Tsükliaeg `Tts` ja osakaalud: töötlemine, ootamine, transport (ptk 8.5 originaalis).
- Pingi kohta: aeg igas olekus → rakendatus, töötlemise / häälestuse / laadimise / jõudeoleku osakaal, tehtud operatsioonide arv.
- Puhvri kohta: keskmine ja maksimaalne täituvus.
- Konveieri kohta: liikumise ja seismise osakaal, peatuste arv.
- Detailitüübi kohta: sisse toodud, valmis, keskmine tsükliaeg.
- Süsteem: läbilaskevõime (detaili tunnis), keskmine ja suurim detailide arv süsteemis, kesklattu pargitud.
- **Aegrida** (`Stats.Timeline`, Dynamic-aruande jaoks, etapp 9) **[U]**: iga `SampleInterval` sekundi järel (vaikimisi 60, ka algus ja lõpp) detailid süsteemis, valmis, hõivatud pingid, puhvrite täituvus.
- Kõik tuleb `SimReport`-ist; menüü *Simulate* näitab sellest lühikokkuvõtet (etapp 4), täielikud aruanded tulevad etapis 9.

---

## 8. Andmemudel (`*.fms.json`) **[U]**

```json
{
  "Meta":    { "Name": "Näidis", "Version": 1 },
  "Scale":   100,
  "Layout":  { "Dim": { "X": 13, "Y": 4 },
               "Cells": [ { "X": 2, "Y": 0, "T": "FromCS" },
                          { "X": 5, "Y": 1, "T": "HorTr", "N": 1, "Dir": "E" } ] },
  "EdgeLengths": [ { "Cells": [[3,2],[4,2]], "Length": 1500 } ],
  "Tracks":     [ { "Name": "Konveier", "Mode": "Continuous", "Carts": 8, "PlacesPerCart": 1,
                    "Speed": 20, "LoadTime": 10, "AccessTime": 0 } ],
  "Machines":   [ { "Name": "MT1", "Model": "", "LoadTime": 15, "SetupTime": 60,
                    "Ops": ["treimine", "puurimine"] } ],
  "Buffers":    [ { "Capacity": 3, "Discipline": "FIFO", "LoadTime": 5 } ],
  "Storage":    { "Capacity": 50, "LoadTime": 20 },
  "Workpieces": [ { "Name": "Võll", "Priority": 1, "Batch": 10,
                    "Routes": [ { "Priority": 1,
                                  "Ops": [ { "Op": "treimine", "Mean": 300, "Dev": 30 } ] } ] } ],
  "Sim":        { "Seed": 1, "Duration": 28800, "Kl": 0.85, "StallTime": 600 }
}
```

- Objektide seos ruudustikuga: lahtril on ikooni tüüp `T` ja järjenumber `N` vastavas massiivis (originaali väljad, lk 51). Rada ja jaamad tuletatakse `Enumerate`-ga.
- `N` on **1-põhine** järjenumber (nagu nimed MT1, BUF1): rajaikoonil `Tracks`-is, pingil `Machines`-is, puhvril `Buffers`-is. `FromCS`, `ToCS`, `SysOut` ja konnektoritel `N` puudub. **[T]**
- Punktiirühendus (loogiline ühendus, pikkus 0, lk 54) on rajaikoon väljaga `"Dot": true`; sellel pole `N`-i. Jaam tekib seal, kus punktiirühendus liitub rajaga (hargnemisikoon `Tee*`). **[T]**
- Suunanool on raja sirge või kaare väli `"Dir"` (osa 2.1). **[O]**
- `Storage: null` tähendab, et kesklattu pole (stsenaarium C0).
- Mudeli struktuuri kontrollib `CheckModel` (`src/fms_glb.js`) laadimisel; rajavõrgu ja andmete kontroll on `Enumerate`-s (osa 2.2).
- Tööpingi ja puhvri seos tuletatakse naabrusest ruudustikus (puhver vahetult pingi all/kohal, osa 2.1).

---

## 9. Valideerimine (etapp 2)

| Stsenaarium | Mida kontrollib |
|---|---|
| **A. Üks pink** – üks konveier, `FromCS` → puhver → pink → `SysOut`, kindlad ajad, üks detailitüüp | Tsükliaeg ja läbilaskevõime peavad klappima käsitsi arvutusega (pudelikael = max(töötlemine + laadimised, transport)). |
| **B. Näidis-PTS** – joon. 5.5: kaks pinki, `InOutBuf` ja `TurnBuf`, `FromCS`, `ToCS`, `SysOut` | Töötab lõpuni, mõistlik statistika. |
| **C. Ristmarsruudid** – kaks tüüpi detaile, A→B ja B→A, väikesed puhvrid, kõrge `Kl` | Ummik tekib → avastatakse → lahendatakse kesklao kaudu. |
| **D. Juhuslikkus** – sama seeme kaks korda | Tulemused identsed. |
| **E. Vastassuunas kärud** – diskreetne rada, kaks käru vastassuunas samal kahesuunalisel lõigul (etapp 7) | Kokkupõrget ei toimu; vastastikune ootamine avastatakse ja Planner lahendab selle (ümbersõit või ootele). |
| **F. Ristmik** – mitu käru, kõigi teekond läbi sama ristmiku (etapp 7) | Ristmikul on korraga üks käru; keegi ei jää lõputult ootama. |

Invariandid, mida kontrollitakse igal sekundil:
- detailide arv: sisse tulnud − lahkunud = süsteemis olevad;
- igal kohal (alus, puhvri koht, pink) on max 1 detail, broneeringud ei ületa mahutavust;
- `SYSTEM_TIME` ei vähene, Event Listis pole sündmust `Time < SYSTEM_TIME` pärast sisetsüklit;
- `StopCount ≥ 0` ja seisev konveier ainult siis, kui mõni laadimine käib;
- (diskreetsed rajad) igas tsoonis on max 1 käru ja käru on ainult tsoonis, mille ta on broneerinud.

---

## 10. Varem lahtised küsimused (ettepanekud kinnitatud)

1. **Avatud konveier** (mitte silmus): mis juhtub detailiga, mis jõuab raja lõppu? Ettepanek: konveier seiskub, kuni see maha laaditakse; Planner ei saada detaili teele, kui sihtkoht pole raja suunas eespool. *Teostus ja valideerimine: etapp 7.*
2. **Konnektor** (radade ühendus): kas see on lihtsalt kahe raja jaam, kus detail tõstetakse ühelt rajalt teisele (puhver mahutavusega 0, `Load` + `Load`)? Ettepanek: jah. *Teostus ja valideerimine koos mitme rajaga: etapp 7.*
3. **`AccessTime`** (keskmine pöördusaeg): tähendus on ebaselge. Ettepanek: lisaviivitus enne esimest laadimist, kui konveier oli seisnud – või jätta kasutamata.
4. **Mitu detaili alusel** (`placesPerCart > 1`) ja **mitu detaili pingis**: esimeses järgus 1, hiljem laiendada.

---

## 11. Diskreetsed rajad: transpordirobotid ja AGV-d (etapp 7)

Originaalis: diskreetne transpordirada (`DISCTRACK`), kus transporti teevad **transpordirobotid (TRB)** või **automaatkärud (AGV)** (lk 29–30); sündmus `Collision`, protseduurid `ProgTM` ja `FindPal`; konfliktid lahendab Planner (lk 43). **[O]**

Tänapäevased nimetused: **AGV** (*automated guided vehicle*, automaatjuhitav käru) ja **RGV** (*rail-guided vehicle*, rööbaskäru). Simulatsiooni jaoks on need samad: kärud, mis liiguvad etteantud radadel iseseisvalt ja eri suundades.

### 11.1 Käru kui iseseisev objekt **[O + T]**

- Raja parameetrid (tabel 4.1): kärude arv, kohtade arv kärul, kiirus, laadimisaeg, pöördusaeg. **[O]**
- Igal kärul (`Pallette`) on oma asukoht (lõik, kaugus), teekond (sõlmede loend), sihtkoht ja olek:

```
IDLE ──► TO_PICKUP ──► LOADING ──► TO_DROP ──► UNLOADING ──► IDLE
  │            ▲                                              │
  └─► PARKING ─┘   (vaba käru sõidab parkimiskohta)           │
WAIT_ZONE – ootab järgmise tsooni vabanemist (igast sõiduolekust)
DOWN – rike (etapp 8)
```

- Käru peatub ainult jaamas, parkimiskohas või tsooni piiril, kui järgmine tsoon on kinni. **[T]**
- Parkimiskohad: jaamad, mis on mudelis märgitud parkimiseks; kui neid pole, jääb vaba käru sinna, kus ta on. **[U]**

### 11.2 Töö jagamine kärudele – `FindPal` **[O nimi, T sisu]**

Transpordisoov tekib siis, kui Planner on detailile sihtkoha broneerinud (osa 5.2).

- **Soov otsib käru**: soovi saab lähim vaba käru (teekonna pikkuse järgi, mitte linnulennult).
- **Käru otsib soovi**: kui käru vabaneb ja ootel on mitu soovi, võtab ta kõige kauem oodanu (FIFO); valitavana ka lähim soov.
- Kui vaba käru pole, jääb soov järjekorda.

### 11.3 Teekond – `ProgTM` **[O nimi, U sisu]**

- „Käru programmeerimine“ = teekonna arvutamine ja kärule andmine.
- Lühim tee graafis Dijkstra algoritmiga; lõigu kaal = pikkus / kiirus.
- Ühesuunalisi lõike läbitakse ainult lubatud suunas.
- Kui tee on blokeeritud (osa 11.4), võib Planner kutsuda `ProgTM`-i uuesti, nii et blokeeritud tsoon jäetakse välja (ümbersõit).

### 11.4 Liikluse juhtimine: tsoonide broneerimine **[U]**

Originaalis avastati kahe käru ohtlik lähenemine (`Collision`), kärud seisati ja Planner programmeeris need ümber. Tänapäevane ja töökindlam viis on **kokkupõrkeid vältida** tsoonide broneerimisega, nagu raudtee blokisignalisatsioonis:

- **Tsoon** = lõik või sõlm (ristmik, hargnemine). Pikad lõigud võib tükeldada mitmeks tsooniks (pikkus `ZoneLength`, vaikimisi kogu lõik).
- Tsoonis on korraga **üks käru**.
- Käru broneerib järgmise tsooni **enne** sinna sisenemist. Kui tsoon on kinni, peatub käru oma tsooni lõpus olekus `WAIT_ZONE`.
- Tsoon vabaneb, kui käru on sellest täielikult väljunud.
- Ühesuunalisel lõigul võib tsoonis olla ka mitu käru üksteise järel (järjekorras), kui `ZoneLength` on väiksem kui lõik. **[T]**

### 11.5 `Collision` – vastastikune ootamine **[O nimi, U tähendus]**

Tsoonide broneerimisega kokkupõrget ei toimu, kuid kärud võivad üksteist **lõputult oodata**, näiteks:
- kaks käru vastassuunas sama kahesuunalise lõigu otstes;
- kärud ristmikul ringiootamises (A ootab B tsooni, B ootab A oma).

Seetõttu:
- `MinuteMan` kontrollib igal sekundil ootegraafi (kes keda ootab). Kui leiab ringi, lisab sündmuse `Collision`.
- `CollisionProc` kutsub Plannerit, mis valib ühe ringis oleva käru (madalam prioriteet: tühi käru enne koormaga, siis lühem ooteaeg) ja kas
  1. arvutab talle uue teekonna, mis väldib kinnist tsooni (`ProgTM`), või
  2. saadab ta lähimasse vabasse jaama või parkimiskohta, et teised saaksid mööda.
- Kui kumbki ei õnnestu, simulatsioon peatub ja teatab ummikust (struktuuri probleem).

### 11.6 `MinuteMan` diskreetsetel radadel **[O + T]**

Iga käru kohta, kes on sõiduolekus:

1. arvutab uue asukoha `Distance + Speed · 1 s` mööda oma teekonda;
2. kui teel on tsooni piir ja järgmine tsoon pole broneeritud → üritab broneerida; kui ei saa, peatub piiril (`WAIT_ZONE`);
3. kui jõuab sihtjaama → peatub täpselt jaamas, lisab `StopMov` käesolevale hetkele;
4. vabastab tsoonid, millest on täielikult väljunud.

Seejärel ootegraafi kontroll (11.5).

Sündmused jäävad samaks: `MoveZ` (käru alustab sõitu), `StopMov` (jõudis jaama), `Load` (peale/maha, väli `Pal` = käru number), `Collision`.

### 11.7 Andmemudeli lisad

```json
"Tracks": [ { "Name": "AGV", "Mode": "Discrete", "Carts": 3, "PlacesPerCart": 1,
              "Speed": 50, "LoadTime": 15, "AccessTime": 0,
              "Dispatch": "Nearest", "ZoneLength": 0 } ],
"EdgeDirections": [ { "Cells": [[5,1],[6,1]], "Dir": "OneWay", "From": [5,1] } ],
"Parking": [ [2,3] ]
```

- `ZoneLength: 0` tähendab: tsoon = terve lõik.
- Lõigud on vaikimisi kahesuunalised; `EdgeDirections` muudab ühesuunaliseks.

### 11.8 Riskid, mida prototüüp kontrollib

- Ummikud kahesuunalistel lõikudel ja ristmikel (stsenaariumid E, F).
- Kas tsooniks sobib terve lõik või tuleb pikad lõigud tükeldada (läbilaskevõime vs keerukus).
- Kas kärud jõuavad tühisõitudega töö järel (kärude arv vs läbilaskevõime).

---

## 12. Nimetamine ja sõnastik

Eesmärk: kood peab olema inimloetav. Nimest peab olema näha, **mis rolli asi täidab** ja **kas see on kogu programmi (globaalne) või kohalik mõiste**. Originaali nimed jäävad; uued nimed on samas stiilis.

### 12.1 Reeglid

| Mis | Stiil | Näited |
|---|---|---|
| Globaalne protseduur / funktsioon | `PascalCase`, verb ees, ingliskeelne | `GetEvent`, `PutEvent`, `FindMach`, `ReserveSlot` |
| Sündmuse käsitleja (EventHandler) | sündmuse nimi + `Proc` | `StopMovProc`, `LoadProc` |
| Globaalne andmestruktuur | `PascalCase`, nimisõna; massiiv lõpeb `Array` või on mitmuses | `MachineArray`, `SysWPArray`, `Tracks`, `Workpieces` |
| Globaalne olek, lipp, simulatsiooni kell | `UPPER_SNAKE` | `SYSTEM_TIME`, `NO_EVENTS`, `SIMULATION_DONE` |
| Kirje väli ja mudelifaili (JSON) võti | `PascalCase` | `Event`, `WP`, `ObjType`, `LoadTime`, `PlacesPerCart` |
| Olekumasina olek | `UPPER_SNAKE` | `IDLE`, `PROCESSING`, `WAIT_ZONE` |
| Sündmuse, objekti, ikooni tüüp | originaali nimi `PascalCase` | `InSys`, `MoveZ`, `Machine`, `Pallette`, `ArcNE` |
| Kohalik muutuja, parameeter | `camelCase`, täissõnad | `machineIndex`, `freeSlots`, `nextEvent` |
| Tsükliloendur | `i`, `j` ainult lühikeses tsüklis | |

Sellest tuleneb lihtne lugemisreegel: **suur algustäht = kogu programmi mõiste, väike algustäht = kohalik**.

Lisaks:
- **Lühendid**: ainult originaalist pärit (`WP`, `MT`, `BUF`, `CS`, `TR`, `TM`, `Pal`, `Mach`, `Buf`, `Proc`, `Sys`, `Kl`) ja üldtuntud (`AGV`, `Id`). Uut lühendit ei tehta – kirjutatakse täissõna.
- **Keel**: nimed inglise keeles nagu originaalis; kommentaarid ja kasutajale nähtavad tekstid eesti keeles (tekstid failis `fms_lng.js`).
- **Ühikud** on välja nimes, kui need pole ilmsed: `LoadTime` (s), `Speed` (cm/s), `Length` (cm) on dokumenteeritud siin; uutel väljadel lisatakse ühik nimesse, kui see on teine (nt `DelayMinutes`).
- **Iga globaalse protseduuri ees** on lühike kommentaar: mida teeb, kes kutsub, milliseid sündmusi lisab.
- **Päritolu tunnus** on päisekommentaari esimene märk, mitte nime osa (staatus võib muutuda, nimi ei muutu). Tunnused on samad mis selles dokumendis: `[O]`, `[T]`, `[U]`, `[O nimi, U sisu]`. Globaalsetel andmetel on tunnus deklaratsiooni real (`fms_glb.js`). Kõik uued asjad leiab käsuga `grep -rn "// \[U" .`

```js
// [O] FindMach – leiab sobivaima tööpingi detaili järgmisele operatsioonile.
//     Kutsub: Planner. Sündmusi ei lisa.
function FindMach(workpiece) { … }

// [U] ReserveSlot – broneerib puhvri koha enne detaili teelesaatmist.
//     Kutsub: Planner, FindMach. Sündmusi ei lisa.
function ReserveSlot(buffer, direction) { … }

let FirstAtMoment = null;   // [O] viit Event Listi esimesele kirjele
let EdgeArray = [];         // [U] rajavõrgu lõigud
```
- **Iga uus globaalne nimi** lisatakse allolevasse sõnastikku koos märkega [O] / [T] / [U].

### 12.2 Sõnastik – globaalsed nimed

**Kell ja juhtimine**

| Nimi | Roll | |
|---|---|---|
| `SYSTEM_TIME` | simulatsiooni kell, sekundit algusest | [O] |
| `NO_EVENTS` | lipp: käesolevaks hetkeks pole rohkem sündmusi | [O] |
| `SIMULATION_DONE` | lipp: simulatsioon on läbi | [O] |
| `SimInit` | algväärtused, mälu, kärude algasendid | [O] |
| `SimStep` | üks peatsükli samm (üks sekund) | [U] |
| `CheckInvariants` | kontrollib invariante (testides) | [U] |
| `DEADLOCK` | lipp: lahendamatu ummik, simulatsioon peatati | [U] |
| `SimRun`, `SimReport`, `SimState` | käivitab lõpuni; aruanne; olek lugemiseks (testid, animaator) | [U] |
| `Model`, `Options` | simulatsiooni võrk (`Enumerate` tulemus, `SimInit`-i koopia); käivitamise seaded (`fms_sim.js`) | [U] |
| `PARKING_RESERVE`, `SAMPLE_INTERVAL` | kesklao ummikuvaru (2 kohta); aegrea samm vaikimisi (60 s) | [U] |

**Sündmuste nimekiri**

| Nimi | Roll | |
|---|---|---|
| `FirstAtMoment` | viit Event Listi esimesele kirjele | [O] |
| `PutEvent` | lisab sündmuse aja järgi õigesse kohta | [O] |
| `GetEvent` | võtab esimese sündmuse, mille `Time ≤ SYSTEM_TIME` | [O] / [T] |
| `ProcEvent` | võtab sündmuse ja kutsub selle käsitleja | [O] |
| `EventHandlers` | sündmuse tüüp → käsitleja (`*Proc`) | [O] |

**Mudeli andmed**

| Nimi | Roll | |
|---|---|---|
| `Layout`, `LayoutDim` | ikoonide ruudustik ja selle mõõdud | [O] |
| `Tracks` | rajad | [O] |
| `MachineArray` | tööpingid (parameetrid + olek) | [O] |
| `BufferArray` | puhvrid | [O] |
| `Storage` | keskladu | [T] |
| `Workpieces` | detailitüübid (max 16) | [O] |
| `SysWPArray` | süsteemis olevad konkreetsed detailid | [O] |
| `NodeArray` | rajavõrgu sõlmed | [U] |
| `EdgeArray` | rajavõrgu lõigud | [U] |
| `StationArray` | jaamad (kus kärud peatuvad ja laaditakse) | [U] |
| `ZoneArray` | liiklustsoonid diskreetsetel radadel | [U] |
| `PalletArray` | kärud / alused | [T] |
| `TransportRequests` | ootel transpordisoovid | [U] |
| `Stats` | kogutud statistika (`Stats.Timeline` – aegrida) | [T] |

**Protseduurid**

| Nimi | Roll | |
|---|---|---|
| `Enumerate` | ruudustikust simulatsiooni võrk ja andmekontroll (osa 2.1–2.2) | [O nimi, U sisu] |
| `DetectOpenCons`, `FindConflicts` | andmekontroll: vabad otsad; andmete kooskõla (osa 2.2) | [O] |
| `TraceLoop`, `FindStations`, `FollowDotLink` | silmus suunanoole järgi; jaamad hargnemistel; punktiirühenduse järgimine | [U] / [U] / [T] |
| `CheckObjects`, `LinkMachines` | puhvrite, lao ja väljundi ühendused; pingi ja puhvri seos | [U] / [T] |
| `MeasureTrack`, `BuildNetwork` | lõigud, pikkused, asukohad; võrgu koostamine | [U] |
| `EnumError`, `EnumWarning`, `Neighbor`, `OtherPort`, `ObjectName`, `CellKey`, `CellPath`, `RoundPosition` | `Enumerate` abiprotseduurid | [U] |
| `MACHINE_BUFFER_SIDES`, `IN_BUFFER_KINDS`, `OUT_BUFFER_KINDS` | pingi ikoon → puhvrite asukoht; sobivad puhvri liigid | [T] |
| `ARC_LENGTH`, `POSITION_DECIMALS` | kaare pikkus (π/4 ikooni); asukohtade ümardus | [T] / [U] |
| `TimelinePoint`, `CompareScores` | aegrea punkt; kriteeriumide võrdlus | [U] |
| `MinuteMan` | liigutab konveiereid ja kärusid ühe sekundi võrra | [O] |
| `Planner` | otsused: sissetoomine, marsruut, sihtkoht, pingi laadimine, konfliktid | [O] |
| `FindMach`, `FindBuf`, `FindSysPos`, `FindPal` | sobivaima pingi / puhvri / väljundi / käru otsing | [O] |
| `ProgTM` | käru teekonna arvutamine | [O] |
| `ShortestPath` | lühim tee rajavõrgus (Dijkstra) | [U] |
| `ReserveSlot`, `ReleaseSlot` | koha broneerimine ja vabastamine | [U] |
| `ReserveZone`, `ReleaseZone` | tsooni broneerimine ja vabastamine | [U] |
| `DetectDeadlock` | ummiku lahendamine (parkimine) ja varukontroll | [U] |
| `FindDeadlockedWorkpieces` | ummikus olevad detailid (püsipunkt üle puhvrite) | [U] |
| `LoadMachines`, `AssignDestinations`, `AdmitWorkpieces` | Planneri kolm sammu | [T] |
| `ChooseRoute` | marsruudi valik sisenemisel | [O nimi, T sisu] |
| `NextOpElsewhere` | järgmine operatsioon, mis tehakse teises pingis | [U] |
| `OrderByDiscipline` | puhvri detailide järjekord (FIFO / FILO / RANDOM) | [O] |
| `PickupCandidate` | jaamas alust ootav detail | [U] |
| `FromCSQueue` | FromCS jaamas ootavad detailid | [T] |
| `ProcAllEvents` | sisetsükkel: kõik käesoleva hetke sündmused | [U] |
| `CheckModel` | mudelifaili struktuuri kontroll (väljad, tüübid, piirid, viited); kasutavad ka redaktori vormid | [U] |
| `EmptyModel`, `ModelSummary` | uus tühi mudel; lühikokkuvõte töölauale | [U] |
| abiprotseduurid | `SetWPState`, `SetMachState`, `CurrentOp`, `CanReserveSlot`, `StorageFree`, `StationDistance`, `StationLoadTime`, `BeginSetup`, `BeginPickup`, `BeginUnloadFromPallet`, `AfterPalletAtStation`, `WorkpieceLeaves`, `SampleDuration`, `Random` – vt päisekommentaarid `src/fms_sim.js`-is | [T]/[U] |
| `Animator`, `SimStatus`, `Transport` | kuvamine: pinkide, puhvrite ja ladude seis; üldseis ühe reana; alused ja detailid (`anima.js`, osa 14) | [O] |

**Mudeli konstandid** (`src/fms_glb.js`)

| Nimi | Roll | |
|---|---|---|
| `IconTypes` | ikooni tüüp → objekti liik, massiiv, millele `N` viitab (joon. 5.4); raja küljed `Ports`, haru `Branch`, kaar `Arc` | [O] / [T] |
| `DIRECTIONS`, `DirectionPorts` | suunad N/E/S/W (samm, vastaskülg); küljed, kuhu suunanool võib näidata | [T] / [O/T] |
| `MODEL_VERSION` | mudelifaili vormingu versioon (`Meta.Version`) | [U] |
| `MAX_WORKPIECE_TYPES` | detailitüüpe kõige rohkem (16) | [O] |
| `TRACK_MODES`, `BUFFER_DISCIPLINES` | lubatud raja liigid ja puhvri distsipliinid | [O] |

**Kasutajaliides** (etapp 3, osa 13)

| Nimi | Roll | |
|---|---|---|
| `Texts`, `FormatText` | kõik kasutajale näidatavad tekstid (`fms_lng.js`); kohatäidete `{Nimi}` asendus | [O] / [U] |
| `EnvironmentOptions`, `LoadOptions`, `SaveOptions` | keskkonna seaded (teema, värvid) brauseri mälus (`fms_opt.js`, originaalis `FMSS.CFG`) | [O] |
| `DemoModels` | kaasas olevad näidismudelid (`models/`) | [U] |
| `ParseModelText`, `ModelFileName` | failisisust kontrollitud mudel; mudeli nimest failinimi | [U] |
| `LoadDemoModel`, `ChooseLocalFile`, `SaveModel` | Load (näidis / fail arvutist), Save (allalaadimine) | [O] |
| `RecentModels`, `RememberModel` | Pick – 10 viimast mudelit brauseri mälus | [O] / [U] |
| `ROW_HEIGHT`, `EGA_WIDTH`, `EGA_HEIGHT`, `EgaPalette` | tekstirea kõrgus; EGA ekraan 640 × 350; 16 värvi | [U] / [O] |
| `CreateEgaTheme`, `CreateModernTheme`, `LoadEgaFont` | välimused; EGA pikslifondi laadimine | [U] |
| `ScreenCanvas`, `ScreenContext`, `ActiveTheme` | põhilõuend, selle kontekst, kehtiv välimus | [U] |
| `MainMenu`, `MENU_ACTIVE`, `MenuPath` | peamenüü; menüü on avatud; valitud punktid tasemete kaupa | [O] / [O] / [U] |
| `DialogStack`, `FullScreenPainter`, `FullScreenInput`, `DesktopPainter`, `Hotkeys`, `RedrawPending` | dialoogid; avaekraani joonistaja ja sisend; töölaua joonistaja; kiirklahvid; joonistamine järjekorras | [U] |
| `InitScreen`, `SetTheme`, `ResizeScreen`, `SetFullScreen`, `SetDesktop`, `SetHotkeys` | graafikateegi seadistamine | [O] / [U] |
| `RequestRedraw`, `Redraw`, `DesktopRect` | ekraani joonistamine; töölaua ala | [U] |
| `ParseLabel`, `MenuBarLayout`, `DropdownRect`, `StatusLayout` | menüü nimi ja kiirklahv; menüüde ja olekurea paigutus | [U] |
| `OpenMenu`, `CloseMenu`, `ChooseMenuItem` | menüü avamine, sulgemine, valiku täitmine | [O] / [U] |
| `MessageBox`, `ListBox`, `InputBox`, `DialogOpen`, `DialogLayout` | dialoogid: teade, nimekiri, tekstiväli | [O] / [U] |
| `KeyName`, `HandleKeyDown`, `HandlePointer` | klaviatuur ja hiir | [U] / [O] |
| `CurrentModel`, `CurrentFile` | laaditud mudel ja selle failinimi | [U] |
| `SPLASH_ACTIVE`, `SplashStart`, `SplashTimer`, `ShowSplash` | avaekraan | [U] |
| `EgaTheme`, `CurrentTheme`, `ChangeTheme`, `ChangeColorScheme` | välimuse valik (F2, Options) | [U] |
| `BuildMainMenu`, `NotYet`, `DrawDesktop`, `AcceptLoadedModel`, `Main` | peamenüü; „tuleb etapis N“ punkt; töölaud; laaditud mudeli vastuvõtt; peaprogramm | [O] / [U] |
| `MenuSimulate`, `SimSummaryLines` | Simulate: kontroll, animaator (osa 14), lõpus kokkuvõte dialoogis | [O] / [U] |
| `SIM_SHOWN_ERRORS`, `SIM_SHOWN_OBJECTS`, `CheckLine`, `Percent`, `Decimal` | kokkuvõtte piirid ja vormindus (%, koma); `ClockText` (h:mm:ss) on `anima.js`-is | [U] |
| `DesktopView`, `SetDesktopView`, `POINTER_CAPTURED`, `HandleWheel`, `InsideDesktop` | töölaua vaade (animaator): joonistaja, klahvid, hiir; lohistamine; hiire ratas | [U] |
| abiprotseduurid | `MenuItems`, `SelectedItem`, `DropdownItems`, `DrawMenuBar`, `DrawDropdown`, `DrawStatusLine`, `MoveInDropdown`, `HandleMenuKey`, `OpenDialog`, `CloseDialog`, `DrawDialog`, `HandleDialogKey`, `HandleDialogPointer`, `MenuLoad`, `MenuPick`, `MenuNew`, `MenuSave`, `MenuWriteAs`, `AskQuit`, `ShowHelp` – vt kommentaarid `src/windows.js`-is ja `src/fms.js`-is | [U] |

**Animaator** (`src/anima.js`, etapp 5, osa 14)

| Nimi | Roll | |
|---|---|---|
| `AnimState` | animaatori olek (jooksev, kiirus, eelmine nihe, kaardid, hiir); `null` – suletud | [U] |
| `StartAnimator`, `StopAnimator`, `AnimatorActive` | avamine (SimInit, pausil), sulgemine, kas avatud | [U] |
| `TrackGeometry`, `TrackPoint`, `CellPathPoint`, `ArcCorner` | raja ikoonid asukohtadega; asukoht rajal → punkt ruudustikus; punkt ikooni sees; kaare keskpunkt | [U] |
| `PalletPosition`, `InterpolateOffset` | aluse asukoht (sama valem mis `MinuteMan`-is); nihe kahe sekundi vahel | [T] / [U] |
| `WorkpiecePlaces`, `PlacePoint`, `BuildScene` | kus iga detail joonistatakse (ka laadimisel liikumas); koha punkt; kaadri andmed | [U] |
| `EventListArray`, `DiffEventList`, `EventAxisX`, `EVENT_TICKS`, `EventCardLayout`, `RelatedObjects` | Event List massiivina; lisandunud ja töödeldud kirjed; ajatelg ja selle märgid (kellaajana); kaartide veerud; kaardiga seotud objektid | [U] |
| `SPEED_STEPS`, `MAX_SPEED`, `SpeedFromSlider`, `SliderFromSpeed`, `NextSpeed`, `SpeedText`, `ClockText` | kiiruse skaala (×1 … ×1000) ja vormindus; aeg h:mm:ss | [U] |
| `LayoutView`, `DrawLayout`, `DrawIcon`, `ObjectLabel` | ruudustiku vaade ekraanil; ikoonid (kasutab ka redaktor) | [U] |
| `AnimatorPainter`, `DrawControlBar`, `ControlLayout`, `DrawEventStrip`, `DrawLinkedList` | töölaua joonistaja; juhtriba; Event List riba ja ahelloend | [U] |
| `AnimatorFrame`, `AdvanceSimulation`, `AnimatorInput`, `AnimatorKey`, `AnimatorHint` | kaader; simulatsioon edasi (time mapping); hiir ja klahvid; olekurea vihje | [U] |
| abiprotseduurid ja konstandid | `StepSimulation`, `CheckFinished`, `ScheduleFrame`, `WakeAnimator`, `ToggleRun`, `StepOnce`, `NextEvent`, `SetSpeed`, `ToggleMax`, `StopRun`, `ExitAnimator`, `SlotPoint`, `QueuePoint`, `DrawWorkpiece`, `DrawBufferSlots`, `DrawStorages`, `DrawSpindle`, `DrawMachineLetters`, `DrawTrackIcon`, `DrawDirectionArrow`, `MACHINE_ROLES`, `MACHINE_LINK_SIDES` jt – vt päisekommentaarid | [U] |
| teema primitiivid | `Line`, `Ellipse`, `Polygon`, `StrokeRect`, `RoundRect`, `Clip`, `Alpha`, `Slider` (teema meetodid); EGA-s `EgaLine`, `EgaArc`, `EgaFillEllipse`, `EgaFillPolygon` | [U] |

**Redaktor** (`src/fms_ed.js`, etapp 6, osa 15)

| Nimi | Roll | |
|---|---|---|
| `EditLayout`, `ViewLayout` | Layout (ruudustik ja palett); View (kogu mudel ilma ruudustikuta) | [O] / [U] |
| `MenuLayout`, `MenuView` | Edit → Layout, Edit → View (`fms.js`) | [O] |
| `StopEditor`, `EditorActive`, `ExitEditor`, `EditState` | sulgemine (uus mudel, Simulate); kas avatud; Esc; redaktori olek (`null` – suletud) | [U] |
| `MODEL_CHANGED`, `ConfirmDiscard` | mudel on salvestamata; küsimus enne Load / Pick / New (`fms.js`) | [U] |
| `OPERATIONS` | tööpinkide operatsioonid (tabel 4.2) – valikud redaktoris (`fms_glb.js`) | [O] |
| `PALETTE`, `PaletteTool` | ikoonipalett (tööriistad + originaali ikoonid); mida punkt teeb | [U] |
| `MAX_LAYOUT_DIM`, `UNDO_LIMIT` | ruudustik kuni 41 × 23 (originaali View); Undo samme 100 | [O] / [U] |
| `CellPorts`, `LinkedPorts`, `PortLinked`, `IsDotTarget` | raja küljed ikoonis; naabriga ühendatud küljed; kas punktiir võib lõppeda objektiga | [T] / [U] |
| `IconFromPorts`, `SetCellPorts` | automaatne ikoonivalik külgedest; lahtri ikoon uute külgede järgi | [U] |
| `LaySegment`, `LayPath`, `CellSteps`, `DirectionBetween`, `ExtendDragPath` | lõik kahe lahtri vahel; rada mööda teed; vahelahtrid; naabri suund; lohistamise tee (tagasi = lõik kaob) | [U] |
| `PlaceIcon`, `EraseCell`, `MoveCell`, `CycleDirection` | ikoon paletist (originaali klõps); kustutamine; liigutamine; suunanool | [O] / [U] |
| `ResizeLayout`, `CellsOutside`, `ParseDim` | ruudustiku mõõdud; välja jäävad ikoonid; „13 x 7“ | [U] |
| `EnsureTrack`, `AddObject`, `DropUnusedObject`, `CleanEdgeLengths`, `UniqueName` | uus rada; uus pink / puhver; viimase ikooniga kaovad andmed ja numbrid nihkuvad; metrokaardi pikkuste puhastus; MT1, MT2 … | [U] |
| `RestoreModel`, `BeginChange`, `CommitChange`, `UndoEdit`, `RedoEdit`, `ModelEdited` | mudeli sisu asendus (sama objekt); Undo / Redo | [U] |
| `EditorLayout`, `LayoutPainter`, `ViewPainter`, `DrawBufferKind` | akna osad (infurida, ruudustik, palett); joonistajad; puhvri liigi märk | [U] |
| `LayoutInput`, `LayoutKey`, `LayoutHint`, `ClickCell`, `StepWithTool`, `DragTo`, `FinishDrag`, `AskGridSize` | hiir ja klahvid; olekurea vihje; klõps; Shift + nool; lohistamine; ruudustiku suurus | [U] |
| `DeleteTrack`, `SegmentCells`, `EdgeLengthOf`, `SetEdgeLength` | raja kustutamine (ikoonid + andmed, numbrid nihkuvad); lõik hargnemiste vahel; metrokaardi pikkus | [U] |
| `ModelProblems`, `ProblemCell`, `ProblemsText` | vead ja hoiatused (`CheckModel`, siis `Enumerate`); veateate lahter joonisel; infurea arvud | [U] |
| `NoteEditorChange`, `SetEditorCursor`, `EditorCursorRect` | vormi muudatus Layout-i Undo-sse; kursor objektile; kursori ala (vorm ei kata seda) | [U] |
| `EditConfig`, `EditMachTool`, `EditBuffer`, `EditStorageData`, `EditTransportSystem`, `EditWorkpieceData` | objekti andmed vormis (`fms_ed_data.js`, originaali `FMS_ED1.PAS` protseduurid) | [O] |
| `EditModelData`, `EditRoute`, `RouteList`, `RouteText`, `RouteFields`, `ReadRouteDraft` | mudeli üldandmed (nimi, mõõtkava, `Sim`); marsruut (operatsioonide tabel); marsruutide nimekiri ja rida | [U] |
| `NewWorkpiece`, `CopyWorkpiece`, `FlushWorkpiece` | uus detailitüüp; Copy; Flush | [U] / [O] / [O] |
| `ConfigAllCells`, `KnownOperations` | Config → All järjekord; operatsioonide valik (pinkide omad, `OPERATIONS`, marsruutide omad) | [U] |
| `SubmitModelForm`, `FormValues`, `ParseNumber`, `NumberText`, `ModelForm`, `Done` | vormi kontroll `CheckModel`-iga mudeli koopial ja rakendamine; väärtused; arv ↔ tekst (koma); tavaline vorm; sulgemine | [U] |
| `ProblemLines`, `ShowProblems`, `SHOWN_PROBLEMS` | Edit → Check / Layout-is K: vead ja hoiatused nimekirjas, valik viib kohale | [U] |
| `MenuConfigAll`, `MenuConfigChoose`, `MenuCheck`, `NoteChange`, `FormContext` | Config (`fms.js`); Check; vormi muudatus (Undo, „muudetud“); vormi kontekst | [O] / [O] / [U] / [U] / [U] |
| `MenuNewTrack`, `MenuNewWorkpiece`, `MenuCopyWorkpiece`, `MenuFlushWorkpiece`, `ItemNumber` | Transport → Uus rada; Workpiece data → Uus / Copy / Flush; menüü number 1 … 9, A … | [U] |
| `FormBox`, `FormLayout`, `DrawForm`, `HandleFormKey`, `HandleFormPointer`, `PressFormButton`, `ChangeField`, `FieldWidth`, `LabelWidth`, `FieldText` | vormidialoog (`windows.js`): tekst, arv, valik, märkeruut, silt; Tab / nooled / hiir; vead välja juures; koht nii, et objekt jääb näha | [U] |
| abiprotseduurid ja konstandid | `LayoutGrid`, `InsideGrid`, `CellAt`, `SegmentEnd`, `ClampCursor`, `ClampScroll`, `GridView`, `CellUnder`, `ScrollArrows`, `DrawToolGlyph`, `DrawPaletteItem`, `DEFAULT_TRACK`, `DEFAULT_MACHINE`, `DEFAULT_BUFFER`, `DEFAULT_STORAGE` – vt päisekommentaarid | [U] |

---

## 13. Kasutajaliides (etapp 3) **[O + U]**

- **Moodulid** originaali järgi: `fms.js` (FMS.PAS), `windows.js` (WINDOWS.PAS), `fms_glb.js`, `fms_file.js`, `fms_opt.js`, `fms_lng.js`; uus `fms_theme.js` (välimused). Kood on kaustas `src/`, käivitab `index.html`.
- **Üks lõuend** (Canvas), kogu liides joonistatakse ise nagu originaalis. `windows.js` teab ainult paigutust ja loogikat ning kasutab värvide asemel **rolle** (`MenuBar`, `WindowText` …); teema annab rollidele värvid ja joonistab primitiivid (ristkülik, tekst, paneel, nupp).
- **Loogiline ekraan**: rida on 14 pikslit. EGA: 640 × 350 (80 × 25 märki), 16 värvi, font PxPlus IBM EGA 8x14, tähed teravaks (lävend), suurendus täisarvuline ja venitus 4:3 nagu EGA monitoril. Kaasaegne: sama paigutus, kuid ekraan on nii suur kui aken (kuni 1,5 CSS-pikslit loogilise piksli kohta), süsteemifont, ümarad nurgad, hele / tume / süsteemi järgi.
- **Menüü** nagu joon. 6.1–6.2: peamenüü üleval, alammenüüd vertikaalselt, nende alammenüüd nihkega paremal. Menüü nimed inglise keeles (originaal), vihjed ja teated eesti keeles. Hiljem valmivad punktid on hallid, aga valitavad – valik ütleb, mis etapis need tulevad. Directory, Change dir, Rename, Delete on välja lülitatud (brauseris pole ketast).
- **Klahvid**: F10 menüü, Alt + täht, nooled, Enter, Esc, F1 abi, F2 välimus, Alt-X lõpetamine. Olekureal on klahvid või valitud menüüpunkti vihje; klahvid on ka hiirega klõpsatavad.
- **Failid**: Load (näidismudel serverist või fail arvutist), Save / Write as (allalaadimine), Pick (10 viimast brauseri mälus). Laadimisel kontrollib `CheckModel` faili ja näitab vead eesti keeles.
- **Avaekraan**: DOS-i käsurida `C:\FMSS>FMS`, siis pealkiri ja read ükshaaval; esimene klahv lõpetab animatsiooni, teine viib töölauale. Quit viib tagasi avaekraanile.

---

## 14. Animaator (etapp 5) **[O + U]**

Originaalis (originaal.md 6.3): `Animator` joonistab kärude asukohad ning pinkide ja puhvrite olekud, `SimStatus` üldised suurused; side on ühepoolne. **[O]** Teostus: `src/anima.js`.

- **Ühepoolne side** **[O]**: animaator kutsub `SimInit` / `SimStep` ja loeb `SimState()`-i, aga simulaatori andmeid ei muuda. Test: samm-sammult koos olekut lugedes on aruanne sama mis `SimRun`-iga.
- **Avamine**: *Simulate* kontrollib mudelit (`Enumerate`) ja avab animaatori **pausil** töölaual (`SetDesktopView`). Menüü jääb kasutatavaks. Lõpus (aeg täis või ummik) animaator peatub ja näitab kokkuvõtet, pilt jääb ekraanile. Esc / ⏹ näitab kokkuvõtet ja viib töölauale tagasi. **[U]**
- **Aeg** **[O + U]**: kell liigub täissekundite kaupa (time mapping). Kiirus on ×1 … ×1000 simulatsiooni sekundit reaalses sekundis. Kaadris tehakse `kiirus × möödunud aeg` sammu (`AdvanceSimulation`). Max: nii palju samme, kui kaadris 14 ms jooksul jõuab, ilma joonistamiseta – 8 h näidismudelit läbib alla sekundi.
- **Sujuv liikumine** **[U]**: nähtav aeg on `SYSTEM_TIME − 1 + Fraction` (0 … 1): pilt jääb simulatsioonist ühe sekundi maha ja konveieri nihe interpoleeritakse eelmise ja praeguse sekundi vahel (`InterpolateOffset`). Nii ei hüppa alused ka ×1 juures ja peatuvad täpselt jaamas. Sammu (`.`, `N`) järel jõuab pilt 1/4 s jooksul järele.
- **Laadimine** **[U]**: detail liigub lähtekohast sihtkohta (alus ↔ jaam, puhver ↔ pink). Algus on detaili `StateSince`, lõpp tema `Load`-sündmuse aeg Event Listis (`WorkpiecePlaces`).
- **Rada ekraanil** **[U]**: asukoht rajal → ikoon (`Start`, `Length` `Enumerate`-st) → punkt ikooni sees (sirgel lõik, kaarel veerandring). Hargnemisikooni pooled võivad olla eri pikkusega (metrokaart), seepärast on keskkoht jaama asukoht (`TrackGeometry.Middle`).
- **Juhtimine**: Space start/paus, `+` / `−` kiirus (1, 2, 5, 10 … 1000), `.` üks sekund, `N` järgmise sündmuseni (sammud, kuni sündmuste arv kasvab), `M` max, `L` ahelloend, Esc lõpp. Kaasaegses välimuses on juhtriba: nupud ▶/⏸, +1 s, ⏭, ⏹, kiiruse liugur (logaritmiline; lohistamine, klõps, hiire ratas) ja max; hiire all oleva nupu vihje on olekureal. EGA-s on klahvid ja olekurea klõpsatavad klahvid. **[U]**

**Mõlemas välimuses** **[O]**:

| Objekt | Näitab |
|---|---|
| konveier | rada; seisab → teine värv, olekureal „seisab (n)“ = käivaid laadimisi |
| alus | ruut raja peal; broneeritud (detail tuleb peale) – teine raam |
| detail | ring tüübi värviga (16 tüüpi); ummiku tõttu kesklattu saadetav – punane ring |
| tööpink | keha värv olekust; täht: L laadimine, H häälestus, T töötlemine, M mahalaadimine (R rike – etapp 8) |
| puhver | kohad lahtritena: detail (nool pingi poole – sissetulev, raja poole – väljaminev), broneeritud (kontuur), vaba |
| FromCS / ToCS / SysOut | ootavad detailid (4 + arv); täituvus valmis + pargitud + broneeritud / mahutavus; lahkunute arv |
| SimStatus | aeg / kestus, kiirus, olek, detailid süsteemis ja valmis, tk/h, konveier |

EGA: ikoon 48 × 35 pikslit (4:3 ekraanil ruut), joonistamine pikslihaaval 16 värviga (Bresenham, ilma silumiseta).

**Ainult kaasaegses välimuses** **[U]**:
- **Event List riba**: ajatelg (logaritmiline, nüüd … +1 h) alates nähtavast ajast, märgid kellaajana h:mm:ss nagu üleval (nüüd, +10 s, +1 min, +10 min, +1 h; arvutus jääb sekundites); sündmused kaartidena (värv tüübi järgi, nt `Load WP12`), sama aja sündmused ühes veerus FIFO järjekorras (3 rida, ülejäänu „+n“). Lisandunud kaart libiseb kohale, töödeldud kaob vasakule (`DiffEventList` – kirjeid võrreldakse viite järgi). Kaardile osutades tõstetakse esile seotud pink / puhver / jaam / alus / detail ja olekureale tuleb sündmuse aeg. `L` – ahelloendi vaade (kastid `Event`, `WP`, `Time` (h:mm:ss) ja `Next`-nooled, `FirstAtMoment` … `nil`). Kiirusel üle ×50 ja max-režiimis ainult arvud.
- Pingi spindel pöörleb töötlemisel, häälestusel pöörleb aeglaselt hammasratas.

---

## 15. Redaktor (etapp 6) **[O + U]**

Originaalis (originaal.md 8.2): `EditLayout` – üleval redigeeritav mudel (13 × 4 ikooni, ruudustik), all ikoonipalett; ikoon valitakse paletist hiirega ja pannakse ruudule; servades kerimisnooled. `View` – sama väiksemas mõõtkavas (41 × 23), ilma ruudustikuta. Teostus: `src/fms_ed.js`.

**Layout** **[O + U]**
- Aken: infurida (mudel, ruudustik, aktiivne rada, kursor), ruudustik ja palett. EGA-s ikoon 48 × 35 nagu animaatoris; nähtav osa sõltub ekraanist (EGA-s 13 × 6), ülejäänu kerimisnoolte, hiire ratta või kursoriga. Kaasaegses välimuses on ikoon nii suur, kui ruumi on (36 … 72 pikslit).
- **Palett** **[O]**: kõik originaali ikoonid (joon. 5.4) + punktiirühendus + tööriistad (vali / liiguta, kustuta, suunanool). Klõps paneb **täpselt valitud ikooni** (originaali moodi).
- **Rada lohistades** **[U]**: rajaikooni või punktiiri tööriistaga lohistades saab iga lahter küljed, kust rada sisse ja välja läheb, ja ikoon valitakse külgedest (`IconFromPorts`): kaks külge – sirge või kaar, kolm – hargnemine, neli – ristmik. Arvesse lähevad ainult **ühendatud** küljed (`LinkedPorts`) – seepärast saab raja otsast pöörata (ots muutub kaareks, mitte hargnemiseks). Kiire hiire korral täidetakse vahele jäävad lahtrid (`CellSteps`); tagasi liikudes kaob viimane lõik (tee arvutatakse iga kord algseisust uuesti). Klaviatuuril sama: Shift + nool kursorist.
- **Reeglid** (sama mis `Enumerate`-s): pidev rada ei lähe objekti ega punktiiri sisse; punktiir lõpeb puhvri, lao või väljundiga ja liitub ainult raja **sirgega risti** – nii tekib hargnemine (jaam); punktiir ei hargne. Mittesobiv lõik jääb tegemata ja olekureal on teade.
- **Objektid**: pink ja puhver saavad paigutamisel uue kirje vaikeväärtustega (pink `MT1` …, esimene operatsioon `OPERATIONS`-ist). Sama liiki ikoon samas lahtris muudab ainult ikooni (objekt ja andmed jäävad). `ToCS` loob kesklao andmed, kui neid polnud.
- **Kustutamine**: naabruses olev hargnemine / ristmik kaotab selle poole haru. Pingi või puhvri viimase ikooniga kaovad ka tema andmed ja järgmiste numbrid (`N`, `BUFn`) nihkuvad – pinkide nimed jäävad. **Rajad jäävad alles** (rada joonistatakse tihti ümber; rada kustutatakse Transport-menüüst). Metrokaardi pikkus (`EdgeLengths`), mille lahter pole enam rada, kaob.
- **Suunanool** **[O]**: klõps raja sirgel või kaarel – puudub → üks suund → teine → puudub. Kui ikoon muutub (nt sirgest saab hargnemine), kaob nool, mis enam ei sobi.
- **Muu**: vali / liiguta – lohista ikoon tühja lahtrisse; `T` – aktiivne rada (uute rajaikoonide `N`; viimane valik on uus rada); `G` – ruudustiku mõõdud (kuni 41 × 23, välja jäävad ikoonid kustutatakse küsimusega); Ctrl-Z / Ctrl-Y – Undo / Redo (100 sammu, kogu mudeli hetktõmmised); Esc – töölauale.
- Mudel muutub kohapeal (`CurrentModel`). Salvestamata muudatus on töölaual näha ja Load / Pick / New / Quit küsivad enne kinnitust (`ConfirmDiscard`).

**View** **[O]**: kogu mudel korraga, ilma ruudustiku punktideta; ainult vaatamiseks (Esc).

**Andmed vormides** (`src/fms_ed_data.js`, etapp 6b) **[O + U]**
- **Config** **[O]**: *All* – kõik objektid joonisel järjest (pingid, puhvrid, rada, keskladu; ülevalt alla), objekt on Layout-is esile tõstetud ja vorm avaneb ekraani all – või üleval, kui all kataks objekti (`FormBox` `Avoid`). OK → järgmine, Loobu / Esc lõpetab. *Choose* – Layout tööriistaga „vali“: klõps või Enter objektil avab selle vormi.
- **Vormid**: tööpink (nimi, mudel, ajad, operatsioonid märkeruutudega + uus), puhver (kohad, pöördusmeetod, aeg), keskladu (kas on, kohad, aeg), rada (tabel 4.1; raja lahtrist avades ka **lõigu pikkus** – metrokaart, tühi = mõõtkavast), detail (nimi, prioriteet, partii) → **marsruudid** (nimekiri + uus) → marsruut (prioriteet ja operatsioonide tabel: operatsioon, keskmine, kõrvalekalle; + op / − op / Kustuta), **Model data** [U] (nimi, mõõtkava, seeme, kestus, Kl, seisu piir).
- **Kontroll** [U]: vormi väärtused pannakse mudeli koopiasse ja kontrollitakse sama `CheckModel`-iga, mis faili laadimisel; vead on välja juures (silt punane, teade vormi all). Arvus sobib koma ja punkt.
- **Menüüd**: Transport – rajad + *Uus rada*; vormis *Kustuta rada* (ikoonid ja andmed, järgmiste numbrid nihkuvad). Workpiece data – detailid → *Edit* / *Copy* / *Flush* + *Uus detail* (kuni 16). Storage data, Model data.
- **Andmekontroll ja hoiatused** [U]: Layout-i infureal on vigade ja hoiatuste arv (`ModelProblems`: `CheckModel`, siis `Enumerate`; arvutatakse iga muudatuse järel). **K** või Edit → **Check** näitab nimekirja; Enter viib vea kohale joonisel (`ProblemCell`: lahter, pink, puhver või rada).
- **Pooleli mudel jääb salvestatavaks**: „operatsiooni ei tee ükski pink“ on nüüd ainult `Enumerate`-i viga (osa 2.2) – muidu muutuks mudel pärast pingi kustutamist laadimatuks.
- Vormi muudatus läheb Layout-i Undo-sse (`NoteEditorChange`) ja märgib mudeli muudetuks.
