import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createScrapbook, deleteScrapbook } from "../api";
import type { ScrapbookSummary } from "../types";

interface ScrapbookListProps {
  scrapbooks: ScrapbookSummary[];
  loading: boolean;
  error: string | null;
  onOpen: (id: number) => void;
  onRefresh: () => Promise<void>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ScrapbookList({
  scrapbooks,
  loading,
  error,
  onOpen,
  onRefresh,
}: ScrapbookListProps) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setActionError("Give your scrapbook a name.");
      return;
    }

    setCreating(true);
    setActionError(null);
    try {
      const created = await createScrapbook(trimmed);
      setName("");
      onOpen(created.id);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number, scrapbookName: string) => {
    if (!window.confirm(`Delete "${scrapbookName}" and all of its photos?`)) {
      return;
    }

    setDeletingId(id);
    setActionError(null);
    try {
      await deleteScrapbook(id);
      await onRefresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-semibold text-foreground">Your scrapbooks</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a scrapbook, then add up to 10 photos at a time to build your visual collection.
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="scrapbook-name">New scrapbook</Label>
          <Input
            id="scrapbook-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Summer in Lisbon"
            maxLength={120}
          />
        </div>
        <Button type="submit" disabled={creating} className="sm:mb-0">
          {creating ? "Creating..." : "Create scrapbook"}
        </Button>
      </form>

      {(error || actionError) && (
        <p className="alert-panel">{error ?? actionError}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading scrapbooks...</p>
      ) : scrapbooks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-10 text-center">
          <p className="text-sm font-medium text-foreground">No scrapbooks yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first scrapbook above to start collecting photos.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {scrapbooks.map((scrapbook) => (
            <li
              key={scrapbook.id}
              className="card-panel card-panel-interactive flex flex-col gap-4 p-[var(--spacing-card)]"
            >
              <button
                type="button"
                onClick={() => onOpen(scrapbook.id)}
                className="text-left"
              >
                <h3 className="text-lg font-semibold text-foreground">{scrapbook.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {scrapbook.imageCount === 1
                    ? "1 photo"
                    : `${scrapbook.imageCount} photos`}
                  {" · Updated "}
                  {formatDate(scrapbook.updatedAt)}
                </p>
              </button>

              <div className="flex items-center gap-2">
                <Button type="button" onClick={() => onOpen(scrapbook.id)}>
                  Open
                </Button>
                <Button
                  type="button"
                  variant="outlineDestructive"
                  onClick={() => void handleDelete(scrapbook.id, scrapbook.name)}
                  disabled={deletingId === scrapbook.id}
                >
                  {deletingId === scrapbook.id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
