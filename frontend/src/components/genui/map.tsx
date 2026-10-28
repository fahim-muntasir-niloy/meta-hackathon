"use client";

import { defineComponent } from "@openuidev/react-lang";
import { lazy, Suspense } from "react";
import { z } from "zod";

// Leaflet reads `window` at import time, so it only loads in the browser.
const LeafletMap = lazy(() => import("./leaflet-map"));

export const MARKER_KINDS = ["farm", "officer", "weather", "place"] as const;

export type MapPoint = {
  lat: number;
  lng: number;
  label: string;
  description?: string;
  kind: (typeof MARKER_KINDS)[number];
  radiusKm?: number;
};

export const MapMarker = defineComponent({
  name: "MapMarker",
  props: z.object({
    lat: z.number(),
    lng: z.number(),
    label: z.string(),
    description: z.string().optional(),
    kind: z.enum(MARKER_KINDS).optional(),
    radiusKm: z.number().optional(),
  }),
  description:
    'One pin on a Map. lat/lng must come from a geocode_location result or the place in a get_weather result. kind: "farm" (the farmer\'s field/home), "officer" (agriculture office), "weather" (forecast location), "place" (anything else). radiusKm draws a shaded area, e.g. an outbreak zone.',
  component: () => null,
});

export const GeoMap = defineComponent({
  name: "Map",
  props: z.object({
    markers: z.array(MapMarker.ref),
    title: z.string().optional(),
    zoom: z.number().optional(),
  }),
  description:
    "Interactive map with pins. Zooms to fit all markers; zoom (5-16) only applies to a single marker (default 11).",
  component: ({ props }) => {
    // Markers stream in one field at a time; only draw the ones with coordinates.
    const points: MapPoint[] = (props.markers ?? []).flatMap(({ props: m }) =>
      Number.isFinite(m.lat) && Number.isFinite(m.lng)
        ? [{ lat: m.lat, lng: m.lng, label: m.label ?? "", description: m.description, kind: m.kind ?? "place", radiusKm: m.radiusKm }]
        : [],
    );
    return (
      <figure className="geo-map">
        {props.title && <figcaption className="geo-map-title">{props.title}</figcaption>}
        <Suspense fallback={<div className="geo-map-canvas geo-map-loading" />}>
          {points.length > 0 ? (
            <LeafletMap points={points} zoom={props.zoom ?? 11} />
          ) : (
            <div className="geo-map-canvas geo-map-loading" />
          )}
        </Suspense>
      </figure>
    );
  },
});
