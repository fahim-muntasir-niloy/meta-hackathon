"use client";

import "leaflet/dist/leaflet.css";
import { latLng, latLngBounds } from "leaflet";
import { ExternalLink } from "lucide-react";
import { Fragment, useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { MapPoint } from "./map";

const KIND_COLORS: Record<MapPoint["kind"], string> = {
  farm: "#1f7a4d",
  officer: "#2563eb",
  weather: "#d97706",
  place: "#6b7280",
};

/** Re-fits as markers stream in; MapContainer's own center/zoom are only read on mount. */
function FitView({ points, zoom }: { points: MapPoint[]; zoom: number }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat},${p.lng},${p.radiusKm ?? 0}`).join("|");
  useEffect(() => {
    if (points.length === 1 && !points[0].radiusKm) {
      map.setView([points[0].lat, points[0].lng], zoom);
      return;
    }
    const bounds = latLngBounds(points.map((p) => [p.lat, p.lng]));
    for (const p of points) if (p.radiusKm) bounds.extend(latLng(p.lat, p.lng).toBounds(p.radiusKm * 2000));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the points
  }, [map, key, zoom]);
  return null;
}

export default function LeafletMap({ points, zoom }: { points: MapPoint[]; zoom: number }) {
  const first = points[0];
  // Labels stay readable as permanent tooltips until the map gets crowded.
  const permanentLabels = points.length <= 4;

  return (
    <>
      <MapContainer
        className="geo-map-canvas"
        center={[first.lat, first.lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        attributionControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {points.map((p, i) => {
          const color = KIND_COLORS[p.kind];
          return (
            <Fragment key={i}>
              {p.radiusKm ? (
                <Circle
                  center={[p.lat, p.lng]}
                  radius={p.radiusKm * 1000}
                  pathOptions={{ color, weight: 1, fillOpacity: 0.12 }}
                />
              ) : null}
              <CircleMarker
                center={[p.lat, p.lng]}
                radius={9}
                pathOptions={{ color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }}
              >
                {p.label && (
                  <Tooltip direction="top" offset={[0, -8]} permanent={permanentLabels}>
                    {p.label}
                  </Tooltip>
                )}
                {p.description && <Popup>{p.description}</Popup>}
              </CircleMarker>
            </Fragment>
          );
        })}
        <FitView points={points} zoom={zoom} />
      </MapContainer>
      <a
        className="geo-map-link"
        href={`https://www.google.com/maps/search/?api=1&query=${first.lat},${first.lng}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        গুগল ম্যাপে খুলুন <ExternalLink size={13} />
      </a>
    </>
  );
}
