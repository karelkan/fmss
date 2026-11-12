# Simulatsiooniloogika disain

Etapp 1 ([PLAAN.md](PLAAN.md)). Alus: [originaal.md](originaal.md). **Mustand** – etapis 2 valideeritakse prototüübiga ja parandatakse.

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
SimInit
repeat
  MinuteMan                    { liigutab konveiereid ajavahemikus [t-1, t]; võib lisada StopMov }
  repeat
    ProcEvent                  { võtab esimese sündmuse Time <= t, kutsub EventHandleri }
  until NO_EVENTS
  CheckInvariants              { ainult testides }
  Animator; SimStat            { ainult brauseris }
  Inc(SYSTEM_TIME)
until SIMULATION_DONE
```

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
  - mudelil on mõõtkava (`scale`, cm ikooni kohta). Sirge ikoon = 1 ühik, kaar = π/4 ühikut;
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
| `speed` | cm/s |
| `carts` | kohtade (alustade, `Pallette`) arv konveieril |
| `placesPerCart` | mitu detaili alusele mahub (esimeses järgus 1) |
| `loadTime` | detaili peale- või mahalaadimise aeg, s |
| `accessTime` | esmakordse pöördumise aeg, s (esimeses järgus ei kasuta) |
| `direction` | liikumissuund |

- Alused on konveieril võrdsete vahedega `L / carts` ja liiguvad koos: konveieril on üks nihe `s`, alus `i` asub kohal `(s + i·L/carts) mod L`. **[T]**
- Olek: `stopCount` – mitu laadimist parasjagu käib. Kui `stopCount > 0`, seisab **kogu konveier** (lk 45). **[O]**
- Alus peatub jaamas ainult siis, kui seal on **tegevus**:
  - **mahalaadimine**: alusel on detail, mille sihtkoht on see jaam;
  - **pealelaadimine**: alus on tühi ja jaamas ootab detail, millele on sihtkoht juba broneeritud (vt 5.2).

  Muidu sõidab alus mööda. **[T]**
- Kui samas jaamas on mõlemad, tehakse enne maha- ja siis pealelaadimine, konveier seisab vahepeal edasi. **[T]**

### 3.2 Puhver **[O + T]**

- Parameetrid: `capacity`, `discipline` (FIFO / FILO / RANDOM), `loadTime`, `kind` (`InBuf`, `OutBuf`, `InOutBuf`, `TurnBuf`).
- Puhver seob tööpingi raja jaamaga: rada ↔ puhver ↔ tööpink. **[O]** (lk 32)
- Puhvri kohtadel on suund:
  - **sisse** (rajalt pingi poole) – detail ootab tööpinki;
  - **välja** (pingilt raja poole) – detail ootab transporti.

  `InBuf` ainult sisse, `OutBuf` ainult välja, `InOutBuf` ja `TurnBuf` mõlemat (ühine mahutavus). **[T]**
- Igal kohal on **broneering**: koht loetakse hõivatuks juba siis, kui sinna on detail teele saadetud. **[U]**

### 3.3 Tööpink **[O + T]**

- Parameetrid: `name`, `model`, `loadTime`, `setupTime`, `ops` (sooritatavad operatsioonid). Esimeses järgus mahub pinki 1 detail.
- Olekud:

```
         Load (puhvrist)            Turn              Process
IDLE ───────────────► LOADING ──► SETUP ──► PROCESSING ──┬─► SETUP (järgmine op samas pingis)
  ▲                                                       └─► UNLOADING ──► IDLE
  └──────────────────────────────────────────── Load (puhvrisse) ┘
                       DOWN – rike (etapp 8)
