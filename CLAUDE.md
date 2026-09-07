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

## Zustandsänderungen nur funktional

`setDaten` nimmt ausschließlich eine Funktion des vorherigen Standes entgegen
(Typ `SetDaten`). Ein Objekt zu übergeben wäre kürzer, führt aber dazu, dass zwei
schnelle Klicks beide von derselben veralteten Kopie ausgehen — beim Löschen zweier
Zeilen käme die erste zurück. Der Typ lässt die kurze Form gar nicht erst zu.

Beim Anlegen zusätzlich über die ID absichern (`d.fluege.some(f => f.id === neu.id)`).
`disabled` allein verhindert keinen Doppelklick: Zwei Tipps landen im selben
React-Durchlauf, bevor der Zustand steht.

## Nutzerdaten nie stillschweigend überschreiben

Der Import prüft mit `istSicherung`, ob die Datei überhaupt eine Steigflug-Sicherung
ist — sonst hätte `normalisiere` jede beliebige JSON-Datei klaglos zu Leerdaten
geglättet und den Bestand gelöscht. Sind bereits Einträge vorhanden, kommt vor dem
Ersetzen eine Rückfrage mit beiden Zahlen.

## Gesperrte Knöpfe brauchen einen sichtbaren Grund

Vor jedem `disabled={…}`: Steht im selben Blickfeld, was fehlt? Wenn nein, gehört
der Grund daneben — ein stummer ausgegrauter Knopf wird als kaputtes Feature
gemeldet, nicht als fehlende Eingabe.

## Fallstricke, die schon zugeschlagen haben

- **Flughafenliste:** Die kompakte Liste in `src/data/airports.ts` wird an Semikolon
  und Zeilenumbruch getrennt, **nicht** am Leerzeichen — Namen wie „New York JFK“
  enthalten selbst welche. Test vorhanden.
- **Service Worker beim Testen:** Nach einem neuen Build liefert der Service Worker
  im Browser weiter die alte Fassung. Vor dem Prüfen `navigator.serviceWorker`
  abmelden und `caches` leeren, sonst testet man den Vorgängerstand.
- **Datum und Zeitzone:** Datumswerte werden mit `T12:00:00` geparst. Ohne Uhrzeit
  rutscht ein Datum je nach Zeitzone einen Tag zurück.
- **Jahresränder immer beidseitig prüfen.** Die Hochrechnung zählte am 31. Dezember
  einen Tag zu wenig und rechnete deshalb über den Ist-Stand hinaus. Für jede
  Bereichsgrenze gehören zwei Tests ins Repo — der Fehler am zweiten Rand wird sonst
  zuverlässig übersehen, weil die eigenen Testdaten am ersten liegen.
- **Leere Jahresansicht muss auf andere Jahre hinweisen.** Ein blankes „Noch nichts
  eingetragen“ nach einem Jahreswechsel liest sich wie Datenverlust.

## Abgleich mit Supabase

**Lokal zuerst.** `localStorage` ist die Arbeitskopie, Supabase der Abgleich.
Nie umbauen auf „erst laden, dann anzeigen“ — die App muss ohne Netz vollständig
funktionieren, bei einer Flug-App ganz besonders.

**Löschen ist immer sanft.** `alsGeloescht()` setzt ein Kennzeichen; echtes
Entfernen aus der Liste würde die Löschung auf anderen Geräten nie ankommen
lassen. Alles, was rechnet oder anzeigt, filtert über `ohneGeloeschte()` bzw. den
`geloescht`-Zweig in `zaehlt()` in `calc.ts`.

**Zeitstempel setzt nur der Server** (Trigger `sf_setze_geaendert_am`). Geräteuhren
gehen auseinander; ein vom Browser gesetzter Stempel würde beim Zusammenführen
Einträge verschlucken.

**Die Zusammenführung liegt in `src/sync/merge.ts` und ist frei von Netzwerk.**
Jede Regel dort hat einen Test. Neue Regeln gehören dorthin, nicht in `sync.ts`.

**Das Projekt ist geteilt.** `einkaufszettel` beherbergt auch Korbi und
Mediavault. Alle Tabellen und Funktionen dieser App beginnen mit `sf_`. Vor jedem
neuen Objekt gegen die bestehenden Namen prüfen. Ein eigenes Supabase-Projekt
geht nicht: Der Free-Tier erlaubt zwei aktive, beide sind belegt.

## Reihenfolge in den Listen

`src/core/reihenfolge.ts`: Bevorstehendes zuerst und aufsteigend, Vergangenes
darunter absteigend. Der nächste Termin gehört nach oben — durchgehend absteigend
stellte bei lauter Buchungen in der Zukunft die am weitesten entfernte Reise
ganz nach oben.

Bei gleichem Datum ordnet `ordneSegmente` Flüge nach Reiseverlauf (das Ziel des
einen ist der Start des nächsten). Sich auf die Stabilität von `Array.sort` zu
verlassen reicht nicht: Nach einem Abgleich kommt die Reihenfolge aus der
Zusammenführung und kann eine Umsteigeverbindung verdrehen.

## Sprache

Bezeichner, Kommentare und Oberfläche auf Deutsch. Fachbegriffe des Programms
(Points, Qualifying Points, Frequent Traveller) bleiben im Original.
