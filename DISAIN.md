# Simulatsiooniloogika disain

Etapp 1 ([PLAAN.md](PLAAN.md)). Alus: [originaal.md](originaal.md). Osad 1–7 (pidevad konveierid) on **valideeritud prototüübiga** (`proto/`); tulemused ja tehtud muudatused: [VALIDEERIMINE.md](VALIDEERIMINE.md). Tootekood on `src/fms_sim.js` (etapp 4): sama loogika + `Enumerate` (osa 2.1) ja andmekontroll (osa 2.2). Animaator (etapp 5): osa 14. Redaktor (etapp 6): osa 15 (`src/fms_ed.js`, `src/fms_ed_data.js`). Rajavõrgu graaf (etapp 7a: mitu rada, konnektorid, avatud konveier): osa 2.3. Diskreetsed rajad (AGV-d, etapp 7b): osa 11. Mitu detaili alusel / kärul (etapp 7c): osa 16. Rikked ja juhuslikkus (etapp 8): osa 17. Aruanded (etapp 9): osa 18. Avaldamine (etapp 10): osa 19.

Nimetamise reeglid ja globaalsete nimede sõnastik: osa 12.

Iga otsuse juures on märge:
- **[O]** – originaal, nagu dokumendis;
- **[T]** – originaali täpsustus (dokumendis puudu või ebaselge, lahendus on originaali vaimus);
- **[U]** – uus lahendus (originaalist erinev või lisatud).

Ulatus: esimeses järgus ainult **pidevad konveierid** (suletud silmus). Diskreetsed rajad (transpordirobotid, AGV-d – osa 11), kokkupõrked ja rikked tulid hiljem (etapid 7–8, osad 11, 16, 17).

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

Etapis 4 toetas `Enumerate` ühte suletud pidevat konveierit. Etapist 7a on rajavõrk graaf: mitu rada, konnektorid ja avatud konveier (osa 2.3); etapist 7b ka diskreetne rada (`TraceGraph`, osa 11.1); etapist 7c on alusel / kärul ka mitu kohta (`PlacesPerCart > 1`, osa 16).

- **Ikoonide küljed** (`IconTypes[...].Ports`, `fms_glb.js`): `HorTr` W–E, `VertTr` N–S, kaared oma kahe küljega (`ArcSE` = S, E), `Tee*` läbib W–E või N–S ja haru (`Branch`) on nimes olev külg (`TeeN` → haru N), `Cruise` neli külge (ühendatud ristmik), `CrossOver` neli külge, aga ei ühenda (sild, osa 2.3). Y kasvab alla.
- **Suunanool** **[O]**: originaalis oli pideva raja liikumissuund nool ühe raja ikooni kõrval („kirjeldatakse ühel raja ikoonil“). Mudelis on see lahtri väli `"Dir": "N" | "E" | "S" | "W"` – **külg, kust kärud ikoonist väljuvad**. Lubatud ainult raja sirgel ja kaarel ning ainult ikooni külgede suunas (`DirectionPorts`): `HorTr` → `E`/`W`, `ArcSE` → `S`/`E`; hargnemisel, ristmikul ja punktiirühendusel noolt ei ole (`CheckModel`). Diskreetsel rajal teeb nool lõigu ühesuunaliseks (osa 11.1).
- **Mitu noolt** **[T]**: lubatud, kui need on kooskõlas (sama ringi suund); vastuolu on viga. Originaali lahendust me ei tea.
- **Rada** (`TraceTrack`, `WalkTrack`): alustatakse esimesest noolega ikoonist, väljutakse noole küljest ja liigutakse naabrite kaudu, kuni jõutakse tagasi (**silmus**) või rada lõpeb (**avatud konveier** – siis käiakse ka noolest vastuvoolu raja alguseni, osa 2.3). Rada lõpeb tühja lahtri, objekti või konnektori juures. Vead: naaber ei sobi (viga 1), teise raja ikoon ilma konnektorita, ristmik või haru, mis pole punktiirühendus (viga 2), sama lahter kaks korda, raja ikoon rajast väljas.
- **Jaam** (`FindStations`, `FollowDotLink`): igal hargnemisel peab haru olema punktiirühendus (üks või mitu `Dot`-ikooni, võib ka kohe objekt olla), mis viib puhvri, `FromCS`, `ToCS`, `SysOut`-i või konnektorini (konnektorisse selle raja küljest). Jaama asukoht on hargnemisikooni keskpunkt. Avatud raja ots konnektori kõrval on samuti jaam – otsaikooni keskel.
- **Pink ↔ puhver** (`LinkMachines`) **[T]**: puhver on vahetult pingi all või kohal. `MachToolDown` – üks puhver all (sisse ja välja), `MachToolUp` – üks puhver kohal, `MachToolThruDown` – sissetulev kohal, väljaminev all, `MachToolThruUp` – vastupidi. **Puhvri liik on liikumissuund joonisel** **[O]** (joon. 5.4: `InBuf` – detailid liiguvad üles ▲, `OutBuf` – alla ▼, `InOutBuf` ja `TurnBuf` mõlemat pidi; `BUFFER_FLOW`). Suund tuleb puhvri kohast (`RoleFlow`): sissetulev detail liigub raja poolt pingi poole – pingi all olevas puhvris üles, pingi kohal olevas alla; väljaminev vastupidi. Seega `MachToolThruDown` (detailid ülalt alla) vajab kaht ▼ puhvrit (`OutBuf`), `MachToolThruUp` kaht ▲ (`InBuf`), `MachToolDown` ja `MachToolUp` (üks puhver mõlemas suunas) kahesuunalist. *Parandus pärast etappi 7a: varem loeti `InBuf` / `OutBuf` rolliks („sissetulev“ / „väljaminev“) ja läbival pingil liikusid detailid ▲-puhvrist alla.*
- **Lõik ja pikkus** (`MeasureTrack`): lõik on rada kahe järjestikuse hargnemise keskpunkti vahel (hargnemisikoonist pool kummalegi poole); avatud rajal ka raja algusest esimese hargnemiseni ja viimasest lõpuni. Sirge = 1, kaar = π/4 ikooni, korda `Scale`. `EdgeLengths` kirje leiab lõigu, mille sisemiste lahtrite hulgas on **kõik** kirje lahtrid (piisab näiteks esimesest ja viimasest); käsitsi pikkus jaotub lõigu ikoonidele (ka hargnemise poolele) ühtlaselt. Kahe kõrvuti hargnemise vahelist lõiku ei saa üle kirjutada (sisemisi lahtreid pole).
- **Nullpunkt** **[T]**: silmusel on asukoht 0 `FromCS` jaam (kui see on rajal, muidu esimene konnektor); alguses on seal alus 0 (nagu prototüübis). Avatud rajal on 0 raja algus. Asukohad ümardatakse 0,001 cm-ni, et ujukomavead ei mõjutaks peatumist.
- **Tulemus** – simulatsiooni võrk (`SimInit`-i sisend): `Tracks` (`Closed`, pikkus, ikoonid koos asukohtadega, lõigud), `Stations` (raja ja asukoha järjekorras), `Connectors` (nimi `CON1` … joonise järjekorras, kaks jaama), `Buffers` ja `Machines` – ainult need, mis on joonisel (`ModelIndex` = indeks mudelifailis), `Storage` (null, kui `ToCS`-i pole), `Workpieces`, `Sim`. Animaator (etapp 5) kasutab ikoonide asukohti kärude joonistamiseks.

### 2.2 Andmekontroll (originaali vead 1–8) **[O + T]**

`CheckModel` kontrollib faili struktuuri laadimisel, `Enumerate` (`TraceTrack`, `DetectOpenCons`, `CheckObjects`, `LinkMachines`, `FindConflicts`, `CheckReachability`) võrku enne simulatsiooni. Vead peatavad, hoiatused mitte.

| Originaali viga | Kontroll | |
|---|---|---|
| 1. topoloogia pole suletud | ikoonid ei sobi kokku, punktiirühendus ei vii objektini / pole rajaga ühendatud, kaks rada puutuvad ilma konnektorita, konnektori üks külg vaba või sama rada mõlemal küljel. **Etapist 7a** on katkev rada avatud konveier (osa 2.3); kui seetõttu jääb midagi vastuvoolu, on viga kättesaadavuse kontrollis ja teates on konveieri otsad | viga |
| 2. pidevatel radadel on harusid | haru, mis pole punktiirühendus; ristmik | viga |
| 3. kesklaos liiga vähe kohti | `Capacity ≤ ParkingReserve` | hoiatus |
| 4. pingid ei tee marsruudi operatsioone | operatsiooni ei tee ükski **joonisel olev** pink (`FindConflicts`; etapist 6 mitte enam `CheckModel`-is, et redaktoris pooleli mudel jääks salvestatavaks) | viga |
| 5. pideval rajal pole suunda | noolt pole; nooled vastuolus | viga |
| 6. radadel rohkem kohti kui puhvrites | `Carts × PlacesPerCart > Σ Capacity` | hoiatus |
| 7. puhvrid järjestikku | puhver vahetult teise puhvri kohal | viga |
| 8. pingil puhver puudu | pingi ikooni järgi oodatud puhver puudub või on vale liiki | viga |
| kättesaadavus **[U]** (`CheckReachability`, 7a) | igast puhvrist viib rada `SysOut`-i ja `ToCS`-i; marsruudi igast võimalikust kohast (ja kesklao korral `FromCS`-ist – pargitud detail) viib rada järgmise operatsiooni mõne pingini | viga |
| lisaks **[T]** | `FromCS` ja `SysOut` täpselt üks, `ToCS` kõige rohkem üks (ja siis `Storage` olemas); objekt joonisel üks kord ja ühendatud ühe jaamaga; puhver seotud ühe pingiga; detailitüübid ja pingid olemas; `EdgeLengths` leiab lõigu; joonisel puuduv rada / pink / puhver → hoiatus | |

---

### 2.3 Rajavõrgu graaf: mitu rada, konnektorid, avatud konveier (etapp 7a) **[O + U]**

Originaalis: „Rajad on seotud konnektorite, tööpinkide või puhvrite kaudu“, „pideva raja avatus/suletus tuleneb ikoonide paigutusest“, konnektor on „sisuliselt nullmahutavusega puhver“ (originaal.md 2.3, 4). **[O]**

