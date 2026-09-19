import { useEffect, useRef } from "react";
import type { CompetitorResult } from "@/lib/competitors.functions";

declare global {
  interface Window {
    google?: any;
    __initGmaps?: () => void;
  }
}

let mapsPromise: Promise<void> | null = null;

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise<void>((resolve, reject) => {
    const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] ?? "";
    if (!key) {
      reject(new Error("Map key missing"));
      return;
    }
    window.__initGmaps = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__initGmaps&channel=${channel}`;
    s.async = true;
    s.onerror = () => reject(new Error("Map failed to load"));
    document.head.appendChild(s);
  });
  return mapsPromise;
}

export default function CompetitorMap({ data }: { data: CompetitorResult }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !ref.current || !window.google?.maps) return;
        const g = window.google.maps;
        if (!mapRef.current) {
          mapRef.current = new g.Map(ref.current, {
            center: data.center,
            zoom: 13,
            disableDefaultUI: true,
            zoomControl: true,
            styles: [
              { elementType: "geometry", stylers: [{ color: "#141a29" }] },
              { elementType: "labels.text.fill", stylers: [{ color: "#a2adca" }] },
              { elementType: "labels.text.stroke", stylers: [{ color: "#0a0c14" }] },
              { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0c14" }] },
              { featureType: "road", elementType: "geometry", stylers: [{ color: "#242c40" }] },
              { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
            ],
          });
        } else {
          mapRef.current.setCenter(data.center);
        }
        const map = mapRef.current;
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];

        const info = new g.InfoWindow();
        markersRef.current.push(
          new g.Marker({
            map,
            position: data.center,
            title: data.placeLabel,
            icon: {
              path: g.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: "#2dd4bf",
              fillOpacity: 1,
              strokeColor: "#0a0c14",
              strokeWeight: 2,
            },
          }),
        );
        markersRef.current.push(
          new g.Circle({
            map,
            center: data.center,
            radius: data.radiusKm * 1000,
            strokeColor: "#2dd4bf",
            strokeOpacity: 0.35,
            strokeWeight: 1,
            fillColor: "#2dd4bf",
            fillOpacity: 0.05,
          }),
        );

        const bounds = new g.LatLngBounds();
        bounds.extend(data.center);

        const addPins = (
          list: typeof data.competitors,
          color: string,
          scale: number,
          kind: string,
        ) => {
          list.forEach((c) => {
            const marker = new g.Marker({
              map,
              position: { lat: c.lat, lng: c.lng },
              title: c.name,
              icon: {
                path: g.SymbolPath.CIRCLE,
                scale,
                fillColor: color,
                fillOpacity: 1,
                strokeColor: "#0a0c14",
                strokeWeight: 1.5,
              },
            });
            marker.addListener("click", () => {
              info.setContent(
                `<div style="font-family:Inter,sans-serif;font-size:12px;color:#0a0c14"><strong>${c.name}</strong><br/>${kind} · ${c.distanceKm} km${c.rating ? ` · ★ ${c.rating} (${c.reviews ?? 0})` : ""}<br/>${c.address}</div>`,
              );
              info.open({ map, anchor: marker });
            });
            markersRef.current.push(marker);
            bounds.extend({ lat: c.lat, lng: c.lng });
          });
        };

        addPins(data.competitors, "#f5b85e", 6, "Competitor");
        addPins(data.suppliers ?? [], "#7dd3fc", 6.5, "Supplier");

        if (data.competitors.length + (data.suppliers?.length ?? 0) > 0) map.fitBounds(bounds, 48);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [data]);

  return <div ref={ref} className="h-[360px] w-full rounded-[12px] ring-1 ring-line" />;
}
