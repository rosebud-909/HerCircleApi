/** US ZIP → city/state via Zippopotam, with in-process LRU + optional Firestore write-through registry. */

import { useFirestore } from '../dbMode.js';
import { fsGetPostalLocation, fsUpsertPostalLocation } from '../firestoreRepo.js';

const MAX_CACHE_ENTRIES = 400;
/** @type {Map<string, { location: string; source: string }>} */
const cache = new Map();

export function clearZipLocationCacheForTests() {
  cache.clear();
}

function usZipFiveDigits(postalRaw) {
  const trimmed = String(postalRaw ?? '').trim();
  const dash = trimmed.indexOf('-');
  const base = dash >= 0 ? trimmed.slice(0, dash) : trimmed;
  return base.slice(0, 5);
}

function buildFallbackLocation(countryCode, postalRaw) {
  const postal = String(postalRaw ?? '').trim();
  const code = String(countryCode ?? '').toUpperCase() || 'US';
  const dn = new Intl.DisplayNames(['en'], { type: 'region' });
  return `${postal}, ${dn.of(code) ?? code}`;
}

/**
 * @param {string} countryCodeRaw — ISO 3166-1 alpha-2
 * @param {string} postalRaw
 * @returns {Promise<{ location: string; source: 'zippopotam' | 'persisted' | 'fallback' }>}
 */
export async function resolvePostalToLocation(countryCodeRaw, postalRaw) {
  const countryCode = String(countryCodeRaw ?? '').trim().toUpperCase();
  if (countryCode !== 'US') {
    return { location: buildFallbackLocation(countryCode || 'US', postalRaw), source: 'fallback' };
  }

  const zip = usZipFiveDigits(postalRaw);
  if (!/^\d{5}$/.test(zip)) {
    return { location: buildFallbackLocation(countryCode, postalRaw), source: 'fallback' };
  }

  const key = `us:${zip}`;
  const hit = cache.get(key);
  if (hit) {
    return { location: hit.location, source: hit.source };
  }

  if (useFirestore()) {
    try {
      const stored = await fsGetPostalLocation('US', zip);
      if (stored) {
        cache.set(key, { location: stored.location, source: 'persisted' });
        while (cache.size > MAX_CACHE_ENTRIES) {
          const oldest = cache.keys().next().value;
          if (oldest === undefined) break;
          cache.delete(oldest);
        }
        return { location: stored.location, source: 'persisted' };
      }
    } catch (e) {
      console.error('[zipLocation] Firestore read failed', e);
    }
  }

  const url = `https://api.zippopotam.us/us/${encodeURIComponent(zip)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { location: buildFallbackLocation(countryCode, postalRaw), source: 'fallback' };
    }
    const data = await res.json();
    const place = data?.places?.[0];
    const city = typeof place?.['place name'] === 'string' ? place['place name'].trim() : '';
    const st =
      typeof place?.['state abbreviation'] === 'string' ? place['state abbreviation'].trim() : '';
    if (city && st) {
      const location = `${city}, ${st}`;
      cache.set(key, { location, source: 'zippopotam' });
      while (cache.size > MAX_CACHE_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
      }
      if (useFirestore()) {
        try {
          await fsUpsertPostalLocation('US', zip, { location, source: 'zippopotam' });
        } catch (e) {
          console.error('[zipLocation] Firestore write failed', e);
        }
      }
      return { location, source: 'zippopotam' };
    }
  } catch {
    /* network / parse */
  }

  return { location: buildFallbackLocation(countryCode, postalRaw), source: 'fallback' };
}
