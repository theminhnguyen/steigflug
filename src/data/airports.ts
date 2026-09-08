import type { Strecke } from '../core/types'

/**
 * Kompakte Flughafenliste: "IATA|Name|Ländercode".
 * Deckt die aus Deutschland üblichen Ziele ab. Unbekannte Codes sind kein
 * Problem – dann wählt der Nutzer die Strecke selbst.
 */
const ROH = `
FRA|Frankfurt|DE; MUC|München|DE; BER|Berlin|DE; HAM|Hamburg|DE
DUS|Düsseldorf|DE; CGN|Köln/Bonn|DE; STR|Stuttgart|DE; NUE|Nürnberg|DE
HAJ|Hannover|DE; LEJ|Leipzig/Halle|DE; BRE|Bremen|DE; DTM|Dortmund|DE
FMO|Münster/Osnabrück|DE; BSL|Basel|CH; ZRH|Zürich|CH; GVA|Genf|CH
BRN|Bern|CH; BRU|Brüssel|BE; VIE|Wien|AT; SZG|Salzburg|AT
INN|Innsbruck|AT; GRZ|Graz|AT; LNZ|Linz|AT; LUX|Luxemburg|LU
AMS|Amsterdam|NL; EIN|Eindhoven|NL; RTM|Rotterdam|NL; CDG|Paris Charles de Gaulle|FR
ORY|Paris Orly|FR; NCE|Nizza|FR; LYS|Lyon|FR; MRS|Marseille|FR
TLS|Toulouse|FR; BOD|Bordeaux|FR; NTE|Nantes|FR; LHR|London Heathrow|GB
LGW|London Gatwick|GB; LCY|London City|GB; STN|London Stansted|GB; LTN|London Luton|GB
MAN|Manchester|GB; EDI|Edinburgh|GB; GLA|Glasgow|GB; BHX|Birmingham|GB
BRS|Bristol|GB; NCL|Newcastle|GB; DUB|Dublin|IE; ORK|Cork|IE
MAD|Madrid|ES; BCN|Barcelona|ES; AGP|Málaga|ES; VLC|Valencia|ES
SVQ|Sevilla|ES; BIO|Bilbao|ES; PMI|Palma de Mallorca|ES; IBZ|Ibiza|ES
ALC|Alicante|ES; LPA|Las Palmas|ES; TFS|Teneriffa Süd|ES; TFN|Teneriffa Nord|ES
ACE|Lanzarote|ES; FUE|Fuerteventura|ES; LIS|Lissabon|PT; OPO|Porto|PT
FAO|Faro|PT; FNC|Funchal|PT; PDL|Ponta Delgada|PT; FCO|Rom Fiumicino|IT
MXP|Mailand Malpensa|IT; LIN|Mailand Linate|IT; BGY|Bergamo|IT; VCE|Venedig|IT
NAP|Neapel|IT; BLQ|Bologna|IT; FLR|Florenz|IT; TRN|Turin|IT
PSA|Pisa|IT; CTA|Catania|IT; PMO|Palermo|IT; BRI|Bari|IT
CAG|Cagliari|IT; OLB|Olbia|IT; VRN|Verona|IT; TRS|Triest|IT
CPH|Kopenhagen|DK; BLL|Billund|DK; AAL|Aalborg|DK; ARN|Stockholm Arlanda|SE
GOT|Göteborg|SE; MMX|Malmö|SE; OSL|Oslo|NO; BGO|Bergen|NO
TRD|Trondheim|NO; SVG|Stavanger|NO; TOS|Tromsø|NO; HEL|Helsinki|FI
KEF|Reykjavík|IS; WAW|Warschau|PL; KRK|Krakau|PL; GDN|Danzig|PL
WRO|Breslau|PL; POZ|Posen|PL; PRG|Prag|CZ; BRQ|Brünn|CZ
BUD|Budapest|HU; BTS|Bratislava|SK; KSC|Košice|SK; LJU|Ljubljana|SI
ZAG|Zagreb|HR; SPU|Split|HR; DBV|Dubrovnik|HR; PUY|Pula|HR
ZAD|Zadar|HR; RJK|Rijeka|HR; BEG|Belgrad|RS; SJJ|Sarajevo|BA
TGD|Podgorica|ME; TIA|Tirana|AL; SKP|Skopje|MK; PRN|Pristina|XK
SOF|Sofia|BG; VAR|Varna|BG; BOJ|Burgas|BG; OTP|Bukarest|RO
CLJ|Cluj|RO; TSR|Timișoara|RO; IAS|Iași|RO; KIV|Chișinău|MD
KBP|Kiew|UA; LWO|Lwiw|UA; RIX|Riga|LV; VNO|Vilnius|LT
TLL|Tallinn|EE; ATH|Athen|GR; SKG|Thessaloniki|GR; HER|Heraklion|GR
CHQ|Chania|GR; RHO|Rhodos|GR; JTR|Santorin|GR; JMK|Mykonos|GR
KGS|Kos|GR; CFU|Korfu|GR; MLA|Malta|MT; LCA|Larnaka|CY
PFO|Paphos|CY; IST|Istanbul|TR; SAW|Istanbul Sabiha|TR; AYT|Antalya|TR
ADB|Izmir|TR; ESB|Ankara|TR; TLV|Tel Aviv|IL; AMM|Amman|JO
BEY|Beirut|LB; CAI|Kairo|EG; HRG|Hurghada|EG; SSH|Sharm el-Sheikh|EG
RAK|Marrakesch|MA; CMN|Casablanca|MA; AGA|Agadir|MA; TUN|Tunis|TN
DJE|Djerba|TN; ALG|Algier|DZ; TBS|Tiflis|GE; EVN|Eriwan|AM
GYD|Baku|AZ; JFK|New York JFK|US; EWR|Newark|US; LGA|New York LaGuardia|US
BOS|Boston|US; IAD|Washington Dulles|US; ORD|Chicago|US; LAX|Los Angeles|US
SFO|San Francisco|US; SEA|Seattle|US; MIA|Miami|US; MCO|Orlando|US
ATL|Atlanta|US; DFW|Dallas|US; IAH|Houston|US; DEN|Denver|US
PHX|Phoenix|US; LAS|Las Vegas|US; SAN|San Diego|US; CLT|Charlotte|US
DTW|Detroit|US; MSP|Minneapolis|US; PHL|Philadelphia|US; YYZ|Toronto|CA
YUL|Montreal|CA; YVR|Vancouver|CA; YYC|Calgary|CA; MEX|Mexiko-Stadt|MX
CUN|Cancún|MX; GRU|São Paulo|BR; GIG|Rio de Janeiro|BR; EZE|Buenos Aires|AR
SCL|Santiago de Chile|CL; LIM|Lima|PE; BOG|Bogotá|CO; UIO|Quito|EC
PTY|Panama-Stadt|PA; HAV|Havanna|CU; PUJ|Punta Cana|DO; SJO|San José|CR
MBJ|Montego Bay|JM; DXB|Dubai|AE; AUH|Abu Dhabi|AE; DOH|Doha|QA
RUH|Riad|SA; JED|Jeddah|SA; KWI|Kuwait|KW; MCT|Maskat|OM
BAH|Bahrain|BH; BKK|Bangkok|TH; HKT|Phuket|TH; SIN|Singapur|SG
KUL|Kuala Lumpur|MY; HKG|Hongkong|HK; PVG|Shanghai Pudong|CN; PEK|Peking|CN
CAN|Guangzhou|CN; NRT|Tokio Narita|JP; HND|Tokio Haneda|JP; KIX|Osaka|JP
ICN|Seoul|KR; TPE|Taipeh|TW; MNL|Manila|PH; CGK|Jakarta|ID
DPS|Bali|ID; HAN|Hanoi|VN; SGN|Ho-Chi-Minh-Stadt|VN; DEL|Delhi|IN
BOM|Mumbai|IN; BLR|Bengaluru|IN; MAA|Chennai|IN; HYD|Hyderabad|IN
CMB|Colombo|LK; MLE|Malé|MV; KTM|Kathmandu|NP; SYD|Sydney|AU
MEL|Melbourne|AU; BNE|Brisbane|AU; PER|Perth|AU; AKL|Auckland|NZ
JNB|Johannesburg|ZA; CPT|Kapstadt|ZA; NBO|Nairobi|KE; ADD|Addis Abeba|ET
LOS|Lagos|NG; ACC|Accra|GH; DKR|Dakar|SN; MRU|Mauritius|MU
SEZ|Seychellen|SC; WDH|Windhoek|NA; DAR|Daressalam|TZ; ZNZ|Sansibar|TZ
`

