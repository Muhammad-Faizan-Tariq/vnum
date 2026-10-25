"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  LocateFixed,
  MapPin,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Place = { label: string; latitude: number; longitude: number; source: "device" | "default" };
type Weather = { temperature: number; code: number; isDay: boolean; unit: string };

const PLACE_KEY = "vnum-weather-place";
const PLACE_EVENT = "vnum-weather-place-change";

function subscribePlace(cb: () => void) {
  window.addEventListener(PLACE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(PLACE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function readPlace() {
  try {
    return localStorage.getItem(PLACE_KEY);
  } catch {
    return null;
  }
}
function writePlace(p: Place | null) {
  try {
    if (p) localStorage.setItem(PLACE_KEY, JSON.stringify(p));
    else localStorage.removeItem(PLACE_KEY);
  } catch {
    /* storage unavailable: the choice just won't persist */
  }
  window.dispatchEvent(new Event(PLACE_EVENT));
}

/** WMO weather interpretation codes, as returned by Open-Meteo. */
function describe(code: number, isDay: boolean): { label: string; Icon: LucideIcon } {
  if (code === 0) return { label: isDay ? "Clear sky" : "Clear night", Icon: isDay ? Sun : Moon };
  if (code <= 2) return { label: "Partly cloudy", Icon: CloudSun };
  if (code === 3) return { label: "Overcast", Icon: Cloud };
  if (code === 45 || code === 48) return { label: "Fog", Icon: CloudFog };
  if (code >= 51 && code <= 57) return { label: "Drizzle", Icon: CloudDrizzle };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: "Rain", Icon: CloudRain };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Snow", Icon: CloudSnow };
  if (code >= 95) return { label: "Thunderstorm", Icon: CloudLightning };
  return { label: "Mixed conditions", Icon: Cloud };
}

function greetingFor(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  if (hour >= 18 && hour < 22) return "Good evening";
  return "Good night";
}

// A shared 1s ticker so the clock stays correct without per-card intervals.
function subscribeClock(cb: () => void) {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
}
let lastTick = 0;
const getNow = () => {
  const t = Math.floor(Date.now() / 1000) * 1000;
  if (t !== lastTick) lastTick = t;
  return lastTick;
};

export function GreetingCard({
  name,
  fallback,
  context,
}: {
  name: string;
  fallback: { label: string; latitude: number; longitude: number };
  context: string;
}) {
  // null on the server and during hydration: we never print a time that was computed elsewhere.
  const now = useSyncExternalStore(subscribeClock, getNow, () => null);
  const date = now === null ? null : new Date(now);

  // A location the user chose to share is read from this browser's storage (never from the server).
  const placeRaw = useSyncExternalStore(subscribePlace, readPlace, () => null);
  const place = useMemo<Place>(() => {
    try {
      const saved = placeRaw ? (JSON.parse(placeRaw) as Place) : null;
      if (saved && typeof saved.latitude === "number" && typeof saved.longitude === "number") {
        return { ...saved, source: "device" };
      }
    } catch {
      /* ignore corrupt storage */
    }
    return { ...fallback, source: "default" };
  }, [placeRaw, fallback]);

  const [locating, setLocating] = useState<"idle" | "asking" | "denied" | "unsupported">("idle");
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${place.latitude},${place.longitude}#${attempt}`;
  const [result, setResult] = useState<{ key: string; weather?: Weather } | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(place.latitude));
    url.searchParams.set("longitude", String(place.longitude));
    url.searchParams.set("current", "temperature_2m,weather_code,is_day");
    fetch(url, { signal: ctl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j) => {
        const c = j?.current;
        if (typeof c?.temperature_2m !== "number") throw new Error("bad payload");
        setResult({
          key: requestKey,
          weather: {
            temperature: Math.round(c.temperature_2m),
            code: Number(c.weather_code),
            isDay: c.is_day === 1,
            unit: j.current_units?.temperature_2m ?? "°C",
          },
        });
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setResult({ key: requestKey });
      });
    return () => ctl.abort();
  }, [place.latitude, place.longitude, requestKey]);

  const current = result?.key === requestKey ? result : null;
  const weather = current?.weather ?? null;
  const state: "loading" | "ready" | "error" = !current ? "loading" : weather ? "ready" : "error";

  const useDeviceLocation = useCallback(() => {
    if (!("geolocation" in navigator)) return setLocating("unsupported");
    setLocating("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: Place = {
          label: "your location",
          latitude: Math.round(pos.coords.latitude * 100) / 100,
          longitude: Math.round(pos.coords.longitude * 100) / 100,
          source: "device",
        };
        writePlace(next);
        setLocating("idle");
      },
      () => setLocating("denied"),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  }, []);

  const resetLocation = () => {
    writePlace(null);
    setLocating("idle");
  };

  const w = weather ? describe(weather.code, weather.isDay) : null;
  const firstName = name.split(" ")[0];

  return (
    <section
      aria-label="Greeting"
      data-testid="greeting-card"
      className="rounded-lg border border-border bg-surface shadow-sm"
    >
      <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <p className="eyebrow">{context}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-[1.75rem]" data-testid="greeting-text">
            {date ? (
              <>
                {greetingFor(date.getHours())}, <span className="text-accent">{firstName}</span>
              </>
            ) : (
              <span className="invisible">Good morning, {firstName}</span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="greeting-date">
            {date ? (
              date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
            ) : (
              <span className="invisible">Monday, 1 January 2000</span>
            )}
          </p>
        </div>

        <div className="flex items-stretch divide-x divide-border rounded-md border border-border bg-surface-muted/50">
          <div className="flex min-w-32 flex-col justify-center px-4 py-3">
            <span className="eyebrow">Local time</span>
            <time
              data-testid="greeting-time"
              dateTime={date?.toISOString()}
              className="mt-1 font-mono text-2xl leading-none font-medium tabular"
            >
              {date ? (
                <>
                  {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })}
                  <span className="ml-1 text-sm text-muted-foreground">{String(date.getSeconds()).padStart(2, "0")}</span>
                </>
              ) : (
                "--:--"
              )}
            </time>
          </div>
          <div className="flex min-w-44 flex-col justify-center px-4 py-3" data-testid="weather" aria-live="polite">
            <span className="eyebrow">Weather</span>
            {state === "ready" && weather && w ? (
              <div className="mt-1 flex items-center gap-2">
                <w.Icon className="size-6 text-accent" aria-hidden />
                <span className="font-mono text-2xl leading-none font-medium tabular" data-testid="weather-temp">
                  {weather.temperature}
                  {weather.unit}
                </span>
                <span className="text-[13px] leading-tight text-muted-foreground" data-testid="weather-condition">
                  {w.label}
                </span>
              </div>
            ) : state === "error" ? (
              <div className="mt-1 text-[13px]">
                <p className="text-muted-foreground">Weather unavailable right now.</p>
                <button className="font-medium text-accent hover:underline" onClick={() => setAttempt((a) => a + 1)}>
                  Try again
                </button>
              </div>
            ) : (
              <div className="mt-2 h-6 w-28 animate-pulse rounded bg-border" aria-label="Loading weather" />
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-5 py-2.5 text-xs text-muted-foreground sm:px-6">
        <span className="inline-flex items-center gap-1.5" data-testid="weather-location">
          <MapPin className="size-3.5" aria-hidden />
          {place.source === "default" ? `Default location: ${place.label}` : "Using your approximate location"}
          <span aria-hidden>·</span>
          Open-Meteo
        </span>
        {place.source === "default" ? (
          <span className="inline-flex items-center gap-2">
            <Button variant="ghost" size="sm" className={cn("h-6 px-1.5 text-xs")} onClick={useDeviceLocation} loading={locating === "asking"}>
              <LocateFixed className="size-3.5" aria-hidden /> Use my location
            </Button>
            <span className="hidden sm:inline">
              {locating === "denied"
                ? "Permission denied. Showing the default location."
                : locating === "unsupported"
                  ? "Location is not available in this browser."
                  : "Asked only when you click; rounded and kept in this browser."}
            </span>
          </span>
        ) : (
          <button className="font-medium text-accent hover:underline" onClick={resetLocation}>
            Switch back to {fallback.label}
          </button>
        )}
      </div>
    </section>
  );
}
