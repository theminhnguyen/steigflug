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

## Gestaltung

Die Tokens in `src/styles.css` sind die einzige Quelle für Farbe, Abstand, Radius
und Tiefe. Keine nackten Pixelwerte oder Hex-Farben in Komponenten — Abstände
kommen aus `--s1`…`--s8`.

**Genau eine Leitzahl je Ansicht** (`.leitzahl`, ≥48px, dieselbe Schrift wie
alles andere — eine Zier- oder Serifenschrift läse sich als Fremdkörper). Große
Zahlen mit proportionalen Ziffern; `tabular-nums` nur in Spalten, die untereinander
fluchten müssen.

**Diagramme** (`src/components/Kurve.tsx`) folgen festen Vorgaben: Linien 2px mit
runden Enden, Endpunkte ≥8px mit 2px-Ring in Flächenfarbe, Gitter haarfein und
durchgezogen, Flächenwäsche bei ~10 % Deckkraft. Beschriftet wird sparsam — nur
die Endwerte, nie jeder Punkt. Text trägt nie die Datenfarbe; die Zuordnung
kommt aus dem farbigen Zeichen daneben.

**Nie zwei Y-Achsen.** Points und Qualifying Points haben verschiedene Schwellen
(650 und 325) — deshalb zeigt die Kurve den Anteil am jeweiligen Ziel. Eine
gemeinsame Skala, eine Ziellinie bei 100 %.

Die Diagrammfarben sind eigene Schritte je Helligkeitsmodus (`--serie-points`,
`--serie-qp`), geprüft auf Helligkeitsband, Buntheit, Farbfehlsichtigkeit und
Kontrast. Die Oberflächenakzente sind heller und dafür nicht geeignet — bei einer
Änderung den Prüfer der dataviz-Fertigkeit erneut laufen lassen, nicht schätzen.

## Aktualisierung der installierten App

`registerType: 'prompt'`, nicht `autoUpdate`. Bei autoUpdate übernimmt der neue
Service Worker zwar sofort, die geöffnete Seite läuft aber mit dem alten Code
weiter — man ist stumm eine Fassung hinterher, bis zufällig neu geladen wird.
Stattdessen meldet `Aktualisierung.tsx` eine neue Fassung sichtbar; geladen wird
nur auf Tastendruck. Von selbst lädt die App nie neu: ein Neustart mitten in
einer Eingabe wäre schlimmer als ein Tag Rückstand.

**Beim Prüfen zwei Fallen, in die ich schon getappt bin:**
1. Ein hinzugefügter *Kommentar* ergibt nach der Minifizierung ein
   byte-identisches Bündel — es gibt dann gar nichts zu aktualisieren, und der
   Test scheint fehlzuschlagen, obwohl die Funktion stimmt. Für einen echten
   Prüflauf eine sichtbare Zeichenkette ändern.
2. Nach `updateServiceWorker(true)` **nicht sofort** selbst neu laden. Den
   Neustart macht der Service Worker, sobald er die Steuerung hat; lädt man
   vorher neu, bedient noch der alte Worker die Anfrage und man bekommt wieder
   die alte Fassung. Der eigene Rückfall wartet deshalb 2,5 Sekunden.

Der erste Besuch einer Seite wird von keinem Service Worker gesteuert. Ein
Aktualisierungstest muss vorher zweimal laden, sonst prüft man einen Randfall.

## Import aus Miles & More

`src/import/milesandmore.ts` liest die eigene Flughistorie aus dem Konto:
`api.travelid.lufthansa.com/flightstats/v3/me/segmentList`, im angemeldeten
Browser aufgerufen und als Datei gesichert. **Nicht dokumentiert**, kann ohne
Ankündigung verschwinden — deshalb liest der Parser durchgehend nachsichtig:
fehlt ein Feld oder passt ein Wert nicht, wird die Zeile übersprungen statt den
Import zu kippen. Textfelder kommen mit Leerzeichen aufgefüllt (`"LH   "`).

`StatusPoints` sind die tatsächlich gutgeschriebenen Punkte und landen als
`korrekturPoints` — echte Gutschrift schlägt jede Berechnung. **Was `GupPoints`
genau bedeutet, ist nicht belegt** (das Projekt, aus dem das Schema stammt, weiß
es auch nicht). Vermutlich Qualifying Points; deshalb zeigt die Vorschau alle
belegten Punktefelder an und lässt die Deutung umschalten, statt sie zu
unterstellen. Nicht stillschweigend als sicher behandeln.

**Zweimal einlesen darf nichts verdoppeln.** Die Datei vergibt bei jedem Abruf
neue Kennungen, deshalb identifiziert `kennzeichen()` ein Segment über Datum,
Strecke und Airline. Der Abgleich ersetzt nie einen vorhandenen Eintrag — er
ergänzt nur leere Korrekturwerte und macht aus einem geplanten einen geflogenen
Flug. Von Hand Eingetragenes bleibt unangetastet.

**Weiter automatisieren geht nicht — gemessen, nicht vermutet.** Der Endpunkt
sendet CORS-Freigaben ausschließlich für `https://www.miles-and-more.com`; von
der Steigflug-Adresse kommt `401` ganz ohne CORS-Kopfzeilen zurück. Ein Abruf
aus der App heraus ist damit unmöglich, und serverseitig ginge es nur mit
hinterlegten Zugangsdaten — genau das, was diese App vermeiden soll. Die
Handgriffe lassen sich nur verkürzen: Einfügefeld statt Datei, dazu ein
Lesezeichen, das auf der Miles-&-More-Seite selbst läuft.

Der Endpunkt liefert **geflogene** Segmente. Gebuchte Reisen in der Zukunft
stehen dort nicht; die bleiben Handarbeit.

