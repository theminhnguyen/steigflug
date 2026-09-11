import { useMemo, useRef, useState } from 'react'
import type { AppDaten, KartenArt, SetDaten, UptripKarte, UptripKollektion } from '../core/types'
import type { Regelwerk } from '../rules'
import { alleAirlines } from '../rules'
import {
  KARTEN_ARTEN,
  kartenUebersicht,
  kartenVorschlaege,
  kollektionsStand,
  uptripWeg,
  type KartenVorschlag,
  type Namen,
} from '../core/uptrip'
import { AIRPORTS } from '../data/airports'
import { datumKurz, heuteIso, menge, zahl, zahlAusFeld } from '../core/format'
import { neueId } from '../store/store'
import { alsGeloescht, ohneGeloeschte } from '../sync/merge'
import Balken from './Balken'

interface Props {
  regelwerk: Regelwerk
  daten: AppDaten
  setDaten: SetDaten
}

const ART_NAME = Object.fromEntries(KARTEN_ARTEN.map((a) => [a.id, a.name])) as Record<
  KartenArt,
  string
>

function leereKarte(kollektion: string): UptripKarte {
  return {
    id: neueId(),
    name: '',
    art: 'stadt',
    original: true,
    datum: heuteIso(),
    flug: '',
    kollektion,
    geaendertAm: '',
    dirty: true,
    geloescht: false,
  }
}

function leereKollektion(): UptripKollektion {
  return {
    id: neueId(),
    name: '',
    belohnung: '',
    benoetigt: 8,
    mindestOriginale: 0,
    points: 0,
    qp: 0,
    bringtStatus: false,
    eingeloest: false,
    geaendertAm: '',
    dirty: true,
    geloescht: false,
  }
}

/**
 * Sammelalbum für die Uptrip-App.
 *
 * Von Hand gepflegt, weil sich Uptrip nicht auslesen lässt. Deshalb ist das
 * Nachtragen so kurz wie möglich gehalten: Vorschläge aus den letzten Flügen,
 * und die gewählte Kollektion bleibt für die nächste Karte stehen — nach einem
 * Flug kommen zwei Karten, meist für dieselbe Kollektion.
 */
