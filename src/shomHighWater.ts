export type ShomHighWaterSchedules = Record<string, Date[]>

export const SHOM_REFERENCE_PORTS = [
  { atlasId: 'golfe-normand-breton', port: 'Saint-Malo' },
  { atlasId: 'bretagne-nord', port: 'Roscoff' },
  { atlasId: 'manche', port: 'Cherbourg' },
] as const

export function parseHighWaterLines(value: string): Date[] {
  return value
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => new Date(item))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
}

export function nearestHighWater(values: Date[] | undefined, target: Date): Date | null {
  if (!values?.length || !Number.isFinite(target.getTime())) return null
  return values.reduce<Date | null>((best, value) => {
    if (!Number.isFinite(value.getTime())) return best
    if (!best) return value
    return Math.abs(value.getTime() - target.getTime()) < Math.abs(best.getTime() - target.getTime()) ? value : best
  }, null)
}
