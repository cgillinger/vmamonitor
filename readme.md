# VMA Notifieringar - Sveriges krisberedskap

VMA Notifieringar är ett tillägg för Microsoft Edge som övervakar Viktigt Meddelande till Allmänheten (VMA) och visar aktuella varningar direkt i din webbläsare.

![VMA Notifieringar-ikon](icons/lamp-green-48.png)

## Vad är VMA?

VMA (Viktigt Meddelande till Allmänheten) är ett varningssystem som används i Sverige för att varna allmänheten vid olyckor, kriser och andra akuta händelser som kan hota liv, hälsa, egendom eller miljö. Dessa meddelanden sänds via Sveriges Radio och TV, och nu kan du också få dem direkt i din webbläsare med detta tillägg.

## Funktioner

- **Realtidsövervakning**: Kontrollerar kontinuerligt VMA-API:et var 5:e minut
- **Visuell indikation**: Ikonen ändrar färg baserat på allvarlighetsgrad:
  - 🟢 Grön: Inga aktiva VMA
  - 🟡 Gul: Mindre allvarligt VMA
  - 🟠 Orange: Allvarligt VMA
  - 🔴 Röd: Mycket allvarligt VMA
  - 🔵 Blå: Testläge aktivt
- **Notifieringar**: Popup-notifieringar vid nya VMA
- **Regionfiltrering**: Välj specifikt län att övervaka
- **Detaljerad information**: Visar fullständig information om aktiva VMA
- **Kvittering**: Möjlighet att kvittera (tysta) varningar när du sett dem
- **Testläge**: Möjlighet att testa funktionaliteten utan faktiska VMA
- **VMA-historik**: Sparar automatiskt de tre senaste avslutade VMA-meddelandena
- **Automatisk datarensning**: Rensar gamla kvitterade varningar efter 3 dagar

## Installation

### Från Microsoft Edge Add-ons Store
1. Besök [VMA Notifieringar på Microsoft Edge Add-ons Store](#) (länk kommer efter publicering)
2. Klicka på "Hämta"
3. Följ anvisningarna för att installera tillägget

### Manuell installation (utvecklingsläge)
1. Ladda ner och packa upp zip-filen med källkoden
2. Öppna Edge och gå till `edge://extensions/`
3. Aktivera "Utvecklarläge" i övre högra hörnet
4. Klicka på "Läs in uppackad"
5. Välj mappen där du packade upp källkoden

## Användning

Efter installation dyker en VMA-ikon upp i Edge:s verktygsfält. Som standard är ikonen grön, vilket indikerar att det inte finns några aktiva VMA.

### Grundläggande funktioner:
- **Kontrollera status**: Klicka på ikonen för att se aktuell status och eventuella aktiva VMA
- **Manuell uppdatering**: Klicka på uppdateringsikonen (⟳) i popup-fönstret
- **Öppna inställningar**: Klicka på kugghjulsikonen (⚙) i popup-fönstret
- **Se historik**: Växla till "Historik"-fliken för att se tidigare VMA-meddelanden

### Inställningar:
1. Öppna inställningar genom att klicka på kugghjulsikonen
2. Välj vilket län du vill övervaka (standardvärde är "Hela Sverige")
3. Klicka på "Spara inställningar"

### Testläge:
1. Klicka på "Testa VMA" i popup-fönstrets nedre del
2. Ett simulerat VMA visas för att demonstrera funktionaliteten
3. Klicka på "Avaktivera test" för att återgå till normalläge

### Vid ett VMA:
1. Ikonen ändrar färg baserat på VMA:ets allvarlighetsgrad
2. En notifiering visas
3. Klicka på ikonen för att se detaljerad information
4. För allvarliga VMA kan du klicka på "Kvittera VMA" för att tysta notifieringen men behålla varningsikonen

### Historikfunktion:
1. Klicka på "Historik"-fliken i popup-fönstret
2. Se de senaste tre avslutade VMA-meddelandena
3. För varje VMA visas när det utfärdades och när det upphörde
4. Endast riktiga VMA lagras i historiken (inte testmeddelanden)

## Tekniska detaljer

### Datakällor
- Tillägget använder Sveriges Radios officiella VMA API för att hämta information:
  - Produktions-API: `https://vmaapi.sr.se/api/v2/alerts`
  - Test-API: `https://vmaapi.sr.se/testapi/v2/alerts`

### Datarensning
- Kvitterade VMA-meddelanden rensas automatiskt efter 3 dagar
- Test-VMA visas aldrig i historiken
- Användaren kan rensa historiken manuellt genom att avinstallera och återinstallera tillägget

### Edge-optimeringar
- Anpassade notifikationer för Microsoft Edge
- Kompatibilitetsfixar specifika för Edge-webbläsaren
- Robust felhantering för popup-öppning

### Minneshantering
- Effektiv datastruktur för att minimera minnesanvändning
- Automatisk rensning av gamla data

## Integritet

VMA Notifieringar värnar om din integritet:
- Ingen personlig information samlas in
- Endast regionval sparas i webbläsarens synkroniserade lagring
- VMA-historik och kvitteringsinformation sparas endast lokalt i din webbläsare
- Inga tredjepartsverktyg för analys eller spårning
- All kommunikation sker via säker HTTPS

För mer information, se vår [integritetspolicy](PRIVACY_POLICY.md).

## Bidrag och Support

Detta projekt är öppen källkod under MIT-licensen. Bidrag välkommas via pull requests.

Vid frågor eller problem, vänligen öppna ett ärende i GitHub-repositoriet.

### Utvecklingsprinciper
- **Robusthet**: Prioriterar att VMA visas korrekt och tillförlitligt
- **Integritet**: Minimerar datainsamling och lagring
- **Användarvänlighet**: Enkel och tydlig användargränssnitt
- **Säkerhet**: Noggrant utvecklad för att vara säker och pålitlig

## Licens

Detta projekt är licensierat under MIT-licensen - se [LICENSE](LICENSE) för detaljer.
