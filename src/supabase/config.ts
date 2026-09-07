/**
 * Zugangsdaten des Supabase-Projekts.
 *
 * Beide Werte sind bewusst öffentlich: Der Publishable Key ist dafür gemacht, im
 * Browser zu stehen. Geschützt werden die Daten nicht durch den Schlüssel,
 * sondern durch Row Level Security — jede Zeile trägt eine user_id, und die
 * Datenbank gibt nur Zeilen heraus, deren user_id zur angemeldeten Person passt.
 *
 * Sie stehen hier im Code statt in einer .env-Datei, damit `npm run deploy` von
 * jedem Rechner aus funktioniert, ohne dass vorher Umgebungsvariablen gesetzt
 * werden müssen.
 *
 * Das Projekt `einkaufszettel` beherbergt außerdem Korbi und Mediavault. Alle
 * Tabellen dieser App tragen deshalb das Präfix `sf_`.
 */
export const SUPABASE_URL = 'https://ctqcrerkzztmnuqsgxsz.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_wWrXW49VWq0VvspPCubVjw_DeKlUA56'

/** Adresse, zu der Google nach der Anmeldung zurückschickt. */
export function anmeldeRuecksprung(): string {
  const { origin, pathname } = window.location
  return origin + pathname
}
