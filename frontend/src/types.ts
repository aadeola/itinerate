export interface ActivityInput {
  name: string;
  location?: string;
  durationMinutes?: number;
  notes?: string;
}

export interface TripRequest {
  city: string;
  days: number;
  startTime: string;
  endTime: string;
  activities: ActivityInput[];
}

export interface ScheduledActivity {
  name: string;
  location: string | null;
  startTime: string;
  endTime: string;
  reason: string | null;
}

export interface DayPlan {
  dayNumber: number;
  items: ScheduledActivity[];
}

export interface Itinerary {
  city: string;
  days: DayPlan[];
  summary: string | null;
}

export interface GeocodedScheduledActivity extends ScheduledActivity {
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
}

export interface GeocodedDayPlan {
  dayNumber: number;
  items: GeocodedScheduledActivity[];
}

export interface GeocodedItinerary {
  city: string;
  days: GeocodedDayPlan[];
  summary: string | null;
  geocodingError: string | null;
}

export interface InferredActivity {
  name: string | null;
  locationQuery: string | null;
  description: string | null;
  confidence: number | null;
}

export interface ResolvedPlace {
  name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  mapsUrl: string | null;
}

export interface VisionInferResponse {
  activity: InferredActivity;
  place: ResolvedPlace | null;
}

export interface ScrapbookSummary {
  id: number;
  name: string;
  imageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScrapbookImage {
  id: number;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  createdAt: string;
  contentUrl: string;
}

export interface ScrapbookDetail {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  images: ScrapbookImage[];
}

export interface SavedItinerarySummary {
  id: number;
  city: string;
  summary: string | null;
  dayCount: number;
  createdAt: string;
}

export interface SavedItineraryDetail {
  id: number;
  createdAt: string;
  itinerary: Itinerary;
}
