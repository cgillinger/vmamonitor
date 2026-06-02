# VMA Notifieringar - Sveriges krisberedskap

VMA Notifieringar är ett tillägg för Microsoft Edge som övervakar Viktigt Meddelande till Allmänheten (VMA) och visar aktuella varningar direkt i din webbläsare.

> Det här är ett personligt hobbyprojekt som jag byggt för eget bruk och lagt upp ifall det är till nytta för någon annan. Jag jobbar på det på fritiden, så issues och PR:ar är välkomna men svar kan dröja. Använd på egen risk.

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
- **Notifieringar**: Vid nya VMA
- **Regionfiltrering**: Välj specifikt län att övervaka
- **Detaljerad information**: Visar fullständig information om aktiva VMA
- **Kvittering**: Möjlighet att kvittera (tysta) varningar när du sett dem
- **Testläge**: Möjlighet att testa funktionaliteten utan faktiska VMA
- **VMA-historik**: Sparar automatiskt de tre senaste avslutade VMA-meddelandena
- **Automatisk datarensning**: Rensar gamla kvitterade varningar efter 3 dagar
- **Språkstöd**: Stöd för både svenska och engelska VMA-meddelanden
- **Tillgänglighet**: Fullständigt stöd för skärmläsare och tangentbordsnavigering
- **ARIA-kompatibilitet**: Alla element har beskrivande etiketter för hjälpmedel
- **Keyboard shortcuts**: Navigation med tab, piltangenter och escape
- **Focus indicators**: Tydliga visuella markeringar för tangentbordsanvändare
- **Screen reader announcements**: Automatiska meddelanden för statusändringar

## Versionsinformation

### Version 1.2 (May 2025)
- **Tillgänglighetsförbättringar**: Komplett omarbetning för bättre stöd av skärmläsare och tangentbordsnavigering
- **ARIA-etiketter**: Alla interaktiva element har nu beskrivande etiketter för hjälpmedel
- **Live regions**: Dynamiska statusuppdateringar meddelas automatiskt till skärmläsare
- **Tangentbordsnavigering**: Fullständig support för navigation med enbart tangentbord
- **Focus indicators**: Tydliga visuella markeringar när element får fokus
- **Skärmläsarmeddelanden**: Automatiska meddelanden för VMA-status, kvitteringar och språkändringar
- **Semantic HTML**: Förbättrad struktur med `<main>`, `<nav>`, `<section>` och ARIA-roller
- **Accessibility preferences**: Stöd för "high contrast" och "reduced motion"
- **Förbättrad notifieringshantering**: En enda notifiering per VMA istället för dubletter
- **Footer kvittera-knapp**: Röd kvittera-knapp bredvid test-knappen för snabbare åtkomst
- **Förbättrad design**: Moderniserad inställningssida med gradient-bakgrunder och animationer

### Version 1.1 (April 2025)
- Stöd för VMA på engelska via Sveriges Radios nya översättningar (från november 2024)
- Möjlighet att välja föredraget språk mellan svenska och engelska
- Förbättrad användargränssnitt med språkväljare
- Versionshantering med migrations-stöd

### Version 1.0 (Ursprunglig version)
- Grundläggande funktionalitet för övervakning av VMA
- Stöd för svenska VMA-meddelanden
- Regionfiltrering och testläge

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
- **Byt språk**: Klicka på språkikonen (🌐) för att växla mellan svenska och engelska

### Inställningar:
1. Öppna inställningar genom att klicka på kugghjulsikonen
2. Välj vilket län du vill övervaka (standardvärde är "Hela Sverige")
3. Välj föredraget språk (svenska eller engelska)
4. Klicka på "Spara inställningar"

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

### Språkstöd:
1. VMA-meddelanden visas på ditt föredragna språk när översättningar finns tillgängliga
2. Från november 2024 tillhandahåller Sveriges Radio engelska översättningar för VMA
3. Du kan byta språk direkt i popup-fönstret genom att klicka på språkikonen (🌐)
4. Om ingen översättning finns tillgänglig på ditt föredragna språk visas det på det tillgängliga språket

