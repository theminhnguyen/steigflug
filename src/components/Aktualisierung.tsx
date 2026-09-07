import { useRegisterSW } from 'virtual:pwa-register/react'

/** Alle 30 Minuten nachsehen, solange die App offen ist. */
const PRUEFABSTAND = 30 * 60 * 1000

/**
 * Meldet eine neue Fassung, statt sie im Stillen erst beim übernächsten Öffnen
 * wirksam werden zu lassen.
 *
 * Von sich aus lädt die App nie neu — ein Neuladen mitten in einer Eingabe wäre
 * schlimmer als eine Fassung Rückstand. Der Zeitpunkt gehört dem Nutzer.
 */
export default function Aktualisierung() {
  const {
    needRefresh: [neueFassung, setNeueFassung],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_pfad, registrierung) {
      if (!registrierung) return
      setInterval(() => {
        if (navigator.onLine) void registrierung.update()
      }, PRUEFABSTAND)
    },
  })

  if (!neueFassung) return null

  return (
    <div className="hinweisleiste" role="status">
      <span aria-hidden="true">✨</span>
      <div>
        <b>Neue Fassung verfügbar</b>
        <span>Deine Einträge bleiben dabei unberührt.</span>
      </div>
      <div className="knopf-reihe">
        <button
          type="button"
          className="knopf haupt klein"
          onClick={() => {
            void (async () => {
              await updateServiceWorker(true)
              // Den Neustart übernimmt der Service Worker, sobald er die Steuerung
              // hat. Sofort selbst neu zu laden wäre falsch: Dann bediente noch der
              // alte Worker die Anfrage und man bekäme wieder die alte Fassung.
              // Diese Frist greift nur, wenn der Wechsel ausbleibt.
              window.setTimeout(() => window.location.reload(), 2500)
            })()
          }}
        >
          Jetzt laden
        </button>
        <button
          type="button"
          className="knopf leise klein"
          onClick={() => setNeueFassung(false)}
          aria-label="Hinweis ausblenden"
        >
          Später
        </button>
      </div>
    </div>
  )
}
