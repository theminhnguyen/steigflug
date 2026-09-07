import { useRef, useState } from 'react'
import type { AppDaten } from '../core/types'
import { alsJson, dateiname, leereDaten, normalisiere } from '../store/store'
import { zahl } from '../core/format'

interface Props {
  daten: AppDaten
  setDaten: (d: AppDaten) => void
}

export default function Daten({ daten, setDaten }: Props) {
  const dateiFeld = useRef<HTMLInputElement>(null)
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'fehler'; text: string } | null>(null)
  const [loeschBestaetigung, setLoeschBestaetigung] = useState(false)

  function exportieren() {
    const blob = new Blob([alsJson(daten)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = dateiname(daten)
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Erst nach dem Klick freigeben, sonst bricht der Download in Safari ab.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMeldung({ art: 'gut', text: `Gesichert als ${dateiname(daten)}.` })
  }

  async function importieren(datei: File) {
    try {
      const text = await datei.text()
      const eingelesen = normalisiere(JSON.parse(text), daten.zieljahr)
      setDaten(eingelesen)
      setMeldung({
        art: 'gut',
        text: `${zahl(eingelesen.fluege.length)} Flüge und ${zahl(eingelesen.boden.length)} Boden-Einträge übernommen.`,
      })
    } catch {
      setMeldung({
        art: 'fehler',
        text: 'Die Datei konnte nicht gelesen werden. Ist es eine Steigflug-Sicherung?',
      })
    } finally {
      if (dateiFeld.current) dateiFeld.current.value = ''
    }
  }

  return (
    <>
      <section className="karte">
        <h2>Sicherung</h2>
        <p className="unter">
          Deine Daten liegen ausschließlich in diesem Browser — sie verlassen das Gerät
          nie. Damit sind sie auch weg, wenn du Browserdaten löschst oder das Gerät
          wechselst. Sichere sie deshalb ab und zu als Datei.
        </p>

        <div className="knopf-reihe">
          <button type="button" className="knopf haupt" onClick={exportieren}>
            Als Datei sichern
          </button>
          <button
            type="button"
            className="knopf"
            onClick={() => dateiFeld.current?.click()}
          >
            Sicherung einlesen
          </button>
          <input
            ref={dateiFeld}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const datei = e.target.files?.[0]
              if (datei) void importieren(datei)
            }}
          />
        </div>

        {meldung && (
          <div className="merker" style={{ marginTop: 16, marginBottom: 0 }}>
            <span aria-hidden="true">{meldung.art === 'gut' ? '✅' : '⚠️'}</span>
            <div>{meldung.text}</div>
          </div>
        )}
      </section>

      <section className="karte">
        <h2>Bestand</h2>
        <div className="tabelle-huelle">
          <table>
            <tbody>
              <tr>
                <td>Flugsegmente insgesamt</td>
                <td>{zahl(daten.fluege.length)}</td>
              </tr>
              <tr>
                <td>davon geplant</td>
                <td>{zahl(daten.fluege.filter((f) => f.geplant).length)}</td>
              </tr>
              <tr>
                <td>Boden-Einträge insgesamt</td>
                <td>{zahl(daten.boden.length)}</td>
              </tr>
              <tr>
                <td>davon geplant</td>
                <td>{zahl(daten.boden.filter((b) => b.geplant).length)}</td>
              </tr>
              <tr>
                <td>Eigene Regel-Anpassungen</td>
                <td>{Object.keys(daten.regelwerkOverrides).length > 0 ? 'ja' : 'nein'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="karte">
        <h2>Alles löschen</h2>
        <p className="unter">
          Entfernt sämtliche Flüge, Boden-Einträge und Anpassungen von diesem Gerät. Das
          lässt sich nicht rückgängig machen — sichere vorher.
        </p>
        <div className="knopf-reihe">
          {loeschBestaetigung ? (
            <>
              <button
                type="button"
                className="knopf haupt"
                style={{ background: 'var(--warn)', borderColor: 'var(--warn)' }}
                onClick={() => {
                  setDaten(leereDaten(daten.zieljahr))
                  setLoeschBestaetigung(false)
                  setMeldung({ art: 'gut', text: 'Alle Daten wurden gelöscht.' })
                }}
              >
                Ja, wirklich alles löschen
              </button>
              <button
                type="button"
                className="knopf leise"
                onClick={() => setLoeschBestaetigung(false)}
              >
                Abbrechen
              </button>
            </>
          ) : (
            <button
              type="button"
              className="knopf"
              onClick={() => setLoeschBestaetigung(true)}
            >
              Daten löschen
            </button>
          )}
        </div>
      </section>
    </>
  )
}
