import type {
  GeocodedItinerary,
  Itinerary,
  SavedItineraryDetail,
  SavedItinerarySummary,
  ScrapbookDetail,
  ScrapbookSummary,
  TripRequest,
  VisionInferResponse,
} from "./types";

interface ApiError {
  error?: string;
  messages?: string[];
}

const STATUS_HINTS: Record<number, string> = {
  502: "The AI planner could not complete your request. Try again in a moment.",
  503: "The AI planner is not configured. Set ITINERARY_LLM_API_KEY in backend/.env and ensure the llm-proxy is running.",
};

const VISION_STATUS_HINTS: Record<number, string> = {
  422: "We couldn't identify a location from that image. Please submit a clearer image.",
  429: "Gemini vision quota exceeded. Wait a minute and try again, or change ITINERARY_VISION_MODEL in backend/.env.",
  502: "The vision service could not complete your request. Try again in a moment.",
  503: "Screenshot inference is not configured. Set ITINERARY_VISION_API_KEY in backend/.env.",
};

async function errorMessage(
  response: Response,
  hints: Record<number, string>,
): Promise<string> {
  let message = hints[response.status] ?? `Request failed (${response.status})`;
  try {
    const body: ApiError = await response.json();
    if (body.messages?.length) {
      message = body.messages.join(" ");
    } else if (body.error) {
      message = body.error;
    }
  } catch {
    // response had no JSON body; keep the status-based message
  }
  return message;
}

export async function planItinerary(request: TripRequest): Promise<Itinerary> {
  let response: Response;
  try {
    response = await fetch("/api/itinerary/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const onDevServer = origin.includes(":5173");
    throw new Error(
      onDevServer
        ? "Could not reach the planner. Ensure ./scripts/dev.sh is running and the backend is healthy at http://localhost:8080/api/health."
        : "Could not reach the planner. Open http://localhost:5173 (run ./scripts/dev.sh or cd frontend && npm run dev) so API requests can proxy to the backend on port 8080.",
    );
  }

  if (!response.ok) {
    throw new Error(await errorMessage(response, STATUS_HINTS));
  }

  return (await response.json()) as Itinerary;
}

const GEOCODE_STATUS_HINTS: Record<number, string> = {
  503: "Itinerary map geocoding is not configured. Set ITINERARY_GEOCODING_API_KEY in backend/.env.",
  502: "Could not geocode this itinerary. Try again in a moment.",
};

export async function geocodeItinerary(itinerary: Itinerary): Promise<GeocodedItinerary> {
  let response: Response;
  try {
    response = await fetch("/api/itinerary/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(itinerary),
    });
  } catch {
    throw new Error(
      "Could not reach the server. Is the backend running on port 8080?",
    );
  }

  if (!response.ok) {
    throw new Error(await errorMessage(response, GEOCODE_STATUS_HINTS));
  }

  return (await response.json()) as GeocodedItinerary;
}

export async function inferActivityFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<VisionInferResponse> {
  let response: Response;
  try {
    response = await fetch("/api/vision/infer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, mimeType }),
    });
  } catch {
    throw new Error(
      "Could not reach the server. Is the backend running on port 8080?",
    );
  }

  if (!response.ok) {
    throw new Error(await errorMessage(response, VISION_STATUS_HINTS));
  }

  return (await response.json()) as VisionInferResponse;
}

const SCRAPBOOK_STATUS_HINTS: Record<number, string> = {
  400: "That scrapbook request wasn't valid. Check your input and try again.",
  404: "That scrapbook or image could not be found.",
};

async function scrapbookFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(path, init);
  } catch {
    throw new Error(
      "Could not reach the server. Is the backend running on port 8080?",
    );
  }
}

export async function listScrapbooks(): Promise<ScrapbookSummary[]> {
  const response = await scrapbookFetch("/api/scrapbooks");
  if (!response.ok) {
    throw new Error(await errorMessage(response, SCRAPBOOK_STATUS_HINTS));
  }
  return (await response.json()) as ScrapbookSummary[];
}

export async function createScrapbook(name: string): Promise<ScrapbookSummary> {
  const response = await scrapbookFetch("/api/scrapbooks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, SCRAPBOOK_STATUS_HINTS));
  }
  return (await response.json()) as ScrapbookSummary;
}

export async function getScrapbook(id: number): Promise<ScrapbookDetail> {
  const response = await scrapbookFetch(`/api/scrapbooks/${id}`);
  if (!response.ok) {
    throw new Error(await errorMessage(response, SCRAPBOOK_STATUS_HINTS));
  }
  return (await response.json()) as ScrapbookDetail;
}

export async function deleteScrapbook(id: number): Promise<void> {
  const response = await scrapbookFetch(`/api/scrapbooks/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, SCRAPBOOK_STATUS_HINTS));
  }
}

export async function uploadScrapbookImages(
  scrapbookId: number,
  files: File[],
): Promise<ScrapbookDetail> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const response = await scrapbookFetch(`/api/scrapbooks/${scrapbookId}/images`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, SCRAPBOOK_STATUS_HINTS));
  }
  return (await response.json()) as ScrapbookDetail;
}

export async function deleteScrapbookImage(
  scrapbookId: number,
  imageId: number,
): Promise<ScrapbookDetail> {
  const response = await scrapbookFetch(
    `/api/scrapbooks/${scrapbookId}/images/${imageId}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(await errorMessage(response, SCRAPBOOK_STATUS_HINTS));
  }
  return (await response.json()) as ScrapbookDetail;
}

const SAVED_ITINERARY_STATUS_HINTS: Record<number, string> = {
  404: "That saved itinerary could not be found.",
};

async function savedItineraryFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(path, init);
  } catch {
    throw new Error(
      "Could not reach the server. Is the backend running on port 8080?",
    );
  }
}

export async function listSavedItineraries(): Promise<SavedItinerarySummary[]> {
  const response = await savedItineraryFetch("/api/saved-itineraries");
  if (!response.ok) {
    throw new Error(await errorMessage(response, SAVED_ITINERARY_STATUS_HINTS));
  }
  return (await response.json()) as SavedItinerarySummary[];
}

export async function saveItinerary(
  itinerary: Itinerary,
): Promise<SavedItinerarySummary> {
  const response = await savedItineraryFetch("/api/saved-itineraries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(itinerary),
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, SAVED_ITINERARY_STATUS_HINTS));
  }
  return (await response.json()) as SavedItinerarySummary;
}

export async function getSavedItinerary(
  id: number,
): Promise<SavedItineraryDetail> {
  const response = await savedItineraryFetch(`/api/saved-itineraries/${id}`);
  if (!response.ok) {
    throw new Error(await errorMessage(response, SAVED_ITINERARY_STATUS_HINTS));
  }
  return (await response.json()) as SavedItineraryDetail;
}

export async function deleteSavedItinerary(id: number): Promise<void> {
  const response = await savedItineraryFetch(`/api/saved-itineraries/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response, SAVED_ITINERARY_STATUS_HINTS));
  }
}
