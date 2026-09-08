import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase/client'
import { anmeldeRuecksprung } from '../supabase/config'
import type { AppDaten, SetDaten } from '../core/types'
import { abgleichen } from './sync'
import { einstellungenAbbild, offeneAenderungen, uebernimmErgebnis } from './merge'

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
const ANMELDE_VERSUCH = 'steigflug.anmeldeVersuch'

/** sessionStorage kann in privaten Fenstern werfen — nie die App daran hängen. */
const merker = {
  setzen(schluessel: string) {
    try {
      sessionStorage.setItem(schluessel, '1')
    } catch {
      /* egal */
    }
  },
  vorhanden(schluessel: string): boolean {
    try {
      return sessionStorage.getItem(schluessel) !== null
    } catch {
      return false
    }
  },
  loeschen(schluessel: string) {
    try {
      sessionStorage.removeItem(schluessel)
    } catch {
      /* egal */
    }
  },
}

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
  const [fehlversuche, setFehlversuche] = useState(0)
  // Zählt Abgleiche, die zwar durchliefen, aber nichts abgearbeitet haben.
  const [stillstand, setStillstand] = useState(0)

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
      if (data.session) {
        merker.loeschen(ANMELDE_VERSUCH)
      } else if (merker.vorhanden(ANMELDE_VERSUCH)) {
        // Der Anmeldeversuch ist nie hier angekommen. Das passiert, wenn die
        // Rücksprungadresse in Supabase fehlt: Dann landet man auf der
        // Standardadresse des Projekts — bei einer anderen App.
        merker.loeschen(ANMELDE_VERSUCH)
        setFehler(
          'Die Anmeldung kam nicht zu Steigflug zurück. In Supabase fehlt die ' +
            'Rücksprungadresse https://theminhnguyen.github.io/steigflug/ — ' +
            'ohne sie leitet Google auf die Standardadresse des Projekts weiter. ' +
            'Siehe ANMELDUNG-EINRICHTEN.md.',
        )
        setZustand('fehler')
      }
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
      const vorher = datenRef.current
      const abbildVorher = einstellungenAbbild(vorher)
      const ergebnis = await abgleichen(vorher, nutzer.id)

      // Das Ergebnis übernehmen — aber nicht über Eingaben bügeln, die während
      // des Netzaufrufs entstanden sind. Dafür wird gegen den Stand zu Beginn
      // verglichen: Nur was sich seither geändert hat, behält seine Fassung.
      setDaten((aktuell) => {
        // Gilt auch für die Einstellungen: Wer währenddessen das Zieljahr
        // umstellt, soll es hinterher nicht zurückgesetzt vorfinden.
        const inzwischenGeaendert = einstellungenAbbild(aktuell) !== abbildVorher
        const einstellungen = inzwischenGeaendert
          ? {
              zieljahr: aktuell.zieljahr,
              zielStatus: aktuell.zielStatus,
              regelwerkOverrides: aktuell.regelwerkOverrides,
              // Bleibt als offen stehen und geht beim nächsten Abgleich mit.
              einstellungenGesendet: vorher.einstellungenGesendet,
            }
          : {
              zieljahr: ergebnis.daten.zieljahr,
              zielStatus: ergebnis.daten.zielStatus,
              regelwerkOverrides: ergebnis.daten.regelwerkOverrides,
              einstellungenGesendet: ergebnis.daten.einstellungenGesendet,
            }
        const neu = {
          ...aktuell,
          ...einstellungen,
          fluege: uebernimmErgebnis(aktuell.fluege, vorher.fluege, ergebnis.daten.fluege),
          boden: uebernimmErgebnis(aktuell.boden, vorher.boden, ergebnis.daten.boden),
        }
        // Sicherung gegen Endlosläufe: Wenn ein erfolgreicher Abgleich die Zahl
        // der offenen Änderungen nicht senkt, stimmt etwas nicht — dann lieber
        // seltener versuchen als im Sekundentakt gegen dieselbe Wand.
        const offenVorher = offeneAenderungen(aktuell)
        const offenNachher = offeneAenderungen(neu)
        setStillstand((n) => (offenNachher > 0 && offenNachher >= offenVorher ? n + 1 : 0))
        return neu
      })
      const jetzt = new Date().toISOString()
      setLetzterAbgleich(jetzt)
      try {
        localStorage.setItem(LETZTER_ABGLEICH, jetzt)
      } catch {
        /* privater Modus — nicht schlimm */
      }
      setFehlversuche(0)
      setZustand('ruht')
    } catch (e) {
      setFehler(verstaendlich(e instanceof Error ? e.message : String(e)))
      setFehlversuche((n) => n + 1)
      setZustand('fehler')
    } finally {
      laeuftRef.current = false
    }
  }, [setDaten])

  // Nach dem Anmelden einmal abgleichen.
  useEffect(() => {
    if (sitzung) void jetztAbgleichen()
  }, [sitzung, jetztAbgleichen])

  const offen = useMemo(() => offeneAenderungen(daten), [daten])

  // Offene Änderungen nach kurzer Ruhe hochladen, statt bei jedem Tastendruck.
  // Nach Fehlschlägen wächst die Wartezeit, sonst liefe die App bei einem
  // dauerhaften Fehler alle 2,5 Sekunden gegen dieselbe Wand.
  useEffect(() => {
    if (!sitzung || !online || offen === 0) return
    const wartezeit = 2500 * 2 ** Math.min(fehlversuche + stillstand, 6)
    const zeit = window.setTimeout(() => void jetztAbgleichen(), wartezeit)
    return () => window.clearTimeout(zeit)
  }, [sitzung, online, offen, fehlversuche, stillstand, jetztAbgleichen])

  // Zurück im Netz: nachholen.
  useEffect(() => {
    if (sitzung && online && offen > 0) void jetztAbgleichen()
    // Absichtlich nur beim Wechsel von offline auf online.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  const anmelden = useCallback(async () => {
    setFehler(null)
    setFehlversuche(0)
    setStillstand(0)
    merker.setzen(ANMELDE_VERSUCH)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: anmeldeRuecksprung() },
    })
    if (error) {
      merker.loeschen(ANMELDE_VERSUCH)
      setFehler(verstaendlich(error.message))
      setZustand('fehler')
    }
  }, [])

  const abmelden = useCallback(async () => {
    await supabase.auth.signOut()
    setSitzung(null)
    setZustand('ruht')
    setFehler(null)
    setFehlversuche(0)
    setStillstand(0)
    merker.loeschen(ANMELDE_VERSUCH)
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
