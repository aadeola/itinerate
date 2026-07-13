import { useCallback, useEffect, useState } from "react";
import {
  deleteSavedItinerary,
  getSavedItinerary,
  listSavedItineraries,
} from "../api";
import type { Itinerary, SavedItinerarySummary } from "../types";

interface SavedItinerariesViewProps {
  onOpen: (itinerary: Itinerary) => void;
}

export default function SavedItinerariesView({ onOpen }: SavedItinerariesViewProps) {
  const [entries, setEntries] = useState<SavedItinerarySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refreshList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSavedItineraries();
      setEntries(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const handleOpen = async (id: number) => {
    setBusyId(id);
    setError(null);
    try {
      const detail = await getSavedItinerary(id);
      onOpen(detail.itinerary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open itinerary.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setBusyId(id);
    setError(null);
    try {
      await deleteSavedItinerary(id);
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete itinerary.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading saved itineraries...</p>
    );
  }

  return (
    <div className="animate-float-in">
      {error && (
        <div
          className="mb-4 rounded-[20px] border border-[#e6c6c6] px-4 py-3 text-[13px] text-[#8a3333]"
          style={{ backgroundColor: "#faf2f2", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
        >
          {error}
        </div>
      )}

      {entries.length === 0 ? (
        <div
          className="rounded-[20px] border border-[#e6e6e6] px-4 py-3 text-[13px] text-[#333333]"
          style={{ backgroundColor: "#f6f6f6", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
        >
          No saved itineraries yet. Build a trip and hit Save itinerary to keep it here.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-[20px] border border-[#e6e6e6] px-4 py-3 text-[13px] text-[#333333]"
              style={{ backgroundColor: "#f6f6f6", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1a1a1a]">
                    {entry.city}
                  </h3>
                  {entry.summary && (
                    <p className="mt-1 max-w-xl text-[#555555]">{entry.summary}</p>
                  )}
                  <p className="mt-1 text-[#777777]">
                    {entry.dayCount} {entry.dayCount === 1 ? "day" : "days"} ·
                    saved {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => void handleOpen(entry.id)}
                    disabled={busyId === entry.id}
                    className="inline-flex shrink-0 items-center gap-[5px] border border-[#e4e4e7] bg-[#fefefe] px-[15px] py-[9px] text-[13px] font-medium text-[#1a1a1a] transition hover:bg-[#f0f0f0] focus:outline focus:outline-2 focus:outline-[#cccccc] disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ borderRadius: "11px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(entry.id)}
                    disabled={busyId === entry.id}
                    className="inline-flex shrink-0 items-center gap-[5px] border border-[#e0e0e0] bg-[#f5f5f5] px-[15px] py-[9px] text-[13px] font-medium text-[#333333] transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ borderRadius: "11px", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
