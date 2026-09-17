export type ShomCurrentSource = {
  id: string
  label: string
  referencePort: string
  spatialResolution: string
  temporalResolution: string
  phaseWindow: string
  productUrl: string
}

export function shomCurrentSourceForPoint(latitude: number, longitude: number): ShomCurrentSource | null {
  if (latitude >= 48 && latitude <= 49.2 && longitude >= -3 && longitude <= -0.8) return {
    id: 'golfe-normand-breton', label: 'SHOM · Golfe Normand-Breton', referencePort: 'Saint-Malo', spatialResolution: '500 m', temporalResolution: '1 h', phaseWindow: 'PM -6 h à +6 h', productUrl: 'https://diffusion.shom.fr/atlas-de-courants-de-maree-2d-golfe-normand-breton.html',
  }
  if (latitude >= 48.2 && longitude <= -1.2) return {
    id: 'bretagne-nord', label: 'SHOM · Bretagne Nord', referencePort: 'Roscoff', spatialResolution: '250–500 m', temporalResolution: '30 min', phaseWindow: 'PM -6 h à +6 h', productUrl: 'https://diffusion.shom.fr/atlas-de-courants-de-maree-2d-bretagne-nord.html',
  }
  if (latitude >= 48.2 && longitude > -1.2 && longitude <= 2.5) return {
    id: 'manche', label: 'SHOM · Manche', referencePort: 'Cherbourg', spatialResolution: '2 km', temporalResolution: '5 min', phaseWindow: 'PM -6 h à +6 h', productUrl: 'https://diffusion.shom.fr/atlas-de-courants-de-maree-2d-manche.html',
  }
  if (latitude >= 43 && latitude <= 51.8 && longitude >= -6.5 && longitude <= 2.5) return {
    id: 'manche-atlantique', label: 'SHOM · Manche / Atlantique', referencePort: 'port de référence de l’atlas', spatialResolution: 'selon atlas', temporalResolution: 'selon atlas', phaseWindow: 'cycle semi-diurne', productUrl: 'https://diffusion.shom.fr/marees/courants-de-maree.html',
  }
  return null
}

export type ShomCurrentAvailability = {
  atlas: ShomCurrentSource | null
  directAtlasDataAvailable: boolean
  tidePredictionApiRequiresSubscription: boolean
  note: string
}

export function shomCurrentAvailability(latitude: number, longitude: number): ShomCurrentAvailability {
  const atlas = shomCurrentSourceForPoint(latitude, longitude)
  return {
    atlas,
    directAtlasDataAvailable: Boolean(atlas),
    tidePredictionApiRequiresSubscription: true,
    note: atlas
      ? 'Atlas SHOM open data identifié pour cette zone. Les champs 2D sont fournis pour morte-eau (coef. 45) et vive-eau (coef. 95) autour de la pleine mer du port de référence.'
      : 'Aucun atlas SHOM Manche/Atlantique identifié automatiquement pour ce point.',
  }
}
