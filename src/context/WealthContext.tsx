'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import { Holding, Platform, Snapshot, WealthSummary, AssetClass, ViewType, EstimateParams, Movement } from '@/types/wealth';
import { assetClassColor, assetClassTag, platformColor, platformTag } from '@/lib/constants';
import { initialOf } from '@/lib/initial';
import { formatCurrency, formatPercentage } from '@/lib/calculations';
import { api, ApiError, HoldingInput, HoldingPatch, MovementInput } from '@/lib/api';
import { INITIAL_ASSETS_TABLE, type AssetsTableState } from '@/lib/assetsTable';

interface ClassDistributionItem {
  label: AssetClass;
  value: number;
  pct: number;
  color: string;
  tagClass: string;
  pctLabel: string;
}

interface PlatformCardItem {
  name: string;
  type: string;
  balanceUSD: number;
  balanceFormatted: string;
  pctOfTotal: number;
  pctLabel: string;
  color: string;
  tagClass: string;
  initial: string;
  isActive: boolean;
}

interface WealthContextType {
  // State
  view: ViewType;
  selectedPlatform: string | null;
  assetsTable: AssetsTableState;
  holdings: Holding[];
  platforms: Platform[];
  snapshots: Snapshot[];
  estimateParams: EstimateParams;
  loading: boolean;
  loadError: string | null;
  /** Goes up each time fresh data is on screen: what's fetched apart (an activity list) reloads with it. */
  dataVersion: number;

  // Computed Values
  netWorthUSD: number;
  netWorthFormatted: string;
  ytdGrowthFormatted: string;
  ytdLabel: string;
  liquidityPct: number;
  illiquidPct: number;
  classDistribution: ClassDistributionItem[];
  platformDistribution: PlatformCardItem[];
  selectedPlatformHoldings: Holding[];
  availableAssetClasses: AssetClass[];

  // Actions
  setView: (view: ViewType) => void;
  setSelectedPlatform: (platform: string | null) => void;
  /** Platforms view, with that platform's holdings open. */
  openPlatform: (platform: string) => void;
  setAssetsTable: React.Dispatch<React.SetStateAction<AssetsTableState>>;
  setEstimateParams: React.Dispatch<React.SetStateAction<EstimateParams>>;
  addHolding: (holding: HoldingInput) => Promise<void>;
  updateHolding: (id: string, patch: HoldingPatch) => Promise<void>;
  deleteHolding: (id: string) => Promise<void>;
  takeSnapshot: () => Promise<void>;
  deleteSnapshot: (id: string) => Promise<void>;
  /** Records a gain, loss, deposit, withdrawal or transfer; resolves to it once data is reloaded. */
  recordMovement: (input: MovementInput) => Promise<Movement>;
  /** Undoes a movement: its effect on values is reverted and it's gone from the activity. */
  revertMovement: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
}

const WealthContext = createContext<WealthContextType | undefined>(undefined);

// The API spells a platform as on its earliest holding, so deleting that holding (say, from another
// device) can change how a selected platform is spelled. Follow it through the holdings it still has; with
// none left, it's gone.
function followPlatform(selected: string | null, before: Holding[], after: Holding[]): string | null {
  if (selected === null || after.some((h) => h.platform === selected)) return selected;
  const ids = new Set(before.filter((h) => h.platform === selected).map((h) => h.id));
  return after.find((h) => ids.has(h.id))?.platform ?? null;
}

// How a failed load ends the sentence on the error screen: what the API said, if it answered.
const reason = (e: unknown) => (e instanceof ApiError ? `: ${e.message}` : '. Please try again.');

const EMPTY_SUMMARY: WealthSummary = {
  netWorth: { usd: 0 },
  holdingsCount: 0,
  ytd: { basis: 'NO_BASELINE', growthPct: 0 },
  liquidity: { liquidPct: 0, illiquidPct: 0, liquidAssetClasses: [] },
  byAssetClass: [],
  byPlatform: [],
};

