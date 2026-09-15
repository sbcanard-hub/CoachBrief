const base = 'https://api.open-meteo.com/v1/forecast'
const common = new URLSearchParams({
  latitude: '43.58',
  longitude: '7.12',
  hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
  start_date: '2026-09-16',
  end_date: '2026-09-16',
  timezone: 'auto',
  wind_speed_unit: 'kn',
})
const models = ['best_match','meteofrance_arome_france','ecmwf_ifs','icon_eu','ncep_gfs_global']
for (const model of models) {
  const params = new URLSearchParams(common)
  params.set('models', model)
  const response = await fetch(`${base}?${params}`)
  const text = await response.text()
  console.log(`${model}: HTTP ${response.status} ${response.statusText}`)
  console.log(text.slice(0, 300))
  if (!response.ok) process.exitCode = 1
}
