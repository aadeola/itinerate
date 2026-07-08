import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActivityInput, TripRequest } from "../types";

interface ActivityRow {
  id: number;
  name: string;
  location: string;
  duration: string;
  notes: string;
  showLocation: boolean;
}

interface TripFormProps {
  onSubmit: (request: TripRequest) => void;
  loading: boolean;
  initialValues?: TripRequest;
}

let nextId = 1;
const newRow = (): ActivityRow => ({
  id: nextId++,
  name: "",
  location: "",
  duration: "",
  notes: "",
  showLocation: false,
});

function minutesToHoursString(minutes: number): string {
  const quarters = Math.round(minutes / 15);
  return String(quarters / 4);
}

function isQuarterHourIncrement(hours: number): boolean {
  const quarters = hours * 4;
  return Math.abs(quarters - Math.round(quarters)) < 1e-9;
}

function getDurationHoursError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const hours = parseFloat(trimmed);
  if (!Number.isFinite(hours) || hours <= 0) {
    return "Enter a positive duration in hours.";
  }
  if (!isQuarterHourIncrement(hours)) {
    return "Duration must use 15-minute increments (e.g. 1, 1.25, 1.5, 1.75 hours).";
  }
  return null;
}

function rowsFromActivities(activities: ActivityInput[]): ActivityRow[] {
  if (activities.length === 0) {
    return [newRow(), newRow(), newRow()];
  }
  return activities.map((activity) => ({
    id: nextId++,
    name: activity.name,
    location: activity.location ?? "",
    duration: activity.durationMinutes
      ? minutesToHoursString(activity.durationMinutes)
      : "",
    notes: activity.notes ?? "",
    showLocation: Boolean(activity.location?.trim()),
  }));
}

export default function TripForm({ onSubmit, loading, initialValues }: TripFormProps) {
  const [city, setCity] = useState(initialValues?.city ?? "");
  const [days, setDays] = useState(initialValues?.days ?? 3);
  const [startTime, setStartTime] = useState(initialValues?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(initialValues?.endTime ?? "18:00");
  const [rows, setRows] = useState<ActivityRow[]>(() =>
    initialValues ? rowsFromActivities(initialValues.activities) : [newRow(), newRow(), newRow()],
  );
  const [error, setError] = useState<string | null>(null);
  const [durationErrors, setDurationErrors] = useState<Record<number, string>>({});

  const updateRow = (id: number, patch: Partial<ActivityRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const validateDuration = (id: number, value: string) => {
    const message = getDurationHoursError(value);
    setDurationErrors((prev) => {
      const next = { ...prev };
      if (message) {
        next[id] = message;
      } else {
        delete next[id];
      }
      return next;
    });
    return message === null;
  };

  const addRow = () => setRows((prev) => [...prev, newRow()]);

  const removeRow = (id: number) => {
    setDurationErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!city.trim()) {
      setError("Please enter a city.");
      return;
    }
    if (endTime <= startTime) {
      setError("End time must be after start time.");
      return;
    }

    const nextDurationErrors: Record<number, string> = {};
    let hasDurationError = false;

    for (const row of rows) {
      if (!row.name.trim() || !row.duration.trim()) {
        continue;
      }
      const message = getDurationHoursError(row.duration);
      if (message) {
        nextDurationErrors[row.id] = message;
        hasDurationError = true;
      }
    }

    if (hasDurationError) {
      setDurationErrors(nextDurationErrors);
      setError("Fix activity durations before continuing.");
      return;
    }

    const activities = rows
      .filter((r) => r.name.trim())
      .map((r) => {
        const hours = parseFloat(r.duration);
        return {
          name: r.name.trim(),
          location: r.location.trim() || undefined,
          durationMinutes:
            Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : undefined,
          notes: r.notes.trim() || undefined,
        };
      });

    if (activities.length === 0) {
      setError("Add at least one activity with a name.");
      return;
    }

    onSubmit({ city: city.trim(), days, startTime, endTime, activities });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="city">Which city are you exploring?</Label>
          <Input
            id="city"
            placeholder="e.g. Kyoto, Lisbon, Mexico City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            autoFocus={!initialValues}
          />
        </div>

        <div>
          <Label htmlFor="days">Days</Label>
          <Input
            id="days"
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(e) =>
              setDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="start">Day starts</Label>
            <Input
              id="start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="end">Day ends</Label>
            <Input
              id="end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-foreground">
            What do you want to do?
          </h2>
          <span className="text-sm text-muted-foreground">
            We infer location unless you add one
          </span>
        </div>

        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="rounded-lg border border-border bg-muted/50 p-3 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="flex-1">
                  <Input
                    placeholder={`Activity ${index + 1} — e.g. Visit the old town`}
                    value={row.name}
                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                  />
                </div>
                <div className="flex items-start gap-2">
                  <div className="sm:w-32">
                    <Input
                      className={durationErrors[row.id] ? "border-ring focus-visible:ring-ring/30" : ""}
                      type="text"
                      inputMode="decimal"
                      placeholder="Hrs"
                      aria-invalid={Boolean(durationErrors[row.id])}
                      aria-describedby={
                        durationErrors[row.id] ? `duration-error-${row.id}` : undefined
                      }
                      value={row.duration}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateRow(row.id, { duration: value });
                        if (durationErrors[row.id]) {
                          validateDuration(row.id, value);
                        }
                      }}
                      onBlur={() => validateDuration(row.id, row.duration)}
                    />
                    {durationErrors[row.id] && (
                      <p
                        id={`duration-error-${row.id}`}
                        className="mt-1.5 text-xs font-medium text-muted-foreground"
                        role="alert"
                      >
                        {durationErrors[row.id]}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="iconRemove"
                    size="icon"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length === 1}
                    aria-label="Remove activity"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    >
                      <path d="M6 6l8 8M14 6l-8 8" />
                    </svg>
                  </Button>
                </div>
              </div>
              {row.showLocation ? (
                <div className="mt-3 flex items-center gap-2">
                  <Input
                    placeholder="Area hint — e.g. Montmartre, Shibuya"
                    value={row.location}
                    onChange={(e) =>
                      updateRow(row.id, { location: e.target.value })
                    }
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="iconRemove"
                    size="icon"
                    onClick={() =>
                      updateRow(row.id, { location: "", showLocation: false })
                    }
                    aria-label="Remove location"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    >
                      <path d="M6 6l8 8M14 6l-8 8" />
                    </svg>
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => updateRow(row.id, { showLocation: true })}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  >
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                  Add location
                </button>
              )}
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          className="mt-3 px-0"
          onClick={addRow}
        >
          <svg
            viewBox="0 0 20 20"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M10 4v12M4 10h12" />
          </svg>
          Add another activity
        </Button>
      </div>

      {error && <p className="alert-panel">{error}</p>}

      <Button type="submit" size="lg" disabled={loading} className="w-full">
        {loading
          ? "Planning your days..."
          : initialValues
            ? "Update my itinerary"
            : "Build my itinerary"}
      </Button>
    </form>
  );
}
