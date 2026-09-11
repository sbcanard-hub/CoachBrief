import { exportCoachBriefData, importCoachBriefData } from './savedBriefings'
import type { CoachBriefImportResult } from './savedBriefings'
import { loadKnowledgePreferences, saveKnowledgePreferences } from './knowledgePreferences'
import type { KnowledgePreferences } from './knowledgePreferences'

export type CoachBriefPortableBundle = {
  format: 'coachbrief-portable'
  version: 1
  exportedAt: string
  data: ReturnType<typeof exportCoachBriefData>
  knowledgePreferences: KnowledgePreferences
}

function isPortableBundle(value: unknown): value is CoachBriefPortableBundle {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CoachBriefPortableBundle>
  return candidate.format === 'coachbrief-portable'
    && candidate.version === 1
    && typeof candidate.exportedAt === 'string'
    && Boolean(candidate.data)
    && Boolean(candidate.knowledgePreferences)
}

export function exportPortableCoachBriefData(): CoachBriefPortableBundle {
  return {
    format: 'coachbrief-portable',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: exportCoachBriefData(),
    knowledgePreferences: loadKnowledgePreferences(),
  }
}

export function portableCoachBriefDataToJson() {
  return JSON.stringify(exportPortableCoachBriefData(), null, 2)
}

export function importPortableCoachBriefData(text: string, mode: 'merge' | 'replace' = 'merge'): CoachBriefImportResult {
  const parsed = JSON.parse(text) as unknown
  if (!isPortableBundle(parsed)) {
    return importCoachBriefData(text, mode)
  }
  const result = importCoachBriefData(JSON.stringify(parsed.data), mode)
  saveKnowledgePreferences(parsed.knowledgePreferences)
  return result
}
