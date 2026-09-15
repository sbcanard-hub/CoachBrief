import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

const required = [
  "useState<'idle' | 'loading' | 'ready' | 'error'>('idle')",
  "setMemoryWeatherState('loading')",
  "setMemoryWeatherState('ready')",
  "setMemoryWeatherState('error')",
  "memoryWeatherState === 'error'",
  "setWeatherRetry((value) => value + 1)",
]

const missing = required.filter((needle) => !source.includes(needle))
if (missing.length) {
  console.error('Loading guard incomplet. Éléments manquants:')
  for (const item of missing) console.error(`- ${item}`)
  process.exit(1)
}

console.log('OK: le panneau Prévision distingue chargement, succès et erreur, avec possibilité de relance.')
