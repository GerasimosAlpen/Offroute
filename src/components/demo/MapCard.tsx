import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { MapPin } from "lucide-preact";
import "@/lib/leaflet-setup";
import { Card } from "./Card";

export function MapCard() {
  const jakarta: [number, number] = [-6.1754, 106.8272];

  return (
    <Card
      icon={<MapPin size={14} />}
      title="React Leaflet"
      badge="map"
      badgeColor="text-green-400 border-green-500/30 bg-green-500/10"
      delay={0.55}
    >
      <p class="text-xs text-zinc-500">Interactive Leaflet maps via preact/compat.</p>
      <div class="h-40 w-full rounded-lg overflow-hidden z-0">
        <MapContainer
          center={jakarta}
          zoom={12}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={jakarta}>
            <Popup>Offroute HQ</Popup>
          </Marker>
        </MapContainer>
      </div>
    </Card>
  );
}
