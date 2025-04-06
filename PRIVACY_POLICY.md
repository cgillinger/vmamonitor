# Integritetspolicy för VMA Notifieringar - Sveriges krisberedskap

## Inledning
Denna integritetspolicy beskriver hur VMA Notifieringar - Sveriges krisberedskap ("tillägget", "vi", "vår" eller "oss") samlar in, använder och delar information när du använder vårt webbläsartillägg för Microsoft Edge.

## Information vi samlar in
VMA Notifieringar samlar in följande begränsade information:

- **Regioninställningar**: Vi sparar din valda region i webbläsarens synkroniserade lagring (chrome.storage.sync) för att komma ihåg ditt val mellan sessioner och enheter.
- **Språkpreferens**: Vi sparar ditt föredragna språk (svenska eller engelska) i webbläsarens synkroniserade lagring för att visa VMA-meddelanden på önskat språk.
- **Kvitterade varningar**: När du kvitterar ett VMA sparas dess ID lokalt i webbläsarens lagring (chrome.storage.local) för att undvika upprepade notifieringar.
- **VMA-historik**: Information om de tre senaste utgångna VMA-meddelandena sparas lokalt i din webbläsare för att visa i historikfliken.
- **Tillfällig data**: När du hämtar VMA-information visas data från Sveriges Radios VMA API tillfälligt i tillägget.

## Hur vi använder informationen
- Din valda region används **endast** för att visa relevanta VMA-meddelanden för ditt geografiska område.
- Din språkpreferens används **endast** för att bestämma vilket språk VMA-meddelanden ska visas på (när sådana översättningar finns tillgängliga).
- Information om kvitterade varningar används endast för att undvika upprepade notifieringar för samma VMA.
- VMA-historik används endast för att visa dig tidigare VMA-meddelanden i tilläggets historikflik.
- Ingen information används för reklam eller delning med tredje part.

## API-anrop
Tillägget gör följande API-anrop till Sveriges Radios VMA API:
- Hämta aktuella VMA-meddelanden för vald region
- Vid testläge används en separat test-API-endpoint

## Datadelning
- Vi delar **ingen** användarinformation med tredje part.
- Vi skickar **inga** personuppgifter till Sveriges Radios VMA API.
- Vi använder **ingen** spårning eller analys.

## Dataskydd
- All kommunikation med Sveriges Radios VMA API sker via HTTPS.
- Regionpreferenser och språkval lagras i webbläsarens synkroniserade lagring.
- Kvitteringsinformation och VMA-historik lagras endast lokalt i din webbläsare.
- All lokal data är tidsstämplad och rensas automatiskt efter 3 dagar (för kvitterade VMA).

## Automatisk datarensning
- Kvitterade VMA-meddelanden rensas automatiskt efter 3 dagar.
- Historik begränsas till de tre senaste utgångna VMA-meddelandena.
- Test-VMA sparas aldrig i historiken.

## Dina rättigheter
Du kan när som helst:
- Ändra din valda region i tilläggets inställningar
- Ändra ditt föredragna språk i tilläggets inställningar
- Rensa historik och kvitterade varningar genom att avinstallera tillägget
- Avinstallera tillägget, vilket raderar all sparad data

## Kontakt
Om du har frågor om denna integritetspolicy, kontakta oss via franke1281@proton.me.

## Uppdateringar av integritetspolicyn
Vi kan uppdatera denna integritetspolicy då och då. Vi meddelar om betydande ändringar genom att uppdatera tilläggets version.

Senast uppdaterad: 6 april 2025 (Version 1.1)