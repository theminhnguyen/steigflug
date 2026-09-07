# Anmeldung freischalten — ein einziger Handgriff

Die Google-Anmeldung ist im Supabase-Projekt **bereits aktiv** (es wird mit Korbi
und Mediavault geteilt). Du musst deshalb *nichts* in der Google Cloud Console
anlegen. Fehlt nur noch, dass Supabase weiß, wohin es dich nach der Anmeldung
zurückschicken darf.

## Der Handgriff

1. Öffne <https://supabase.com/dashboard/project/ctqcrerkzztmnuqsgxsz/auth/url-configuration>
2. Unter **Redirect URLs** auf **Add URL** klicken und eintragen:

   ```
   https://theminhnguyen.github.io/steigflug/
   ```

3. Speichern. Fertig.

Steht die Adresse dort nicht, führt Google dich nach der Anmeldung auf eine
fremde Seite (die Standardadresse des Projekts) statt zurück nach Steigflug.

### Nur falls du lokal testen willst

Dann zusätzlich `http://localhost:5191/` eintragen. Für die normale Nutzung
nicht nötig.

## Woran du merkst, dass es geklappt hat

In Steigflug unter **Daten** auf „Mit Google anmelden“ tippen. Nach der Auswahl
deines Kontos landest du wieder in Steigflug, oben rechts steht statt „nur lokal“
dann „gesichert“ mit grünem Punkt.

Klemmt etwas, zeigt die App den Grund im Klartext an — sie rät nicht herum.

## Was dabei mit deinen Daten passiert

- Deine Flüge liegen weiterhin **auch** auf dem Gerät. Die App funktioniert ohne
  Netz vollständig weiter; der Abgleich holt nach, sobald du wieder online bist.
- Übertragen wird nur, was du einträgst: Datum, Flughäfen, Airline, Reiseklasse,
  Notizen. Kein Zugriff auf deine Mails, dein Google-Konto oder dein Miles-&-More-
  Konto — die App fragt bei Google nur Name und Mailadresse ab.
- Jede Zeile trägt deine Nutzerkennung, und die Datenbank gibt per Row Level
  Security ausschließlich Zeilen heraus, die dir gehören. Geprüft: Ein Abruf ohne
  Anmeldung liefert eine leere Liste, ein Schreibversuch wird abgewiesen.
- Meldest du dich ab, bleiben die Einträge auf dem Gerät.

## Wenn du es dir anders überlegst

Ohne Anmeldung ist Steigflug genau die App von vorher: alles lokal, nichts
verlässt das Gerät. Der Anmeldeknopf ist ein Angebot, keine Voraussetzung.
