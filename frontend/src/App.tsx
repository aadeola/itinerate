import { useState } from "react";
import { Button } from "@/components/ui/button";
import TripForm from "./components/TripForm";
import TimelineView from "./components/TimelineView";
import ScreenshotInfer from "./components/ScreenshotInfer";
import ScrapbooksView from "./components/ScrapbooksView";
import { useTheme } from "./hooks/use-theme";
import { planItinerary } from "./api";
import type { ActivityInput, Itinerary, TripRequest } from "./types";

type View = "plan" | "screenshot" | "scrapbooks";

const DEFAULT_REQUEST: Omit<TripRequest, "activities"> = {
  city: "",
  days: 3,
  startTime: "09:00",
  endTime: "18:00",
};

export default function App() {
  const { dark, toggle } = useTheme();
  const [view, setView] = useState<View>("plan");
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [lastRequest, setLastRequest] = useState<TripRequest | null>(null);
  const [seededRequest, setSeededRequest] = useState<TripRequest | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (request: TripRequest) => {
    setLoading(true);
    setError(null);
    setLastRequest(request);
    setSeededRequest(null);
    try {
      const result = await planItinerary(request);
      setItinerary(result);
      setLastRequest({ ...request, city: result.city });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddActivity = (activity: ActivityInput) => {
    const base = seededRequest ?? lastRequest;
    const next: TripRequest = base
      ? { ...base, activities: [...base.activities, activity] }
      : { ...DEFAULT_REQUEST, activities: [activity] };
    setSeededRequest(next);
    setFormKey((k) => k + 1);
    setView("plan");
  };

  const edit = () => {
    setItinerary(null);
    setError(null);
  };

  const reset = () => {
    setItinerary(null);
    setLastRequest(null);
    setSeededRequest(null);
    setError(null);
    setView("plan");
    setFormKey((k) => k + 1);
  };

  const initialValues = seededRequest ?? lastRequest ?? undefined;

  return (
    <div className="relative min-h-screen bg-background px-4 py-10 sm:px-6 sm:py-16">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={toggle}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6"
      >
        {dark ? (
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="10" cy="10" r="4" />
            <path d="M10 2v2M10 16v2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M2 10h2M16 10h2M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z" />
            <path d="M10 1v2M10 17v2M3 10H1M19 10h-2" />
          </svg>
        )}
        <span className="hidden sm:inline">{dark ? "Light" : "Dark"}</span>
      </Button>

      <div className="mx-auto w-full max-w-6xl">
        {!itinerary && (
          <header className="mb-10 text-center">
            <div className="badge-pill mx-auto w-fit">Itinerate</div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {view === "scrapbooks"
                ? "Build a visual scrapbook of your trip"
                : "Plan the perfect order for your trip"}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
              {view === "scrapbooks"
                ? "Create scrapbooks for different trips or themes, then upload batches of photos to save your favorite moments."
                : "Tell us the city, your days, and what you want to see. AI resolves each activity's location and sorts them into a smart, easy-to-follow timeline."}
            </p>

            <div className="tab-group mt-8">
              <button
                type="button"
                onClick={() => setView("plan")}
                className={`tab-trigger ${view === "plan" ? "tab-trigger-active" : ""}`}
              >
                Plan trip
              </button>
              <button
                type="button"
                onClick={() => setView("screenshot")}
                className={`tab-trigger ${view === "screenshot" ? "tab-trigger-active" : ""}`}
              >
                Add from screenshot
              </button>
              <button
                type="button"
                onClick={() => setView("scrapbooks")}
                className={`tab-trigger ${view === "scrapbooks" ? "tab-trigger-active" : ""}`}
              >
                Scrapbooks
              </button>
            </div>
          </header>
        )}

        <main className="card-panel card-panel-lg">
          {itinerary ? (
            <TimelineView itinerary={itinerary} onEdit={edit} onReset={reset} />
          ) : view === "screenshot" ? (
            <ScreenshotInfer onAddActivity={handleAddActivity} />
          ) : view === "scrapbooks" ? (
            <ScrapbooksView />
          ) : (
            <>
              {error && <p className="alert-panel mb-5">{error}</p>}
              <TripForm
                key={formKey}
                onSubmit={handleSubmit}
                loading={loading}
                initialValues={initialValues}
              />
            </>
          )}
        </main>

        {!itinerary && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {view === "scrapbooks"
              ? "Scrapbooks are saved on the server so your photos persist between visits."
              : "Planning uses an AI model to infer each activity's neighborhood and build a geographically sensible schedule."}
          </p>
        )}
      </div>
    </div>
  );
}
