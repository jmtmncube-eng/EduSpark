import { useEffect, useState } from 'react';

/**
 * Minimal clock + weather chip rendered next to the dashboard header.
 *
 * • Clock ticks every second.
 * • Weather pulled from Open-Meteo (free, no API key).
 *   Geolocation requested on mount; falls back to Johannesburg if denied.
 * • Quietly degrades — never throws, never blocks layout.
 */

const FALLBACK = { lat: -26.2, lng: 28.0, label: 'Johannesburg' };
const REFRESH_MS = 15 * 60 * 1000; // 15 min

interface Weather {
  tempC: number;
  code: number;
  isDay: boolean;
  place: string;
}

function wmoIcon(code: number, isDay: boolean): { emoji: string; label: string } {
  if (code === 0) return { emoji: isDay ? '☀️' : '🌙', label: isDay ? 'Clear' : 'Clear night' };
  if (code <= 3) return { emoji: isDay ? '⛅' : '☁️', label: 'Partly cloudy' };
  if (code === 45 || code === 48) return { emoji: '🌫️', label: 'Foggy' };
  if (code >= 51 && code <= 57) return { emoji: '🌦️', label: 'Drizzle' };
  if (code >= 61 && code <= 67) return { emoji: '🌧️', label: 'Rain' };
  if (code >= 71 && code <= 77) return { emoji: '🌨️', label: 'Snow' };
  if (code >= 80 && code <= 82) return { emoji: '🌦️', label: 'Showers' };
  if (code === 85 || code === 86) return { emoji: '🌨️', label: 'Snow showers' };
  if (code >= 95) return { emoji: '⛈️', label: 'Thunderstorm' };
  return { emoji: '🌡️', label: 'Weather' };
}

async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lng}&count=1&language=en&format=json`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const d = await res.json() as { results?: { name: string; admin1?: string }[] };
    return d.results?.[0]?.name ?? null;
  } catch { return null; }
}

async function fetchWeather(lat: number, lng: number, label: string, signal?: AbortSignal): Promise<Weather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,is_day&timezone=auto`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json() as { current?: { temperature_2m: number; weather_code: number; is_day: number } };
    if (!data.current) return null;
    return {
      tempC: Math.round(data.current.temperature_2m),
      code: data.current.weather_code,
      isDay: data.current.is_day === 1,
      place: label,
    };
  } catch { return null; }
}

export default function ClockWeather({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState<Weather | null>(null);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Weather fetch (with geolocation), refreshed every 15 min
  useEffect(() => {
    const ctrl = new AbortController();

    async function loadFor(lat: number, lng: number) {
      const place = (await reverseGeocode(lat, lng, ctrl.signal)) ?? FALLBACK.label;
      const w = await fetchWeather(lat, lng, place, ctrl.signal);
      if (w) setWeather(w);
    }

    function loadDefault() { loadFor(FALLBACK.lat, FALLBACK.lng); }

    if ('geolocation' in navigator) {
      const cached = localStorage.getItem('es_geo_pos');
      if (cached) {
        try {
          const p = JSON.parse(cached) as { lat: number; lng: number; at: number };
          // Use cached for instant render, then refresh
          if (Date.now() - p.at < 24 * 60 * 60 * 1000) {
            loadFor(p.lat, p.lng);
          }
        } catch { /* ignore */ }
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude, lng = pos.coords.longitude;
          localStorage.setItem('es_geo_pos', JSON.stringify({ lat, lng, at: Date.now() }));
          loadFor(lat, lng);
        },
        () => loadDefault(),
        { timeout: 6000, maximumAge: 24 * 60 * 60 * 1000 },
      );
    } else {
      loadDefault();
    }

    const interval = setInterval(() => {
      const cached = localStorage.getItem('es_geo_pos');
      if (cached) {
        try { const p = JSON.parse(cached); loadFor(p.lat, p.lng); } catch { loadDefault(); }
      } else { loadDefault(); }
    }, REFRESH_MS);

    return () => { ctrl.abort(); clearInterval(interval); };
  }, []);

  const timeStr = now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
  const wmo = weather ? wmoIcon(weather.code, weather.isDay) : null;

  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 14,
        padding: '10px 16px',
        background: 'linear-gradient(135deg, rgba(20,184,166,.10), rgba(14,165,233,.06))',
        border: '1px solid rgba(20,184,166,.25)',
        borderRadius: 14,
        flexShrink: 0,
        // Mobile: compact + wrap-friendly
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
      }}
      title={weather ? `${wmo?.label} · ${weather.place}` : 'Loading weather…'}
    >
      {/* Clock */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.1 }}>
        <div style={{
          fontFamily: 'var(--fh)', fontWeight: 800, fontSize: compact ? 18 : 22,
          color: 'var(--t)', letterSpacing: '.02em',
        }}>{timeStr}</div>
        <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          {dateStr}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: 'var(--bd)' }} />

      {/* Weather */}
      {weather && wmo ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: compact ? 22 : 26 }}>{wmo.emoji}</span>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <div style={{ fontFamily: 'var(--fh)', fontWeight: 800, fontSize: compact ? 16 : 18 }}>
              {weather.tempC}°
            </div>
            <div style={{ fontSize: 10, color: 'var(--t3)', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {weather.place}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--t3)', fontSize: 11 }}>
          <span style={{ fontSize: 18, opacity: 0.5 }}>🌐</span>
          <span>—</span>
        </div>
      )}
    </div>
  );
}
