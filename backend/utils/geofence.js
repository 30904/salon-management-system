const EARTH_RADIUS_METERS = 6371000;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function distanceMeters(lat1, lon1, lat2, lon2) {
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export function isWithinRadius(latitude, longitude, centerLat, centerLon, radiusMeters) {
  const distance = distanceMeters(latitude, longitude, centerLat, centerLon);
  return distance <= radiusMeters;
}
