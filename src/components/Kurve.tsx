import { useMemo, useRef, useState } from 'react'
import type { VerlaufPunkt } from '../core/calc'
import type { Ziel } from '../rules'
import { datumKurz, heuteIso, zahl } from '../core/format'

interface Props {
  verlauf: VerlaufPunkt[]
  ziel: Ziel
  jahr: number
}

/* Maße im Koordinatensystem des Bildes; die Anzeige skaliert mit. */
const B = 720
const H = 210
const RAND = { oben: 14, rechts: 52, unten: 26, links: 34 }
const FLAECHE = { b: B - RAND.links - RAND.rechts, h: H - RAND.oben - RAND.unten }

/* Jeder zweite Monat, lang genug zum Unterscheiden — bei Einzelbuchstaben
   sind Januar/Juni/Juli und März/Mai nicht auseinanderzuhalten. */
const MONATE = ['Jan', 'Mär', 'Mai', 'Jul', 'Sep', 'Nov']

interface Stelle {
  x: number
  yPoints: number
  yQp: number
  datum: string
  points: number
  qp: number
  pctPoints: number
  pctQp: number
  geplant: boolean
  label: string
}

/**
 * Der Anstieg über das Jahr: zwei Reihen auf einer gemeinsamen Skala.
 *
 * Points und Qualifying Points haben verschiedene Schwellen (650 und 325). Zwei
 * Achsen wären der sicherste Weg, das Bild unlesbar zu machen — stattdessen
 * zeigt die Kurve den Anteil am jeweiligen Ziel. Damit liegt die Ziellinie für
 * beide bei 100 Prozent, und man sieht auf einen Blick, welche der beiden Hürden
 * die knappere ist.
 */
