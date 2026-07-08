import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { GeocodedScheduledActivity } from "../types";

interface ItineraryMapProps {
  city: string;
  items: GeocodedScheduledActivity[];
  loading: boolean;
  error: string | null;
  geocodingError: string | null;
}

const MARKER_COLORS = [
  "hsl(32 95% 44%)",
  "hsl(220 15% 20%)",
  "hsl(32 90% 90%)",
  "hsl(220 10% 90%)",
  "hsl(220 10% 96%)",
];

function numberedIcon(index: number) {
  const color = MARKER_COLORS[index % MARKER_COLORS.length];
  const textColor = index % MARKER_COLORS.length === 2 || index % MARKER_COLORS.length === 4
    ? "hsl(220 15% 20%)"
    : "#fff";

  return L.divIcon({
    className: "",
    html: `<div style="
      width: 28px;
      height: 28px;
      border-radius: 9999px;
      background: ${color};
      color: ${textColor};
      display: grid;
      place-items: center;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
      border: 2px solid #fff;
    ">${index + 1}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 0) {
      return;
    }
    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] });
  }, [map, positions]);

  return null;
}

function geocodedItems(items: GeocodedScheduledActivity[]) {
  return items.filter(
    (item) =>
      item.latitude != null &&
      item.longitude != null &&
      Number.isFinite(item.latitude) &&
      Number.isFinite(item.longitude),
  );
}

export default function ItineraryMap({ city, items, loading, error, geocodingError }: ItineraryMapProps) {
  const mapped = useMemo(() => geocodedItems(items), [items]);
  const positions = useMemo(
    () =>
      mapped.map(
        (item) => [item.latitude!, item.longitude!] as [number, number],
      ),
    [mapped],
  );
  const polyline = positions.length >= 2 ? positions : [];
  const unmappedCount = items.length - mapped.length;

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-border bg-muted/40 sm:h-[400px]">
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert-panel h-80 content-center sm:h-[400px]">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 sm:h-[400px]">
        <p className="text-sm text-muted-foreground">Nothing scheduled for this day.</p>
      </div>
    );
  }

  if (mapped.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 sm:h-[400px]">
        <p className="max-w-md px-6 text-center text-sm text-muted-foreground">
          {geocodingError ??
            `Could not map any stops for this day in ${city}. Try editing activity locations and rebuilding your itinerary.`}
        </p>
      </div>
    );
  }

  const defaultCenter = positions[0];

  return (
    <div className="space-y-2">
      {unmappedCount > 0 && (
        <p className="text-sm text-muted-foreground">
          Could not map {unmappedCount} {unmappedCount === 1 ? "stop" : "stops"} on this day.
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-border shadow-sm">
        <MapContainer
          center={defaultCenter}
          zoom={13}
          scrollWheelZoom
          className="h-80 w-full sm:h-[400px]"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds positions={positions} />
          {polyline.length >= 2 && (
            <Polyline
              positions={polyline}
              pathOptions={{ color: "hsl(32 95% 44%)", weight: 3, opacity: 0.75 }}
            />
          )}
          {mapped.map((item, index) => (
            <Marker
              key={`${item.name}-${item.startTime}-${index}`}
              position={[item.latitude!, item.longitude!]}
              icon={numberedIcon(index)}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{item.name}</p>
                  {item.location && <p>{item.location}</p>}
                  <p className="mt-1 font-mono text-xs">
                    {item.startTime} – {item.endTime}
                  </p>
                  {item.mapsUrl && (
                    <a
                      href={item.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs font-medium underline"
                    >
                      Open in Google Maps
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