```

- `SETUP` kestus: `setupTime`, kui operatsioon erineb pingi eelmisest operatsioonist, muidu 0. **[T]**
- Pink võtab detaili puhvrist **ainult siis, kui selle detaili jaoks on puhvris väljumise koht broneeritud**. Nii ei jää pink kunagi töödeldud detailiga kinni. **[U]**

### 3.4 Keskladu ja süsteemi väljund **[T]**

- `FromCS` – uute detailide allikas. Esimeses järgus on toorikuid piiramatult; määrav on Planneri sissetoomise reegel.
- `ToCS` – valmis detailide ladu (mahutavus `capacity`).
- `SysOut` – süsteemist väljumine, piiramatu.
- Valmis detail läheb `ToCS`-i, kui see on olemas ja seal on ruumi, muidu `SysOut`-i. Praak läheb alati `SysOut`-i.

### 3.5 Detail (`SysWP`) **[O + T]**

| Väli | Sisu |
|---|---|
| `id` | number |
| `type` | detailitüüp (`Workpieces`, max 16) |
| `route` | valitud marsruut |
| `opIndex` | järgmine operatsioon marsruudis |
| `loc` | kus on: (objekt, koht) – jaam, alus, puhver, pink |
| `dest` | broneeritud sihtkoht või puudub |
| `tIn`, `tOut` | sisenemise ja väljumise aeg |
| `tProc`, `tSetup`, `tTrans`, `tLoad`, `tWait` | kogunenud ajad tsükliaja jaoks |

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
| `MoveZ` | `LoadProc` | `stopCount--`; kui 0, konveier liigub edasi. |
| `StopMov` | `MinuteMan` | Alus seisab jaamas. Määrab, kas maha- või pealelaadimine, ja lisab `Load` ajaks `t + loadTime`. |
| `Load` | `StopMovProc`, Planner, `ProcessProc` | Viib detaili lähtekohast sihtkohta, vabastab broneeringu. Edasi oleneb sihtkohast (vt 4.3). |
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

Laadimise kestus **[T]**: rada ↔ jaam – raja `loadTime`; puhver ↔ tööpink – pingi `loadTime`; rada ↔ keskladu – lao `loadTime`.

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

`Planner(põhjus, objekt)` kutsutakse:
- simulatsiooni alguses;
- kui detail jõudis puhvri sissetulevale kohale;
- kui pink vabanes;
- kui detail jõudis puhvri väljaminevale kohale;
- kui detail lahkus süsteemist.

Planner ise **ei muuda olekuid**, vaid otsustab ja lisab sündmusi (`InSys`, `Load`, `OutSys`). Olekuid muudavad ainult EventHandlerid. **[O]** (lk 51)

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

- **Vältimine**: sissetoomise piir `Kl`, broneerimine ning reegel, et pink ei alusta ilma väljaminevat kohta broneerimata.
- **Avastamine**: kui süsteemis on detaile, aga `T_stall` sekundit (vaikimisi 600) pole ükski detail liikunud ega töödeldud → ummik.
- **Lahendus**: kauem oodanud väljaminev detail saadetakse ajutiselt kesklattu (`ToCS`) ja Planner toob selle hiljem tagasi. Kui keskladu puudub või on täis, simulatsioon peatub ja teatab ummikust (see on ka kasulik tulemus: struktuur ei sobi antud koormusele).

Etapi 2 stressitest peab näitama, kas see piisab.

---

## 6. `MinuteMan` (pidevad konveierid) **[O + T]**

Iga konveieri kohta, kui `stopCount = 0`:

1. uus nihe `s' = s + speed · 1 s`;
2. iga aluse kohta vaadatakse, kas ta ületas selle sekundi jooksul mõne jaama, kus on tema jaoks tegevus (3.1);
3. kui jah, võetakse **lähim** selline ületus: nihe pannakse nii, et alus seisab täpselt jaamas, `stopCount++`, lisatakse `StopMov` käesolevale hetkele;
4. muidu `s := s'`.

Korraga peatub konveier ainult ühe aluse pärast. Teised tegevused tulevad järgmistel sekunditel.

---

## 7. Statistika **[O + T]**

- Detaili kohta: `tIn`, `tOut`, töötlemis-, häälestus-, transpordi-, laadimis- ja ooteaeg. Tsükliaeg `Tts` ja osakaalud: töötlemine, ootamine, transport (ptk 8.5 originaalis).
- Pingi kohta: aeg igas olekus → rakendatus.
- Puhvri kohta: keskmine ja maksimaalne täituvus.
- Konveieri kohta: liikumise ja seismise osakaal.
- Süsteem: läbilaskevõime (detaili tunnis), detailide arv süsteemis aja jooksul.

---

## 8. Andmemudel (`*.fms.json`) **[U]**

