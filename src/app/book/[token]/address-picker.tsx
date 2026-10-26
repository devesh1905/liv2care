"use client";

import "leaflet/dist/leaflet.css";
import { LocateFixed, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { t, type Lang } from "@/lib/i18n/patient";

type Point = { lat: number; lon: number };
type Fields = { house: string; block: string; street: string; area: string; landmark: string; pincode: string };

const EMPTY: Fields = { house: "", block: "", street: "", area: "", landmark: "", pincode: "" };
const INDIA_CENTRE: [number, number] = [20.5937, 78.9629];
const NOMINATIM = "https://nominatim.openstreetmap.org";

type Place = { lat: string; lon: string; address?: Record<string, string> };

/** What a map search or a pin tells us about the place. Only used to fill empty boxes, which the patient can always change. */
function fromPlace(address: Record<string, string> | undefined): Partial<Fields> {
  if (!address) return {};
  return {
    street: address.road ?? address.pedestrian ?? "",
    area: address.suburb ?? address.neighbourhood ?? address.city_district ?? address.village ?? address.town ?? address.city ?? "",
    pincode: /^\d{6}$/.test(address.postcode ?? "") ? address.postcode : "",
  };
}

/**
 * The home-collection address, taken the way delivery apps take it: search or use the phone's location, drop and drag a pin,
 * then fill in house or flat number, block, street, area, landmark and pincode. The pin is optional; the details are not.
 * Map data comes from OpenStreetMap, which is free for a pilot (a paid maps service would replace it at scale).
 */
export function AddressPicker({ lang }: { lang: Lang }) {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [point, setPoint] = useState<Point | null>(null);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mapNode = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);

  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [key]: e.target.value }));

  function fillEmpty(found: Partial<Fields>) {
    setFields((f) => ({
      ...f,
      street: f.street || found.street || "",
      area: f.area || found.area || "",
      pincode: f.pincode || found.pincode || "",
    }));
  }

  async function reverse(p: Point) {
    try {
      const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&accept-language=en&lat=${p.lat}&lon=${p.lon}`);
      if (res.ok) fillEmpty(fromPlace(((await res.json()) as Place).address));
    } catch {
      // the patient can type the details
    }
  }

  function place(p: Point, lookUp: boolean) {
    setPoint(p);
    setNote(t(lang, "addrPinned"));
    if (lookUp) void reverse(p);
  }

  function locate() {
    if (!navigator.geolocation) {
      setNote(t(lang, "addrLocateFail"));
      return;
    }
    setBusy(true);
    setNote(t(lang, "addrLocating"));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        place({ lat: pos.coords.latitude, lon: pos.coords.longitude }, true);
      },
      () => {
        setBusy(false);
        setNote(t(lang, "addrLocateFail"));
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function search() {
    const q = query.trim();
    if (q.length < 3) return;
    setBusy(true);
    try {
      const res = await fetch(`${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=in&accept-language=en&q=${encodeURIComponent(q)}`);
      const [first] = res.ok ? ((await res.json()) as Place[]) : [];
      if (first) {
        place({ lat: Number(first.lat), lon: Number(first.lon) }, false);
        fillEmpty(fromPlace(first.address));
      } else {
        setNote(t(lang, "addrNotFound"));
      }
    } catch {
      setNote(t(lang, "addrNotFound"));
    } finally {
      setBusy(false);
    }
  }

  // The map is drawn once, in the browser only.
  useEffect(() => {
    let gone = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (gone || !mapNode.current || map.current) return;
      const m = L.map(mapNode.current, { center: INDIA_CENTRE, zoom: 4, scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      m.on("click", (e: { latlng: { lat: number; lng: number } }) => place({ lat: e.latlng.lat, lon: e.latlng.lng }, true));
      map.current = m;
      setReady(true);
    })();
    return () => {
      gone = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the pin on the map in step with the chosen point.
  useEffect(() => {
    if (!ready || !map.current || !point) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const at: [number, number] = [point.lat, point.lon];
      if (!marker.current) {
        const icon = L.divIcon({
          className: "",
          html: '<svg width="32" height="42" viewBox="0 0 32 42" aria-hidden="true"><path d="M16 0C7.2 0 0 7 0 15.7 0 27 16 42 16 42s16-15 16-26.3C32 7 24.8 0 16 0z" fill="#e8590c"/><circle cx="16" cy="15.5" r="6" fill="#fff"/></svg>',
          iconSize: [32, 42],
          iconAnchor: [16, 42],
        });
        marker.current = L.marker(at, { draggable: true, icon, keyboard: false }).addTo(map.current!);
        marker.current.on("dragend", () => {
          const p = marker.current!.getLatLng();
          place({ lat: p.lat, lon: p.lng }, true);
        });
      } else {
        marker.current.setLatLng(at);
      }
      map.current!.setView(at, Math.max(map.current!.getZoom(), 17));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, point]);

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="lat" value={point?.lat ?? ""} />
      <input type="hidden" name="lon" value={point?.lon ?? ""} />

      <div className="flex flex-col gap-2 rounded-2xl border bg-card p-3">
        <div className="flex gap-2">
          <Input
            aria-label={t(lang, "addrSearch")}
            placeholder={t(lang, "addrSearch")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
          />
          <Button type="button" variant="outline" disabled={busy} onClick={() => void search()}>
            <Search aria-hidden="true" />
            {t(lang, "addrSearchButton")}
          </Button>
        </div>
        <Button type="button" variant="outline" disabled={busy} onClick={locate} className="justify-start">
          <LocateFixed aria-hidden="true" className="text-primary" />
          {t(lang, "addrLocate")}
        </Button>
        <div ref={mapNode} className="h-52 w-full overflow-hidden rounded-xl border bg-muted" role="application" aria-label={t(lang, "addrMapHint")} />
        <p role="status" className="text-sm text-muted-foreground">
          {note ?? t(lang, "addrMapHint")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t(lang, "addrHouse")}</span>
          <Input name="house" required maxLength={60} autoComplete="off" value={fields.house} onChange={set("house")} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t(lang, "addrBlock")}</span>
          <Input name="block" maxLength={40} autoComplete="off" value={fields.block} onChange={set("block")} />
        </label>
        <label className="col-span-2 flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t(lang, "addrStreet")}</span>
          <Input name="street" required minLength={2} maxLength={100} autoComplete="off" value={fields.street} onChange={set("street")} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t(lang, "addrArea")}</span>
          <Input name="area" required minLength={2} maxLength={60} autoComplete="off" value={fields.area} onChange={set("area")} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t(lang, "addrPincode")}</span>
          <Input name="pincode" required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} autoComplete="off" value={fields.pincode} onChange={set("pincode")} />
        </label>
        <label className="col-span-2 flex flex-col gap-1.5">
          <span className="text-sm font-semibold">{t(lang, "addrLandmark")}</span>
          <Input name="landmark" maxLength={80} autoComplete="off" value={fields.landmark} onChange={set("landmark")} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{t(lang, "addressHint")}</p>
    </div>
  );
}
