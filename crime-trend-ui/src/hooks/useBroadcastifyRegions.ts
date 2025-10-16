import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_STATE_OPTION, StateInfo, US_STATES } from '../constants/states';
import { ALL_COUNTY_OPTION, getCountiesForState } from '../constants/counties';

interface BroadcastifyStateResponse {
  states?: { code: string; name: string }[];
}

interface BroadcastifyCountyResponse {
  state: string;
  counties: { id: string; name: string }[];
}

interface RegionHookResult {
  states: StateInfo[];
  counties: string[];
  loadingStates: boolean;
  loadingCounties: boolean;
  lastError: string | null;
  refreshStates: () => Promise<void>;
  refreshCounties: (stateCode: string) => Promise<void>;
}

const FALLBACK_STATES: StateInfo[] = [...US_STATES];

async function parseJsonSafe<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Invalid JSON response: ${text}`);
  }
}

function normaliseStates(data: BroadcastifyStateResponse): StateInfo[] {
  const list = Array.isArray(data.states) ? data.states : [];
  const normalised: StateInfo[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const code = typeof entry.code === 'string' ? entry.code.trim().toUpperCase() : '';
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!code || !name || seen.has(code)) {
      continue;
    }
    seen.add(code);
    normalised.push({ code, name });
  }
  if (normalised.length === 0) {
    return FALLBACK_STATES;
  }
  return normalised.sort((a, b) => a.name.localeCompare(b.name));
}

function normaliseCounties(data: BroadcastifyCountyResponse): string[] {
  if (!data || !Array.isArray(data.counties)) {
    return [];
  }
  return data.counties
    .map((county) => (typeof county?.name === 'string' ? county.name.trim() : ''))
    .filter((name) => name.length > 0 && name !== ALL_COUNTY_OPTION)
    .sort((a, b) => a.localeCompare(b));
}

export function useBroadcastifyRegions(stateCode: string): RegionHookResult {
  const [states, setStates] = useState<StateInfo[]>(FALLBACK_STATES);
  const [counties, setCounties] = useState<string[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCounties, setLoadingCounties] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshStates = useCallback(async () => {
    setLoadingStates(true);
    try {
      const response = await fetch('/api/broadcastify/states');
      if (!response.ok) {
        throw new Error(`Failed to load states (${response.status})`);
      }
      const json = await parseJsonSafe<BroadcastifyStateResponse>(response);
      setStates(normaliseStates(json));
      setLastError(null);
    } catch (error) {
      console.error('Failed to fetch broadcastify states', error);
      setLastError((error as Error).message);
      setStates(FALLBACK_STATES);
    } finally {
      setLoadingStates(false);
    }
  }, []);

  const refreshCounties = useCallback(async (code: string) => {
    if (!code || code === ALL_STATE_OPTION) {
      setCounties([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoadingCounties(true);
    try {
      const response = await fetch(`/api/broadcastify/states/${encodeURIComponent(code)}/counties`, {
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`Failed to load counties (${response.status})`);
      }
      const json = await parseJsonSafe<BroadcastifyCountyResponse>(response);
      const resolved = normaliseCounties(json);
      setCounties(resolved.length > 0 ? resolved : [...getCountiesForState(code)]);
      setLastError(null);
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') {
        return;
      }
      console.error('Failed to fetch broadcastify counties', error);
      setLastError((error as Error).message);
      setCounties([...getCountiesForState(code)]);
    } finally {
      if (!controller.signal.aborted) {
        setLoadingCounties(false);
      }
    }
  }, []);

  useEffect(() => {
    refreshStates().catch((error) => {
      console.error('Error initialising states', error);
    });
  }, [refreshStates]);

  useEffect(() => {
    refreshCounties(stateCode).catch((error) => {
      console.error('Error loading counties', error);
    });
    return () => {
      abortRef.current?.abort();
    };
  }, [stateCode, refreshCounties]);

  return useMemo(
    () => ({
      states,
      counties,
      loadingStates,
      loadingCounties,
      lastError,
      refreshStates,
      refreshCounties
    }),
    [states, counties, loadingStates, loadingCounties, lastError, refreshStates, refreshCounties]
  );
}
