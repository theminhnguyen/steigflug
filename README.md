# Steigflug

Miles-&-More-Statuspunkte eintragen, automatisch berechnen und ausrechnen lassen,
wann der Frequent-Traveller-Status voraussichtlich steht.

Läuft komplett im Browser. Keine Anmeldung, kein Server, keine Kosten. Alle Daten
bleiben auf dem Gerät.

## Warum es das gibt

Miles & More hat 2024 von Statusmeilen auf **Punkte** umgestellt. Seitdem hängt die
Gutschrift **nicht mehr am Ticketpreis oder an der Entfernung**, sondern nur an
Reiseklasse und Kurz-/Langstrecke. Dazu kommen zwei Hürden statt einer:

| Status | Points | davon Qualifying Points |
| --- | --- | --- |
| Frequent Traveller | 650 | 325 |
| Senator | 2.000 | 1.000 |

**Qualifying Points** gibt es nur bei den vollintegrierten Airlines (Lufthansa,
SWISS, Austrian, Brussels, Discover, Eurowings, Air Dolomiti, ITA, Croatia, LOT,
Luxair). Genau daran scheitern Rechnungen, die nur die Gesamtpunkte im Blick haben:
Marriott-Aufenthalte etwa zahlen voll auf die 650 ein, aber mit null auf die 325.

## Was die App kann

- **Cockpit** — zwei Fortschrittsbalken (Ist massiv, Geplant schraffiert), das
  voraussichtliche Erreichungsdatum, die Restlücke und wie viele Flugsegmente sie
  schließen
- **Flüge** — ein Segment pro Eintrag, Kurz-/Langstrecke wird aus den Flughäfen
  erkannt, Rückflug per Knopfdruck, abweichende Gutschriften korrigierbar
- **Boden** — Marriott, Kreditkarte, Uptrip, eVoucher, CO₂-Pakete mit automatischer
  Deckelung auf die Jahreslimits
- **Regeln** — die komplette Punktetabelle einsehbar und überschreibbar
- **Daten** — Sicherung als JSON-Datei, Wiedereinlesen, alles löschen

Geplante Einträge zählen in der Prognose, aber nicht im Ist-Stand. Damit lässt sich
durchspielen, ob eine Reise oder ein Meilentausch den Status noch rechtzeitig bringt.

## Punkte pro Flugsegment

| Reiseklasse | Kurzstrecke | Langstrecke |
| --- | --- | --- |
| Economy | 20 | 60 |
| Premium Economy | 20 | 80 |
| Business | 40 | 200 |
| First | 40 | 400 |

Ein Hin- und Rückflug sind zwei Segmente. Eine Umsteigeverbindung ebenfalls zwei.

## Punkte ohne Flug

| Quelle | Points | Qualifying Points | Limit pro Jahr |
| --- | --- | --- | --- |
| Marriott Bonvoy | 40 je Aufenthalt | – | 120 |
| Kreditkarte, Willkommensbonus | 40 einmalig | – | 40 |
| Kreditkarte, Meilentausch | 20 je 5.000 Meilen | 20 | 100 |
| Uptrip App | 20 je Kollektion | 20 | 100 |
| eVoucher | 50 je Voucher | 50 | kein bekanntes |
| CO₂-Ausgleich | bis +80 % des Fluges | ja | an Flüge gekoppelt |

## Regelwerk pflegen

Miles & More ändert die Bedingungen regelmäßig. Deshalb liegen **alle** Zahlen in
[`src/rules/regelwerk.json`](src/rules/regelwerk.json) — nicht im Code. Bei einer
Programmänderung wird nur diese Datei angefasst; die Quellen und das Stand-Datum
stehen mit drin.

Zusätzlich lässt sich jeder Wert im Reiter „Regeln“ direkt in der App überschreiben.
Diese Anpassungen liegen in den Nutzerdaten und überleben ein Update.

## Entwicklung

```bash
npm install
npm run dev      # Entwicklungsserver
npm test         # 91 Tests über Rechenkern, Flughafendaten, Formate und Speicherung
npm run build    # Produktionsbau nach dist/
npm run deploy   # Bau und Veröffentlichung auf GitHub Pages
```

Der Rechenkern in [`src/core/calc.ts`](src/core/calc.ts) besteht aus reinen
Funktionen ohne UI-Bezug und ist vollständig testbar — inklusive der
Jahresdeckelungen und der Prognose.

## Verlässlichkeit der Zahlen

Die Werte stammen aus öffentlichen Auswertungen des Programms (Quellen sind in der
App unter „Regeln“ verlinkt). Zwei Angaben sind in den Quellen uneinheitlich und
deshalb bewusst konservativ angesetzt und überschreibbar:

- das Jahreslimit der Uptrip-App (100 oder 150 Punkte)
- ob ein Marriott-Aufenthalt ab einer oder ab zwei Nächten zählt

Maßgeblich ist immer das eigene Miles-&-More-Konto. Weicht eine Gutschrift ab, lässt
sie sich pro Flug als „abweichende Gutschrift“ eintragen.
