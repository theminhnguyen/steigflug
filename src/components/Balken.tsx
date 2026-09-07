import { anteil } from '../core/calc'
import { zahl } from '../core/format'

interface Props {
  name: string
  ist: number
  plan: number
  ziel: number
  /** Qualifying Points bekommen eine eigene Farbe, damit die zwei Hürden
   *  auf einen Blick unterscheidbar bleiben. */
  variante?: 'points' | 'qp'
}

export default function Balken({ name, ist, plan, ziel, variante = 'points' }: Props) {
  return (
    <div className="ziel">
      <div className="ziel-kopf">
        <span className="ziel-name">{name}</span>
        <span className="ziel-zahl">
          <b>{zahl(ist)}</b>
          {plan > ist && <span> (+{zahl(plan - ist)} geplant)</span>}
          <span> von {zahl(ziel)}</span>
        </span>
      </div>
      <div
        className={`balken ${variante === 'qp' ? 'qp' : ''}`}
        role="progressbar"
        aria-label={name}
        aria-valuenow={Math.round(ist)}
        aria-valuemin={0}
        aria-valuemax={ziel}
      >
        <i className="plan" style={{ width: `${anteil(plan, ziel)}%` }} />
        <i className="ist" style={{ width: `${anteil(ist, ziel)}%` }} />
      </div>
    </div>
  )
}
