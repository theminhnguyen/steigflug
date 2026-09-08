import { useEffect, useState } from 'react'
import {
  BESCHRIFTUNG,
  anwenden,
  aufloesen,
  leseWahl,
  naechsteWahl,
  speichereWahl,
  systemIstDunkel,
  type ThemaWahl,
} from '../core/thema'

function Zeichen({ wahl }: { wahl: ThemaWahl }) {
  if (wahl === 'hell') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    )
  }
  if (wahl === 'dunkel') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
      </svg>
    )
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * Schaltet zwischen Gerätevorgabe, hell und dunkel weiter.
 *
 * Die Vorauswahl bleibt „system“ — das ist für die allermeisten richtig. Der
 * Knopf ist für die Fälle da, in denen man es anders will als das Gerät.
 */
export default function Thema() {
  const [wahl, setWahl] = useState<ThemaWahl>(() => leseWahl())

  useEffect(() => {
    const nachziehen = () => anwenden(aufloesen(wahl, systemIstDunkel()))
    nachziehen()
    if (wahl !== 'system') return

    // Zwei Wege, weil einer allein nicht reicht: Das Ereignis kommt, solange die
    // Seite im Vordergrund ist. Schaltet das Gerät aber um, während die App im
    // Hintergrund liegt — etwa beim automatischen Wechsel abends —, ist das
    // Ereignis beim Zurückkehren längst verpasst. Deshalb dann erneut prüfen.
    const abfrage =
      typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null
    abfrage?.addEventListener('change', nachziehen)
    // Beim Sichtbarwerden prüfen. Auf den Fokus hört es ohne diese Bedingung:
    // Fokus heißt bereits, dass die App vorn ist, und eine zusätzliche
    // Sichtbarkeitsprüfung schlucke hier nur Fälle weg.
    const beiSichtbarkeit = () => {
      if (document.visibilityState === 'visible') nachziehen()
    }
    document.addEventListener('visibilitychange', beiSichtbarkeit)
    window.addEventListener('focus', nachziehen)

    return () => {
      abfrage?.removeEventListener('change', nachziehen)
      document.removeEventListener('visibilitychange', beiSichtbarkeit)
      window.removeEventListener('focus', nachziehen)
    }
  }, [wahl])

  return (
    <button
      type="button"
      className="kopf-ampel thema"
      title={BESCHRIFTUNG[wahl]}
      aria-label={`Helligkeit umschalten. Aktuell: ${BESCHRIFTUNG[wahl]}`}
      onClick={() => {
        const naechste = naechsteWahl(wahl)
        speichereWahl(naechste)
        setWahl(naechste)
      }}
    >
      <Zeichen wahl={wahl} />
    </button>
  )
}