- **Mitu rada** **[O]**: iga raja number `N` on oma pidev konveier (silmus või avatud). Rajad on ühendatud ainult **konnektoritega**; kaks rada, mis puutuvad ilma konnektorita, on viga.
- **Konnektor** **[U]** (osa 10.2): kahe raja ülekandekoht, mis **mahutab ühe detaili** (nullmahutavusega puhver nõuaks, et mõlema raja alused oleksid korraga kohal). Kummalgi küljel on üks rada: raja ots (`HorCon` W/E, `VertCon` N/S küljel) või punktiir hargnemisest. Kummalgi rajal on konnektori jaam. Andmeid pole: laadimisaeg tuleb rajalt (`LoadTime`), nimi `CON1`, `CON2` … joonise järjekorras.
- **Avatud konveier** **[U]** (osa 10.1): rada, mis ei sulgu. Alused liiguvad nagu silmusel, aga raja lõpust lähevad nad (tühjalt) **otse algusesse** tagasi – nagu lindikonveier, mille tagasitee pole joonisel. Pikkus = raja pikkus. Jaamad on ikoonide keskel, seega mitte kunagi päris otstes.
- **Transporditee** (`StationPaths`) **[U]**: lühim tee jaamast jaama (Dijkstra, viigi korral vähem sõlmi; etapist 7b kiireim – kaal on aeg = pikkus / kiirus, diskreetsel rajal raja graafis, osa 11.1): rada mööda liikumissuunas, konnektori kaudu teisele rajale (pikkus 0). Avatud konveieril ainult **allavoolu**. Tee = sõidud (`Legs`: rada, algus- ja lõppjaam), nende vahel konnektorid. Arvutatakse `Enumerate`-s (kontroll) ja `SimInit`-is (`TransportPaths`); ühe lähtejaama teed annab `ShortestPaths`, millele saab öelda, milliseid konnektoreid läbida ei tohi.
- **Teele minek** (`Depart`) **[U]**: kui detailil on sihtkoht broneeritud (osa 5.2), valitakse **lühim vaba tee** (`FreePath`: kinnised konnektorid jäetakse välja – paralleelsetest konnektoritest võetakse vaba, etapp 7b) ja broneeritakse **kõik selle konnektorid korraga**. Siis ei jää detail kunagi konnektorisse järgmist ootama (ringootamist pole) ja koormaga alus ei pea avatud konveieri lõpust mööda sõitma. Kui vaba teed pole, jääb detail oma kohale (`WAIT_DEST`, sihtkoht jääb) ja Planner proovib igal kutsel uuesti. Sihtkoha valik (`FindMach`) kasutab endiselt lühimat teed sõltumata konnektorite seisust.
- **Sõit** **[T]**: alus peatub mahalaadimiseks sõidu lõppjaamas (`Path[0].To`): sihtkohas või konnektoris. Konnektoris jääb detail `WAIT_PICKUP`-olekusse ja järgmise raja alus võtab ta sealt nagu puhvrist. Uus sündmuse objekt `Connector` (`Load` aluselt konnektorisse ja konnektorist alusele).
- **Valik** **[T]**: `FindMach` arvestab ainult pinke, kuhu tee viib, ja „lähim“ on tee pikkus (ühe silmuse korral sama mis varem). Ummiku tuvastus (`FindDeadlockedWorkpieces`) arvestab samuti ainult kättesaadavaid pinke; tee ootel detail (konnektor kinni) loetakse liikuvaks, sest konnektor vabaneb alati.
- **Koormamine** **[T]**: konnektor on üks koht `Kl` valemis (`Ntm + Nmt + Nbuf + Ncon`).
- **Sild** (`CrossOver`) **[U]**: mitteühendatud ristumine nagu elektriskeemil – N–S rada on sirge, W–E rada läheb keskel väikese poolringiga üle. Rajad ei ühendu: kumbki läbib lahtri otse (sirge, pikkus 1). Lahtril on kaks raja numbrit: `N` (W–E) ja `N2` (N–S); `CellTrack` annab külje raja. Sild võib olla kahe raja vahel (sõltumatud konveierid) või sama raja kahe osa vahel (kaheksakujuline silmus). Sillal pole jaama ega suunanoolt; metrokaardi pikkus jaotub nagu sirgel.

---

## 3. Objektid ja olekud

### 3.1 Konveier (pidev rada, suletud) **[O + T]**

| Parameeter | Tähendus |
|---|---|
| `Speed` | cm/s |
| `Carts` | kohtade (alustade, `Pallette`) arv konveieril |
| `PlacesPerCart` | mitu detaili alusele mahub (etapist 7c ka > 1, osa 16) |
| `LoadTime` | detaili peale- või mahalaadimise aeg, s |
| `AccessTime` | esmakordse pöördumise aeg, s (esimeses järgus ei kasuta) |
| `Direction` | liikumissuund |

- Alused on konveieril võrdsete vahedega `Length / Carts` ja liiguvad koos: konveieril on üks nihe `Offset`, alus `palletIndex` asub kohal `(Offset + palletIndex · Length / Carts) mod Length`. **[T]**
- Olek: `StopCount` – mitu laadimist parasjagu käib. Kui `StopCount > 0`, seisab **kogu konveier** (lk 45). **[O]**
- Alus peatub jaamas ainult siis, kui seal on **tegevus** (`NeedsStop`):
  - **mahalaadimine**: alusel on detail, mille sõit lõpeb selles jaamas (sihtkoht või konnektor);
  - **pealelaadimine**: alusel on vaba koht (7c: detaile + broneeringuid < `PlacesPerCart`; ühe kohaga – alus on tühi) ja jaamas ootab detail, millele on sihtkoht juba broneeritud (vt 5.2).

  Muidu sõidab alus mööda. **[T]**
- Kui samas jaamas on mitu tegevust, tehakse enne kõik mahalaadimised ja siis pealelaadimised (`PalletAction`), konveier seisab vahepeal edasi. **[T]**

### 3.2 Puhver **[O + T]**

- Parameetrid: `Capacity`, `Discipline` (FIFO / FILO / RANDOM), `LoadTime`, `Kind` (`InBuf`, `OutBuf`, `InOutBuf`, `TurnBuf`).
- Puhver seob tööpingi raja jaamaga: rada ↔ puhver ↔ tööpink. **[O]** (lk 32)
- Puhvri kohtadel on suund:
  - **sisse** (rajalt pingi poole) – detail ootab tööpinki;
  - **välja** (pingilt raja poole) – detail ootab transporti.

  Ühesuunalises puhvris (`InBuf`, `OutBuf`) on kõik kohad ühes suunas – vastavalt sellele, kas puhver on pingi jaoks sissetulev või väljaminev (osa 2.1); `InOutBuf` ja `TurnBuf` mõlemat (ühine mahutavus). **[T]**
- Igal kohal on **broneering**: koht loetakse hõivatuks juba siis, kui sinna on detail teele saadetud. **[U]**

### 3.3 Tööpink **[O + T]**

- Parameetrid: `Name`, `Model`, `LoadTime`, `SetupTime`, `Ops` (sooritatavad operatsioonid). Esimeses järgus mahub pinki 1 detail.
- Olekud:

