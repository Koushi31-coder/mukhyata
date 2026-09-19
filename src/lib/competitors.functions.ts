import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

const CATEGORY_QUERY: Record<string, string> = {
  dairy: "dairy milk shop",
  poultry: "poultry chicken egg shop",
  kirana: "kirana general store",
  flourmill: "flour mill atta chakki",
  tailoring: "tailor tailoring shop",
  teastall: "tea stall snacks shop",
};

const SUPPLIER_QUERY: Record<string, string> = {
  dairy: "cattle feed and dairy equipment supplier",
  poultry: "poultry feed supplier wholesale",
  kirana: "wholesale grocery distributor",
  flourmill: "grain wholesale mandi wheat supplier",
  tailoring: "wholesale cloth fabric supplier",
  teastall: "wholesale tea and snacks distributor",
};

export interface Competitor {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number | undefined;
  reviews?: number | undefined;
  distanceKm: number;
}

export interface CompetitorResult {
  center: { lat: number; lng: number };
  placeLabel: string;
  radiusKm: number;
  competitors: Competitor[];
  suppliers: Competitor[];
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const findCompetitors = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        village: z.string().min(1).max(80),
        block: z.string().max(80).default(""),
        district: z.string().max(80).default(""),
        category: z.string().min(1).max(40),
        radiusKm: z.number().min(1).max(50).default(10),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<CompetitorResult> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const connKey = process.env["GOOGLE_MAPS_API_KEY"];
    if (!lovableKey || !connKey) throw new Error("Map service is not configured.");

    const headers = {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
    };

    const address = [data.village, data.block, data.district, "India"]
      .filter(Boolean)
      .join(", ");

    const geoRes = await fetch(
      `${GATEWAY}/maps/api/geocode/json?address=${encodeURIComponent(address)}`,
      { headers },
    );
    if (!geoRes.ok) {
      throw new Error(`Location lookup failed (${geoRes.status}): ${await geoRes.text()}`);
    }
    const geo = (await geoRes.json()) as {
      status: string;
      results?: Array<{ formatted_address: string; geometry: { location: { lat: number; lng: number } } }>;
    };
    const hit = geo.results?.[0];
    if (!hit) throw new Error(`Could not locate "${address}" on the map.`);
    const center = { lat: hit.geometry.location.lat, lng: hit.geometry.location.lng };

    const search = async (textQuery: string, label: string, maxKm: number): Promise<Competitor[]> => {
      const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount",
        },
        body: JSON.stringify({
          textQuery,
          maxResultCount: 20,
          locationBias: {
            circle: {
              center: { latitude: center.lat, longitude: center.lng },
              radius: Math.min(maxKm, 50) * 1000,
            },
          },
        }),
      });
      if (!res.ok) {
        throw new Error(`${label} search failed (${res.status}): ${await res.text()}`);
      }
      const json = (await res.json()) as {
        places?: Array<{
          id: string;
          displayName?: { text?: string };
          formattedAddress?: string;
          location?: { latitude: number; longitude: number };
          rating?: number;
          userRatingCount?: number;
        }>;
      };
      return (json.places ?? [])
        .filter((p) => p.location)
        .map((p) => {
          const pos = { lat: p.location!.latitude, lng: p.location!.longitude };
          return {
            id: p.id,
            name: p.displayName?.text ?? "Unnamed business",
            address: p.formattedAddress ?? "",
            lat: pos.lat,
            lng: pos.lng,
            rating: p.rating,
            reviews: p.userRatingCount,
            distanceKm: +haversine(center, pos).toFixed(1),
          };
        })
        .filter((c) => c.distanceKm <= maxKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    };

    const supplierRadius = Math.min(Math.max(data.radiusKm * 2, 25), 50);
    const [competitors, suppliers] = await Promise.all([
      search(
        `${CATEGORY_QUERY[data.category] ?? data.category} near ${address}`,
        "Competitor",
        data.radiusKm,
      ),
      search(
        `${SUPPLIER_QUERY[data.category] ?? "wholesale supplier"} near ${address}`,
        "Supplier",
        supplierRadius,
      ).catch(() => [] as Competitor[]),
    ]);

    return {
      center,
      placeLabel: hit.formatted_address,
      radiusKm: data.radiusKm,
      competitors,
      suppliers: suppliers.slice(0, 10),
    };
  });