## Tekniska detaljer

### Datakällor
- Tillägget använder Sveriges Radios officiella VMA API för att hämta information:
  - Produktions-API: `https://vmaapi.sr.se/api/v2/alerts`
  - Test-API: `https://vmaapi.sr.se/testapi/v2/alerts`

### Språkstöd
- Från november 2024 tillhandahåller Sveriges Radio engelska översättningar för VMA
- Tillägget stöder både svenska (`sv-SE`) och engelska (`en-US`) info-objekt från API:et
- Användare kan ställa in sitt föredragna språk och tillägget kommer att söka efter den bästa matchningen

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
- Endast regionval och språkpreferens sparas i webbläsarens synkroniserade lagring
- VMA-historik och kvitteringsinformation sparas endast lokalt i din webbläsare
- Inga tredjepartsverktyg för analys eller spårning
- All kommunikation sker via säker HTTPS

För mer information, se vår [integritetspolicy](PRIVACY_POLICY.md).

## Bidrag och Support

Detta projekt är öppen källkod under MIT-licensen. Bidrag välkomnas via pull requests.

Vid frågor eller problem, vänligen öppna ett ärende i GitHub-repositoriet.

### Utvecklingsprinciper
- **Robusthet**: Prioriterar att VMA visas korrekt och tillförlitligt
- **Integritet**: Minimerar datainsamling och lagring
- **Användarvänlighet**: Enkel och tydlig användargränssnitt
- **Säkerhet**: Noggrant utvecklad för att vara säker och pålitlig

## Licens

Detta projekt är licensierat under MIT-licensen - se [LICENSE](LICENSE) för detaljer.

## Changelog

### [1.2.0] - 2025-05-18

#### Tillagda funktioner
- **Tillgänglighet**: Komplett ARIA-stöd för skärmläsare med etiketter, live regions och roller
- **Tangentbordsnavigering**: Fullständig navigering med tab, piltangenter och escape-knapp
- **Skärmläsarmeddelanden**: Automatiska meddelanden för VMA-status, kvitteringar, språkändringar och flikval
- **Focus indicators**: Blå rammarkeringar för alla fokuserbara element
- **Accessibility preferences**: Stöd för "prefers-contrast: high" och "prefers-reduced-motion"
- **Footer kvittera-knapp**: Röd kvittera-knapp i popup-footern bredvid test-knappen

#### Förbättrade funktioner
- **Notifieringar**: En enda sammanslagen notifiering per VMA istället för dubletter
- **HTML-struktur**: Semantic elements (`<main>`, `<nav>`, `<section>`) med korrekt ARIA-roller
- **Språkstöd**: Dynamiska språkattribut (`lang`) för korrekt skärmläsaruttal
- **Design**: Moderniserad inställningssida med gradienter, animationer och hover-effekter

#### Fixade buggar
- Kvittera-knappen visas inte längre för test-VMA
- Kvittering stoppar nu all notifikationsaktivitet helt (badge-blinking och popup-meddelanden)
- Förbättrad synkronisering mellan huvud- och footer-kvittera-knappar

#### Tekniska förändringar
- Uppdaterade alla filer till version 1.2
- Utökade svenska och engelska lokalisationsfiler med tillgänglighetstexter
- CSS-förbättringar för `@media` queries (contrast/motion preferences)
- JavaScript-förbättringar för keyboard event handling och screen reader announcements

### [1.1.0] - 2025-04-XX
- Stöd för svenska och engelska VMA-meddelanden
- Språkväljare i popup-gränssnitt
- Automatisk språkdetektering vid första installation
- Migration-stöd för befintliga installationer

### [1.0.0] - 2025-XX-XX
- Initial release med grundläggande VMA-övervakning
- Regionfiltrering för svenska län
- Testläge för demonstration
- VMA-historik och kvittering