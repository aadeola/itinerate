import { useCallback, useEffect, useState } from "react";
import ScrapbookDetail from "./ScrapbookDetail";
import ScrapbookList from "./ScrapbookList";
import { listScrapbooks } from "../api";
import type { ScrapbookSummary } from "../types";

export default function ScrapbooksView() {
  const [scrapbooks, setScrapbooks] = useState<ScrapbookSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listScrapbooks();
      setScrapbooks(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  if (selectedId !== null) {
    return (
      <ScrapbookDetail
        scrapbookId={selectedId}
        onBack={() => {
          setSelectedId(null);
          void refreshList();
        }}
      />
    );
  }

  return (
    <ScrapbookList
      scrapbooks={scrapbooks}
      loading={loading}
      error={error}
      onOpen={setSelectedId}
      onRefresh={refreshList}
    />
  );
}