export interface Airport {
  iata: string
  name: string
  land: string
}

export const AIRPORTS: Record<string, Airport> = {}
// Getrennt wird an Semikolon und Zeilenumbruch – nicht am Leerzeichen:
// Flughafennamen wie „New York JFK“ enthalten selbst Leerzeichen.
for (const eintrag of ROH.split(/[;\n]/)) {
  const [iata, name, land] = eintrag.trim().split('|')
  if (iata && name && land) AIRPORTS[iata] = { iata, name, land }
}

/** Länder, die Miles & More als Kontinentalflug behandelt (Europa). */
const EUROPA = new Set([
  'DE','AT','CH','BE','NL','LU','FR','GB','IE','ES','PT','IT','DK','SE','NO','FI','IS',
  'PL','CZ','SK','HU','SI','HR','RS','BA','ME','MK','AL','XK','BG','RO','MD','UA','GR',
  'LV','LT','EE','MT','CY',
])

/**
 * Randlagen: Ziele rund ums Mittelmeer, die Lufthansa mit Kurzstreckenflotte
 * bedient. Sie werden als kontinental vorgeschlagen, aber sichtbar als
 * Grenzfall markiert, damit der Nutzer gegenprüfen kann.
 */
const GRENZFALL = new Set(['TR','IL','JO','LB','EG','MA','TN','DZ','GE','AM','AZ'])

export interface StreckenVorschlag {
  strecke: Strecke
  /** true, wenn beide Flughäfen bekannt waren */
  sicher: boolean
  grenzfall: boolean
}

/** Schlägt anhand der Flughäfen kontinental/interkontinental vor. */
export function schaetzeStrecke(von: string, nach: string): StreckenVorschlag {
  const a = AIRPORTS[von.toUpperCase()]
  const b = AIRPORTS[nach.toUpperCase()]
  if (!a || !b) {
    return { strecke: 'kontinental', sicher: false, grenzfall: false }
  }
  const beideNah = [a, b].every((f) => EUROPA.has(f.land) || GRENZFALL.has(f.land))
  const grenzfall = beideNah && [a, b].some((f) => GRENZFALL.has(f.land))
  return {
    strecke: beideNah ? 'kontinental' : 'interkontinental',
    sicher: true,
    grenzfall,
  }
}

export function airportLabel(iata: string): string {
  const f = AIRPORTS[iata.toUpperCase()]
  return f ? `${f.iata} · ${f.name}` : iata.toUpperCase()
}
