/** Datentypen der App. Bewusst schlank gehalten: alles, was sich rechnen lässt,
 *  wird gerechnet und nicht gespeichert. */

export type KlassenId = 'economy' | 'premium' | 'business' | 'first'
export type Strecke = 'kontinental' | 'interkontinental'

/**
 * Felder, die jeder abgleichbare Eintrag mitführt.
 *
 * `geaendertAm` setzt ausschließlich der Server. `dirty` heißt: lokal geändert,
 * noch nicht hochgeladen. `geloescht` ist ein sanftes Löschen — ohne das erführe
 * ein zweites Gerät nie, dass ein Eintrag verschwunden ist.
 */
export interface SyncFelder {
  geaendertAm: string
  dirty: boolean
  geloescht: boolean
}

/** Ein Flugsegment. Ein Hin- und Rückflug sind zwei Segmente. */
export interface Flug extends SyncFelder {
  id: string
  /** ISO-Datum, yyyy-mm-dd */
  datum: string
  /** IATA-Code, z. B. FRA */
  von: string
  nach: string
  /** IATA-Airline-Code, z. B. LH */
  airline: string
  klasse: KlassenId
  strecke: Strecke
  /** true, wenn der Nutzer die Strecke selbst gesetzt hat (überschreibt die Automatik) */
  streckeManuell: boolean
  /** geplant = zählt in der Prognose, aber nicht im Ist-Stand */
  geplant: boolean
  /** Tatsächlich gutgeschriebene Werte, falls sie von der Berechnung abweichen */
  korrekturPoints: number | null
  korrekturQp: number | null
  notiz: string
}

/** Punkte, die nicht aus einem Flug stammen: Marriott, Kreditkarte, Uptrip, … */
export interface BodenEintrag extends SyncFelder {
  id: string
  datum: string
  /** verweist auf bodenQuellen[].id im Regelwerk */
  quelle: string
  /** Anzahl Einheiten (Aufenthalte, Pakete, …) bzw. bei freier Eingabe die Points */
  anzahl: number
  /** nur bei freier Eingabe genutzt */
  freieQp: number
  geplant: boolean
  notiz: string
  /** Tatsächlich gutgeschriebene Werte, falls sie vom Regelwerk abweichen */
  korrekturPoints: number | null
  korrekturQp: number | null
  /**
   * Woher der Eintrag stammt. Leer bei Handeinträgen; bei Übernahmen aus dem
   * Kontoauszug ein inhaltlicher Schlüssel, an dem ein zweiter Import erkennt,
   * was schon da ist.
   */
  herkunft: string
}

export type KartenArt = 'stadt' | 'airline' | 'flugzeug' | 'spezial'

/** Eine Sammelkarte aus der Uptrip-App, von Hand ins Album übertragen. */
export interface UptripKarte extends SyncFelder {
  id: string
  /** wie auf der Karte, etwa „Munich“ oder „Airbus A319“ */
  name: string
  art: KartenArt
  /** Aus einem eigenen Flug. Die Status-Kollektion verlangt eine Mindestzahl davon. */
  original: boolean
  /** Datum laut Karte, darf leer sein */
  datum: string
  /** Flug oder Anlass laut Karte, etwa „VL 2018 · MUC → DUS“ */
  flug: string
  /** ID der Kollektion, der die Karte zugeordnet ist; leer = frei */
  kollektion: string
}

/** Eine Kollektion in der Uptrip-App. */
export interface UptripKollektion extends SyncFelder {
  id: string
  name: string
  /** Belohnung im Wortlaut, etwa „Lounge-Gutschein“ */
  belohnung: string
  /** Wie viele Karten die Kollektion braucht */
  benoetigt: number
  /** Wie viele davon Originale aus eigenen Flügen sein müssen */
  mindestOriginale: number
  /** Status-Punkte der Belohnung, falls es welche gibt */
  points: number
  qp: number
  /** Die Kollektion bringt den Status selbst (Frequent Traveller) */
  bringtStatus: boolean
  /** Eingelöst — die Karten darin sind in der App verbraucht */
  eingeloest: boolean
}

export interface AppDaten {
  /** Schema-Version für spätere Migrationen */
  schema: number
  /** Kalenderjahr, auf das qualifiziert wird */
  zieljahr: number
  /** verweist auf ziele[].id im Regelwerk */
  zielStatus: string
  fluege: Flug[]
  boden: BodenEintrag[]
  uptripKarten: UptripKarte[]
  uptripKollektionen: UptripKollektion[]
  /** Nutzer-Überschreibungen des Regelwerks, teilweise Struktur */
  regelwerkOverrides: Record<string, unknown>
  /**
   * Abbild der zuletzt hochgeladenen Einstellungen als JSON. Weicht der aktuelle
   * Stand davon ab, müssen sie erneut gesendet werden — das erspart es, an jeder
   * einzelnen Stelle ein Änderungskennzeichen mitzuführen.
   */
  einstellungenGesendet: string
}

/** Ergebnis einer Punkteberechnung für einen einzelnen Eintrag */
export interface Punkte {
  points: number
  qp: number
}


/**
 * Zustandsänderungen laufen ausschließlich über eine Funktion des vorherigen
 * Standes. Ein Objekt entgegenzunehmen wäre bequemer, führt aber dazu, dass zwei
 * schnell aufeinanderfolgende Klicks beide vom selben veralteten Stand ausgehen
 * und die erste Änderung verlorengeht. Der Typ verhindert das erst gar nicht.
 */
export type SetDaten = (aendern: (bisher: AppDaten) => AppDaten) => void
