import { useEffect, useMemo, useState } from 'react'
import type { AppDaten } from './core/types'
import { lade, speichere } from './store/store'
import { BASIS_REGELWERK, findeZiel, mitOverrides } from './rules'
import Cockpit from './components/Cockpit'
import Fluege from './components/Fluege'
import Boden from './components/Boden'
import Regeln from './components/Regeln'
import Daten from './components/Daten'
import Logo from './components/Logo'

const REITER = [
  { id: 'cockpit', name: 'Cockpit' },
  { id: 'fluege', name: 'Flüge' },
  { id: 'boden', name: 'Boden' },
  { id: 'regeln', name: 'Regeln' },
  { id: 'daten', name: 'Daten' },
] as const

type ReiterId = (typeof REITER)[number]['id']

/** Standard-Zieljahr: das kommende Kalenderjahr, denn darauf wird geplant. */
const STANDARD_JAHR = new Date().getFullYear() + 1

export default function App() {
  const [daten, setDaten] = useState<AppDaten>(() => lade(STANDARD_JAHR))
  const [reiter, setReiter] = useState<ReiterId>('cockpit')
  const [speicherFehler, setSpeicherFehler] = useState(false)

  useEffect(() => {
    setSpeicherFehler(!speichere(daten))
  }, [daten])

  const regelwerk = useMemo(
    () => mitOverrides(BASIS_REGELWERK, daten.regelwerkOverrides),
    [daten.regelwerkOverrides],
  )
  const ziel = useMemo(
    () => findeZiel(regelwerk, daten.zielStatus),
    [regelwerk, daten.zielStatus],
  )

  const jahre = useMemo(() => {
    const jetzt = new Date().getFullYear()
    const liste = [jetzt - 1, jetzt, jetzt + 1, jetzt + 2, jetzt + 3]
    return liste.includes(daten.zieljahr) ? liste : [...liste, daten.zieljahr].sort()
  }, [daten.zieljahr])

  return (
    <div className="huelle">
      <header className="kopf">
        <div className="marke">
          <Logo />
          Steigflug
        </div>

        <label className="visually-hidden" htmlFor="zieljahr" hidden>
          Zieljahr
        </label>
        <select
          id="zieljahr"
          value={daten.zieljahr}
          onChange={(e) => {
            const jahr = Number(e.target.value)
            setDaten((d) => ({ ...d, zieljahr: jahr }))
          }}
          title="Kalenderjahr, auf das qualifiziert wird"
        >
          {jahre.map((j) => (
            <option key={j} value={j}>
              {j}
            </option>
          ))}
        </select>

        <select
          value={daten.zielStatus}
          onChange={(e) => {
            const status = e.target.value
            setDaten((d) => ({ ...d, zielStatus: status }))
          }}
          title="Angestrebter Status"
        >
          {regelwerk.ziele.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
      </header>

      <nav className="reiter">
        {REITER.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-current={reiter === r.id}
            onClick={() => setReiter(r.id)}
          >
            {r.name}
          </button>
        ))}
      </nav>

      {speicherFehler && (
        <div className="merker">
          <span aria-hidden="true">⚠️</span>
          <div>
            <b>Daten konnten nicht gespeichert werden</b>
            Dein Browser blockiert den lokalen Speicher (privater Modus?). Die App
            funktioniert, aber deine Einträge sind nach dem Schließen weg. Sichere sie
            unter „Daten“ als Datei.
          </div>
        </div>
      )}

      <main>
        {reiter === 'cockpit' && (
          <Cockpit
            regelwerk={regelwerk}
            daten={daten}
            ziel={ziel}
            aufFluege={() => setReiter('fluege')}
            aufBoden={() => setReiter('boden')}
          />
        )}
        {reiter === 'fluege' && (
          <Fluege regelwerk={regelwerk} daten={daten} setDaten={setDaten} />
        )}
        {reiter === 'boden' && (
          <Boden regelwerk={regelwerk} daten={daten} setDaten={setDaten} />
        )}
        {reiter === 'regeln' && (
          <Regeln regelwerk={regelwerk} daten={daten} setDaten={setDaten} />
        )}
        {reiter === 'daten' && <Daten daten={daten} setDaten={setDaten} />}
      </main>

      <p className="fuss">
        Alle Daten bleiben auf diesem Gerät. Regelwerk-Stand: {regelwerk.stand}.
      </p>
    </div>
  )
}
