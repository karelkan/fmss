# Simulatsiooniloogika disain

Etapp 1 ([PLAAN.md](PLAAN.md)). Alus: [originaal.md](originaal.md). Osad 1–7 (pidevad konveierid) on **valideeritud prototüübiga** (`proto/`); tulemused ja tehtud muudatused: [VALIDEERIMINE.md](VALIDEERIMINE.md). Osa 11 (AGV-d) on veel valideerimata.

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
- Pingi kohta: aeg igas olekus → rakendatus.
- Puhvri kohta: keskmine ja maksimaalne täituvus.
- Konveieri kohta: liikumise ja seismise osakaal.
- Süsteem: läbilaskevõime (detaili tunnis), detailide arv süsteemis aja jooksul.

---

## 8. Andmemudel (`*.fms.json`) **[U]**

```json
{
  "Meta":    { "Name": "Näidis", "Version": 1 },
  "Scale":   100,
  "Layout":  { "Dim": { "X": 13, "Y": 4 },
               "Cells": [ { "X": 0, "Y": 0, "T": "FromCS", "N": 1 } ] },
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
- `Storage: null` tähendab, et kesklattu pole (stsenaarium C0).
- Mudeli struktuuri kontrollib `CheckModel` (`src/fms_glb.js`) laadimisel; rajavõrgu kontroll (`DetectOpenCons`, `FindConflicts`) tuleb koos `Enumerate`-ga.
- Tööpingi ja puhvri seos tuletatakse naabrusest ruudustikus (puhver vahetult pingi all/kohal).

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

1. **Avatud konveier** (mitte silmus): mis juhtub detailiga, mis jõuab raja lõppu? Ettepanek: konveier seiskub, kuni see maha laaditakse; Planner ei saada detaili teele, kui sihtkoht pole raja suunas eespool.
2. **Konnektor** (radade ühendus): kas see on lihtsalt kahe raja jaam, kus detail tõstetakse ühelt rajalt teisele (puhver mahutavusega 0, `Load` + `Load`)? Ettepanek: jah.
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
| `Stats` | kogutud statistika | [T] |

**Protseduurid**

| Nimi | Roll | |
|---|---|---|
| `Enumerate` | ruudustikust rajavõrk, jaamad, seosed | [O nimi, U sisu] |
| `DetectOpenCons`, `FindConflicts` | andmekontroll | [O] |
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
| `CheckModel` | mudelifaili struktuuri kontroll (väljad, tüübid, viited) | [U] |
| `EmptyModel`, `ModelSummary` | uus tühi mudel; lühikokkuvõte töölauale | [U] |
| abiprotseduurid | `SetWPState`, `SetMachState`, `CurrentOp`, `CanReserveSlot`, `StorageFree`, `StationDistance`, `StationLoadTime`, `BeginSetup`, `BeginPickup`, `BeginUnloadFromPallet`, `AfterPalletAtStation`, `WorkpieceLeaves`, `SampleDuration`, `Random` – vt päisekommentaarid `proto/fms_sim.js`-is | [T]/[U] |
| `Animator`, `SimStatus`, `Transport` | kuvamine | [O] |

**Mudeli konstandid** (`src/fms_glb.js`)

| Nimi | Roll | |
|---|---|---|
| `IconTypes` | ikooni tüüp → objekti liik ja massiiv, millele `N` viitab (joon. 5.4) | [O] |
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
| abiprotseduurid | `MenuItems`, `SelectedItem`, `DropdownItems`, `DrawMenuBar`, `DrawDropdown`, `DrawStatusLine`, `MoveInDropdown`, `HandleMenuKey`, `OpenDialog`, `CloseDialog`, `DrawDialog`, `HandleDialogKey`, `HandleDialogPointer`, `MenuLoad`, `MenuPick`, `MenuNew`, `MenuSave`, `MenuWriteAs`, `AskQuit`, `ShowHelp` – vt kommentaarid `src/windows.js`-is ja `src/fms.js`-is | [U] |

---

## 13. Kasutajaliides (etapp 3) **[O + U]**

- **Moodulid** originaali järgi: `fms.js` (FMS.PAS), `windows.js` (WINDOWS.PAS), `fms_glb.js`, `fms_file.js`, `fms_opt.js`, `fms_lng.js`; uus `fms_theme.js` (välimused). Kood on kaustas `src/`, käivitab `index.html`.
- **Üks lõuend** (Canvas), kogu liides joonistatakse ise nagu originaalis. `windows.js` teab ainult paigutust ja loogikat ning kasutab värvide asemel **rolle** (`MenuBar`, `WindowText` …); teema annab rollidele värvid ja joonistab primitiivid (ristkülik, tekst, paneel, nupp).
- **Loogiline ekraan**: rida on 14 pikslit. EGA: 640 × 350 (80 × 25 märki), 16 värvi, font PxPlus IBM EGA 8x14, tähed teravaks (lävend), suurendus täisarvuline ja venitus 4:3 nagu EGA monitoril. Kaasaegne: sama paigutus, kuid ekraan on nii suur kui aken (kuni 1,5 CSS-pikslit loogilise piksli kohta), süsteemifont, ümarad nurgad, hele / tume / süsteemi järgi.
- **Menüü** nagu joon. 6.1–6.2: peamenüü üleval, alammenüüd vertikaalselt, nende alammenüüd nihkega paremal. Menüü nimed inglise keeles (originaal), vihjed ja teated eesti keeles. Hiljem valmivad punktid on hallid, aga valitavad – valik ütleb, mis etapis need tulevad. Directory, Change dir, Rename, Delete on välja lülitatud (brauseris pole ketast).
- **Klahvid**: F10 menüü, Alt + täht, nooled, Enter, Esc, F1 abi, F2 välimus, Alt-X lõpetamine. Olekureal on klahvid või valitud menüüpunkti vihje; klahvid on ka hiirega klõpsatavad.
- **Failid**: Load (näidismudel serverist või fail arvutist), Save / Write as (allalaadimine), Pick (10 viimast brauseri mälus). Laadimisel kontrollib `CheckModel` faili ja näitab vead eesti keeles.
- **Avaekraan**: DOS-i käsurida `C:\FMSS>FMS`, siis pealkiri ja read ükshaaval; esimene klahv lõpetab animatsiooni, teine viib töölauale. Quit viib tagasi avaekraanile.
