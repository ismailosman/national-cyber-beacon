import type { AlertWithOrg } from '@/hooks/useAlerts';

// [lng, lat] — Mapbox coordinate order
export const REGION_COORDS: Record<string, [number, number]> = {
  Banaadir:     [45.34, 2.05],
  Puntland:     [49.0,  8.4],
  Somaliland:   [44.06, 9.56],
  Jubaland:     [42.55, 0.35],
  'South West': [43.4,  2.6],
  Hirshabelle:  [45.9,  3.1],
  Galmudug:     [47.2,  5.5],
};

export function getAlertCoords(alert: AlertWithOrg): [number, number] | null {
  const org = alert.organizations;
  if (!org) return null;
  // Prefer precise org coordinates
  if (org.lat != null && org.lng != null) return [org.lng, org.lat];
  // Fall back to region centroid
  const regional = REGION_COORDS[org.region];
  if (regional) return regional;
  return null; // Skip — no location available
}

export function alertsToGeoJSON(alerts: AlertWithOrg[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const alert of alerts) {
    const coords = getAlertCoords(alert);
    if (!coords) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: coords },
      properties: {
        id: alert.id,
        title: alert.title,
        severity: alert.severity,
        status: alert.status,
        orgName: alert.organizations?.name ?? 'Unknown',
        region: alert.organizations?.region ?? '',
        sector: alert.organizations?.sector ?? '',
        createdAt: alert.created_at,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}
