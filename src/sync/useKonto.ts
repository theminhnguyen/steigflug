import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase/client'
import { anmeldeRuecksprung } from '../supabase/config'
import type { AppDaten, SetDaten } from '../core/types'
import { abgleichen } from './sync'
import { fuehreZusammen, offeneAenderungen } from './merge'

export type AbgleichZustand = 'ruht' | 'laeuft' | 'fehler'

export interface Konto {
  sitzung: Session | null
  email: string | null
  laedtSitzung: boolean
  zustand: AbgleichZustand
  fehler: string | null
  letzterAbgleich: string | null
  offen: number
  online: boolean
  anmelden: () => Promise<void>
  abmelden: () => Promise<void>
  jetztAbgleichen: () => Promise<void>
}

const LETZTER_ABGLEICH = 'steigflug.letzterAbgleich'

/** Verständliche Meldung statt der englischen Rohmeldung von Supabase. */
function verstaendlich(meldung: string): string {
  const m = meldung.toLowerCase()
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) {
    return 'Die Google-Anmeldung ist im Supabase-Projekt noch nicht freigeschaltet. Siehe ANMELDUNG-EINRICHTEN.md.'
  }
  if (m.includes('redirect') || m.includes('requested path is invalid')) {
    return 'Die Rücksprungadresse ist in Supabase noch nicht hinterlegt. Siehe ANMELDUNG-EINRICHTEN.md.'
  }
  if (m.includes('failed to fetch') || m.includes('networkerror')) {
    return 'Keine Verbindung. Deine Eingaben bleiben auf dem Gerät und werden später abgeglichen.'
  }
  return meldung
}

export function useKonto(daten: AppDaten, setDaten: SetDaten): Konto {
  const [sitzung, setSitzung] = useState<Session | null>(null)
  const [laedtSitzung, setLaedtSitzung] = useState(true)
  const [zustand, setZustand] = useState<AbgleichZustand>('ruht')
  const [fehler, setFehler] = useState<string | null>(null)
  const [letzterAbgleich, setLetzterAbgleich] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LETZTER_ABGLEICH)
    } catch {
      return null
    }
  })
  const [online, setOnline] = useState(() => navigator.onLine)

  // Die Daten stehen in einer Ref, damit der Abgleich nicht bei jeder Eingabe
  // neu erzeugt wird — sonst liefe die Zeitschaltung endlos von vorn los.
  const datenRef = useRef(daten)
  datenRef.current = daten
  const laeuftRef = useRef(false)

  // Schlägt die Anmeldung fehl, schickt Supabase den Grund in der Adresszeile
  // zurück. Ohne dieses Auslesen käme man wortlos auf der Startseite heraus.
  useEffect(() => {
    const ausUrl = (roh: string) => new URLSearchParams(roh.replace(/^[?#]/, ''))
    for (const teil of [window.location.search, window.location.hash]) {
      const p = ausUrl(teil)
      const grund = p.get('error_description') ?? p.get('error')
      if (!grund) continue
      setFehler(verstaendlich(decodeURIComponent(grund.replace(/\+/g, ' '))))
      setZustand('fehler')
      // Adresszeile aufräumen, damit der Fehler beim Neuladen nicht klebt.
      window.history.replaceState({}, '', window.location.pathname)
      break
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSitzung(data.session)
      setLaedtSitzung(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_ereignis, neue) => {
      setSitzung(neue)
      setLaedtSitzung(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const rein = () => setOnline(true)
    const raus = () => setOnline(false)
    window.addEventListener('online', rein)
    window.addEventListener('offline', raus)
    return () => {
      window.removeEventListener('online', rein)
      window.removeEventListener('offline', raus)
    }
  }, [])

  const jetztAbgleichen = useCallback(async () => {
    const nutzer = (await supabase.auth.getSession()).data.session?.user
    if (!nutzer) return
    // Synchroner Riegel: Zwei Auslöser dürfen nicht gleichzeitig abgleichen.
    if (laeuftRef.current) return
    laeuftRef.current = true
    setZustand('laeuft')
    setFehler(null)
    try {
      const ergebnis = await abgleichen(datenRef.current, nutzer.id)
      // Während des Netzaufrufs kann weitergetippt worden sein. Deshalb wird das
      // Ergebnis mit dem inzwischen aktuellen Stand zusammengeführt statt ihn zu
      // ersetzen — frische Eingaben gewinnen und gehen beim nächsten Mal mit.
      setDaten((aktuell) => ({
        ...aktuell,
        ...ergebnis.daten,
        fluege: fuehreZusammen(aktuell.fluege, ergebnis.daten.fluege).lokal,
        boden: fuehreZusammen(aktuell.boden, ergebnis.daten.boden).lokal,
      }))
      const jetzt = new Date().toISOString()
      setLetzterAbgleich(jetzt)
      try {
        localStorage.setItem(LETZTER_ABGLEICH, jetzt)
      } catch {
        /* privater Modus — nicht schlimm */
      }
      setZustand('ruht')
    } catch (e) {
      setFehler(verstaendlich(e instanceof Error ? e.message : String(e)))
      setZustand('fehler')
    } finally {
      laeuftRef.current = false
    }
  }, [setDaten])

  // Nach dem Anmelden einmal abgleichen.
  useEffect(() => {
    if (sitzung) void jetztAbgleichen()
  }, [sitzung, jetztAbgleichen])

  const offen = offeneAenderungen(daten)

  // Offene Änderungen nach kurzer Ruhe hochladen, statt bei jedem Tastendruck.
  useEffect(() => {
    if (!sitzung || !online || offen === 0) return
    const zeit = window.setTimeout(() => void jetztAbgleichen(), 2500)
    return () => window.clearTimeout(zeit)
  }, [sitzung, online, offen, jetztAbgleichen])

  // Zurück im Netz: nachholen.
  useEffect(() => {
    if (sitzung && online && offen > 0) void jetztAbgleichen()
    // Absichtlich nur beim Wechsel von offline auf online.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  const anmelden = useCallback(async () => {
    setFehler(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: anmeldeRuecksprung() },
    })
    if (error) {
      setFehler(verstaendlich(error.message))
      setZustand('fehler')
    }
  }, [])

  const abmelden = useCallback(async () => {
    await supabase.auth.signOut()
    setSitzung(null)
    setZustand('ruht')
    setFehler(null)
  }, [])

  return {
    sitzung,
    email: sitzung?.user.email ?? null,
    laedtSitzung,
    zustand,
    fehler,
    letzterAbgleich,
    offen,
    online,
    anmelden,
    abmelden,
    jetztAbgleichen,
  }
}
