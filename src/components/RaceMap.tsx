import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

type ParticipantLocation = {
  id: string;
  lat: number;
  lng: number;
  username: string;
};

type RaceMapProps = {
  startLat: number;
  startLng: number;
  checkpointLat?: number | null;
  checkpointLng?: number | null;
  currentLat?: number;
  currentLng?: number;
  participants?: ParticipantLocation[];
};

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export function RaceMap({ startLat, startLng, checkpointLat, checkpointLng, currentLat, currentLng, participants = [] }: RaceMapProps) {
  const center: [number, number] = [startLat, startLng];

  const hasCheckpoint = checkpointLat !== null && checkpointLat !== undefined &&
                        checkpointLng !== null && checkpointLng !== undefined;

  const positions: [number, number][] = hasCheckpoint
    ? [
        [startLat, startLng],
        [checkpointLat, checkpointLng],
        [startLat, startLng],
      ]
    : [[startLat, startLng]];

  return (
    <div className="h-64 rounded-lg overflow-hidden border-2 border-slate-700">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapUpdater center={center} />

        <Marker position={[startLat, startLng]} />
        {hasCheckpoint && <Marker position={[checkpointLat, checkpointLng]} />}
        {currentLat && currentLng && <Marker position={[currentLat, currentLng]} />}

        {participants.map(p => (
          p.lat && p.lng && (
            <Marker key={p.id} position={[p.lat, p.lng]} />
          )
        ))}

        {positions.length > 1 && <Polyline positions={positions} color="#CEFF00" weight={3} />}
      </MapContainer>
    </div>
  );
}