export const WealthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [view, setViewState] = useState<ViewType>('dashboard');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  // The Assets table's search, filters and order outlive a trip to another view (but not the account).
  const [assetsTable, setAssetsTable] = useState<AssetsTableState>(INITIAL_ASSETS_TABLE);

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const holdingsRef = useRef<Holding[]>([]);
  // Overlapping refreshes (a mutation's while an earlier one is still out) can answer out of order: only
  // the answer to a newer one than what's on screen is shown.
  const refreshesStarted = useRef(0);
  const refreshShown = useRef(0);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [summary, setSummary] = useState<WealthSummary>(EMPTY_SUMMARY);
  const [assetClasses, setAssetClasses] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const [estimateParams, setEstimateParams] = useState<EstimateParams>({
    contribution: 900,
    yieldPct: 9,
    years: 12,
  });

  // Every read comes from the backend now (Fase 6 cutover) — no localStorage, no client-side
  // aggregation. A mutation is followed by a full refresh rather than an optimistic update: this
  // is a low-traffic personal dashboard, so staying simple and always-authoritative beats the
  // complexity of reconciling optimistic state with what the server actually persisted.
  const refresh = useCallback(async () => {
    const refreshId = ++refreshesStarted.current;
    let results;
    try {
      results = await Promise.all([
        api.getSummary(),
        api.getHoldings(),
        api.getPlatforms(),
        api.getAssetClasses(),
        api.getSnapshots(),
      ]);
    } catch (e) {
      // Newer data is already on screen: nothing to report.
      if (refreshId < refreshShown.current) return;
      // A newer refresh that failed still supersedes older ones: they'd show data from before it.
      refreshShown.current = refreshId;
      throw e;
    }
    const [summaryRes, holdingsRes, platformsRes, assetClassesRes, snapshotsRes] = results;
    if (refreshId < refreshShown.current) return;
    refreshShown.current = refreshId;
    setLoadError(null); // an earlier refresh's failure, if any, is moot now
    const before = holdingsRef.current;
    holdingsRef.current = holdingsRes;
    setSummary(summaryRes);
    setHoldings(holdingsRes);
    setPlatforms(platformsRes);
    setAssetClasses(assetClassesRes.all);
    setSnapshots(snapshotsRes);
    setSelectedPlatform((selected) => followPlatform(selected, before, holdingsRes));
    setDataVersion((v) => v + 1);
  }, []);

  // The first load, and Retry on the error screen, which reloads in place: the view and selection stay.
  const load = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      setLoading(true);
      setLoadError(null);
      try {
        await refresh();
      } catch (e) {
        if (isCurrent()) setLoadError(`Couldn't load your data${reason(e)}`);
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [refresh],
  );

  useEffect(() => {
    let current = true;
    void load(() => current);
    return () => {
      current = false;
    };
  }, [load]);

  // Computed values — all sourced from GET /wealth/summary (server-side aggregation), not
  // recomputed from the raw holdings list on every render.
  const netWorthUSD = summary.netWorth.usd;
  const netWorthFormatted = useMemo(() => formatCurrency(netWorthUSD), [netWorthUSD]);
  const ytdGrowthFormatted = useMemo(() => formatPercentage(summary.ytd.growthPct), [summary.ytd.growthPct]);
  const ytdLabel = useMemo(() => {
    if (summary.ytd.basis === 'YEAR_START_SNAPSHOT') return 'since January';
    if (summary.ytd.basis === 'EARLIEST_SNAPSHOT') return 'since your first snapshot';
    return 'no history yet';
  }, [summary.ytd.basis]);

  const liquidityPct = summary.liquidity.liquidPct;
  const illiquidPct = summary.liquidity.illiquidPct;

  const classDistribution = useMemo<ClassDistributionItem[]>(
    () =>
      summary.byAssetClass.map((item) => ({
        label: item.assetClass,
        value: item.valueUsd,
        pct: item.pct,
        color: assetClassColor(item.assetClass),
        tagClass: assetClassTag(item.assetClass),
        pctLabel: item.pct.toFixed(1) + '%',
      })),
    [summary.byAssetClass],
  );

  const platformDistribution = useMemo<PlatformCardItem[]>(
    () =>
      summary.byPlatform.map((item) => ({
        name: item.name,
        type: item.type,
        balanceUSD: item.valueUsd,
        balanceFormatted: formatCurrency(item.valueUsd),
        pctOfTotal: item.pct,
        pctLabel: item.pct.toFixed(1) + '%',
        color: platformColor(item.name),
        tagClass: platformTag(item.type),
        initial: initialOf(item.name),
        isActive: selectedPlatform === item.name,
      })),
    [summary.byPlatform, selectedPlatform],
  );

  const selectedPlatformHoldings = useMemo(() => {
    if (!selectedPlatform) return [];
    return holdings.filter((h) => h.platform === selectedPlatform);
  }, [holdings, selectedPlatform]);

  // Actions. Once a change went through, failing to reload afterwards isn't the change failing: reported
  // as such, it would invite doing it again (a duplicate holding, say). It's the error screen instead.
  const reloadAfterChange = useCallback(async () => {
    try {
      await refresh();
    } catch (e) {
      setLoadError(`Your change was saved, but your data couldn't be reloaded${reason(e)}`);
    }
  }, [refresh]);

  const addHolding = useCallback(
    async (input: HoldingInput) => {
      await api.createHolding(input);
      await reloadAfterChange();
    },
    [reloadAfterChange],
  );

  const updateHolding = useCallback(
    async (id: string, patch: HoldingPatch) => {
      await api.updateHolding(id, patch);
      await reloadAfterChange();
    },
    [reloadAfterChange],
  );

  const deleteHolding = useCallback(
    async (id: string) => {
      await api.deleteHolding(id);
      await reloadAfterChange();
    },
    [reloadAfterChange],
  );

  const takeSnapshot = useCallback(async () => {
    await api.createSnapshot();
    await reloadAfterChange();
  }, [reloadAfterChange]);

  const deleteSnapshot = useCallback(
    async (id: string) => {
      await api.deleteSnapshot(id);
      await reloadAfterChange();
    },
    [reloadAfterChange],
  );

  // A movement the API refused because what's on screen is out of date (a holding removed or changed on
  // another device, a movement already undone) reloads it, so the next try starts from what's there.
  const reloadIfStale = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && (e.status === 404 || e.status === 409)) refresh().catch(() => {});
      return e;
    },
    [refresh],
  );

  const recordMovement = useCallback(
    async (input: MovementInput) => {
      let movement: Movement;
      try {
        movement = await api.createMovement(input);
      } catch (e) {
        throw reloadIfStale(e);
      }
      await reloadAfterChange();
      return movement;
    },
    [reloadAfterChange, reloadIfStale],
  );

  const revertMovement = useCallback(
    async (id: string) => {
      try {
        await api.deleteMovement(id);
      } catch (e) {
        throw reloadIfStale(e);
      }
      await reloadAfterChange();
    },
    [reloadAfterChange, reloadIfStale],
  );

  return (
    <WealthContext.Provider
      value={{
        view,
        selectedPlatform,
        assetsTable,
        holdings,
        platforms,
        snapshots,
        estimateParams,
        loading,
        loadError,
        dataVersion,

        netWorthUSD,
        netWorthFormatted,
        ytdGrowthFormatted,
        ytdLabel,
        liquidityPct,
        illiquidPct,
        classDistribution,
        platformDistribution,
        selectedPlatformHoldings,
        availableAssetClasses: assetClasses,

        setView: (v) => {
          setViewState(v);
          setSelectedPlatform(null);
        },
        setSelectedPlatform,
        openPlatform: (platform) => {
          setViewState('platforms');
          setSelectedPlatform(platform);
        },
        setAssetsTable,
        setEstimateParams,
        addHolding,
        updateHolding,
        deleteHolding,
        takeSnapshot,
        deleteSnapshot,
        recordMovement,
        revertMovement,
        refresh,
        retry: () => load(),
      }}
    >
      {children}
    </WealthContext.Provider>
  );
};

export const useWealth = () => {
  const context = useContext(WealthContext);
  if (!context) {
    throw new Error('useWealth must be used within a WealthProvider');
  }
  return context;
};
