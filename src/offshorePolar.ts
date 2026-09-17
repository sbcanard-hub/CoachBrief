export type PolarTable = {
  name: string
  tws: number[]
  rows: Array<{ twa: number; speeds: number[] }>
}

function number(value: string) {
  const parsed = Number(value.trim().replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

export function parsePolarCsv(text: string, name = 'Polaire importée'): PolarTable {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 3) throw new Error('Polaire trop courte')
  const delimiter = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ','
  const header = lines[0].split(delimiter).map((cell) => cell.trim())
  const tws = header.slice(1).map(number)
  if (tws.some((value) => value == null) || tws.length < 2) throw new Error('Entête TWS invalide')
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(delimiter)
    const twa = number(cells[0])
    const speeds = cells.slice(1).map(number)
    if (twa == null || speeds.length !== tws.length || speeds.some((value) => value == null)) return null
    return { twa, speeds: speeds as number[] }
  }).filter((row): row is { twa: number; speeds: number[] } => Boolean(row))
  if (rows.length < 2) throw new Error('Lignes TWA insuffisantes')
  rows.sort((a, b) => a.twa - b.twa)
  return { name, tws: tws as number[], rows }
}

function bounds(values: number[], target: number) {
  if (target <= values[0]) return [0, 0] as const
  if (target >= values[values.length - 1]) return [values.length - 1, values.length - 1] as const
  for (let index = 0; index < values.length - 1; index += 1) {
    if (target >= values[index] && target <= values[index + 1]) return [index, index + 1] as const
  }
  return [0, 0] as const
}

function lerp(a: number, b: number, ratio: number) { return a + (b - a) * ratio }

export function minimumSailableTwa(table: PolarTable) {
  const first = table.rows[0]?.twa
  return first == null ? 0 : Math.max(0, Math.min(180, Math.abs(first)))
}

export function polarSpeed(table: PolarTable, twa: number, tws: number) {
  const angle = Math.max(0, Math.min(180, Math.abs(twa)))
  const minimumAngle = minimumSailableTwa(table)
  if (angle + 1e-9 < minimumAngle) return 0

  const wind = Math.max(0, tws)
  const angles = table.rows.map((row) => row.twa)
  const [ai, aj] = bounds(angles, angle)
  const [wi, wj] = bounds(table.tws, wind)
  const rowA = table.rows[ai]
  const rowB = table.rows[aj]
  const windRatio = wi === wj ? 0 : (wind - table.tws[wi]) / (table.tws[wj] - table.tws[wi])
  const speedA = lerp(rowA.speeds[wi], rowA.speeds[wj], windRatio)
  const speedB = lerp(rowB.speeds[wi], rowB.speeds[wj], windRatio)
  const angleRatio = ai === aj ? 0 : (angle - rowA.twa) / (rowB.twa - rowA.twa)
  return Math.max(0, lerp(speedA, speedB, angleRatio))
}

export function trueWindAngle(courseBearing: number, windFromDirection: number) {
  const delta = Math.abs((((windFromDirection - courseBearing) % 360) + 540) % 360 - 180)
  return Math.min(180, delta)
}

export const DEMO_POLAR: PolarTable = {
  name: 'Polaire de démonstration',
  tws: [6, 10, 14, 20, 28],
  rows: [
    { twa: 40, speeds: [4.2, 5.3, 6.0, 6.6, 6.8] },
    { twa: 52, speeds: [4.8, 6.1, 7.0, 7.7, 8.0] },
    { twa: 70, speeds: [5.2, 6.8, 7.9, 8.8, 9.3] },
    { twa: 90, speeds: [5.3, 7.1, 8.5, 9.7, 10.7] },
    { twa: 110, speeds: [5.1, 7.0, 8.5, 10.0, 11.5] },
    { twa: 135, speeds: [4.8, 6.6, 8.0, 9.7, 11.8] },
    { twa: 160, speeds: [4.3, 5.9, 7.2, 8.8, 10.6] },
    { twa: 180, speeds: [4.0, 5.5, 6.7, 8.2, 9.9] },
  ],
}