export default function Uptrip({ regelwerk, daten, setDaten }: Props) {
  const heute = heuteIso()
  const kartenFormular = useRef<HTMLElement>(null)
  const kollektionsFormular = useRef<HTMLDivElement>(null)

  const kollektionen = useMemo(
    () =>
      ohneGeloeschte(daten.uptripKollektionen).sort(
        (a, b) =>
          Number(a.eingeloest) - Number(b.eingeloest) ||
          Number(b.bringtStatus) - Number(a.bringtStatus) ||
          a.name.localeCompare(b.name, 'de'),
      ),
    [daten.uptripKollektionen],
  )

  const [karte, setKarte] = useState<UptripKarte>(() =>
    leereKarte(kollektionen.find((k) => k.bringtStatus && !k.eingeloest)?.id ?? ''),
  )
  const [karteBearbeitet, setKarteBearbeitet] = useState<string | null>(null)
  const [kollektion, setKollektion] = useState<UptripKollektion | null>(null)
  const [kollektionBearbeitet, setKollektionBearbeitet] = useState<string | null>(null)

  const namen = useMemo((): Namen => {
    const airlines = new Map(alleAirlines(regelwerk).map((a) => [a.code, a.name]))
    return {
      stadt: (iata) => AIRPORTS[iata]?.name ?? iata,
      airline: (code) => airlines.get(code) ?? code,
    }
  }, [regelwerk])

  const uebersicht = useMemo(
    () => kartenUebersicht(daten.uptripKarten, daten.uptripKollektionen),
    [daten.uptripKarten, daten.uptripKollektionen],
  )
  const staende = useMemo(
    () => new Map(kollektionen.map((k) => [k.id, kollektionsStand(k, daten.uptripKarten)])),
    [kollektionen, daten.uptripKarten],
  )
  const weg = useMemo(
    () =>
      uptripWeg(
        daten.uptripKollektionen,
        daten.uptripKarten,
        daten.fluege,
        heute,
        regelwerk.uptrip.kartenJeSegment,
      ),
    [daten.uptripKollektionen, daten.uptripKarten, daten.fluege, heute, regelwerk.uptrip.kartenJeSegment],
  )
  const vorschlaege = useMemo(
    () => kartenVorschlaege(daten.fluege, daten.uptripKarten, namen, heute),
    [daten.fluege, daten.uptripKarten, namen, heute],
  )

  const gruppen = useMemo(() => {
    const bekannt = new Set(kollektionen.map((k) => k.id))
    const nachGruppe = new Map<string, UptripKarte[]>()
    for (const c of ohneGeloeschte(daten.uptripKarten)) {
      const schluessel = bekannt.has(c.kollektion) ? c.kollektion : ''
      const liste = nachGruppe.get(schluessel) ?? []
      liste.push(c)
      nachGruppe.set(schluessel, liste)
    }
    // Neueste zuerst; Karten ohne Datum ans Ende.
    const sortiert = (l: UptripKarte[]) =>
      l.sort((a, b) => b.datum.localeCompare(a.datum) || a.name.localeCompare(b.name, 'de'))
    const ergebnis = kollektionen
      .filter((k) => nachGruppe.has(k.id))
      .map((k) => ({
        id: k.id,
        titel: `${k.name || 'Ohne Namen'}${k.eingeloest ? ' · eingelöst' : ''}`,
        karten: sortiert(nachGruppe.get(k.id)!),
      }))
    const frei = nachGruppe.get('')
    if (frei) ergebnis.push({ id: '', titel: 'Keiner Kollektion zugeordnet', karten: sortiert(frei) })
    return ergebnis
  }, [kollektionen, daten.uptripKarten])

  /* ---------- Karten ---------- */

  const karteFehlt = !karte.name.trim() ? 'Bitte den Namen der Karte eintragen, etwa „Munich“.' : null
  // Eine gelöschte Kollektion darf nicht als unsichtbare Auswahl stehen bleiben.
  const gewaehlteKollektion = kollektionen.some((k) => k.id === karte.kollektion)
    ? karte.kollektion
    : ''

  function karteZuruecksetzen(kollektionId: string) {
    setKarte(leereKarte(kollektionId))
    setKarteBearbeitet(null)
  }

  function karteSpeichern() {
    if (karteFehlt) return
    const eintrag: UptripKarte = {
      ...karte,
      name: karte.name.trim(),
      flug: karte.flug.trim(),
      kollektion: gewaehlteKollektion,
      dirty: true,
    }
    setDaten((d) => ({
      ...d,
      uptripKarten: karteBearbeitet
        ? d.uptripKarten.map((k) => (k.id === karteBearbeitet ? eintrag : k))
        : d.uptripKarten.some((k) => k.id === eintrag.id)
          ? d.uptripKarten
          : [...d.uptripKarten, eintrag],
    }))
    karteZuruecksetzen(eintrag.kollektion)
  }

  function vorschlagUebernehmen(v: KartenVorschlag) {
    setKarte((k) => ({ ...k, name: v.name, art: v.art, original: true, datum: v.datum, flug: v.flug }))
  }

  function karteBearbeiten(k: UptripKarte) {
    setKarte({ ...k })
    setKarteBearbeitet(k.id)
    kartenFormular.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function karteLoeschen(id: string) {
    setDaten((d) => ({
      ...d,
      uptripKarten: d.uptripKarten.map((k) => (k.id === id ? alsGeloescht(k) : k)),
    }))
    if (karteBearbeitet === id) karteZuruecksetzen(karte.kollektion)
  }

  /* ---------- Kollektionen ---------- */

  const kollektionFehlt = !kollektion
    ? null
    : !kollektion.name.trim()
      ? 'Bitte einen Namen eintragen.'
      : kollektion.benoetigt <= 0
        ? 'Bitte eintragen, wie viele Karten die Kollektion braucht.'
        : null

  function kollektionOeffnen(k: UptripKollektion, bearbeitet: string | null) {
    setKollektion(k)
    setKollektionBearbeitet(bearbeitet)
    // Erst nach dem Zeichnen gibt es das Formular, zu dem gescrollt wird.
    requestAnimationFrame(() =>
      kollektionsFormular.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    )
  }

  function kollektionSchliessen() {
    setKollektion(null)
    setKollektionBearbeitet(null)
  }

  function kollektionSpeichern() {
    if (!kollektion || kollektionFehlt) return
    const eintrag: UptripKollektion = {
      ...kollektion,
      name: kollektion.name.trim(),
      belohnung: kollektion.belohnung.trim(),
      dirty: true,
    }
    setDaten((d) => ({
      ...d,
      uptripKollektionen: kollektionBearbeitet
        ? d.uptripKollektionen.map((k) => (k.id === kollektionBearbeitet ? eintrag : k))
        : d.uptripKollektionen.some((k) => k.id === eintrag.id)
          ? d.uptripKollektionen
          : [...d.uptripKollektionen, eintrag],
    }))
    kollektionSchliessen()
  }

  function kollektionLoeschen(id: string) {
    // Die Karten bleiben: Sie gelten danach als keiner Kollektion zugeordnet.
    setDaten((d) => ({
      ...d,
      uptripKollektionen: d.uptripKollektionen.map((k) => (k.id === id ? alsGeloescht(k) : k)),
    }))
    if (kollektionBearbeitet === id) kollektionSchliessen()
  }

  const leer = uebersicht.gesamt === 0 && uebersicht.verbraucht === 0 && kollektionen.length === 0

  return (
    <>
      {/* Genau eine Leitzahl je Ansicht. */}
      <section className="aussage">
        <div className="leitzahl">
          <b>{zahl(uebersicht.gesamt)}</b>
          <span className="einheit">
            {uebersicht.gesamt === 1 ? 'Karte' : 'Karten'} in Uptrip
          </span>
        </div>
        <p>
          {leer
            ? 'Uptrip lässt sich nicht automatisch auslesen. Lege unten deine Kollektionen an und trage nach jedem Flug die neuen Karten ein.'
            : `Davon ${menge(uebersicht.originale, 'Original', 'Originale')} aus eigenen Flügen und ${zahl(uebersicht.weitere)} weitere.`}
        </p>
        {uebersicht.frei.length > 0 && (
          <p className="zusatz">
            {menge(uebersicht.frei.length, 'Karte ist', 'Karten sind')} noch keiner Kollektion
            zugeordnet.
          </p>
        )}
        {uebersicht.verbraucht > 0 && (
          <p className="zusatz">
            {menge(uebersicht.verbraucht, 'Karte ist', 'Karten sind')} in eingelösten
            Kollektionen aufgegangen.
          </p>
        )}
      </section>

      {weg && (
        <section className="karte">
          <h2>{weg.stand.kollektion.name || 'Status-Kollektion'}</h2>
          <p className="unter">
            {weg.stand.vollstaendig
              ? 'Vollständig — du kannst die Belohnung in der Uptrip-App einlösen.'
              : `${zahl(weg.stand.kollektion.benoetigt)} Karten, davon mindestens ${zahl(weg.stand.mindestOriginale)} Originale aus eigenen Flügen.`}
          </p>
          {weg.stand.mindestOriginale > 0 && (
            <Balken
              name="Originale"
              ist={weg.stand.originale}
              plan={weg.originaleMitPlanung}
              ziel={weg.stand.mindestOriginale}
            />
          )}
          <Balken
            name="Karten insgesamt"
            ist={weg.stand.angerechnet}
            plan={Math.min(
              weg.stand.kollektion.benoetigt,
              weg.stand.angerechnet + (weg.originaleMitPlanung - weg.stand.originale),
            )}
            ziel={weg.stand.kollektion.benoetigt}
            variante="qp"
          />
          {!weg.stand.vollstaendig && (
            <p className="unter" style={{ margin: 'var(--s4) 0 0' }}>
              {weg.stand.fehlendeOriginale > 0 &&
                `Es fehlen ${menge(weg.stand.fehlendeOriginale, 'Original', 'Originale')}, also mindestens ${menge(weg.segmenteNoetig, 'Flugsegment', 'Flugsegmente')} mit der Lufthansa Group. `}
              {weg.geplanteSegmente > 0 &&
                `Mit ${menge(weg.geplanteSegmente, 'geplantem Segment', 'geplanten Segmenten')} in Steigflug kommen voraussichtlich ${zahl(weg.originaleMitPlanung - weg.stand.originale)} dazu. `}
              {weg.stand.fehlendeBeliebige > 0 &&
                `${menge(weg.stand.fehlendeBeliebige, 'weiterer Platz lässt', 'weitere Plätze lassen')} sich mit jeder Karte füllen.`}
            </p>
          )}
          {weg.stand.ueberzaehlig > 0 && (
            <div className="merker" style={{ margin: 'var(--s4) 0 0' }}>
              <span aria-hidden="true">↔️</span>
              <div>
                <b>{menge(weg.stand.ueberzaehlig, 'Karte zählt', 'Karten zählen')} hier nicht</b>
                Mehr als {zahl(weg.stand.kollektion.benoetigt - weg.stand.mindestOriginale)}{' '}
                Karten, die keine Originale sind, nimmt die Kollektion nicht an. In einer anderen
                Kollektion wären sie nützlicher.
              </div>
            </div>
          )}
        </section>
      )}

      <section className="karte" ref={kartenFormular}>
        <h2>{karteBearbeitet ? 'Karte bearbeiten' : 'Karte eintragen'}</h2>
        <p className="unter">
          Pro Flug gibt Uptrip dir zwei Karten. Trag sie hier ein, sobald du sie in der App
          gewählt hast.
        </p>

        {!karteBearbeitet && vorschlaege.length > 0 && (
          <>
            <p className="abschnitt-titel">Aus deinen letzten Flügen</p>
            <div className="knopf-reihe" style={{ flexWrap: 'wrap', marginBottom: 'var(--s4)' }}>
              {vorschlaege.map((v) => (
                <button
                  key={v.schluessel}
                  type="button"
                  className="knopf leise klein"
                  onClick={() => vorschlagUebernehmen(v)}
                >
                  {v.name} · {ART_NAME[v.art]} · {datumKurz(v.datum)}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="formular">
          <div className="feld-reihe">
            <div className="feld">
              <label htmlFor="u-name">Name auf der Karte</label>
              <input
                id="u-name"
                type="text"
                placeholder="z. B. Munich"
                value={karte.name}
                onChange={(e) => setKarte({ ...karte, name: e.target.value })}
              />
            </div>
            <div className="feld">
              <label htmlFor="u-art">Art</label>
              <select
                id="u-art"
                value={karte.art}
                onChange={(e) => setKarte({ ...karte, art: e.target.value as KartenArt })}
              >
                {KARTEN_ARTEN.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="schalter">
            <input
              type="checkbox"
              checked={karte.original}
              onChange={(e) => setKarte({ ...karte, original: e.target.checked })}
            />
            Original — aus einem eigenen Flug (Flugzeug-Symbol oben links auf der Karte)
          </label>

          <div className="feld">
            <label htmlFor="u-datum">Datum laut Karte</label>
            <input
              id="u-datum"
              type="date"
              value={karte.datum}
              onChange={(e) => setKarte({ ...karte, datum: e.target.value })}
            />
          </div>

          <div className="feld">
            <label htmlFor="u-flug">Flug oder Anlass</label>
            <input
              id="u-flug"
              type="text"
              placeholder="z. B. LH 2016 · MUC → DUS"
              value={karte.flug}
              onChange={(e) => setKarte({ ...karte, flug: e.target.value })}
            />
          </div>

          <div className="feld">
            <label htmlFor="u-kollektion">Kollektion</label>
            <select
              id="u-kollektion"
              value={gewaehlteKollektion}
              onChange={(e) => setKarte({ ...karte, kollektion: e.target.value })}
            >
              <option value="">— keiner zugeordnet —</option>
              {kollektionen.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name || 'Ohne Namen'}
                  {k.eingeloest ? ' (eingelöst)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="knopf-reihe">
            <button
              type="button"
              className="knopf haupt"
              disabled={karteFehlt !== null}
              onClick={karteSpeichern}
            >
              {karteBearbeitet ? 'Änderung speichern' : 'Hinzufügen'}
            </button>
            {karteBearbeitet && (
              <button
                type="button"
                className="knopf leise"
                onClick={() => karteZuruecksetzen(karte.kollektion)}
              >
                Abbrechen
              </button>
            )}
          </div>
          {karteFehlt && (
            <span className="hinweis" style={{ color: 'var(--text-leise)', fontSize: 12.5 }}>
              {karteFehlt}
            </span>
          )}
        </div>
      </section>

      <section className="karte">
        <h2>Kollektionen</h2>
        <p className="unter">
          Die Punkte einer Belohnung stehen hier nur zur Übersicht. In die Rechnung kommen sie
          über den Kontoauszug, sobald Miles &amp; More sie gutschreibt — sonst zählten sie
          doppelt.
        </p>

        {kollektionen.length === 0 ? (
          <div className="leer">Noch keine Kollektion angelegt.</div>
        ) : (
          <div className="liste">
            {kollektionen.map((k) => {
              const s = staende.get(k.id)!
              return (
                <div className={`zeile ${k.eingeloest ? 'ist-geplant' : ''}`} key={k.id}>
                  <div className="zeile-haupt">
                    <div className="zeile-titel">
                      {k.name || 'Ohne Namen'}
                      {k.eingeloest ? (
                        <span className="marke-geplant">eingelöst</span>
                      ) : (
                        s.vollstaendig && <span className="marke-geplant">vollständig</span>
                      )}
                    </div>
                    <div className="zeile-neben">
                      {k.belohnung || 'Belohnung nicht eingetragen'}
                      {s.mindestOriginale > 0 &&
                        ` · ${zahl(s.originale)} von ${zahl(s.mindestOriginale)} Originalen`}
                    </div>
                  </div>
                  <div className="punkte-block">
                    <b>
                      {zahl(s.angerechnet)}/{zahl(k.benoetigt)}
                    </b>
                    <span className={k.points + k.qp === 0 ? 'keine-qp' : ''}>
                      {k.points + k.qp === 0
                        ? 'keine Punkte'
                        : `${zahl(k.points)} P · ${zahl(k.qp)} QP`}
                    </span>
                  </div>
                  <div className="knopf-reihe">
                    <button
                      type="button"
                      className="knopf klein"
                      onClick={() => kollektionOeffnen({ ...k }, k.id)}
                    >
                      Ändern
                    </button>
                    <button
                      type="button"
                      className="knopf leise klein"
                      onClick={() => kollektionLoeschen(k.id)}
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {kollektion ? (
          <div className="formular" ref={kollektionsFormular} style={{ marginTop: 'var(--s5)' }}>
            <p className="abschnitt-titel" style={{ margin: 0 }}>
              {kollektionBearbeitet ? 'Kollektion bearbeiten' : 'Neue Kollektion'}
            </p>
            <div className="feld">
              <label htmlFor="u-k-name">Name</label>
              <input
                id="u-k-name"
                type="text"
                placeholder="z. B. Ready for Takeoff"
                value={kollektion.name}
                onChange={(e) => setKollektion({ ...kollektion, name: e.target.value })}
              />
            </div>
            <div className="feld">
              <label htmlFor="u-k-belohnung">Belohnung</label>
              <input
                id="u-k-belohnung"
                type="text"
                placeholder="z. B. 20 Points und 20 Qualifying Points"
                value={kollektion.belohnung}
                onChange={(e) => setKollektion({ ...kollektion, belohnung: e.target.value })}
              />
            </div>
            <div className="feld-reihe">
              <div className="feld">
                <label htmlFor="u-k-benoetigt">Karten nötig</label>
                <input
                  id="u-k-benoetigt"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={kollektion.benoetigt}
                  onChange={(e) =>
                    setKollektion({ ...kollektion, benoetigt: zahlAusFeld(e.target.value) })
                  }
                />
              </div>
              <div className="feld">
                <label htmlFor="u-k-originale">davon Originale</label>
                <input
                  id="u-k-originale"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={kollektion.mindestOriginale}
                  onChange={(e) =>
                    setKollektion({ ...kollektion, mindestOriginale: zahlAusFeld(e.target.value) })
                  }
                />
                <span className="hinweis">0, wenn jede Karte zählt.</span>
              </div>
            </div>
            <div className="feld-reihe">
              <div className="feld">
                <label htmlFor="u-k-points">Points der Belohnung</label>
                <input
                  id="u-k-points"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={kollektion.points}
                  onChange={(e) =>
                    setKollektion({ ...kollektion, points: zahlAusFeld(e.target.value) })
                  }
                />
              </div>
              <div className="feld">
                <label htmlFor="u-k-qp">davon Qualifying Points</label>
                <input
                  id="u-k-qp"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={kollektion.qp}
                  onChange={(e) => setKollektion({ ...kollektion, qp: zahlAusFeld(e.target.value) })}
                />
              </div>
            </div>
            <label className="schalter">
              <input
                type="checkbox"
                checked={kollektion.bringtStatus}
                onChange={(e) => setKollektion({ ...kollektion, bringtStatus: e.target.checked })}
              />
              Bringt den Status selbst (Frequent Traveller)
            </label>
            {kollektionBearbeitet && (
              <label className="schalter">
                <input
                  type="checkbox"
                  checked={kollektion.eingeloest}
                  onChange={(e) => setKollektion({ ...kollektion, eingeloest: e.target.checked })}
                />
                Eingelöst — die Karten darin sind in der App verbraucht
              </label>
            )}
            {kollektion.mindestOriginale > kollektion.benoetigt && (
              <span className="hinweis warn">
                Mehr Originale als Karten insgesamt — gerechnet wird mit{' '}
                {zahl(kollektion.benoetigt)}.
              </span>
            )}
            <div className="knopf-reihe">
              <button
                type="button"
                className="knopf haupt"
                disabled={kollektionFehlt !== null}
                onClick={kollektionSpeichern}
              >
                {kollektionBearbeitet ? 'Änderung speichern' : 'Anlegen'}
              </button>
              <button type="button" className="knopf leise" onClick={kollektionSchliessen}>
                Abbrechen
              </button>
            </div>
            {kollektionFehlt && (
              <span className="hinweis" style={{ color: 'var(--text-leise)', fontSize: 12.5 }}>
                {kollektionFehlt}
              </span>
            )}
          </div>
        ) : (
          <div className="knopf-reihe" style={{ marginTop: 'var(--s4)' }}>
            <button
              type="button"
              className="knopf klein"
              onClick={() => kollektionOeffnen(leereKollektion(), null)}
            >
              Kollektion anlegen
            </button>
            {!kollektionen.some((k) => k.bringtStatus) && (
              <button
                type="button"
                className="knopf leise klein"
                onClick={() =>
                  kollektionOeffnen(
                    { ...leereKollektion(), ...regelwerk.uptrip.statusKollektion, bringtStatus: true },
                    null,
                  )
                }
              >
                Frequent Traveller anlegen
              </button>
            )}
          </div>
        )}
      </section>

      <section className="karte">
        <h2>Deine Karten</h2>
        {gruppen.length === 0 ? (
          <div className="leer">Noch keine Karte eingetragen.</div>
        ) : (
          gruppen.map((g) => (
            <div key={g.id || 'frei'}>
              <p className="abschnitt-titel" style={{ marginTop: 'var(--s4)' }}>
                {g.titel} · {menge(g.karten.length, 'Karte', 'Karten')}
              </p>
              <div className="liste">
                {g.karten.map((c) => (
                  <div className="zeile" key={c.id}>
                    <div className="zeile-haupt">
                      <div className="zeile-titel">
                        {c.name}
                        {c.original && <span className="marke-geplant">Original</span>}
                      </div>
                      <div className="zeile-neben">
                        {[ART_NAME[c.art], c.datum ? datumKurz(c.datum) : '', c.flug]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className="knopf-reihe">
                      <button type="button" className="knopf klein" onClick={() => karteBearbeiten(c)}>
                        Ändern
                      </button>
                      <button
                        type="button"
                        className="knopf leise klein"
                        onClick={() => karteLoeschen(c.id)}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </>
  )
}