```
         Load (puhvrist)            Turn              Process
IDLE ───────────────► LOADING ──► SETUP ──► PROCESSING ──┬─► SETUP (järgmine op samas pingis)
  ▲                                                       └─► UNLOADING ──► IDLE
  └──────────────────────────────────────────── Load (puhvrisse) ┘
   PROCESSING ──Crash──► DOWN ──Repair──► UNLOADING (praak) – rike (etapp 8, osa 17)
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
| `Load` | `StopMovProc`, Planner, `ProcessProc`, `RepairProc` | Viib detaili lähtekohast sihtkohta, vabastab broneeringu. Edasi oleneb sihtkohast (vt 4.3). Kui detailil on juba broneeritud järgmine sihtkoht (3.3), saab ta selle kohe. |
| `Turn` | `LoadProc`, `ProcessProc` | Ümberhäälestus läbi → `Process` ajaks `t + kestus`. |
| `Process` | `TurnProc` | Operatsioon läbi, `opIndex++` → järgmine operatsioon samas pingis (`Turn`) või mahalaadimine puhvrisse (`Load`). Kutsub Plannerit. |
| `OutSys` | Planner | Kõik operatsioonid tehtud: määrab sihtkohaks `ToCS` / `SysOut`. |
| `DoNothing` | testid | Ei tee midagi. |
| `Crash` | `TurnProc` (rikke kell) | Tööpingi rike töötlemise ajal: pink `DOWN`, detail praak, `Repair` (osa 17). |
| `Repair` | `CrashProc` | Remont läbi: praak laaditakse puhvrisse (`Load`), edasi `OutSys` → `SysOut`. |

Operatsiooni kestus: vaikimisi ühtlane jaotus vahemikus `mean ± dev`, ümardatud täissekunditeks, vähemalt 1 s. **[T]** Etapist 8 ka kolmnurkne või normaaljaotus (`Sim.Distribution`, osa 17). **[U]**

### 4.3 `Load` – kuhu edasi **[T]**

| Sihtkoht | Järgmine samm |
|---|---|
| alus | `MoveZ` (konveier jätkab) |
| puhvri sissetulev koht | `MoveZ`; Planner (pink võib detaili võtta) |
| tööpink | `Turn` |
| puhvri väljaminev koht (pingist) | Planner (pink vaba, detailile otsitakse sihtkoht) |
| `ToCS` / `SysOut` | detail lahkub, statistika; `MoveZ`; Planner (võib tuua uue detaili) |
| konnektor (7a) | detail ootab järgmise raja alust; `MoveZ` (või kohe pealelaadimine samas jaamas) |

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
   - Millal: kui `Ndet / (Ntm + Nmt + Nbuf) < Kl`, vaikimisi `Kl = 0.85`. Etapist 7a lisandub konnektorite arv `Ncon`. `Ntm` on originaalis kohtade arv transpordil; etapist 7c **aluste / kärude arv** (`Carts`, kohtade arvust sõltumata) **[U]** – kohad tõid süsteemi detaile, mis ootasid FromCS-is (VALIDEERIMINE.md etapp 7c, leid 1). Ühe kohaga alusel on see sama. Lisaks igal lahkumisel kontrollitakse uuesti. Teised originaali reeglid (kindel intervall, ajakava, partiid) on valitavad seadetes.
   - Mis tüüp: kõige vähem töödeldud tüüp (vaikimisi); valitavad ka „üks tüüp järjest“ ja „kõige rohkem vabu pinke marsruudis“.
2. **Marsruudi valik** sisenemisel. **[O]** Kriteeriumid: enim hetkel vabade pinkide operatsioone → lähim esimese operatsiooni pink → enim operatsioone samas pingis. Viik → marsruudi prioriteet.
3. **Sihtkoha valik ja broneerimine** (`FindMach`, `FindBuf`, `FindSysPos`). **[T + U]**
   - Kui detailil on järgmine operatsioon: sobivad pingid on need, mis teevad seda operatsiooni, mille puhvris on vaba sissetulev koht ja kuhu viib rada (osa 2.3). Valik: vaba pink → pink pole rikkes (etapp 8) → lühim järjekord → lähim (tee pikkus).
   - Kui operatsioone pole: `OutSys` → `ToCS` või `SysOut`.
   - **Detail läheb teele ainult siis, kui sihtkoht on broneeritud.** Seni ootab ta oma kohal. **[U]** See tagab, et alus ei jää kunagi detailiga tiirlema ja konveier ei ummistu.
4. **Pingi laadimine puhvrist**: kui pink on `IDLE` ja puhvris ootab detail, valitakse see puhvri distsipliini järgi (FIFO / FILO / RANDOM) ja broneeritakse väljaminev koht. **[O + U]**
5. **Järgmine operatsioon**: kui seda saab teha samas pingis, tehakse seal. **[O]**

### 5.3 Ummikud **[U]**

Ka broneerimisega võib tekkida ringootamine: pingi A väljaminev detail ootab kohta pingi B puhvris ja vastupidi, ning kõik puhvrid on täis.

- **Vältimine**: sissetoomise piir `Kl`, broneerimine, reegel „pink ei alusta ilma väljaminevat kohta broneerimata“ ja **järgmise pingi koha broneerimine enne töötlemist** (3.3). Valideerimine: vältimisega ei tekkinud stressitestis ühtegi lahendamatut ummikut ja parkimisi oli 1–3; ilma selleta ummistus süsteem igasuguse puhvri suuruse juures.
- **Avastamine** (`FindDeadlockedWorkpieces`): igal sekundil arvutatakse püsipunktini, millised puhvrid **saavad edasi liikuda** – neis on vaba koht või broneering, nende pink töötab, sissetuleva detaili saab pink võtta (sh järgmise koha broneering) või väljaminev detail saab sihtkoha mõnes vabas / edasi liikuvas puhvris. Täis puhvrid, mis edasi liikuda ei saa, on ummikus. Esimene versioon (ummik = `StallTime` sekundit ootamist) andis koormuse all **valehäireid** (stsenaariumis B pargiti 19 detaili ilma tegeliku ummikuta) ja asendati.
- **Lahendus**: ummikus puhvri kauem oodanud detail (väljaminev või sissetulev) saadetakse ajutiselt kesklattu (`ToCS`, pargitakse) ja Planner toob selle hiljem `FromCS` kaudu tagasi. Ühesuunalisest puhvrist ei saa sissetulevat detaili tagasi rajale saata (invariant) – siis pargitakse ainult väljaminevaid või kahesuunaliste puhvrite detaile; kui selliseid pole, on ummik lahendamatu ja teade ütleb põhjuse. Kui keskladu puudub või on täis, simulatsioon peatub ja teatab ummikust – see on ka kasulik tulemus: struktuur ei sobi antud koormusele.
- **Varukontroll**: kui midagi ei toimu `StallTime` sekundit (vaikimisi 600) ja süsteemis on detaile → peatub ja teatab.
- **Rike** (etapp 8, osa 17): rikkes pink (`DOWN`) ei ole `IDLE`, seega loeb `FindDeadlockedWorkpieces` tema puhvri edasi liikuvaks – remont on ajaliselt piiratud. Rikked ei andnud valehäireid (VALIDEERIMINE.md etapp 8).

---

## 6. `MinuteMan` (pidevad konveierid) **[O + T]**

Iga konveieri kohta, kui `StopCount = 0`:

1. uus nihe `newOffset = Offset + Speed · 1 s`;
2. iga aluse kohta vaadatakse, kas ta ületas selle sekundi jooksul mõne jaama, kus on tema jaoks tegevus (3.1);
3. kui jah, võetakse **lähim** selline ületus: nihe pannakse nii, et alus seisab täpselt jaamas, `StopCount++`, lisatakse `StopMov` käesolevale hetkele;
4. muidu `Offset := newOffset`.

Korraga peatub konveier ainult ühe aluse pärast. Teised tegevused tulevad järgmistel sekunditel.

Kui teine alus jõuab samal hetkel täpselt jaama (nihe 0), saab ta märke `ArrivedAt` (`MarkArrivals`) ja peatub seal, kui konveier uuesti liigub. **[U]** Varem sõitis ta mööda – avatud konveieril murdis see invariandi, suletud ringil tegi alus lisaringi (VALIDEERIMINE.md etapp 8, leid 1; prototüübis sama viga).

---

## 7. Statistika **[O + T]**

- Detaili kohta: `TimeIn`, `TimeOut`, töötlemis-, häälestus-, transpordi-, laadimis- ja ooteaeg. Tsükliaeg `Tts` ja osakaalud: töötlemine, ootamine, transport (ptk 8.5 originaalis).
- Pingi kohta: aeg igas olekus → rakendatus, töötlemise / häälestuse / laadimise / jõudeoleku osakaal, tehtud operatsioonide arv.
- Puhvri kohta: keskmine ja maksimaalne täituvus.
- Konveieri kohta: liikumise ja seismise osakaal, peatuste arv.
- Raja kohta (7c): aluste / kärude keskmine ja suurim täituvus (`AvgLoad` – detaile aluse kohta, `MaxLoad`) ja kogumissõidud (`Pooled` – pealelaadimised, kui alusel oli juba detail). **[U]**
- Detailitüübi kohta: sisse toodud, valmis, praak (etapp 8), keskmine tsükliaeg.
- Rikked (etapp 8) **[U]**: pingi kohta `DOWN` osakaal (`DownShare`) ja rikete arv (`Crashes`); rakendatus ei sisalda rikkeaega. Süsteemis `Crashes`, `Scrapped`; aegreas `DownMachines`, `Scrapped`. Praak ei lähe valmis detailide, läbilaskevõime ega tsükliaja hulka.
- Süsteem: läbilaskevõime (detaili tunnis), keskmine ja suurim detailide arv süsteemis, kesklattu pargitud.
- **Aegrida** (`Stats.Timeline`, Dynamic-aruande jaoks, etapp 9) **[U]**: iga `SampleInterval` sekundi järel (vaikimisi 60, ka algus ja lõpp) detailid süsteemis, valmis, hõivatud pingid, puhvrite täituvus.
- Kõik tuleb `SimReport`-ist; menüü *Simulate* näitab sellest lühikokkuvõtet (etapp 4), täielikud aruanded on menüüs *Report* (etapp 9, osa 18).

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
- Sillal (`CrossOver`, 7a) on teine raja number `N2` (N–S rada); `N` on W–E rada. Teistel ikoonidel `N2` puudub. **[U]**
- Punktiirühendus (loogiline ühendus, pikkus 0, lk 54) on rajaikoon väljaga `"Dot": true`; sellel pole `N`-i. Jaam tekib seal, kus punktiirühendus liitub rajaga (hargnemisikoon `Tee*`). **[T]**
- Suunanool on raja sirge või kaare väli `"Dir"` (osa 2.1). **[O]**
- `Storage: null` tähendab, et kesklattu pole (stsenaarium C0).
- Rike (etapp 8, osa 17) **[U]**: pingil võivad olla `CrashMean` (keskmine töötlemisaeg rikete vahel, s; 0 või puudub = rikkeid pole), `RepairMean`, `RepairDev` (remondiaeg, s); `Sim.Distribution` – `Uniform` (vaikimisi, kui puudub), `Triangular` või `Normal`. Vanad mudelid jäävad kehtima.
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
| **E. Vastassuunas kärud** – diskreetne rada, kaks käru vastassuunas samal kahesuunalisel lõigul (etapp 7b) | Kokkupõrget ei toimu; vastastikune ootamine avastatakse ja Planner lahendab selle (ümbersõit või ootele). *Valideeritud:* E1 ümbersõit, E2 kõrvalepõige, E3 lahendamatu → teade, E4 möödasõidurada. |
| **F. Ristmik** – mitu käru, kõigi teekond läbi sama ristmiku (etapp 7b) | Ristmikul on korraga üks käru; keegi ei jää lõputult ootama. *Valideeritud* (1–3 käru, 5 seemet, suurim ootamine < 40 s). |

Invariandid, mida kontrollitakse igal sekundil:
- detailide arv: sisse tulnud − lahkunud = süsteemis olevad;
- igal kohal (alus, puhvri koht, pink) on max 1 detail, broneeringud ei ületa mahutavust;
- `SYSTEM_TIME` ei vähene, Event Listis pole sündmust `Time < SYSTEM_TIME` pärast sisetsüklit;
- `StopCount ≥ 0` ja seisev konveier ainult siis, kui mõni laadimine käib;
- (diskreetsed rajad) igas tsoonis on max 1 käru ja käru on ainult tsoonis, mille ta on broneerinud;
- (7c) alusel on detaile + broneeringuid kokku kõige rohkem `PlacesPerCart`, iga detail viitab oma kohale; käru peatuste nimekirjas on igal tema detailil mahalaadimine sõidu lõppjaamas ja igal ootaval broneeringul enne seda pealelaadimine; käru sõidab nimekirja esimesse jaama;
- (8) sisse toodud = valmis + praak + süsteemis; rikkes pingis on remonti ootav praak (`WAIT_REPAIR`) ja pingi olekule vastab täpselt üks sündmus (`DOWN` – `Repair`, `PROCESSING` – `Process` või `Crash` jne); praaki ei töödelda ega viida kesklattu ning tal pole järgmise pingi broneeringut.

---

## 10. Varem lahtised küsimused (ettepanekud kinnitatud)

1. **Avatud konveier** (mitte silmus): mis juhtub detailiga, mis jõuab raja lõppu? Ettepanek: konveier seiskub, kuni see maha laaditakse; Planner ei saada detaili teele, kui sihtkoht pole raja suunas eespool. *Teostatud etapis 7a (osa 2.3):* Planner saadab detaili ainult allavoolu, nii et koormaga alus ei jõua kunagi lõppu (invariant); tühjad alused lähevad lõpust otse algusesse.
2. **Konnektor** (radade ühendus): kas see on lihtsalt kahe raja jaam, kus detail tõstetakse ühelt rajalt teisele (puhver mahutavusega 0, `Load` + `Load`)? Ettepanek: jah. *Teostatud etapis 7a (osa 2.3)* `Load` + `Load`-iga, kuid konnektor mahutab ühe detaili ja see broneeritakse koos sihtkohaga.
3. **`AccessTime`** (keskmine pöördusaeg): tähendus on ebaselge. Ettepanek: lisaviivitus enne esimest laadimist, kui konveier oli seisnud – või jätta kasutamata.
4. **Mitu detaili alusel** (`placesPerCart > 1`) ja **mitu detaili pingis**: esimeses järgus 1, hiljem laiendada. *Mitu detaili alusel teostatud etapis 7c (osa 16);* mitu detaili pingis on endiselt 1.

---

## 11. Diskreetsed rajad: transpordirobotid ja AGV-d (etapp 7b)

Originaalis: diskreetne transpordirada (`DISCTRACK`), kus transporti teevad **transpordirobotid (TRB)** või **automaatkärud (AGV)** (lk 29–30); sündmus `Collision`, protseduurid `ProgTM` ja `FindPal`; konfliktid lahendab Planner (lk 43). **[O]**

Tänapäevased nimetused: **AGV** (*automated guided vehicle*, automaatjuhitav käru) ja **RGV** (*rail-guided vehicle*, rööbaskäru). Simulatsiooni jaoks on need samad: kärud, mis liiguvad etteantud radadel iseseisvalt ja eri suundades. Teostus: `src/fms_sim.js` (etapp 7b), valideerimine [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 7b. Etapis 1 kirjutatud kava (tsoonid, `Collision` kui ootegraafi ring) jäi alles; täpsustused tulid valideerimisest.

### 11.1 Rada kui teedevõrk (`Enumerate`) **[O + U]**

- Rada, mille `Mode` on `Discrete`, on **graaf** nagu linna teed (`TraceGraph`): **sõlmed** on hargnemised (`Tee*`), ristmikud (`Cruise`) ja raja otsad (ka ots konnektori kõrval); **lõik** on rada kahe sõlme vahel. Hargnemise haru on kas rada (**raja-haru** – sõlmes on ≥ 3 haru, `Junction`) või punktiir (**jaam**, nagu pideval rajal). Sild (`CrossOver`) läbib otse ja on teine tasand.
- Sõlm ja jaam on sõlme lahtri keskel; lõik algab ja lõpeb sõlme keskel (`MeasureGraph`). Pikkus nagu pideval rajal (sirge 1, kaar π/4 ikooni × `Scale`); metrokaart (`EdgeLengths`) kirjutab üle terve lõigu (lahtrid peavad olema lõigu sees, mitte sõlmes).
- Lõik on **kahesuunaline**. **Suunanool** lõigu ikoonil teeb lõigu **ühesuunaliseks** (vastuolulised nooled samal lõigul – viga). Sõlme ikoonil (hargnemine, ristmik) noolt ei ole; kahe kõrvuti sõlme vahelisele lõigule ei saa noolt panna.
- Rada peab olema **ühes tükis** (üks kärupark); kärusid ei tohi olla rohkem kui sõlmi.
- **Ristumised** **[U]**: sama raja numbriga diskreetne rada on üks kärupark, selle `Cruise` on ühine tsoon. Eri radade vahel (AGV ↔ AGV, AGV ↔ konveier) on lubatud ainult konnektor või **sild** – sild on eri tasand ja tsoone ei jaga (ka siis, kui sama rada ristub iseendaga). Kokkupuude sillata on viga nagu 7a-s.
- **Teed jaamast jaama** (`StationPaths`, `ShortestPaths`, osa 2.3) valitakse nüüd **aja** järgi (pikkus / kiirus, ka pidevatel radadel; ühe kiirusega mudelis sama mis pikkus); diskreetse raja sees `NodeDistances` (Dijkstra sõlmest sõlme). Jaamast samasse jaama diskreetsel rajal teed pole.

### 11.2 Käru kui iseseisev objekt **[O + T]**

- Raja parameetrid (tabel 4.1): kärude arv, kohtade arv kärul (etapist 7c ka > 1, osa 16), kiirus, laadimisaeg, pöördusaeg (ei kasuta). **[O]**
- Käru (`Pallets[i]`, nagu konveieri alus – detaili asukoht `Pallet`) on **punkt**: sõlmes (`Node`) või lõigul (`Edge`, `Dir`, `Distance`). Tal on tee (`Route` – sammud `{ Edge, Dir }`, `RouteEnd`), töö sihtsõlm (`Goal`), kohad detailidega (`Places`), broneeritud detailid (`ReservedWPs`) ja peatuste nimekiri (`StopList`, 7c – osa 16). Algul on kärud sõlmedes: enne jaamata otsad, siis muud sõlmed, siis hargnemised (`InitCarts`).
- Olek statistikas (`CartState`): `LOADING` (laadimine), `WAIT_ZONE` (ootab tsooni), `LOADED` / `EMPTY` (sõidab koormaga / tühjalt, ka kõrvale), `IDLE` (vaba). Käru peatub ainult tee lõpus, sõlmes või lõigu ooteasendis (`WaitPoint` – pool ikooni enne sõlme keskpunkti).
- Sündmused jäävad samaks: `StopMov` (käru jõudis jaama), `Load` (väli `Pal` = käru), `MoveZ` (laadimine läbi – käru jätkab, `CartContinues`), lisaks `Collision`. Parkimiskohti (`Parking`) ei teostatud: vaba käru jääb paigale, aga läheb ise hargnemisest ära ja lükatakse teelt kõrvale (11.5).

### 11.3 Töö jagamine kärudele – `FindPal` **[O nimi, T sisu]**

- Transpordisoov tekib, kui detail läheb teele (`Depart`, osa 2.3) ja tema sõit algab diskreetsel rajal. `FindPal` (igal sekundil enne liikumist) käib soovid läbi vanim enne ja annab igaühele vaba käru, kes jõuab **kõige kiiremini** kohale (`ProgTM`); viigi korral väiksem number. Vaba käru peatuste nimekiri on siis pealelaadimine ja mahalaadimine. Mitme kohaga kärul võib soovi saada ka hõivatud käru (7c, osa 16).
- Eelistatud on käru, kelle **teel pole teist käru**. Kui sobiv vaba käru peaks teisest mööda pääsema, ootab soov kuni `REQUEST_PATIENCE` (30 s) – vahepeal vabaneb tavaliselt lähem käru – ja alles siis antakse see ikkagi. *Valideerimisest (I2):* ilma selleta andis teine käru üherealisel joonel 26 % vähem valmis detaile.
- Käru, kes jaamas maha laadis, võtab sealt kohe ootava soovi, millel käru pole, kui tal on vaba koht (`CartPickupCandidate`).

### 11.4 Teekond – `ProgTM` **[O nimi, U sisu]**

- „Käru programmeerimine“ = tee arvutamine ja kärule andmine (`SetRoute`). Dijkstra raja graafis (`GraphSearch`), kaal = pikkus / kiirus, viigi korral vähem lõike; ühesuunalist lõiku ainult lubatud suunas. Lõigul olev käru võib kahesuunalisel lõigul **ümber pöörata**.
- `blocked(tsoon)` jätab tsoonid välja – **ümbersõit**. `ProgTMOneWayInto` – tee, mille viimane lõik on ühesuunaline (selle lõpus saab oodata, kuni sihtsõlm vabaneb).

### 11.5 Liikluse juhtimine: tsoonid ja plokid **[U]**

Originaalis avastati kahe käru ohtlik lähenemine (`Collision`), kärud seisati ja Planner programmeeris need ümber. Siin **kokkupõrkeid välditakse** broneerimisega nagu raudtee blokisignalisatsioonis:

- **Tsoon** on sõlm (`N<i>`) või lõik (`E<i>`); igas tsoonis on korraga **üks käru** (`track.Holder`). Tsooni ei tükeldata (`ZoneLength` jäi teostamata).
- **Plokk** (`CartBlock`): enne sõlme sisenemist broneerib käru **korraga** sõlme ja sellele järgneva ahela – lõigud ja vahesõlmed kuni
  - hargnemiseni (see jääb järgmisse plokki – käru ootab lõigu lõpus enne seda),
  - ühesuunalise lõigu lõpuni (seal võib oodata – vastutulijat pole) või
  - tee lõpuni (lõppsõlm kaasa).

  Kui sõlm pole hargnemine ja sealt läheb edasi ühesuunaline lõik, on plokk ainult sõlm (seal võib oodata). Seega ei ole kahesuunalisel ahelal kunagi vastutulijat ja käru ootab ainult sõlmes või lõigu lõpus enne sõlme. Pikk kahesuunaline rada ilma hargnemisteta on korraga ühe käru käes.
- Plokk broneeritakse niipea, kui käru on eelmise ploki viimasel lõigul (nagu signaal); tsoon vabaneb, kui käru on sellest väljunud (`MoveCart`).
- **Ümbersõit** (`TryDetour`): kui plokk on kinni, arvutab käru tee, mis väldib teiste kärude tsoone; see võetakse, kui see on kõige rohkem `DETOUR_FACTOR` (1,5) × praegune aeg + `DETOUR_SLACK` (10 s). Nii valib käru hargnemisel vaba haru (**möödasõidurada**: üks ootab haru lõpus, teine läheb teist haru mööda).
- **Vaba käru teelt ära** (`MoveCarts`, `SendAside`): vaba käru, kelle taga keegi ootab, saadetakse lähimasse sõlme, mis pole teiste teel (eelistus: väljapoole kõigi teid → väljapoole ootaja teed → väljapoole ootaja praegust plokki – siis sõidab ta ootajast ette). Tema teed takistavad ainult seisvad kärud (ootavad, laadivad) – liikuv käru vabastab tee ise ja teel seisvad vabad kärud lükatakse järgmisel sekundil edasi. Kui vaba sõlme pole, sobib teise käru sõlm, kuhu viib ühesuunaline lõik. Vaba käru ei jää seisma hargnemisse.

### 11.6 `Collision` – vastastikune ootamine **[O nimi, U tähendus]**

Tsoonidega kokkupõrget ei toimu, kuid kärud võivad üksteist **lõputult oodata** (vastassuunas kärud ühel joonel, ristmikul ringiootamine, tühi käru väljapääsuta taskus).

- Pärast liikumist vaatab `MoveCarts` **ootegraafi** (`FindWaitCycle`: käru → tema ploki tsoonide hoidjad; kõrvale saamata vaba käru → tema väljapääsude hoidjad). Laadiv või liikuv käru ringi ei sulge. Ring → sündmus `Collision`.
- `CollisionProc` valib ringist käru (tühi enne koormaga, siis lühema ooteajaga) ja annab talle **ümbersõidu**, mis väldib teiste ringi kärude tsoone (ringist väljas olevad liiguvad ise ära) – ka ühesuunalise lõigu kaudu teise käru käes olevasse sihtsõlme –, või saadab ta **kõrvale**.
- Kui sama ring (mõne samaga kärudest) tekib kohe uuesti, ümbersõitu enam ei proovita (lõputu ringlemine); `COLLISION_RETRIES` (10) korda järjest või kui kumbki ei õnnestu → simulatsioon peatub: „rajal … ootavad kärud üksteist (1, 2) – ümbersõitu ega kõrvalepõiget pole“ – struktuur ei sobi (nagu C0).
- *Piirang* (valideerimine N): kahesuunalisel ringil ilma möödumiskohtadeta ei leia kohalikud reeglid 3 käru korral lahendust, mis vajaks mitme sammu plaani (üks käru teise sihtjaama, siis kolmas …). Mudelis aitavad suunanooled või möödasõidurajad.

### 11.7 `MinuteMan` diskreetsetel radadel **[O + T]**

Iga diskreetse raja kohta (`MoveCarts`): `FindPal` → iga käru (numbri järjekorras) liigub `Speed · 1 s` mööda oma teed (`MoveCart`: plokid, ümbersõit, ooteasend, tsoonide vabastamine, tee lõpus `CartArrives` → `StopMov`) → vabad kärud teelt ära → ootegraaf (`Collision`). Konveierit ei ole, seega pole ka `StopCount`-i – iga käru peatub ise.

### 11.8 Andmemudel

```json
"Tracks": [ { "Name": "AGV", "Mode": "Discrete", "Carts": 3, "PlacesPerCart": 1,
              "Speed": 50, "LoadTime": 15, "AccessTime": 0 } ]
