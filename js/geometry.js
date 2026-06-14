// geometry.js – Stabile Version für korrekte Kategorien-Zuordnung

"use strict";

// Schließt Polygon zuverlässig für Turf.js
function closeRing(coords) {
  if (!Array.isArray(coords) || coords.length < 3) return coords;
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (Math.abs(first[0] - last[0]) > 1e-8 || Math.abs(first[1] - last[1]) > 1e-8) {
    return [...coords, first];
  }
  return coords;
}

export function parseWKT(wktString) {
  if (!wktString || typeof wktString !== "string" || wktString.includes("...")) {
    return [];
  }

  try {
    const cleaned = wktString.replace('POLYGON((', '').replace('))', '').trim();
    const pairs = cleaned.split(',');
    const coords = [];

    for (let pair of pairs) {
      const trimmed = pair.trim();
      if (!trimmed) continue;
      const [lng, lat] = trimmed.split(/\s+/).map(Number);
      if (!isNaN(lng) && !isNaN(lat)) {
        coords.push([lng, lat]);   // Turf: [lng, lat]
      }
    }
    return coords;
  } catch (e) {
    console.error("WKT Parsing Fehler:", e);
    return [];
  }
}

export function isPointInPolygonTurf(point, polygonCoords) {
  if (!polygonCoords || polygonCoords.length < 3) return false;
  try {
    const closed = closeRing(polygonCoords);
    const pt = turf.point([point[1], point[0]]); // [lat, lng] → [lng, lat]
    const poly = turf.polygon([closed]);
    return turf.booleanPointInPolygon(pt, poly);
  } catch (e) {
    console.warn("PointInPolygon Fehler:", e.message);
    return false;
  }
}

export function isLineInPolygonTurf(line, polygonCoords) {
  if (!polygonCoords || polygonCoords.length < 3 || !line || line.length < 2) return false;
  try {
    const closed = closeRing(polygonCoords);
    const lineCoords = line
      .filter(p => typeof p?.x === 'number' && typeof p?.y === 'number')
      .map(p => [p.x, p.y]);

    if (lineCoords.length < 2) return false;

    const lineString = turf.lineString(lineCoords);
    const poly = turf.polygon([closed]);

    return turf.booleanIntersects(lineString, poly) || 
           turf.booleanContains(poly, lineString);
  } catch (e) {
    console.warn("LineInPolygon Fehler:", e.message);
    return false;
  }
}