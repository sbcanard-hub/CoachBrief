const date = '2026-09-17'
const latitude = '43.58'
const longitude = '7.12'
const models = ['best_match', 'icon_eu', 'ecmwf_ifs', 'ncep_gfs_global']
for (const model of models) {
  const params = new URLSearchParams({
    latitude, longitude,
    hourly: 'temperature_2m,relative_humidity_2m,dew_point_2m,pressure_msl,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    start_date: date,
    end_date: date,
    timezone: 'auto',
    wind_speed_unit: 'kn',
    models: model,
  })
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  const body = await response.text()
  console.log('\nMODEL', model, 'STATUS', response.status)
  console.log(body.slice(0, 1000))
}