export default function Kurve({ verlauf, ziel, jahr }: Props) {
  const huelle = useRef<HTMLDivElement>(null)
  const [aktiv, setAktiv] = useState<number | null>(null)

  const { stellen, obenPct, pfade, heuteX } = useMemo(() => {
    const start = Date.UTC(jahr, 0, 1)
    const jahresTage = (Date.UTC(jahr, 11, 31) - start) / 86_400_000 + 1
    const tagVon = (iso: string) => {
      const t = Date.parse(`${iso}T12:00:00Z`)
      if (Number.isNaN(t)) return 0
      return Math.min(jahresTage, Math.max(0, (t - start) / 86_400_000))
    }

    const hoechst = verlauf.reduce(
      (m, v) =>
        Math.max(m, (v.points / ziel.points) * 100, (v.qp / ziel.qualifyingPoints) * 100),
      100,
    )
    // Auf glatte Stufen aufrunden, damit die Achse ganze Zahlen zeigt.
    const obenPct = Math.ceil(Math.max(120, hoechst * 1.08) / 20) * 20

    const x = (tag: number) => RAND.links + (tag / jahresTage) * FLAECHE.b
    const y = (pct: number) => RAND.oben + FLAECHE.h - (pct / obenPct) * FLAECHE.h

    const stellen: Stelle[] = verlauf.map((v) => {
      const pctPoints = (v.points / ziel.points) * 100
      const pctQp = (v.qp / ziel.qualifyingPoints) * 100
      return {
        x: x(tagVon(v.datum)),
        yPoints: y(pctPoints),
        yQp: y(pctQp),
        datum: v.datum,
        points: v.points,
        qp: v.qp,
        pctPoints,
        pctQp,
        geplant: v.geplant,
        label: v.label,
      }
    })

    // Der Jahresanfang ist immer der Nullpunkt der Kurve.
    const anfang = { x: RAND.links, yPoints: y(0), yQp: y(0) }

    // Bestätigt wird nur bis zum ersten geplanten Schritt gezeichnet — so wird
    // nie mehr als gesichert dargestellt, als es tatsächlich ist.
    const ersterPlan = stellen.findIndex((s) => s.geplant)
    const grenze = ersterPlan === -1 ? stellen.length : ersterPlan

    const linie = (
      liste: { x: number; yPoints: number; yQp: number }[],
      feld: 'yPoints' | 'yQp',
    ) => liste.map((s, i) => `${i === 0 ? 'M' : 'L'}${s.x.toFixed(1)} ${s[feld].toFixed(1)}`).join(' ')

    // Blasse Wäsche unter der Linie: gibt dem Verlauf Gewicht, ohne zusätzliches
    // Datengewicht. Nur unter der oberen der beiden Reihen.
    const boden = RAND.oben + FLAECHE.h
    const flaeche = (
      liste: { x: number; yPoints: number; yQp: number }[],
      feld: 'yPoints' | 'yQp',
    ) =>
      liste.length > 1
        ? `${linie(liste, feld)} L${liste[liste.length - 1]!.x.toFixed(1)} ${boden} L${liste[0]!.x.toFixed(1)} ${boden} Z`
        : ''

    const fest = [anfang, ...stellen.slice(0, grenze)]
    const rest = stellen.slice(Math.max(0, grenze - 1))
    const restMitAnfang = grenze === 0 ? [anfang, ...stellen] : rest

    // „Heute“ nur zeigen, wenn es tatsächlich im Zieljahr liegt — sonst
    // klebte die Linie am Rand und behauptete etwas Falsches.
    const heute = heuteIso()
    const heuteX =
      Number(heute.slice(0, 4)) === jahr ? RAND.links + (tagVon(heute) / jahresTage) * FLAECHE.b : null

    return {
      stellen,
      heuteX,
      obenPct,
      pfade: {
        festPoints: fest.length > 1 ? linie(fest, 'yPoints') : '',
        festQp: fest.length > 1 ? linie(fest, 'yQp') : '',
        planPoints: restMitAnfang.length > 1 ? linie(restMitAnfang, 'yPoints') : '',
        planQp: restMitAnfang.length > 1 ? linie(restMitAnfang, 'yQp') : '',
        flaecheQp: flaeche([anfang, ...stellen], 'yQp'),
        ziellinie: RAND.oben + FLAECHE.h - (100 / obenPct) * FLAECHE.h,
      },
    }
  }, [verlauf, ziel, jahr])

  if (stellen.length === 0) {
    return (
      <div className="leer">
        Sobald Flüge oder Boden-Punkte eingetragen sind, zeichnet Steigflug hier den
        Anstieg über das Jahr.
      </div>
    )
  }

  const letzte = stellen[stellen.length - 1]!
  const gezeigt = aktiv === null ? null : stellen[aktiv]

  function beiBewegung(e: React.MouseEvent<SVGRectElement>) {
    const kasten = e.currentTarget.getBoundingClientRect()
    const anteil = (e.clientX - kasten.left) / kasten.width
    const xImBild = RAND.links + anteil * FLAECHE.b
    let naechste = 0
    let abstand = Infinity
    stellen.forEach((s, i) => {
      const d = Math.abs(s.x - xImBild)
      if (d < abstand) {
        abstand = d
        naechste = i
      }
    })
    setAktiv(naechste)
  }

  const achsenStufen = Array.from({ length: obenPct / 20 + 1 }, (_, i) => i * 20)

  return (
    <>
      <div className="diagramm" ref={huelle}>
        <svg viewBox={`0 0 ${B} ${H}`} role="img" aria-label={`Anstieg der Punkte über ${jahr}`}>
          {/* Gitter: eine Stufe neben der Fläche, haarfein und durchgezogen */}
          {achsenStufen.map((pct) => {
            const y = RAND.oben + FLAECHE.h - (pct / obenPct) * FLAECHE.h
            return (
              <g key={pct}>
                <line
                  x1={RAND.links} x2={B - RAND.rechts} y1={y} y2={y}
                  stroke="var(--gitter)" strokeWidth={1}
                />
                <text x={RAND.links - 8} y={y + 3.5} textAnchor="end" className="diagramm-achse">
                  {pct}%
                </text>
              </g>
            )
          })}

          {/* Monatsraster */}
          {MONATE.map((m, i) => {
            const x = RAND.links + ((i * 2) / 12) * FLAECHE.b
            return (
              <text key={m} x={x + FLAECHE.b / 24} y={H - 8} textAnchor="middle" className="diagramm-achse">
                {m}
              </text>
            )
          })}

          {/* Heute */}
          {heuteX !== null && (
            <g>
              <line
                x1={heuteX} x2={heuteX} y1={RAND.oben} y2={RAND.oben + FLAECHE.h}
                stroke="var(--rand-stark)" strokeWidth={1}
              />
              <text x={heuteX} y={RAND.oben - 3} textAnchor="middle" className="diagramm-marke">
                heute
              </text>
            </g>
          )}

          {/* Ziellinie bei 100 Prozent */}
          <line
            x1={RAND.links} x2={B - RAND.rechts}
            y1={pfade.ziellinie} y2={pfade.ziellinie}
            stroke="var(--text-3)" strokeWidth={1} strokeDasharray="5 4"
          />
          <text x={B - RAND.rechts + 6} y={pfade.ziellinie + 3.5} className="diagramm-marke">
            Ziel
          </text>

          {/* Wäsche unter der führenden Reihe */}
          <path d={pfade.flaecheQp} fill="var(--serie-qp)" opacity={0.09} stroke="none" />

          {/* Geplanter Verlauf, gestrichelt */}
          <path d={pfade.planQp} fill="none" stroke="var(--serie-qp)" strokeWidth={2}
                strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
          <path d={pfade.planPoints} fill="none" stroke="var(--serie-points)" strokeWidth={2}
                strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />

          {/* Bestätigter Verlauf, durchgezogen darüber */}
          <path d={pfade.festQp} fill="none" stroke="var(--serie-qp)" strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" />
          <path d={pfade.festPoints} fill="none" stroke="var(--serie-points)" strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" />

          {/* Endpunkte mit Ring in Flächenfarbe, damit sie überall lesbar bleiben */}
          <circle cx={letzte.x} cy={letzte.yQp} r={4.5}
                  fill="var(--serie-qp)" stroke="var(--flaeche)" strokeWidth={2} />
          <circle cx={letzte.x} cy={letzte.yPoints} r={4.5}
                  fill="var(--serie-points)" stroke="var(--flaeche)" strokeWidth={2} />

          {/* Sparsame Beschriftung: nur die Endwerte */}
          <text x={letzte.x + 9} y={letzte.yPoints + 4} className="diagramm-marke">
            {Math.round(letzte.pctPoints)}%
          </text>
          {Math.abs(letzte.yQp - letzte.yPoints) > 13 && (
            <text x={letzte.x + 9} y={letzte.yQp + 4} className="diagramm-marke">
              {Math.round(letzte.pctQp)}%
            </text>
          )}

          {/* Fadenkreuz */}
          {gezeigt && (
            <g pointerEvents="none">
              <line x1={gezeigt.x} x2={gezeigt.x} y1={RAND.oben} y2={RAND.oben + FLAECHE.h}
                    stroke="var(--rand-stark)" strokeWidth={1} />
              <circle cx={gezeigt.x} cy={gezeigt.yQp} r={4.5}
                      fill="var(--serie-qp)" stroke="var(--flaeche)" strokeWidth={2} />
              <circle cx={gezeigt.x} cy={gezeigt.yPoints} r={4.5}
                      fill="var(--serie-points)" stroke="var(--flaeche)" strokeWidth={2} />
            </g>
          )}

          <rect
            x={RAND.links} y={RAND.oben} width={FLAECHE.b} height={FLAECHE.h}
            fill="transparent"
            onMouseMove={beiBewegung}
            onMouseLeave={() => setAktiv(null)}
          />
        </svg>

        {gezeigt && (
          <div
            className="marker"
            style={{
              left: `${(gezeigt.x / B) * 100}%`,
              top: `${(Math.min(gezeigt.yPoints, gezeigt.yQp) / H) * 100 - 4}%`,
            }}
          >
            <div className="marker-datum">
              {datumKurz(gezeigt.datum)} · {gezeigt.label}
            </div>
            <div className="marker-zeile">
              <i style={{ background: 'var(--serie-points)' }} /> Points
              <b>{zahl(gezeigt.points)}</b>
            </div>
            <div className="marker-zeile">
              <i style={{ background: 'var(--serie-qp)' }} /> Qualifying
              <b>{zahl(gezeigt.qp)}</b>
            </div>
          </div>
        )}
      </div>

      <div className="legende">
        <span><i style={{ background: 'var(--serie-points)' }} /> Points</span>
        <span><i style={{ background: 'var(--serie-qp)' }} /> Qualifying Points</span>
        <span><i className="l-plan" /> gestrichelt = geplant</span>
      </div>

      <details className="werte-klappe">
        <summary>Werte als Tabelle</summary>
        <div className="tabelle-huelle" style={{ marginTop: 'var(--s2)' }}>
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Eintrag</th>
                <th>Points</th>
                <th>QP</th>
              </tr>
            </thead>
            <tbody>
              {stellen.map((s, i) => (
                <tr key={`${s.datum}-${i}`}>
                  <td>{datumKurz(s.datum)}</td>
                  <td style={{ textAlign: 'left' }}>
                    {s.label}
                    {s.geplant ? ' (geplant)' : ''}
                  </td>
                  <td>{zahl(s.points)}</td>
                  <td>{zahl(s.qp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  )
}
