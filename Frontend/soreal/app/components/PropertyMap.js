"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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

export default function PropertyMap({ properties, center = [18.4861, -69.9312], zoom = 10 }) {
  const { t } = useTranslation();
  const [map, setMap] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-fit map bounds when properties change
  useEffect(() => {
    if (map && mounted && properties.length > 0) {
      const group = new L.featureGroup(
        properties
          .filter((p) => p.latitude && p.longitude)
          .map((p) => L.marker([p.latitude, p.longitude]))
      );
      if (group.getLayers().length > 0) {
        map.fitBounds(group.getBounds().pad(0.1));
      }
    }
  }, [map, mounted, properties]);

  if (!mounted) {
    return <div className="w-full h-[400px] bg-gray-200 rounded-lg animate-pulse" />;
  }

  return (
    <div className="w-full h-[400px] rounded-lg border">
      <MapContainer
        center={center}
        zoom={zoom}
        whenCreated={(m) => setMap(m)}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {properties
          .filter((p) => p.latitude && p.longitude)
          .map((p) => (
            <Marker
              key={p.id}
              position={[p.latitude, p.longitude]}
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