```

Uusi välju pole: ühesuunalisus tuleb suunanoolest (`Dir` lõigu ikoonil). Etapi 1 kavast jäid ära `Dispatch` (alati lähim käru, FIFO), `ZoneLength`, `EdgeDirections` ja `Parking`.

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
| `SimInit` | algväärtused, mälu, kärude algasendid (`InitCarts`) | [O] |
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
| `StationArray` | jaamad (kus kärud peatuvad ja laaditakse) | [U] |
| `ConnectorArray` | konnektorid: radade ülekandekoht, mahutab 1 detaili (osa 2.3) | [O] |
| `TransportPaths` | lühimad teed jaamast jaama (`StationPaths` tulemus) | [U] |
| `Tracks[i].Pallets` | konveieri alused / diskreetse raja kärud: kohad `Places` (detail või `null`), broneeritud `ReservedWPs` (7c); käru ka `Node`, `Edge`, `Dir`, `Distance`, `Route`, `Goal`, `Waiting`, `StopList` | [T] / [U] |
| `Tracks[i].Nodes`, `Tracks[i].Edges`, `Tracks[i].Holder` | diskreetse raja sõlmed (`Junction` – hargnemine) ja lõigud (`OneWay`); tsoon → käru (osa 11) | [U] |
| `Stats` | kogutud statistika (`Stats.Timeline` – aegrida; `Crashes`, `Scrapped` – etapp 8) | [T] |
| `MachineArray[i]` rike | `CrashMean`, `RepairMean`, `RepairDev` (mudelist); `TimeToCrash` (töötlemisaega rikkeni), `CrashState` (pingi juhuarvujada), `Crashes` (osa 17) | [U] |
| `SysWPArray[i].Scrap`, `WAIT_REPAIR` | detail on praak; olek – praak rikkes pingis ootab remonti (osa 17) | [U] |
| `Tracks[i].Pallets[j].ArrivedAt` | alus jõudis jaama samal hetkel, kui konveier peatus teise aluse pärast (osa 6) | [U] |

**Protseduurid**

| Nimi | Roll | |
|---|---|---|
| `Enumerate` | ruudustikust simulatsiooni võrk ja andmekontroll (osa 2.1–2.2) | [O nimi, U sisu] |
| `DetectOpenCons`, `FindConflicts` | andmekontroll: vabad otsad; andmete kooskõla (osa 2.2) | [O] |
| `TraceTrack`, `WalkTrack`, `FindStations`, `FollowDotLink` | rada suunanoole järgi (silmus või avatud); ikoonide läbimine kuni otsa / sulgumiseni; jaamad hargnemistel ja konnektori kõrval raja otsas; punktiirühenduse järgimine | [U] / [U] / [U] / [T] |
| `PartKey` | raja osa võti (sillal lahter + telg) | [U] |
| `CheckReachability`, `StationPaths`, `ShortestPaths` | kättesaadavuse kontroll (SysOut, ToCS, marsruudi pingid); lühimad teed jaamade vahel üle konnektorite; ühest jaamast, valitud konnektoriteta (osa 2.3) | [U] |
| `CheckObjects`, `LinkMachines` | puhvrite, lao ja väljundi ühendused; pingi ja puhvri seos | [U] / [T] |
| `MeasureTrack`, `BuildNetwork` | lõigud, pikkused, asukohad; võrgu koostamine | [U] |
| `EnumError`, `EnumWarning`, `Neighbor`, `OtherPort`, `ObjectName`, `CellKey`, `CellPath`, `RoundPosition` | `Enumerate` abiprotseduurid | [U] |
| `MACHINE_BUFFER_SIDES`, `BUFFER_FLOW`, `RoleFlow` | pingi ikoon → puhvrite asukoht; puhvri liik → liikumissuund joonisel; kuhu detail puhvris liigub (sissetulev / väljaminev, pingi kohal / all) | [T] / [O] / [T] |
| `ARC_LENGTH`, `POSITION_DECIMALS` | kaare pikkus (π/4 ikooni); asukohtade ümardus | [T] / [U] |
| `TimelinePoint`, `CompareScores` | aegrea punkt; kriteeriumide võrdlus | [U] |
| `MinuteMan` | liigutab konveiereid ja kärusid ühe sekundi võrra | [O] |
| `Planner` | otsused: sissetoomine, marsruut, sihtkoht, pingi laadimine, konfliktid | [O] |
| `FindMach`, `FindBuf`, `FindSysPos`, `FindPal` | sobivaima pingi / puhvri / väljundi / käru otsing (`FindPal` – osa 11.3) | [O] |
| `ProgTM`, `ProgTMOneWayInto`, `SetRoute` | käru tee (Dijkstra raja graafis, ümbersõit); tee, mille viimane lõik on ühesuunaline; tee kärule (osa 11.4) | [O nimi, U sisu] / [U] / [U] |
| `ReserveSlot`, `ReleaseSlot` | koha broneerimine ja vabastamine | [U] |
| `Depart`, `PathConnectors`, `FreePath`, `CanReserveConnector` | teele minek: tee konnektorite broneerimine korraga; tee konnektorid; lühim tee vabade konnektoritega (paralleelsed konnektorid, 7b); kas konnektor on vaba (osa 2.3) | [U] |
| `TraceGraph`, `FindGraphStations`, `MeasureGraph`, `OwnPorts`, `AllPorts`, `PortNeighbor` | diskreetse raja graaf (sõlmed, lõigud, nooled, sidusus); jaamad; lõikude pikkused ja geomeetria; raja küljed lahtris; ikooni küljed koos haruga; mis on külje taga (osa 11.1) | [U] |
| `GraphSearch`, `GraphAdjacency`, `GraphSteps`, `NodeDistances`, `GraphCache` | Dijkstra raja graafis; väljuvad sammud; tee sammud; ajad sõlmest sõlme; vahemälu | [O nimi, U sisu] / [U] |
| `CartBlock`, `TryHoldZones`, `ReleaseZone`, `NodeZone`, `EdgeZone`, `CartZone`, `HeldByOther`, `FarNode`, `WaitPoint` | plokk (osa 11.5); broneerimine korraga; vabastamine; tsooni võti; käru tsoon; kas teise käru käes; sõlm, kuhu käru sõidab; ooteasend lõigul | [U] |
| `MoveCarts`, `MoveCart`, `CartArrives`, `CartContinues`, `TryDetour` | diskreetse raja sekund (`MinuteMan`); käru liikumine; tee lõpus; laadimise järel (`MoveZ`); ümbersõit kinnise ploki korral (osa 11.5, 11.7) | [U] |
| `CartIdle`, `CartPickupCandidate`, `InitCarts`, `CartState`, `CheckCarts` | vaba käru; jaamas peale võetav detail; kärude algkohad; olek statistikas; diskreetse raja invariandid | [U] |
| `PalletWPs`, `PalletHasRoom`, `PalletEmpty`, `ClearPlace`, `CheckPallet` | detailid alusel; kas alusel on vaba koht (detailid + broneeringud < `PlacesPerCart`); alus tühi ja broneeringuteta; detail lahkub kohalt; aluse kohtade invariandid (osa 16) | [U] |
| `PalletAction`, `BeginPalletAction` | aluse järgmine tegevus jaamas (enne mahalaadimised, siis pealelaadimised); selle alustamine või `MoveZ` (osa 16) | [U] |
| `StopNode`, `RemoveCartStop`, `StopListTime`, `CartInsertion`, `CartInsertDrop`, `CanTakeMore`, `UpdateCartGoal` | käru peatuste nimekiri (osa 16): peatuse sõlm; peatuse kustutamine; sõiduaeg läbi peatuste; odavaim lisamine (soov hõivatud kärule); jaamas lisaks võetud detaili mahalaadimine; kas hõivatud käru võib soovi saada; sihtsõlm = esimene peatus | [U] |
| `SendAside`, `NeededZones`, `Blockers`, `Stuck`, `IsWaiting`, `FindWaitCycle`, `FindCollision` | käru kõrvale; tsoonid, mida käru veel vajab; kelle taga käru ootab; kõrvale saamata vaba käru; ootab ootegraafis; ootegraafi ring; `Collision`-i ring (osa 11.6) | [U] |
| `CollisionProc` | `Collision`: ümbersõit või kõrvalepõige, muidu ummik (osa 11.6) | [O nimi, U tähendus] |
| `CrashProc`, `RepairProc` | `Crash`: pink `DOWN`, detail praak, remondi algus; `Repair`: praak pingist välja (osa 17) | [O] / [U] |
| `BeginUnload` | detail pingist puhvri väljaminevale kohale (`ProcessProc`, `RepairProc`) | [T] |
| `Random`, `CrashRandom`, `MixRandom` | seemnega juhuarv (põhijada); pingi rikete ja remondi jada; mulberry32 segamine | [U] |
| `SampleDuration`, `SampleTimeToCrash` | kestus `Mean ± Dev` mudeli jaotusega; töötlemisaeg rikkeni (eksponentjaotus, testides `Options.CrashAfter`) | [T/U] / [U] |
| `MarkArrivals` | alused, mis jõuavad jaama samal hetkel, kui konveier peatub (osa 6) | [U] |
| `DETOUR_FACTOR`, `DETOUR_SLACK`, `REQUEST_PATIENCE`, `COLLISION_RETRIES` | ümbersõidu piir (1,5 × + 10 s); soovi ootamine vaba teega käru järele (30 s); sama ring järjest (10) | [U] |
| `DriveCart` | testidele: käru sõidab sõlme (ilma laadimiseta) | [U] |
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
| abiprotseduurid | `SetWPState`, `SetMachState`, `CurrentOp`, `CanReserveSlot`, `StorageFree`, `StationLoadTime`, `BeginSetup`, `BeginPickup`, `PICKUP_SOURCE`, `BeginUnloadFromPallet`, `AfterPalletAtStation`, `WorkpieceLeaves` – vt päisekommentaarid `src/fms_sim.js`-is | [T]/[U] |
| `Animator`, `SimStatus`, `Transport` | kuvamine: pinkide, puhvrite ja ladude seis; üldseis (üldosa + rajad); alused ja nende kohad (`anima.js`, osa 14) | [O] |

**Mudeli konstandid** (`src/fms_glb.js`)

| Nimi | Roll | |
|---|---|---|
| `IconTypes` | ikooni tüüp → objekti liik, massiiv, millele `N` viitab (joon. 5.4); raja küljed `Ports`, haru `Branch`, kaar `Arc`; sild `CrossOver` (7a) | [O] / [T] / [U] |
| `CellTrack` | raja number, millele lahtri külg kuulub (sillal W–E → `N`, N–S → `N2`) | [U] |
| `DIRECTIONS`, `DirectionPorts` | suunad N/E/S/W (samm, vastaskülg); küljed, kuhu suunanool võib näidata | [T] / [O/T] |
| `MODEL_VERSION` | mudelifaili vormingu versioon (`Meta.Version`) | [U] |
| `MAX_WORKPIECE_TYPES` | detailitüüpe kõige rohkem (16) | [O] |
| `TRACK_MODES`, `BUFFER_DISCIPLINES` | lubatud raja liigid ja puhvri distsipliinid | [O] |
| `DISTRIBUTIONS` | kestuse kõrvalekalde jaotused: `Uniform`, `Triangular`, `Normal` (osa 17) | [U] |

**Kasutajaliides** (etapp 3, osa 13)

| Nimi | Roll | |
|---|---|---|
| `Texts`, `FormatText` | kõik kasutajale näidatavad tekstid (`fms_lng.js`); kohatäidete `{Nimi}` asendus | [O] / [U] |
| `EnvironmentOptions`, `LoadOptions`, `SaveOptions` | keskkonna seaded (teema, värvid; aruande väljund ja teemad – etapp 9) brauseri mälus (`fms_opt.js`, originaalis `FMSS.CFG`) | [O] |
| `DemoModels` | kaasas olevad näidismudelid (`models/`); sisu tuleb failist `models/index.json`, koodis on varunimekiri (etapp 10) | [U] |
| `ParseModelText`, `ModelFileName` | failisisust kontrollitud mudel; mudeli nimest failinimi | [U] |
| `LoadDemoModel`, `ChooseLocalFile`, `SaveModel` | Load (näidis / fail arvutist), Save (allalaadimine) | [O] |
| `SaveText` | tekstifaili allalaadimine (aruanne, etapp 9) | [U] |
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
| `BuildMainMenu`, `NotYet`, `DrawDesktop`, `AcceptLoadedModel`, `Main` | peamenüü; „tuleb versioonis N“ punkt (Advise – 2.0); töölaud; laaditud mudeli vastuvõtt; peaprogramm | [O] / [U] |
| `MenuSimulate`, `SimSummaryLines` | Simulate: kontroll, animaator (osa 14), lõpus kokkuvõte dialoogis | [O] / [U] |
| `SIM_SHOWN_ERRORS`, `SIM_SHOWN_OBJECTS`, `CheckLine`, `Percent`, `Decimal` | kokkuvõtte piirid ja vormindus (%, koma); `ClockText` (h:mm:ss) on `anima.js`-is | [U] |
| `DesktopView`, `SetDesktopView`, `GetDesktopView`, `POINTER_CAPTURED`, `HandleWheel`, `InsideDesktop` | töölaua vaade (animaator, aruanne): joonistaja, klahvid, hiir; praegune vaade (aruanne taastab selle); lohistamine; hiire ratas | [U] |
| abiprotseduurid | `MenuItems`, `SelectedItem`, `DropdownItems`, `DrawMenuBar`, `DrawDropdown`, `DrawStatusLine`, `MoveInDropdown`, `HandleMenuKey`, `OpenDialog`, `CloseDialog`, `DrawDialog`, `HandleDialogKey`, `HandleDialogPointer`, `MenuLoad`, `MenuPick`, `MenuNew`, `MenuSave`, `MenuWriteAs`, `AskQuit`, `ShowHelp` – vt kommentaarid `src/windows.js`-is ja `src/fms.js`-is | [U] |

**Animaator** (`src/anima.js`, etapp 5, osa 14)

| Nimi | Roll | |
|---|---|---|
| `AnimState` | animaatori olek (jooksev, kiirus, eelmine nihe, kaardid, hiir); `null` – suletud | [U] |
| `StartAnimator`, `StopAnimator`, `AnimatorActive` | avamine (SimInit, pausil), sulgemine, kas avatud | [U] |
| `TrackGeometry`, `TrackPoint`, `CellPathPoint`, `ArcCorner` | raja ikoonid asukohtadega; asukoht rajal → punkt ruudustikus; punkt ikooni sees; kaare keskpunkt | [U] |
| `PalletPosition`, `InterpolateOffset` | aluse asukoht (sama valem mis `MinuteMan`-is); nihe kahe sekundi vahel | [T] / [U] |
| `EdgePoint`, `NodePoint`, `CartPosition`, `CartPoint`, `InterpolateCart`, `CartPositions` | diskreetse raja punkt lõigul; sõlme punkt; käru asukoht (koopia); käru punkt; käru punkt kahe sekundi vahel; kõigi kärude eelmine asukoht (7b) | [U] |
| `DrawZones`, `BranchIsTrack` | broneeritud plokk (katkendjoon, ring); kas hargnemise haru on rada (pidev joon) või punktiirühendus (7b) | [U] |
| `WorkpiecePlaces`, `PlacePoint`, `BuildScene` | kus iga detail joonistatakse (ka laadimisel liikumas); koha punkt; kaadri andmed | [U] |
| `PalletGrid`, `PalletPlacePoint`, `DrawPalletPlaces`, `PLACES_SHOWN`, `PLACE_PITCH` | aluse kohtade paigutus (1–3 reas, 4 – 2 × 2); koha punkt alusel; vabad ja broneeritud kohad, üle 4 koha detailide arv; nähtavaid kohti 4; kohtade vahe (7c) | [U] |
| `FitText`, `EgaStatusRows` | tekst lühendatud laiusesse („..“); EGA olekurida üks või kaks rida (7c, 7b ootel töö) | [U] |
| `EventListArray`, `DiffEventList`, `EventAxisX`, `EVENT_TICKS`, `EventCardLayout`, `RelatedObjects` | Event List massiivina; lisandunud ja töödeldud kirjed; ajatelg ja selle märgid (kellaajana); kaartide veerud; kaardiga seotud objektid | [U] |
| `SPEED_STEPS`, `MAX_SPEED`, `SpeedFromSlider`, `SliderFromSpeed`, `NextSpeed`, `SpeedText`, `ClockText` | kiiruse skaala (×1 … ×1000) ja vormindus; aeg h:mm:ss | [U] |
| `LayoutView`, `DrawLayout`, `DrawIcon`, `ObjectLabel` | ruudustiku vaade ekraanil (kaameraga: kerimine ja suum, 11a); ikoonid (kasutab ka redaktor) | [U] |
| `Camera`, `ScrollLayout`, `ScrollStep`, `ScrollArrows`, `DrawScrollArrow` | animaatori kaamera (`Zoom`, `Scroll`); kerimine sammu kaupa; samm (EGA 1 ikoon, kaasaegne ¼ vaatest); kerimisnooled; noole joonistus (ka redaktor) (11a) | [O, autori mälestus] / [U] |
| `ModernCellSize`, `ZoomMin`, `ZoomAt`, `WheelZoomFactor`, `MODERN_ZOOM` | kaasaegse ikooni suurus (automaatne või suum); väikseim suum; suum punkti ümber; ratta samm → tegur; suumi piirid 24 … 144 px (11a) | [U] |
| `AnimatorPainter`, `DrawControlBar`, `ControlLayout`, `DrawEventStrip`, `DrawLinkedList` | töölaua joonistaja; juhtriba; Event List riba ja ahelloend | [U] |
| `AnimatorFrame`, `AdvanceSimulation`, `AnimatorInput`, `AnimatorKey`, `AnimatorHint` | kaader; simulatsioon edasi (time mapping); hiir ja klahvid; olekurea vihje | [U] |
| abiprotseduurid ja konstandid | `StepSimulation`, `CheckFinished`, `ScheduleFrame`, `WakeAnimator`, `ToggleRun`, `StepOnce`, `NextEvent`, `SetSpeed`, `ToggleMax`, `StopRun`, `ExitAnimator`, `SlotPoint`, `QueuePoint`, `DrawWorkpiece`, `DrawBufferSlots`, `DrawStorages`, `DrawConnectors`, `DrawSpindle`, `DrawMachineLetters`, `DrawTrackIcon`, `DrawDirectionArrow`, `MACHINE_ROLES`, `MACHINE_LINK_SIDES` jt – vt päisekommentaarid | [U] |
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
| `MakeCrossOver` | sirgest sild: teise raja rada risti (7a) | [U] |
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

**Aruanded** (`src/fms_rep.js`, etapp 9, osa 18)

| Nimi | Roll | |
|---|---|---|
| `fms_rep.js` | aruannete generaator (originaalis `FMS_REP1.PAS`) | [O] |
| `StaticReport`, `DynamicReport` | Static (algne seis ja lõppseis), Dynamic (kogutud statistika) valitud teemadega | [O] |
| `STATIC_TOPICS`, `DYNAMIC_TOPICS`, `ChooseTopics`, `ReportTopics` | teemad; teemade valik vormis ja seadetest (`fms.js`) | [O] / [O] / [O] / [U] |
| `OutputReport`, `ShowReport`, `ReportText` | Output: ekraanile (kerimisega vaade) või faili (tekst) | [O] |
| `MenuStaticReport`, `MenuDynamicReport`, `ChangeReportOutput` | Report → Static, Dynamic, Output → Display / File (`fms.js`) | [O] |
| `FullReport`, `SaveReportAs`, `ReportFileName` | kokkuvõtte nupp „Aruanne“ (Static + Dynamic); failinime küsimine ja allalaadimine; vaikimisi nimi `mudel-static.txt` | [U] |
| `LastReport`, `KeepReport`, `LastSimulation`, `ForgetReport` | viimane simulatsioon (aruanne, lõppseis, mudel JSON-ina, failinimi); meelde jätmine; lugemine; unustamine (testid) | [U] |
| `CaptureEndState` | lõppseis `SimState`-ist: pinkide olek ja detail, puhvrite sisu, alustel ja konnektorites olevad detailid, keskladu, detailid asukoha ja tüübi järgi | [U] |
| `CycleStats` | tsükliaeg ja selle osad (keskmine, lühim, pikim, osade keskmised ja osakaalud; originaali ptk 8.5) | [U] |
| `TimelineStep`, `TimelineRows`, `TIMELINE_STEPS`, `TIMELINE_MAX_ROWS` | aegrea samm aruandes (kuni 100 rida); valitud punktid | [U] |
| `ReportView`, `ReportActive`, `CloseReport`, `ReportLayout`, `ReportPainter`, `DrawReportLine`, `ReportInput`, `ScrollReport` | aruande vaade töölaual: olek; kas ees; sulgemine (eelmine vaade tagasi); paigutus; joonistamine (EGA – märgid, kaasaegne – joon ja tulbad ristkülikutena); klahvid, ratas, kerimisriba | [U] |
| `REPORT_WIDTH`, `BAR_WIDTH`, `SHARE_BAR_WIDTH`, `WHEEL_LINES` | rea suurim laius (74 märki – mahub EGA aknasse); tulpade pikkus; ratta samm | [U] |
| `TableLines`, `WrapLines`, `LineText`, `Percent`, `Decimal` | püsilaiusega tabel; loetelu murdmine; rea tekst; vormindus (protsent, koma) | [U] |
| abiprotseduurid | `StatusText`, `DeadlockLines`, `HeaderLines`, `TrackKind`, `StaticModel` … `StaticCrashes`, `DynamicCycle` … `DynamicEvents`, `ClampTop` – vt päisekommentaarid | [U] |

**Avaldamine** (`src/fms_file.js`, etapp 10, osa 19)

| Nimi | Roll | |
|---|---|---|
| `ParseDemoList` | näidiste nimekirja (`models/index.json`) sisust `[{ File, Name }]`; vigased kirjed (ka failinimi, mis pole kujul `nimi.fms.json`) jäetakse välja | [U] |
| `LoadDemoList` | loeb näidiste nimekirja serverist ja asendab `DemoModels`-i sisu; kui ei õnnestu, jääb varunimekiri | [U] |
| `DEMO_LIST_FILE`, `DEMO_FILE_PATTERN` | nimekirja fail (`index.json`); lubatud näidise failinimi | [U] |

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
| konveier | rada; seisab → teine värv (iga rada eraldi, 7a), olekureal „seisab (n)“ = käivaid laadimisi; avatud konveieril lähevad alused lõpust algusesse |
| konnektor (7a) | kast raja vahel; detail sees; broneeritud (detail tuleb) – kontuur ümber kasti |
| alus | ruut raja peal; broneeritud (detail tuleb peale) – teine raam. Mitme kohaga (7c): kohad lahtritena 1–3 reas või 2 × 2, detail oma kohas, vaba koht (`PalletPlace`), broneeritud koht kontuuriga; üle 4 koha – „detaile/kohti“ aluse kohal |
| AGV käru (7b) | ruut raja graafis (`CartPoint`), liigub sujuvalt ka sõlme kaudu ja ümber pöörates (`InterpolateCart`); ootab tsooni – oranž / pruun raam; broneeritud plokk, kuhu käru pole veel jõudnud – lõik katkendjoonena, sõlm ringina (`DrawZones`); raja-haru on pidev joon, punktiirühendus punktiir |
| detail | ring tüübi värviga (16 tüüpi); ummiku tõttu kesklattu saadetav – punane ring; praak (8) – rist peal (roll `Scrap`) |
| tööpink | keha värv olekust; täht: L laadimine, H häälestus, T töötlemine, M mahalaadimine, R rike (8: punane keha, praak pingis, kaasaegses spindlit pole) |
| puhver | kohad lahtritena: detail (nool pingi poole – sissetulev, raja poole – väljaminev), broneeritud (kontuur), vaba |
| FromCS / ToCS / SysOut | ootavad detailid (4 + arv); täituvus valmis + pargitud + broneeritud / mahutavus; lahkunute arv |
| SimStatus | aeg / kestus, kiirus, olek, detailid süsteemis ja valmis, tk/h, konveier; diskreetsel rajal „AGV liigub 2/3“ või „AGV ootab 1/3“. EGA-s kahel real, kui radade tekst kõige pikemal kujul ei mahu (rida ei hüppa), teine rida vajadusel lühendatud „..“; kaasaegses juhtribal lühendatud (7c) |

EGA: ikoon 48 × 35 pikslit (4:3 ekraanil ruut), joonistamine pikslihaaval 16 värviga (Bresenham, ilma silumiseta).

**Kerimine ja suum** (etapp 11a, versioon 1.1) – mudel võib olla ekraanist suurem. Diplomitöö väljatrükis seda pole, aga autori mälestuse järgi oli kerimine originaali hilisemas versioonis olemas **[O, autori mälestus]**; suum on uus **[U]**. Teostus: `LayoutView` kaameraga (`anim.Camera` = `{ Zoom, Scroll }`), testid `test/anima.test.js`.
- **EGA**: ikoon jääb alati 48 × 35 (enne vähendati, et kogu mudel mahuks). Mis ei mahu, seda keritakse **terve ikooni kaupa**: nooleklahvid, `Home` – algusesse, hiire ratas (vertikaalselt), klõps servade kerimisnooltel (`ScrollArrows`, sama joonistus mis redaktoris – `DrawScrollArrow`). Kui mudel ei mahu, on olekureal „←→↑↓ Keri“ (siis jääb sealt välja `M`, mis töötab edasi).
- **Kaasaegne**: alguses automaatne suurus – kogu mudel mahub, ikoon 36 … 72 pikslit (`ModernCellSize`); alla 36 ei vähendata, vaid keritakse. **Suum**: hiire ratas või puuteplaadi näpistus suumib hiire all oleva punkti ümber (`ZoomAt`, `WheelZoomFactor` – üks samm ≈ 14 %), piirid 24 … 144 pikslit (`MODERN_ZOOM`; väiksem piir alla 24, kui kogu mudel muidu ei mahuks – `ZoomMin`). Lohistamine kerib (murdosades), nooled kerivad veerand vaate kaupa (`ScrollStep`), `0` – automaatne suurus. Vihje olekureal, kui hiir on joonise kohal. `+` / `−` jäävad kiiruse jaoks.
- **Lõikamine**: joonis joonistatakse ainult vaate alasse (`Clip`); kerimise teljel jääb servadesse kerimisnoolte riba (EGA 7, kaasaegne 10 pikslit). Kaamera jääb F2 vahetuse üle alles (kerimine viiakse piiridesse); uus Simulate algab algusest.
- **Redaktori View** kasutab `LayoutView`-d ilma kaamerata – kogu mudel mahub nagu enne. Suuruse piir 41 × 23 (`MAX_LAYOUT_DIM`) jääb.

**Ainult kaasaegses välimuses** **[U]**:
- **Event List riba**: ajatelg (logaritmiline, nüüd … +1 h) alates nähtavast ajast, märgid kellaajana h:mm:ss nagu üleval (nüüd, +10 s, +1 min, +10 min, +1 h; arvutus jääb sekundites); sündmused kaartidena (värv tüübi järgi, nt `Load WP12`), sama aja sündmused ühes veerus FIFO järjekorras (3 rida, ülejäänu „+n“). Lisandunud kaart libiseb kohale, töödeldud kaob vasakule (`DiffEventList` – kirjeid võrreldakse viite järgi). Kaardile osutades tõstetakse esile seotud pink / puhver / jaam / alus / detail ja olekureale tuleb sündmuse aeg. `L` – ahelloendi vaade (kastid `Event`, `WP`, `Time` (h:mm:ss) ja `Next`-nooled, `FirstAtMoment` … `nil`). Kiirusel üle ×50 ja max-režiimis ainult arvud.
- Pingi spindel pöörleb töötlemisel, häälestusel pöörleb aeglaselt hammasratas.
- `Collision` (7b), `Crash` ja `Repair` (8) on Event Listis punase kaardina.

---

## 15. Redaktor (etapp 6) **[O + U]**

Originaalis (originaal.md 8.2): `EditLayout` – üleval redigeeritav mudel (13 × 4 ikooni, ruudustik), all ikoonipalett; ikoon valitakse paletist hiirega ja pannakse ruudule; servades kerimisnooled. `View` – sama väiksemas mõõtkavas (41 × 23), ilma ruudustikuta. Teostus: `src/fms_ed.js`.

**Layout** **[O + U]**
- Aken: infurida (mudel, ruudustik, aktiivne rada, kursor), ruudustik ja palett. EGA-s ikoon 48 × 35 nagu animaatoris; nähtav osa sõltub ekraanist (EGA-s 13 × 6), ülejäänu kerimisnoolte, hiire ratta või kursoriga. Kaasaegses välimuses on ikoon nii suur, kui ruumi on (36 … 72 pikslit); **suum** (etapp 11a) **[U]**: Ctrl + hiire ratas või näpistus (`Ctrl` sisendis – `HandleWheel`), piirid nagu animaatoris (`ModernCellSize`), `0` – automaatne suurus. Kerimine jääb terve ikooni kaupa ja kursor jääb nähtavale.
- **Palett** **[O]**: kõik originaali ikoonid (joon. 5.4) + punktiirühendus + tööriistad (vali / liiguta, kustuta, suunanool). Klõps paneb **täpselt valitud ikooni** (originaali moodi).
- **Rada lohistades** **[U]**: rajaikooni või punktiiri tööriistaga lohistades saab iga lahter küljed, kust rada sisse ja välja läheb, ja ikoon valitakse külgedest (`IconFromPorts`): kaks külge – sirge või kaar, kolm – hargnemine, neli – ristmik. Arvesse lähevad ainult **ühendatud** küljed (`LinkedPorts`) – seepärast saab raja otsast pöörata (ots muutub kaareks, mitte hargnemiseks). Kiire hiire korral täidetakse vahele jäävad lahtrid (`CellSteps`); tagasi liikudes kaob viimane lõik (tee arvutatakse iga kord algseisust uuesti). Klaviatuuril sama: Shift + nool kursorist.
- **Reeglid** (sama mis `Enumerate`-s): pidev rada ei lähe objekti ega punktiiri sisse; punktiir lõpeb puhvri, lao või väljundiga ja liitub ainult raja **sirgega risti** – nii tekib hargnemine (jaam); punktiir ei hargne. Konnektorisse (7a) jõuab rada või punktiir ainult konnektori raja küljest (`HorCon` W/E, `VertCon` N/S); konnektorist rajale risti tõmmates tekib hargnemine. **Sild** (7a): teise raja sirgest risti üle tõmmates tekib ise sild (`CrossOver`, rajad ei ühendu); sama raja ristmik (`Cruise`) muutub sillaks, kui panna sellele paletist sild (ja tagasi ristmikuks paletist ristmikuga). Naabri kustutamine silda ei muuda; raja kustutamisel jääb teise raja sirge. Teine rada: `T` (aktiivne rada). Mittesobiv lõik jääb tegemata ja olekureal on teade.
- **Objektid**: pink ja puhver saavad paigutamisel uue kirje vaikeväärtustega (pink `MT1` …, esimene operatsioon `OPERATIONS`-ist). Sama liiki ikoon samas lahtris muudab ainult ikooni (objekt ja andmed jäävad). `ToCS` loob kesklao andmed, kui neid polnud.
- **Kustutamine**: naabruses olev hargnemine / ristmik kaotab selle poole haru. Pingi või puhvri viimase ikooniga kaovad ka tema andmed ja järgmiste numbrid (`N`, `BUFn`) nihkuvad – pinkide nimed jäävad. **Rajad jäävad alles** (rada joonistatakse tihti ümber; rada kustutatakse Transport-menüüst). Metrokaardi pikkus (`EdgeLengths`), mille lahter pole enam rada, kaob.
- **Suunanool** **[O]**: klõps raja sirgel või kaarel – puudub → üks suund → teine → puudub. Kui ikoon muutub (nt sirgest saab hargnemine), kaob nool, mis enam ei sobi.
- **Muu**: vali / liiguta – lohista ikoon tühja lahtrisse; `T` – aktiivne rada (uute rajaikoonide `N`; viimane valik on uus rada); `G` – ruudustiku mõõdud (kuni 41 × 23, välja jäävad ikoonid kustutatakse küsimusega); Ctrl-Z / Ctrl-Y – Undo / Redo (100 sammu, kogu mudeli hetktõmmised); Esc – töölauale.
- Mudel muutub kohapeal (`CurrentModel`). Salvestamata muudatus on töölaual näha ja Load / Pick / New / Quit küsivad enne kinnitust (`ConfirmDiscard`).

**Diskreetne rada** (7b) **[U]**: redaktor joonistab samamoodi; rada lohistades tekivad raja-harud (hargnemine) ja ristmikud (`Cruise`), mis on diskreetsel rajal lubatud (`Mode` = `Discrete` Transport-vormis). Suunanool lõigul teeb lõigu ühesuunaliseks. Metrokaardi lõik (`SegmentCells`) lõpeb diskreetse raja otsas otsalahtri keskel (pool ikooni), nagu `MeasureGraph`-is.

**View** **[O]**: kogu mudel korraga, ilma ruudustiku punktideta; ainult vaatamiseks (Esc).

**Andmed vormides** (`src/fms_ed_data.js`, etapp 6b) **[O + U]**
- **Config** **[O]**: *All* – kõik objektid joonisel järjest (pingid, puhvrid, rada, keskladu; ülevalt alla), objekt on Layout-is esile tõstetud ja vorm avaneb ekraani all – või üleval, kui all kataks objekti (`FormBox` `Avoid`). OK → järgmine, Loobu / Esc lõpetab. *Choose* – Layout tööriistaga „vali“: klõps või Enter objektil avab selle vormi.
- **Vormid**: tööpink (nimi, mudel, ajad, rikete vahe ja remont ± kõrvalekalle – etapp 8, operatsioonid märkeruutudega + uus), puhver (kohad, pöördusmeetod, aeg), keskladu (kas on, kohad, aeg), rada (tabel 4.1; raja lahtrist avades ka **lõigu pikkus** – metrokaart, tühi = mõõtkavast), detail (nimi, prioriteet, partii) → **marsruudid** (nimekiri + uus) → marsruut (prioriteet ja operatsioonide tabel: operatsioon, keskmine, kõrvalekalle; + op / − op / Kustuta), **Model data** [U] (nimi, mõõtkava, seeme, kestus, Kl, seisu piir, kõrvalekalde jaotus – etapp 8).
- **Kontroll** [U]: vormi väärtused pannakse mudeli koopiasse ja kontrollitakse sama `CheckModel`-iga, mis faili laadimisel; vead on välja juures (silt punane, teade vormi all). Arvus sobib koma ja punkt.
- **Menüüd**: Transport – rajad + *Uus rada*; vormis *Kustuta rada* (ikoonid ja andmed, järgmiste numbrid nihkuvad). Workpiece data – detailid → *Edit* / *Copy* / *Flush* + *Uus detail* (kuni 16). Storage data, Model data.
- **Andmekontroll ja hoiatused** [U]: Layout-i infureal on vigade ja hoiatuste arv (`ModelProblems`: `CheckModel`, siis `Enumerate`; arvutatakse iga muudatuse järel). **K** või Edit → **Check** näitab nimekirja; Enter viib vea kohale joonisel (`ProblemCell`: lahter, pink, puhver või rada).
- **Pooleli mudel jääb salvestatavaks**: „operatsiooni ei tee ükski pink“ on nüüd ainult `Enumerate`-i viga (osa 2.2) – muidu muutuks mudel pärast pingi kustutamist laadimatuks.
- Vormi muudatus läheb Layout-i Undo-sse (`NoteEditorChange`) ja märgib mudeli muudetuks.

---

## 16. Mitu detaili alusel / kärul (etapp 7c) **[O + U]**

Originaalis on rajal „kohtade arv transpordivahendil – mitu detaili mahub korraga“ (originaal.md tabel 4.1), aga kuidas mitu detaili ühel alusel liiguvad, pole kirjeldatud. **[O]** Teostus: `src/fms_sim.js`, testid `test/places.test.js`, valideerimine [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 7c.

- **Põhimõte jääb** **[U]**: detail läheb alusele ainult siis, kui tema sihtkoht (ja tee konnektorid) on broneeritud (osa 5.2). Seega pääseb iga alusel olev detail alati maha – transpordikohad ei ole kunagi ringootamises ja ummiku vältimist (osa 5.3) muuta pole vaja.
- **Kohad** **[U]**: alusel / kärul on `Places` (massiiv pikkusega `PlacesPerCart`, detail või `null`) ja `ReservedWPs` (pidev rada: pealelaadimine käib; käru: talle antud soovid). Detaili asukoht `Pallet` teab oma kohta (`Place`). `PlacesPerCart = 1` korral on kõik nagu enne: kõik varasemad aruanded on identsed (VALIDEERIMINE.md 7c).
- **Jaamas** (`PalletAction`) **[T]**: enne kõik mahalaadimised (detailid, mille sõit lõpeb siin), siis pealelaadimised (vaba koht ja ootav detail, vanim enne). Iga detail on eraldi `Load` (`LoadTime`); alus seisab, kuni tegevusi on.
- **Pidev konveier** **[T]**: alus peatub, kui tal on siin mahalaadimine või vaba koht ja jaamas ootab detail (`NeedsStop`). Kogumissõit tuleb iseenesest – alus korjab detaile tee pealt. Avatud konveier jääb ohutuks, sest iga detail sõidab ainult allavoolu (osa 2.3).
- **Käru – peatuste nimekiri** (`StopList`) **[U]**: kirjed `{ Kind: 'Pickup' | 'Drop', Station, WP }`. Käru sõidab nimekirja esimesse jaama (`Goal`), teeb seal kõik tegevused ja jätkab järgmisse (`CartContinues`). Tühi nimekiri – käru on vaba.
- **Soov hõivatud kärule – odavaim lisamine** (*cheapest insertion*, *dial-a-ride* ülesande tuntud heuristika) **[U]**: `FindPal` võib soovi anda ka kärule, kellel on töö ja vaba koht (detailid + broneeringud < `PlacesPerCart`), kes ei laadi ja sõidab oma sihtsõlme (`CanTakeMore`). `CartInsertion` proovib kõiki kohti nimekirjas: pealelaadimine positsioonile *i*, mahalaadimine *j ≥ i*; valitakse väikseim sõiduaeg (käru juurest `ProgTM`, edasi `NodeDistances`). Lubatud ainult siis, kui uus sõiduaeg on kõige rohkem `DETOUR_FACTOR` × praegune + `DETOUR_SLACK` (1,5 × + 10 s) – kärul olevad detailid ei jää kauaks peale. Kui jaam on käru teel, on lisakulu 0. Soov läheb kärule, kes jõuab pealelaadimisele kõige varem (vaba käru: sõiduaeg; hõivatud: sõit + eelnevate peatuste laadimised). Kuna kohustusi pole rohkem kui kohti, ei saa käru kunagi ületäis ja nimekirjas on kõige rohkem `2 × PlacesPerCart` peatust.
- **Jaamas lisaks** **[T]**: kui kärul on pärast mahalaadimisi vaba koht, võtab ta jaamas ootava soovi, millel käru pole (`CartPickupCandidate`, nagu 7b-s), ja selle mahalaadimine lisatakse nimekirja odavaimasse kohta (`CartInsertDrop`).
- **Liiklus** (osa 11.5–11.6) ei muutu: osaliselt täis käru on `Collision`-i valikus „koormaga“; kõrvale saadetakse ainult vabu kärusid; hõivatud kärule ei lisata soovi, kui ta on kõrvalepõikel või ümbersõidul teise sõlme (`RouteEnd ≠ Goal`).
- **`Kl`** **[U]**: `Ntm` = aluste / kärude arv (`Carts`), mitte kohtade arv (osa 5.2). Originaali järgi (`Carts × PlacesPerCart`) tõi Planner süsteemi rohkem detaile, mis ootasid FromCS-is – tsükliaeg kasvas (A: 1883 → 3907 s), läbilaskevõime mitte (VALIDEERIMINE.md 7c leid 1).
- **Statistika**: raja `AvgLoad`, `MaxLoad`, `Pooled` (osa 7); kokkuvõttes rida „kohti N: keskmiselt …, kuni …, kogumissõite …“.
- **Andmemudel**: uusi välju pole – `PlacesPerCart` oli olemas; redaktori hoiatus 6 (`Carts × PlacesPerCart > Σ Capacity`) arvestab kohti.

---

## 17. Rikked ja juhuslikkus (etapp 8) **[O + T + U]**

Originaalis: `Crash` on sõltumatu sündmus, mille toimumine on antud **tõenäosusega ajaühikus**; seade seisab remondi ajal; **rike tööpingis → töödeldav detail on praak ja saadetakse välja** (originaal.md 5.1, 5.4 p 6). Parameetrid puudusid (originaal.md osa 10). **[O]** Teostus: `src/fms_sim.js`, testid `test/crash.test.js`, valideerimine [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 8.

- **Ulatus**: ainult tööpingi rike. Transpordi, puhvri ja konnektori rike (originaali tabel 4.5) ja kvaliteedipraak (tõenäosus operatsiooni kohta) jäid tegemata – ideed 2.0 jaoks. **[U]**
- **Rikke kell** **[T]**: käib ainult töötlemise ajal (`PROCESSING`). Töötlemisaeg rikkeni (`TimeToCrash`) on eksponentjaotusega keskmisega `CrashMean` (püsiv tõenäosus ajaühikus), täissekundites, vähemalt 1. Nii juhtub rike alati detaili töötlemise ajal ja detail on alati praak, nagu originaalis. Uus aeg loetakse remondi lõpust.
- **Sündmuste ahel** **[T]**: `TurnProc` võtab operatsiooni kestuse; kui `TimeToCrash ≤ kestus`, tuleb `Process`-i asemel `Crash` ajal `t + TimeToCrash`. Event Listist ei pea midagi eemaldama.

```
Turn → Process                     (tavaline)
Turn → Crash → Repair → Load (pink → puhver) → Planner → OutSys → … → SysOut
```

- **`CrashProc`** **[O]**: pink `DOWN`, detail `Scrap` ja olekusse `WAIT_REPAIR` (jääb remondi ajaks pinki); järgmise pingi broneeritud koht (`PlannedDestination`, osa 3.3) vabaneb kohe; remondiaeg `RepairMean ± RepairDev` (mudeli jaotusega); Planner.
- **`RepairProc`** **[U]**: praak laaditakse välja nagu valmis detail (`BeginUnload`) – väljaminev koht broneeriti pingi laadimisel, seega on see olemas. Praagil operatsioone pole (`CurrentOp` = null), seega `OutSys` → alati `SysOut` (osa 3.4). Lahkumisel läheb praak arvesse `Scrapped`, mitte `Completed`.
- **Planner** **[U]**: `FindMach` eelistab pinki, mis pole rikkes (osa 5.2); rikkes pingi puhvrisse võib siiski detaile saata. `ChooseRoute` loeb ainult vabu (`IDLE`) pinke.
- **Ummik** **[T]**: `DOWN` ei ole `IDLE` – puhver loetakse edasi liikuvaks ja seisukontroll ei käivitu (Event Listis on `Repair`).
- **Juhuarvud** **[U]**: igal pingil on oma jada (`CrashRandom`, seeme `Seed` ja pingi number). Rikete sisselülitamine ei muuda põhijada (`Random`) – kui rikkeid pole (`CrashMean` = 0 või puudub), on tulemused samad mis enne.
- **Kestuse jaotus** (`Sim.Distribution`, `SampleDuration`) **[U]**: `Uniform` – ühtlane `Mean ± Dev` (vaikimisi, nagu enne); `Triangular` – kahe ühtlase juhuarvu summa (tipp `Mean` juures, otsad `Mean ± Dev`, σ² = Dev²/6); `Normal` – σ = `Dev`, väljaspool `Mean ± 3σ` võetakse uus (Box–Muller). Kehtib operatsioonidele ja remondile; laadimis- ja häälestusajad on kindlad (originaalis on kõrvalekalle ainult operatsioonil).
- **Animaator**: rikkes pink punane, täht R, praak pingis ristiga; olekureal „rikkes n praak m“ (kui mudelis on rikkeid – alati, et EGA rida ei hüppaks); Event Listis `Crash` / `Repair` punased. **Kokkuvõte**: rida „Rikkeid n, praak m“ ja pingi real „rikkes x %“.
- **Redaktor**: pingi vormis rikete vahe ja remont ± kõrvalekalle (+ selgitus), Model data vormis kõrvalekalde jaotus.

---

## 18. Aruanded (etapp 9) **[O + U]**

Originaalis (originaal.md 8.3, ptk 6.5 lk 62): moodul `FMS_REP1.PAS`, menüü *Report* – **Static** (süsteemi komponentide parameetrid), **Dynamic** (dünaamilised parameetrid ja simulatsiooni käigus kogutud statistika); mõlemas **valib kasutaja teemad**; **Output** – ekraanile või kasutaja antud nimega faili. Tsükliaeg ja osakaalud: originaal.md 8.5. **[O]** Teostus: `src/fms_rep.js`, menüü `src/fms.js`, testid `test/report.test.js`, valideerimine [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 9.

- **Static = algne seis + lõppseis** **[U, kasutaja otsus]**: iga teema all kõigepealt komponentide parameetrid (mudelifailist ja `Enumerate` võrgust – saadaval ka ilma simulatsioonita), siis lõppseis viimasest simulatsioonist (objekti olek lõpus ja tema statistika).
- **Dynamic** – kogu süsteemi statistika simulatsiooni käigus.

| Static teema | Algne seis | Lõppseis |
|---|---|---|
| Mudel ja seaded | ruudustik, mõõtkava, kestus, seeme, `Kl`, seisuaeg, jaotus, aegrea samm, objektide arv | aeg ja olek, sisse / valmis / praak / süsteemis, detailid asukoha järgi |
| Rajad ja konnektorid | liik, pikkus, kiirus, alused / kärud, kohti, laadimisaeg; konnektori rajad | pidev: liikumise osakaal, peatusi, seisab / liigub, alustel, täituvus, kogumissõidud; AGV: kärude olekute osakaalud, `Collision`, ümbersõidud; konnektoris detail, ülekandeid |
| Tööpingid | laadimine, häälestus, rike, remont, puhvrid, operatsioonid | olek, detail, operatsioone, rikkeid; olekute osakaalud |
| Puhvrid | liik, pink, mahutavus, järjekord, laadimine | sissetulevad, väljaminevad, broneeritud, keskmine ja suurim täituvus |
| Keskladu | mahutavus, laadimine, ummikuvaru | valmis laos, pargitud, täituvus; parkimised kokku |
| Detailitüübid | prioriteet, partii, marsruudid (operatsioon keskmine ± kõrvalekalle) | sisse, valmis, praak, süsteemis, keskmine tsükliaeg |
| Rikked ja praak | jaotus, pinkide rikete ja remondi parameetrid | rikkeid, praak, pinkide kaupa, praak tüüpide kaupa |

| Dynamic teema | Sisu |
|---|---|
| Tsükliaeg ja osakaalud | läbilaskevõime, detaile süsteemis (keskmine, suurim), `Tts` (keskmine, lühim, pikim), valem ja osade tabel tulpadega, suhtarvud |
| Tsükliaeg tüüpide kaupa | valmis, `Tts` keskmine / lühim / pikim, töötlemise, transpordi ja ootamise osakaal |
| Aegrida | `Stats.Timeline`: aeg, süsteemis, valmis kokku ja vahemikus, pinke töös, rikkes, puhvrites; graafik |
| Sündmused | sündmuste arv tüübi kaupa (`EventCountByType`) |

- **Tsükliaja osad** **[T]**: `SimReport`-i kategooriad vastavad originaali valemile nii: `Tm` – töötlemine (`Process`), `Tturn` – häälestus (`Setup`), `Tload` – laadimine (`Load`, sh `Tin`, `Tout`), `Ttrans` – transport, `Twait` – ootamine. `Tp`, `Tprep`, `Twash`, `Tmeas` eraldi pole (pesemine ja mõõtmine oleks operatsioonid). Töötlemise osakaal = (`Tm` + `Tturn`) / `Tts`.
- **Millal saadaval** **[U]**: Simulate jätab tulemuse meelde (`KeepReport`) iga kokkuvõtte ajal – lõpus, ummikus ja katkestamisel (Esc). Päises on olek: „lõpuni“, „katkestatud kell …“ või „UMMIK kell …“ koos põhjusega. Kui mudelit on pärast simulatsiooni muudetud (mudeli JSON erineb), siis Static lõppseisu ei näita ja Dynamic hoiatab. Dynamic ilma simulatsioonita – teade „käivita enne Simulate“.
- **Teemad** **[O]**: Static / Dynamic avab vormi märkeruutudega, valik jääb seadetesse (`EnvironmentOptions.ReportStatic`, `ReportDynamic`). Teemade järjekord aruandes on alati sama.
- **Kokkuvõtte nupp „Aruanne“** **[U]**: Static ja Dynamic valitud teemadega ühes aknas. Normaalse lõpu järel tuleb Esc-iga tagasi animaator, katkestamise järel töölaud.
- **Ekraanil** **[O + U]**: töölaua vaade (nagu animaator) – menüü jääb kasutatavaks, F2 vahetab välimust. Kerimine: nooled, PgUp / PgDn, tühik, Home / End, hiire ratas, klõps kerimisribal; all „read a–b / n“; F – faili; Esc / Enter sulgeb ja taastab eelmise vaate. Rida kuni 74 märki, püsilaiusega kiri. EGA: hall aken nagu dialoogid, joon `─` ja tulbad `▄` fondist (täisplokk `█` liidaks read kokku). Kaasaegne: aken keskel, joon ja tulbad ristkülikutena (aktsendivärv), sest `─` ja `▄` pole igas püsilaiusega fondis sama laiad.
- **Faili** **[O]**: tekstifail (UTF-8), sama sisu mis ekraanil; pealkiri, koostamise aeg, teemade pealkirjad joonitud (`═`). Nimi küsitakse (vaikimisi `mudel-static.txt`, `-dynamic`, `-report`). CSV-d ei tehta (kasutaja otsus).
- **Aegrida aruandes** **[U]**: samm on väikseim 1, 5, 10, 15, 30 min, 1, 2, 4 h hulgast, mis annab kuni 100 rida (8 h → 5 min); viimane punkt (lõpp) on alati kaasas. Graafik näitab valmis detaile kokku (läbilaskevõime kõver – ummik on tasane), sest detailide arv süsteemis on `Kl` tõttu peaaegu konstantne.
- **Simulaator** ei muutunud; `PARKING_RESERVE` eksporditakse (Static näitab ummikuvaru).

---

## 19. Avaldamine (etapp 10) **[U]**

Versioon 1.0 avaldatakse GitHub Pages'is staatiliste failidena, build-sammu pole. Teostus: `site/index.html`, `tools/site.sh`, `.github/workflows/pages.yml`, `models/index.json`; testid `test/publish.test.js`; valideerimine [VALIDEERIMINE.md](VALIDEERIMINE.md) etapp 10.

- **Saidi ülesehitus**: `/` – avaleht ja lühijuhend (`site/index.html`); `/v1/` – versioon 1.0. Hiljem `/v2/` (tag `v2.0`) ja vajadusel `/dev/` (`main`). Avaleht viitab alati olemasolevatele versioonidele.
- **`/v1/` on külmutatud**: `index.html`, `src/`, `fonts/` võetakse viimasest 1.x tag'ist – algul `v1.0`, etapist 11a `v1.1` (`git archive`). Parandused versioonis 1 saavad uue tag'i (1.1, 1.2 …) ja töövoog võtab selle; aadress `/v1/` ei muutu. `models/` tuleb `main` harust, et etapis 11 lisatud näidismudelid oleksid ka 1.0-s näha ilma koodi muutmata. Tingimus: mudelifaili vorming jääb ühilduvaks (`MODEL_VERSION` 1).
- **Näidiste nimekiri** **[U]**: `models/index.json` (`[{ File, Name }]`, esimene avatakse käivitamisel). `LoadDemoList` loeb selle Main-is; vigased kirjed jäetakse välja (`ParseDemoList`), faili puudumisel jääb koodi varunimekiri. Test kontrollib, et iga `models/*.fms.json` on nimekirjas ja jookseb 8 h ilma ummikuta.
- **Kokkupanek**: `tools/site.sh VÄLJUND [REF]` kopeerib failid; sama skripti kasutab töövoog (`tools/site.sh _site v1.0`) ja kohalik kontroll (ilma REF-ita – tööpuust). Töövoog käivitub `main`-i pushil ja käsitsi; Pages'i allikas on GitHub Actions.
- **Suhtelised teed**: `index.html` → `src/fms.js`; moodulid laadivad fondi ja mudelid `new URL('../…', import.meta.url)` kaudu. Seega töötab rakendus igas alamkaustas (test L6 keelab absoluutsed teed).
- **Brauseri mälu**: kõigil sama kasutaja Pages'i saitidel on üks origin, seega `fmss.recent` ja `fmss.options` on `/v1/`-l ja hilisemal 2.0-l ühised. 1.0 neid ei muuda; 2.0 kasutab oma võtmeid (või loeb 1.0 mudelid `fmss.recent`-ist ainult sisse).
- **Advise** jääb menüüsse halliks: „… tuleb versioonis 2.0“ (`NotYet` võtab etapi asemel versiooni). Vananenud „tuleb etapis …“ tekstid (`EnumLater`, `FormTrackLater`, konnektori vihjed) on eemaldatud.
- **Versioon**: töölaual „versioon 1.0“, `package.json` 1.0.0; git-tag `v1.0`. **1.1** (etapp 11a): animaatoris kerimine ja suum, redaktoris suum (osa 14, 15); töölaual „versioon 1.1“, `package.json` 1.1.0, tag `v1.1`, töövoog `tools/site.sh _site v1.1`. Mudelifaili vorming ei muutunud.
- **Avalikkus**: repo on avalik (Pages'i tingimus), õigused kaitstud (litsentsi ei anta). Skaneeringud (`docs/skaneeringud/`) ja `CLAUDE.md` jäävad ainult kohalikku koopiasse – `.gitignore` ja enne esimest pushi eemaldatakse need ka git'i ajaloost.

