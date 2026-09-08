/**
 * Helligkeit der Oberfläche: Systemeinstellung, hell oder dunkel.
 *
 * Die Wahl wird zu einer festen Erscheinung aufgelöst und als `data-theme` an
 * das Wurzelelement geschrieben. Dadurch braucht das Stylesheet keine
 * Medienabfrage und die dunklen Farben stehen nur an einer Stelle — sonst
 * müsste man sie doppelt pflegen und sie liefen mit der Zeit auseinander.
 */

export type ThemaWahl = 'system' | 'hell' | 'dunkel'
export type Erscheinung = 'hell' | 'dunkel'

const SCHLUESSEL = 'steigflug.thema'

/** Reihenfolge beim Weiterschalten. */
const REIHENFOLGE: ThemaWahl[] = ['system', 'hell', 'dunkel']

export function naechsteWahl(aktuell: ThemaWahl): ThemaWahl {
  const i = REIHENFOLGE.indexOf(aktuell)
  return REIHENFOLGE[(i + 1) % REIHENFOLGE.length]!
}

export function istWahl(wert: unknown): wert is ThemaWahl {
  return wert === 'system' || wert === 'hell' || wert === 'dunkel'
}

export function leseWahl(): ThemaWahl {
  try {
    const roh = localStorage.getItem(SCHLUESSEL)
    return istWahl(roh) ? roh : 'system'
  } catch {
    return 'system'
  }
}

export function speichereWahl(wahl: ThemaWahl): void {
  try {
    localStorage.setItem(SCHLUESSEL, wahl)
  } catch {
    /* privater Modus — die Wahl gilt dann nur für diese Sitzung */
  }
}

/** Löst die Wahl zu dem auf, was tatsächlich angezeigt wird. */
export function aufloesen(wahl: ThemaWahl, systemIstDunkel: boolean): Erscheinung {
  if (wahl === 'hell') return 'hell'
  if (wahl === 'dunkel') return 'dunkel'
  return systemIstDunkel ? 'dunkel' : 'hell'
}

export function systemIstDunkel(): boolean {
  return typeof matchMedia === 'function'
    ? matchMedia('(prefers-color-scheme: dark)').matches
    : false
}

export function anwenden(erscheinung: Erscheinung): void {
  document.documentElement.dataset.theme = erscheinung
  // Auch die Browserleiste mitziehen — am iPhone rahmt sie die App sichtbar ein.
  const marke = document.querySelector('meta[name="theme-color"]')
  if (marke) marke.setAttribute('content', erscheinung === 'dunkel' ? '#070f18' : '#f2f5f9')
}

export const BESCHRIFTUNG: Record<ThemaWahl, string> = {
  system: 'Helligkeit folgt dem Gerät',
  hell: 'Immer hell',
  dunkel: 'Immer dunkel',
}
