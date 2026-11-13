"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useTranslation } from "@/app/components/LanguageProvider";
import { useTheme } from "@/app/components/ThemeProvider";

// Custom green brand marker (matches app brand color #18764a)
const brandColor = "#18764a";
const greenMarkerSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${brandColor}"/>
  <circle cx="12" cy="9" r="3.5" fill="white" stroke="${brandColor}" stroke-width="2"/>
</svg>
`.replace(/\s+/g, " ").trim();

const brandIcon = L.icon({
  iconUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(greenMarkerSvg)}`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -16],
});

L.Marker.prototype.options.icon = brandIcon;

const CITY_COORDINATES = {
  bavaro: [18.69, -68.42],
  "ciudad las cayenas": [18.69, -68.42],
  "punta cana": [18.58, -68.4],
  veron: [18.56, -68.37],
  higuey: [18.61, -68.71],
  "la romana": [18.43, -68.97],
  "santo domingo": [18.4861, -69.9312],
  "santiago de los caballeros": [19.45, -70.7],
  "puerto plata": [19.79, -70.69],
  "las terrenas": [19.31, -69.54],
  samana: [19.21, -69.33],
  "san pedro de macoris": [18.46, -69.3],
  bani: [18.28, -70.33],
};
const CITY_NAMES = Object.keys(CITY_COORDINATES).sort((a, b) => b.length - a.length);

function normalizedLocation(value) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function propertyCoordinates(property) {
  if (property.latitude != null && property.longitude != null) {
    return [Number(property.latitude), Number(property.longitude)];
  }
  const place = normalizedLocation(`${property.city || ""} ${property.address || ""}`);
  const city = CITY_NAMES.find((name) => place.includes(name));
  return city ? CITY_COORDINATES[city] : null;
}

// Theme-aware tile layers: OpenStreetMap (free, no API key required).
// Dark mode applies a CSS invert filter to the MapContainer so tiles look dark
// without needing a paid dark tile service.
const TILE_LAYER = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

export default function PropertyMap({ properties, center, zoom = 10, height = 320 }) {
  const { translate: t } = useTranslation();
  const { theme } = useTheme();
  const [map, setMap] = useState(null);
  const [mounted, setMounted] = useState(false);
  const mappedProperties = useMemo(
    () =>
      properties
        .map((property) => ({ property, coordinates: propertyCoordinates(property) }))
        .filter((item) => item.coordinates),
    [properties],
  );
  const initialCenter = center || mappedProperties[0]?.coordinates || [18.4861, -69.9312];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Auto-fit map bounds when properties change
  useEffect(() => {
    if (map && mounted && mappedProperties.length > 0) {
      const group = new L.featureGroup(
        mappedProperties.map(({ coordinates }) => L.marker(coordinates)),
      );
      if (group.getLayers().length > 0) {
        map.fitBounds(group.getBounds().pad(0.1));
      }
    }
  }, [map, mappedProperties, mounted]);

  const popupTextColor = theme === "dark" ? "text-gray-300" : "text-gray-600";

  if (!mounted) {
    return (
      <div
        className="w-full animate-pulse rounded-lg"
        style={{
          height,
          backgroundColor: theme === "dark" ? "#1e2933" : "#e5e7eb",
        }}
      />
    );
  }

  return (
    <div className="w-full rounded-lg border" style={{ height }}>
      <MapContainer
        center={initialCenter}
        zoom={zoom}
        whenCreated={(m) => setMap(m)}
        className={theme === "dark" ? "map-dark" : ""}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url={TILE_LAYER.url} attribution={TILE_LAYER.attribution} />
        {mappedProperties.map(({ property: p, coordinates }) => (
          <Marker key={p.id} position={coordinates}>
            <Popup>
              <div className="p-2">
                <h3 className={`font-bold ${popupTextColor}`}>{p.title}</h3>
                <p className={`text-sm ${popupTextColor}`}>
                  {p.city}, {p.province}
                </p>
                {p.price && (
                  <p className="font-bold">
                    {p.currency} {p.price.toLocaleString()}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
