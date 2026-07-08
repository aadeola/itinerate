import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  deleteScrapbookImage,
  getScrapbook,
  uploadScrapbookImages,
} from "../api";
import type { ScrapbookDetail, ScrapbookImage } from "../types";

interface ScrapbookDetailProps {
  scrapbookId: number;
  onBack: () => void;
}

const MAX_FILES = 10;
const MAX_BYTES = 8 * 1024 * 1024;

interface PendingFile {
  file: File;
  previewUrl: string;
}

export default function ScrapbookDetailView({ scrapbookId, onBack }: ScrapbookDetailProps) {
  const [scrapbook, setScrapbook] = useState<ScrapbookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadScrapbook = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getScrapbook(scrapbookId);
      setScrapbook(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [scrapbookId]);

  useEffect(() => {
    void loadScrapbook();
  }, [loadScrapbook]);

  useEffect(() => {
    return () => {
      for (const pending of pendingFiles) {
        URL.revokeObjectURL(pending.previewUrl);
      }
    };
  }, [pendingFiles]);

  const clearPending = () => {
    setPendingFiles((current) => {
      for (const pending of current) {
        URL.revokeObjectURL(pending.previewUrl);
      }
      return [];
    });
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const acceptFiles = (fileList: FileList | null) => {
    setError(null);
    if (!fileList || fileList.length === 0) {
      return;
    }

    const next: PendingFile[] = [];
    const errors: string[] = [];

    for (const file of Array.from(fileList).slice(0, MAX_FILES)) {
      if (!file.type.startsWith("image/")) {
        errors.push(`${file.name} is not an image.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        errors.push(`${file.name} is larger than 8 MB.`);
        continue;
      }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }

    if (fileList.length > MAX_FILES) {
      errors.push(`You can select up to ${MAX_FILES} images at a time.`);
    }

    setPendingFiles((current) => {
      for (const pending of current) {
        URL.revokeObjectURL(pending.previewUrl);
      }
      return next;
    });

    if (errors.length > 0) {
      setError(errors.join(" "));
    }
  };

  const handleSave = async () => {
    if (pendingFiles.length === 0) {
      setError("Choose at least one image to upload.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const updated = await uploadScrapbookImages(
        scrapbookId,
        pendingFiles.map((pending) => pending.file),
      );
      setScrapbook(updated);
      clearPending();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (image: ScrapbookImage) => {
    if (!window.confirm(`Remove "${image.originalFilename}" from this scrapbook?`)) {
      return;
    }

    setDeletingImageId(image.id);
    setError(null);
    try {
      const updated = await deleteScrapbookImage(scrapbookId, image.id);
      setScrapbook(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setDeletingImageId(null);
    }
  };

  if (loading && !scrapbook) {
    return <p className="text-sm text-muted-foreground">Loading scrapbook...</p>;
  }

  if (!scrapbook) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="outline" onClick={onBack}>
          Back to scrapbooks
        </Button>
        <p className="alert-panel">{error ?? "Scrapbook not found."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button type="button" variant="outline" className="mb-4" onClick={onBack}>
            Back to scrapbooks
          </Button>
          <h2 className="text-2xl font-semibold text-foreground">{scrapbook.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {scrapbook.images.length === 1
              ? "1 saved photo"
              : `${scrapbook.images.length} saved photos`}
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold text-foreground">Add photos</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload up to 10 images at a time, then save them to this scrapbook.
        </p>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            acceptFiles(event.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
            dragging
              ? "border-ring bg-accent shadow-inner"
              : "border-border bg-muted/50 shadow-sm hover:border-ring/70 hover:shadow-md"
          }`}
        >
          {pendingFiles.length > 0 ? (
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {pendingFiles.map((pending) => (
                <img
                  key={pending.previewUrl}
                  src={pending.previewUrl}
                  alt={pending.file.name}
                  className="aspect-square w-full rounded-lg border border-border object-cover shadow-sm"
                />
              ))}
            </div>
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
                Drop up to 10 images here or click to browse
              </p>
              <p className="mt-1 text-xs text-muted-foreground">PNG, JPG, or WebP up to 8 MB each</p>
            </>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => acceptFiles(event.target.files)}
          />
        </div>

        {pendingFiles.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => void handleSave()} disabled={uploading}>
              {uploading ? "Saving..." : `Save ${pendingFiles.length} photo${pendingFiles.length === 1 ? "" : "s"}`}
            </Button>
            <Button type="button" variant="outline" onClick={clearPending} disabled={uploading}>
              Clear selection
            </Button>
          </div>
        )}
      </div>

      {error && <p className="alert-panel">{error}</p>}

      <div>
        <h3 className="text-base font-semibold text-foreground">Saved photos</h3>
        {scrapbook.images.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No photos saved yet. Upload some above to start your scrapbook.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {scrapbook.images.map((image) => (
              <figure key={image.id} className="group relative overflow-hidden rounded-xl border border-border bg-muted/30 shadow-sm">
                <img
                  src={image.contentUrl}
                  alt={image.originalFilename}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
                <figcaption className="border-t border-border bg-card px-3 py-2">
                  <p className="truncate text-xs font-medium text-foreground">
                    {image.originalFilename}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleDeleteImage(image)}
                    disabled={deletingImageId === image.id}
                    className="mt-2 text-xs font-medium text-destructive hover:underline"
                  >
                    {deletingImageId === image.id ? "Removing..." : "Remove"}
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