```json
{
  "meta":   { "name": "Näidis", "version": 1 },
  "scale":  100,
  "grid":   { "w": 13, "h": 4, "cells": [ { "x": 0, "y": 0, "t": "FromCS" } ] },
  "edgeLengths": [ { "cells": [[3,2],[4,2]], "length": 1500 } ],
  "tracks":    [ { "name": "Konveier", "mode": "continuous", "carts": 8, "placesPerCart": 1,
                   "speed": 20, "loadTime": 10, "accessTime": 0 } ],
  "machines":  [ { "name": "MT1", "model": "", "loadTime": 15, "setupTime": 60,
                   "ops": ["treimine", "puurimine"] } ],
  "buffers":   [ { "capacity": 3, "discipline": "FIFO", "loadTime": 5 } ],
  "storage":   { "capacity": 50, "loadTime": 20 },
  "workpieces":[ { "name": "Võll", "priority": 1, "batch": 10,
                   "routes": [ { "priority": 1,
                                 "ops": [ { "op": "treimine", "mean": 300, "dev": 30 } ] } ] } ],
  "sim":       { "seed": 1, "duration": 28800, "Kl": 0.85, "stall": 600 }
}
```

- Objektide seos ruudustikuga: lahtril on tüüp ja indeks vastavasse massiivi (originaali `T`, `N`). Rada ja jaamad tuletatakse `Enumerate`-ga.
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
- `stopCount ≥ 0` ja seisev konveier ainult siis, kui mõni laadimine käib;
- (diskreetsed rajad) igas tsoonis on max 1 käru ja käru on ainult tsoonis, mille ta on broneerinud.

---

## 10. Varem lahtised küsimused (ettepanekud kinnitatud)

1. **Avatud konveier** (mitte silmus): mis juhtub detailiga, mis jõuab raja lõppu? Ettepanek: konveier seiskub, kuni see maha laaditakse; Planner ei saada detaili teele, kui sihtkoht pole raja suunas eespool.
2. **Konnektor** (radade ühendus): kas see on lihtsalt kahe raja jaam, kus detail tõstetakse ühelt rajalt teisele (puhver mahutavusega 0, `Load` + `Load`)? Ettepanek: jah.
3. **`accessTime`** (keskmine pöördusaeg): tähendus on ebaselge. Ettepanek: lisaviivitus enne esimest laadimist, kui konveier oli seisnud – või jätta kasutamata.
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

- **Tsoon** = lõik või sõlm (ristmik, hargnemine). Pikad lõigud võib tükeldada mitmeks tsooniks (pikkus `zoneLength`, vaikimisi kogu lõik).
- Tsoonis on korraga **üks käru**.
- Käru broneerib järgmise tsooni **enne** sinna sisenemist. Kui tsoon on kinni, peatub käru oma tsooni lõpus olekus `WAIT_ZONE`.
- Tsoon vabaneb, kui käru on sellest täielikult väljunud.
- Ühesuunalisel lõigul võib tsoonis olla ka mitu käru üksteise järel (järjekorras), kui `zoneLength` on väiksem kui lõik. **[T]**

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

1. arvutab uue asukoha `kaugus + speed · 1 s` mööda oma teekonda;
2. kui teel on tsooni piir ja järgmine tsoon pole broneeritud → üritab broneerida; kui ei saa, peatub piiril (`WAIT_ZONE`);
3. kui jõuab sihtjaama → peatub täpselt jaamas, lisab `StopMov` käesolevale hetkele;
4. vabastab tsoonid, millest on täielikult väljunud.

Seejärel ootegraafi kontroll (11.5).

Sündmused jäävad samaks: `MoveZ` (käru alustab sõitu), `StopMov` (jõudis jaama), `Load` (peale/maha, väli `Pal` = käru number), `Collision`.

### 11.7 Andmemudeli lisad

```json
"tracks": [ { "name": "AGV", "mode": "discrete", "carts": 3, "placesPerCart": 1,
              "speed": 50, "loadTime": 15, "accessTime": 0,
              "dispatch": "nearest", "zoneLength": 0 } ],
"edgeDirections": [ { "cells": [[5,1],[6,1]], "dir": "oneway", "from": [5,1] } ],
"parking": [ [2,3] ]
```

- `zoneLength: 0` tähendab: tsoon = terve lõik.
- Lõigud on vaikimisi kahesuunalised; `edgeDirections` muudab ühesuunaliseks.

### 11.8 Riskid, mida prototüüp kontrollib

- Ummikud kahesuunalistel lõikudel ja ristmikel (stsenaariumid E, F).
- Kas tsooniks sobib terve lõik või tuleb pikad lõigud tükeldada (läbilaskevõime vs keerukus).
- Kas kärud jõuavad tühisõitudega töö järel (kärude arv vs läbilaskevõime).