## Was echte Kontodaten aufgedeckt haben

Am 2026-09-07 zum ersten Mal gegen die echte Flughistorie geprüft (28 Segmente,
2023–2026). Zwei Fehler, die kein selbstgebauter Testfall gefunden hätte:

- **Lufthansa City Airlines (`VL`) fehlte im Regelwerk.** Eine Lufthansa-Tochter,
  vollintegriert — das Konto schrieb 20 Qualifying Points gut, die App hätte null
  gerechnet. Beim Ergänzen des Regelwerks die offizielle Liste gegenprüfen, nicht
  aus dem Gedächtnis.
- **Die Jahresauswahl bot nur das laufende Jahr samt Umfeld an.** Eine importierte
  Historie reicht Jahre weiter zurück; diese Jahre waren schlicht unerreichbar.
  Die Auswahl leitet sich jetzt aus den vorhandenen Einträgen ab.

**Zu `GupPoints`:** In allen 28 Zeilen identisch mit `StatusPoints`. Das ist mit
der Deutung „Qualifying Points“ vereinbar, beweist sie aber nicht — sämtliche
Airlines in den Daten sind vollintegriert, dort sind beide Werte ohnehin gleich.
Ein Gegenbeweis bräuchte einen Flug mit einer nur teilintegrierten Airline
(Star-Alliance-Partner). Bis dahin bleibt der Schalter in der Vorschau.

## Rechenlast in Komponenten

Formulare halten ihren Entwurf in eigenem Zustand — die Komponente zeichnet
deshalb bei **jedem Tastendruck** neu. Alles Teure gehört dort in ein `useMemo`
mit den Daten als Abhängigkeit, nicht in den Rumpf: Bilanz, Sortierung, Verlauf.

Unveränderliche Listen gehören auf Modulebene, nicht in die Komponente. Die
Flughafen-Vorschlagsliste erzeugte als Teil von `Fluege` über 250 Element-Objekte
je Tastendruck, nur um unverändert zu bleiben.

## Rechnen gehört nicht in die Ansicht

Die Achsenberechnung der Kurve steckte in der Komponente und war deshalb als
einzige Rechnung im Projekt ungetestet — genau dort schlummerte ein Absturz: Eine
im Regelwerk auf null gesetzte Schwelle ergab eine unendliche Obergrenze und
damit `Array.from({length: Infinity})`, also ein `RangeError` und eine weiße
Seite. Jetzt in `src/core/kurveskala.ts` mit Tests, inklusive Deckelung der
Gitterlinien.

Dasselbe gilt für **Entscheidungen über Hinweistexte**. Als Bedingungskette im
JSX stand dort ein Fehler: Eine leere Strecke gilt als „nicht sicher“, und die
App warnte deshalb schon beim Öffnen, der Flughafen sei unbekannt. Nichts
eingetragen ist aber nicht dasselbe wie nicht erkannt. Jetzt entscheidet
`streckenHinweis()` mit Tests für alle fünf Zustände.

**Regel daraus:** Sobald in einer Komponente gerechnet wird — geteilt, skaliert,
gerundet —, gehört das in `src/core/` und braucht einen Test. Division durch eine
Nutzereingabe immer absichern; das Regelwerk lässt Nullen zu.

## Helligkeit

Drei Zustände: Gerätevorgabe, immer hell, immer dunkel — Vorauswahl bleibt die
Gerätevorgabe. Die Wahl wird zu einer festen Erscheinung aufgelöst und als
`data-theme` an das Wurzelelement geschrieben.

**Die dunklen Farben stehen deshalb nur an einer Stelle** (`:root[data-theme='dunkel']`),
nicht zusätzlich in einer Medienabfrage. Beides zu pflegen läuft mit der Zeit
auseinander.

**Entschieden wird vor dem ersten Zeichnen**, in einem winzigen Skript im
Dokumentkopf von `index.html`. Ohne das blitzt beim Öffnen kurz die falsche
Helligkeit auf. Dieses Skript ist die einzige Stelle, an der die Auflösungslogik
doppelt steht — bewusst, weil es ohne Bündel auskommen muss.

**Zwei Wege, dem Gerät zu folgen**, weil einer nicht reicht: das `change`-Ereignis
der Medienabfrage, solange die App vorn ist, plus erneutes Prüfen bei Fokus und
Sichtbarwerden. Schaltet das iPhone abends automatisch um, während die App im
Hintergrund liegt, ist das Ereignis beim Zurückkehren längst verpasst.

**Beim Prüfen:** Die Browservorschau ändert zwar den Wert der Medienabfrage, löst
aber **kein** `change`-Ereignis aus — belegt damit, dass auch ein eigens
registrierter Empfänger nichts erhält. Dieser Pfad lässt sich hier nicht prüfen;
prüfbar ist der Weg über Fokus. Und `document.visibilityState` ist im
Vorschau-Tab `hidden`, siehe [[react-unstable-callback-deps-focus-bug]].

## iOS-Eigenheiten im Layout

Datumsfelder bringen auf iOS Safari eine eigene Mindestbreite mit, die sich
weder mit `width` noch mit `min-width` unterbieten lässt. In einer Rasterspalte
neben anderen Feldern sprengte das die Karte. Gegenmittel: `appearance: none`
auf `input[type=date]`, Spalten als `minmax(min(140px, 100%), 1fr)`, und das
Datum steht in einer eigenen Zeile statt neben den Flughäfen.

Das fällt in der Browservorschau nicht auf — dort wird Chrome nachgebildet,
nicht Safari. Layoutfehler dieser Art zeigen sich erst am Gerät.

## Sprache

Bezeichner, Kommentare und Oberfläche auf Deutsch. Fachbegriffe des Programms
(Points, Qualifying Points, Frequent Traveller) bleiben im Original.
