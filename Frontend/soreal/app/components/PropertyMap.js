"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useTranslation } from "@/app/components/LanguageProvider";

// Fix default marker icon
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

const CITY_COORDINATES = {
  "bavaro": [18.69, -68.42],
  "ciudad las cayenas": [18.69, -68.42],
  "punta cana": [18.58, -68.4],
  "veron": [18.56, -68.37],
  "higuey": [18.61, -68.71],
  "la romana": [18.43, -68.97],
  "santo domingo": [18.4861, -69.9312],
  "santiago de los caballeros": [19.45, -70.7],
  "puerto plata": [19.79, -70.69],
  "las terrenas": [19.31, -69.54],
  "samana": [19.21, -69.33],
  "san pedro de macoris": [18.46, -69.3],
  "bani": [18.28, -70.33],
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

export default function PropertyMap({ properties, center, zoom = 10, height = 320 }) {
  const { translate: t } = useTranslation();
  const [map, setMap] = useState(null);
  const [mounted, setMounted] = useState(false);
  const mappedProperties = useMemo(
    () => properties
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
        mappedProperties.map(({ coordinates }) => L.marker(coordinates))
      );
      if (group.getLayers().length > 0) {
        map.fitBounds(group.getBounds().pad(0.1));
      }
    }
  }, [map, mappedProperties, mounted]);

  if (!mounted) {
    return (
      <div
        className="w-full animate-pulse rounded-lg bg-gray-200"
        style={{ height }}
      />
    );
  }

  return (
    <div className="w-full rounded-lg border" style={{ height }}>
      <MapContainer
        center={initialCenter}
        zoom={zoom}
        whenCreated={(m) => setMap(m)}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mappedProperties.map(({ property: p, coordinates }) => (
            <Marker
              key={p.id}
              position={coordinates}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold">{p.title}</h3>
                  <p className="text-sm text-gray-600">
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
