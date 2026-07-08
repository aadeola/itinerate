import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { inferActivityFromImage } from "../api";
import type { ActivityInput, VisionInferResponse } from "../types";

interface ScreenshotInferProps {
  onAddActivity: (activity: ActivityInput) => void;
}

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });
}

export default function ScreenshotInfer({ onAddActivity }: ScreenshotInferProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VisionInferResponse | null>(null);
  const [added, setAdded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = (next: File | null) => {
    setError(null);
    setResult(null);
    setAdded(false);
    if (!next) {
      return;
    }
    if (!next.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setError("That image is larger than 8 MB. Please choose a smaller one.");
      return;
    }
    setFile(next);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(next);
    });
  };

  const handleInfer = async () => {
    if (!file) {
      setError("Choose a screenshot first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setAdded(false);
    try {
      const base64 = await fileToBase64(file);
      const response = await inferActivityFromImage(base64, file.type);
      setResult(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (!result) return;
    const { activity, place } = result;
    const name = activity.name?.trim() || place?.name?.trim() || "New activity";
    const location =
      place?.name?.trim() ||
      place?.address?.trim() ||
      activity.locationQuery?.trim() ||
      undefined;
    onAddActivity({
      name,
      location,
      notes: activity.description?.trim() || undefined,
    });
    setAdded(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Add from a screenshot</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a photo or screenshot and we'll infer the place, then look it up on Google Maps.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          acceptFile(e.dataTransfer.files?.[0] ?? null);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
          dragging
            ? "border-ring bg-accent shadow-inner"
            : "border-border bg-muted/50 shadow-sm hover:border-ring/70 hover:shadow-md"
        }`}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Selected screenshot preview"
            className="max-h-72 rounded-lg border border-border object-contain shadow-sm"
          />
        ) : (
          <>
            <svg
              viewBox="0 0 24 24"
              className="h-10 w-10 text-muted-foreground/50"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 16l4.5-4.5a2 2 0 0 1 2.8 0L16 16" />
              <path d="M14 14l1.5-1.5a2 2 0 0 1 2.8 0L20 14" />
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
            </svg>
            <p className="mt-3 text-sm font-medium text-foreground">
              Drop an image here or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">PNG or JPG, up to 8 MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {previewUrl && (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={handleInfer} disabled={loading}>
            {loading ? "Inferring location..." : "Infer location"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              acceptFile(null);
              setFile(null);
              setPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
              });
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            Clear
          </Button>
        </div>
      )}

      {error && <p className="alert-panel">{error}</p>}

      {result && (
        <div className="card-panel p-[var(--spacing-card)]">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Inferred activity
          </p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">
            {result.activity.name ?? "Unknown activity"}
          </h3>
          {result.activity.description && (
            <p className="mt-1 text-sm text-muted-foreground">{result.activity.description}</p>
          )}

          {result.place ? (
            <div className="highlight-panel">
              <p className="inline-flex items-center gap-1.5 text-sm font-medium">
                <svg
                  viewBox="0 0 20 20"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 2a6 6 0 0 0-6 6c0 4 6 10 6 10s6-6 6-10a6 6 0 0 0-6-6Zm0 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"
                    clipRule="evenodd"
                  />
                </svg>
                {result.place.name ?? result.activity.locationQuery}
              </p>
              {result.place.address && (
                <p className="mt-1 text-sm text-primary-foreground/80">{result.place.address}</p>
              )}
              {result.place.mapsUrl && (
                <a
                  href={result.place.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-foreground underline-offset-4 hover:underline"
                >
                  View on Google Maps
                </a>
              )}
            </div>
          ) : (
            <p className="alert-panel mt-4">
              We identified{" "}
              <span className="font-medium text-foreground">
                {result.activity.locationQuery}
              </span>{" "}
              but couldn't fetch Google Maps details. You can still add it.
            </p>
          )}

          <Button type="button" onClick={handleAdd} disabled={added} className="mt-5">
            {added ? "Added to activities" : "Add to activities"}
          </Button>
        </div>
      )}
    </div>
  );
}
