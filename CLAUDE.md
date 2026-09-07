# Steigflug — Hinweise für Claude

Miles-&-More-Statuspunkte-Tracker. React + TypeScript + Vite, PWA, rein lokal.

## Architektur-Regeln

**Das Regelwerk gehört nicht in den Code.** Sämtliche Punktwerte, Schwellen,
Airline-Listen und Jahreslimits stehen in `src/rules/regelwerk.json`. Miles & More
ändert die Bedingungen regelmäßig — eine Änderung darf nie mehr als diese Datei
kosten. Wer einen Wert im Code hartkodiert, macht das kaputt.

**Der Rechenkern ist frei von UI.** `src/core/calc.ts` enthält nur reine Funktionen.
Jede neue Rechenregel gehört dorthin und braucht einen Test in `calc.test.ts`.

**Punkte werden nie gespeichert, immer gerechnet.** Gespeichert werden nur die
Rohdaten (Flüge, Boden-Einträge). So bleiben alte Einträge korrekt, wenn sich das
Regelwerk ändert. Ausnahme: die Felder `korrekturPoints` / `korrekturQp`, mit denen
der Nutzer eine abweichende tatsächliche Gutschrift festhalten kann.

## Zwei Hürden, nicht eine

Für einen Status zählen **Points** und **Qualifying Points** getrennt. Qualifying
Points gibt es nur bei den vollintegrierten Airlines. Jede Anzeige und jede
Lückenrechnung muss beide Werte führen — eine Lücke gilt erst als geschlossen, wenn
beide Schwellen stehen. Das ist die häufigste Fehlerquelle im Fachbereich.

## Deckelung

Boden-Quellen haben Jahreslimits (`maxPointsProJahr`). Die Deckelung greift
- in `berechneBilanz` über das ganze Jahr,
- in `berechneVerlauf` fortlaufend nach Datum.

Beide Wege müssen dasselbe Endergebnis liefern; dafür gibt es Tests.

## Fallstricke, die schon zugeschlagen haben

- **Flughafenliste:** Die kompakte Liste in `src/data/airports.ts` wird an Semikolon
  und Zeilenumbruch getrennt, **nicht** am Leerzeichen — Namen wie „New York JFK“
  enthalten selbst welche. Test vorhanden.
- **Service Worker beim Testen:** Nach einem neuen Build liefert der Service Worker
  im Browser weiter die alte Fassung. Vor dem Prüfen `navigator.serviceWorker`
  abmelden und `caches` leeren, sonst testet man den Vorgängerstand.
- **Datum und Zeitzone:** Datumswerte werden mit `T12:00:00` geparst. Ohne Uhrzeit
  rutscht ein Datum je nach Zeitzone einen Tag zurück.

## Sprache

Bezeichner, Kommentare und Oberfläche auf Deutsch. Fachbegriffe des Programms
(Points, Qualifying Points, Frequent Traveller) bleiben im Original.
