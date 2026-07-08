import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import ItineraryMap from "./ItineraryMap";
import { geocodeItinerary } from "../api";
import type { GeocodedItinerary, Itinerary, ScheduledActivity } from "../types";
import timelineStyles from "./TimelineView.module.css";

interface TimelineViewProps {
  itinerary: Itinerary;
  onEdit: () => void;
  onReset: () => void;
}

const markerStyles = [
  "bg-primary text-primary-foreground",
  "bg-foreground text-background",
  "bg-accent text-accent-foreground",
  "bg-muted text-foreground",
  "bg-secondary text-secondary-foreground",
];

function durationLabel(item: ScheduledActivity): string {
  const [sh, sm] = item.startTime.split(":").map(Number);
  const [eh, em] = item.endTime.split(":").map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return [hours ? `${hours}h` : "", mins ? `${mins}m` : ""].join(" ").trim();
}

export default function TimelineView({ itinerary, onEdit, onReset }: TimelineViewProps) {
  const [activeDay, setActiveDay] = useState(itinerary.days[0]?.dayNumber ?? 1);
  const [mapVisible, setMapVisible] = useState(false);
  const [geocodedItinerary, setGeocodedItinerary] = useState<GeocodedItinerary | null>(null);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const day =
    itinerary.days.find((d) => d.dayNumber === activeDay) ?? itinerary.days[0];

  const geocodedDay =
    geocodedItinerary?.days.find((d) => d.dayNumber === activeDay) ?? null;

  useEffect(() => {
    setGeocodedItinerary(null);
    setGeocodeError(null);
    setGeocodeLoading(false);
    setMapVisible(false);
  }, [itinerary]);

  const handleToggleMap = async () => {
    if (mapVisible) {
      setMapVisible(false);
      return;
    }

    setMapVisible(true);

    if (geocodedItinerary || geocodeLoading) {
      return;
    }

    setGeocodeLoading(true);
    setGeocodeError(null);
    try {
      const result = await geocodeItinerary(itinerary);
      setGeocodedItinerary(result);
    } catch (e) {
      setGeocodeError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setGeocodeLoading(false);
    }
  };

  return (
    <div className={`${timelineStyles.root} animate-float-in`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Your itinerary
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {itinerary.city}
          </h1>
          {itinerary.summary && (
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">{itinerary.summary}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <Button variant="outline" onClick={onEdit}>
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 14.5V16h1.5L14 7.5 12.5 6 4 14.5zM12 4l2 2" />
            </svg>
            Edit
          </Button>
          <Button variant="outline" onClick={onReset}>
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 10a6 6 0 1 1 1.8 4.3M4 10V6m0 4h4" />
            </svg>
            Start over
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {itinerary.days.map((d) => {
          const active = d.dayNumber === day.dayNumber;
          return (
            <button
              key={d.dayNumber}
              type="button"
              onClick={() => setActiveDay(d.dayNumber)}
              className={`tab-trigger-pill ${active ? "tab-trigger-pill-active" : ""}`}
            >
              Day {d.dayNumber}
              <span
                className={
                  "ml-2 rounded-full px-2 py-0.5 text-xs " +
                  (active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground")
                }
              >
                {d.items.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <Button variant="outline" type="button" onClick={() => void handleToggleMap()}>
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6.5 10 2l7 4.5V14l-7 4-7-4V6.5Z" />
            <path d="M10 11.5 17 7M10 11.5 3 7M10 11.5V19" />
          </svg>
          {mapVisible ? "Hide map" : "Show map"}
        </Button>
      </div>

      {mapVisible && (
        <div className="mt-4">
          <ItineraryMap
            city={itinerary.city}
            items={geocodedDay?.items ?? day.items.map((item) => ({
              ...item,
              latitude: null,
              longitude: null,
              mapsUrl: null,
            }))}
            loading={geocodeLoading}
            error={geocodeError}
            geocodingError={geocodedItinerary?.geocodingError ?? null}
          />
        </div>
      )}

      <div className="mt-8">
        {day.items.length === 0 ? (
          <p className="card-panel px-[var(--spacing-card)] py-8 text-center text-sm text-muted-foreground">
            Nothing scheduled for this day.
          </p>
        ) : (
          <ol className="relative ml-3 space-y-4 border-l border-border pl-8">
            {day.items.map((item, index) => (
              <li key={index} className="relative animate-float-in">
                <span
                  className={
                    "absolute -left-[37px] top-1.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold shadow-sm " +
                    markerStyles[index % markerStyles.length]
                  }
                >
                  {index + 1}
                </span>

                <div className="card-panel card-panel-interactive p-[var(--spacing-card)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 rounded-md bg-primary px-[var(--spacing-input-x)] py-[calc(var(--spacing-input-y)*0.5)] font-mono text-xs font-medium text-primary-foreground">
                      {item.startTime}
                      <span className="text-primary-foreground/60">-</span>
                      {item.endTime}
                    </div>
                    {durationLabel(item) && (
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {durationLabel(item)}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-lg font-semibold text-foreground">
                    {item.name}
                  </h3>

                  {item.location && (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <svg
                        viewBox="0 0 20 20"
                        className="h-4 w-4 text-muted-foreground/70"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18s6-5.686 6-10A6 6 0 1 0 4 8c0 4.314 6 10 6 10zm0-7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {item.location}
                    </p>
                  )}

                  {item.reason && (
                    <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                      {item.reason}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
