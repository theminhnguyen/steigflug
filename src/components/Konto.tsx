import type { Konto } from '../sync/useKonto'
import { menge } from '../core/format'

const ZEIT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function zeitpunkt(iso: string | null): string {
  if (!iso) return 'noch nie'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? 'unbekannt' : ZEIT.format(d)
}

/** Kleines Google-G für den Anmeldeknopf. */
function GoogleZeichen() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45 24c0-1.6-.1-2.7-.4-4H24v7.5h12c-.2 2-1.5 5-4.4 7l6.7 5.2C42.2 36 45 30.6 45 24z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8 41.3 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.5 28.4c-.5-1.4-.8-2.9-.8-4.4s.3-3 .7-4.4l-7.1-5.5C2.8 17 2 20.4 2 24s.8 7 2.3 9.9l7.2-5.5z" />
      <path fill="#EA4335" d="M24 9.5c3.3 0 6.1 1.1 8.4 3.3l6.2-6.2C34.9 3.1 29.9 1 24 1 15.4 1 8 5.7 4.3 14.1l7.1 5.5C13.3 13.3 18.2 9.5 24 9.5z" />
    </svg>
  )
}

export default function KontoBereich({ konto }: { konto: Konto }) {
  if (konto.laedtSitzung) {
    return (
      <section className="karte">
        <h2>Konto</h2>
        <p className="unter" style={{ margin: 0 }}>
          Wird geprüft …
        </p>
      </section>
    )
  }

  if (!konto.sitzung) {
    return (
      <section className="karte">
        <h2>Auf mehreren Geräten nutzen</h2>
        <p className="unter">
          Ohne Anmeldung liegen deine Einträge nur auf diesem Gerät. Meldest du dich
          mit deinem Google-Konto an, stehen sie auch auf dem iPhone — und sind
          gesichert, falls du den Browser-Speicher löschst.
        </p>

        <div className="knopf-reihe">
          <button
            type="button"
            className="knopf google"
            onClick={() => void konto.anmelden()}
          >
            <GoogleZeichen />
            Mit Google anmelden
          </button>
        </div>

        {konto.fehler && (
          <div className="merker" style={{ marginTop: 16, marginBottom: 0 }}>
            <span aria-hidden="true">⚠️</span>
            <div>{konto.fehler}</div>
          </div>
        )}

        <p className="quellen" style={{ marginTop: 16 }}>
          Die App funktioniert auch ohne Anmeldung vollständig — offline eingetragene
          Flüge werden nach dem Anmelden übernommen, es geht nichts verloren.
        </p>
      </section>
    )
  }

  return (
    <section className="karte">
      <h2>Konto</h2>
      <p className="unter">
        Angemeldet als <strong>{konto.email}</strong>
      </p>

      <div className="liste" style={{ marginBottom: 14 }}>
        <div className="zeile">
          <div className="zeile-haupt">
            <div className="zeile-titel">
              Abgleich
              {konto.zustand === 'laeuft' && <span className="marke-geplant">läuft</span>}
            </div>
            <div className="zeile-neben">
              Zuletzt: {zeitpunkt(konto.letzterAbgleich)}
              {!konto.online && ' · gerade offline'}
              {konto.offen > 0 &&
                ` · ${menge(konto.offen, 'Änderung wartet', 'Änderungen warten')}`}
              {konto.online && konto.offen === 0 && konto.zustand === 'ruht' && ' · alles gesichert'}
            </div>
          </div>
          <span
            className={`ampel ${
              konto.zustand === 'fehler'
                ? 'rot'
                : !konto.online
                  ? 'grau'
                  : konto.offen > 0 || konto.zustand === 'laeuft'
                    ? 'gelb'
                    : 'gruen'
            }`}
            aria-hidden="true"
          />
        </div>
      </div>

      {konto.fehler && (
        <div className="merker" style={{ marginBottom: 14 }}>
          <span aria-hidden="true">⚠️</span>
          <div>{konto.fehler}</div>
        </div>
      )}

      <div className="knopf-reihe">
        <button
          type="button"
          className="knopf"
          disabled={konto.zustand === 'laeuft' || !konto.online}
          onClick={() => void konto.jetztAbgleichen()}
        >
          Jetzt abgleichen
        </button>
        <button type="button" className="knopf leise" onClick={() => void konto.abmelden()}>
          Abmelden
        </button>
      </div>
      {!konto.online && (
        <span className="hinweis" style={{ color: 'var(--text-leise)', fontSize: 12.5 }}>
          Ohne Verbindung nicht möglich — deine Eingaben bleiben auf dem Gerät und
          gehen automatisch hoch, sobald du wieder online bist.
        </span>
      )}

      <p className="quellen" style={{ marginTop: 16 }}>
        Beim Abmelden bleiben die Einträge auf diesem Gerät erhalten.
      </p>
    </section>
  )
}
