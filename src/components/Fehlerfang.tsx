import { Component, type ErrorInfo, type ReactNode } from 'react'
import { alsJson, dateiname, lade } from '../store/store'

interface Props {
  children: ReactNode
}

interface Zustand {
  fehler: Error | null
}

/**
 * Fängt Abstürze einzelner Ansichten ab.
 *
 * Ohne das reißt ein einziger Fehler in irgendeiner Komponente die ganze Seite
 * mit ins Weiße — genau so ein Fall steckte in der Verlaufskurve. Wichtiger als
 * die Meldung ist der Ausweg: Die Daten liegen im Browser, und von hier aus
 * lassen sie sich sichern, bevor irgendetwas anderes versucht wird.
 */
export default class Fehlerfang extends Component<Props, Zustand> {
  state: Zustand = { fehler: null }

  static getDerivedStateFromError(fehler: Error): Zustand {
    return { fehler }
  }

  componentDidCatch(fehler: Error, info: ErrorInfo) {
    console.error('Steigflug: Ansicht abgestürzt', fehler, info.componentStack)
  }

  private sichern = () => {
    try {
      const daten = lade(new Date().getFullYear() + 1)
      const blob = new Blob([alsJson(daten)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = dateiname(daten)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      /* Mehr als versuchen geht hier nicht */
    }
  }

  render() {
    if (!this.state.fehler) return this.props.children

    return (
      <section className="karte">
        <h2>Diese Ansicht ist abgestürzt</h2>
        <p className="unter">
          Ein Fehler in dieser Ansicht hat sie angehalten. <strong>Deine Einträge sind
          davon nicht betroffen</strong> — sie liegen unverändert im Browser. Sichere sie
          zur Sicherheit trotzdem, bevor du weitermachst.
        </p>

        <div className="knopf-reihe">
          <button type="button" className="knopf haupt" onClick={this.sichern}>
            Daten sichern
          </button>
          <button
            type="button"
            className="knopf"
            onClick={() => this.setState({ fehler: null })}
          >
            Nochmal versuchen
          </button>
          <button type="button" className="knopf leise" onClick={() => window.location.reload()}>
            App neu laden
          </button>
        </div>

        <p className="quellen" style={{ marginTop: 'var(--s4)' }}>
          Die anderen Reiter oben funktionieren weiter. Hilft nichts davon, lässt sich
          unter „Daten“ alles löschen und die gesicherte Datei wieder einlesen.
        </p>

        <details className="werte-klappe">
          <summary>Technische Einzelheiten</summary>
          <pre
            style={{
              marginTop: 'var(--s2)',
              padding: 'var(--s3)',
              background: 'var(--flaeche-2)',
              borderRadius: 'var(--r1)',
              fontSize: 12,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {this.state.fehler.message}
          </pre>
        </details>
      </section>
    )
  }
}
