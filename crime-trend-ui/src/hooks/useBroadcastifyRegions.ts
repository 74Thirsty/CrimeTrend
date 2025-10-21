import { useEffect, useMemo, useState } from 'react';
import { ALL_STATE_OPTION, StateInfo, US_STATES } from '../constants/states';
import { getCountiesForState } from '../constants/counties';

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

export function useBroadcastifyRegions(stateCode: string): RegionHookResult {
  const [counties, setCounties] = useState<string[]>([]);

  useEffect(() => {
    if (!stateCode || stateCode === ALL_STATE_OPTION) {
      setCounties([]);
      return;
    }
    setCounties([...getCountiesForState(stateCode)]);
  }, [stateCode]);

  const refreshStates = async () => {
    // Future enhancement: integrate optional Broadcastify catalogue lookups.
  };

  const refreshCounties = async (code: string) => {
    if (!code || code === ALL_STATE_OPTION) {
      setCounties([]);
      return;
    }
    setCounties([...getCountiesForState(code)]);
  };

  return useMemo(
    () => ({
      states: FALLBACK_STATES,
      counties,
      loadingStates: false,
      loadingCounties: false,
      lastError: null,
      refreshStates,
      refreshCounties
    }),
    [counties]
  );
}
