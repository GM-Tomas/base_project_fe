'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import { Holding, Platform, Snapshot, WealthSummary, AssetClass, ViewType, EstimateParams } from '@/types/wealth';
import { assetClassColor, assetClassTag, platformColor, platformTag } from '@/lib/constants';
import { formatCurrency, formatPercentage } from '@/lib/calculations';
import { api, ApiError, HoldingInput } from '@/lib/api';

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
  assetFilter: string;
  holdings: Holding[];
  platforms: Platform[];
  snapshots: Snapshot[];
  estimateParams: EstimateParams;
  isAddModalOpen: boolean;
  loading: boolean;
  loadError: string | null;

  // Computed Values
  netWorthUSD: number;
  netWorthFormatted: string;
  ytdGrowthFormatted: string;
  ytdLabel: string;
  liquidityPct: number;
  illiquidPct: number;
  classDistribution: ClassDistributionItem[];
  platformDistribution: PlatformCardItem[];
  filteredHoldings: Holding[];
  selectedPlatformHoldings: Holding[];
  availableAssetClasses: AssetClass[];

  // Actions
  setView: (view: ViewType) => void;
  setSelectedPlatform: (platform: string | null) => void;
  setAssetFilter: (filter: string) => void;
  setEstimateParams: React.Dispatch<React.SetStateAction<EstimateParams>>;
  addHolding: (holding: HoldingInput) => Promise<void>;
  deleteHolding: (id: string) => Promise<void>;
  takeSnapshot: () => Promise<void>;
  openAddModal: () => void;
  closeAddModal: () => void;
  refresh: () => Promise<void>;
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
  const [assetFilter, setAssetFilter] = useState<string>('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

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
      // A newer refresh that failed still supersedes older ones: they'd show data from before it.
      refreshShown.current = Math.max(refreshShown.current, refreshId);
      throw e;
    }
    const [summaryRes, holdingsRes, platformsRes, assetClassesRes, snapshotsRes] = results;
    if (refreshId < refreshShown.current) return;
    refreshShown.current = refreshId;
    const before = holdingsRef.current;
    holdingsRef.current = holdingsRes;
    setSummary(summaryRes);
    setHoldings(holdingsRes);
    setPlatforms(platformsRes);
    setAssetClasses(assetClassesRes.all);
    setSnapshots(snapshotsRes);
    setSelectedPlatform((selected) => followPlatform(selected, before, holdingsRes));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    refresh()
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof ApiError ? e.message : 'Failed to load your data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

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
        initial: item.name.charAt(0) || '?',
        isActive: selectedPlatform === item.name,
      })),
    [summary.byPlatform, selectedPlatform],
  );

  const filteredHoldings = useMemo(() => {
    if (assetFilter === 'All') return holdings;
    return holdings.filter((h) => h.assetClass === assetFilter);
  }, [holdings, assetFilter]);

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
      const reason = e instanceof ApiError ? e.message : 'network error';
      setLoadError(`your change was saved, but your data couldn't be reloaded (${reason})`);
    }
  }, [refresh]);

  const addHolding = useCallback(
    async (input: HoldingInput) => {
      await api.createHolding(input);
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

  return (
    <WealthContext.Provider
      value={{
        view,
        selectedPlatform,
        assetFilter,
        holdings,
        platforms,
        snapshots,
        estimateParams,
        isAddModalOpen,
        loading,
        loadError,

        netWorthUSD,
        netWorthFormatted,
        ytdGrowthFormatted,
        ytdLabel,
        liquidityPct,
        illiquidPct,
        classDistribution,
        platformDistribution,
        filteredHoldings,
        selectedPlatformHoldings,
        availableAssetClasses: assetClasses,

        setView: (v) => {
          setViewState(v);
          setSelectedPlatform(null);
        },
        setSelectedPlatform,
        setAssetFilter,
        setEstimateParams,
        addHolding,
        deleteHolding,
        takeSnapshot,
        openAddModal: () => setIsAddModalOpen(true),
        closeAddModal: () => setIsAddModalOpen(false),
        refresh,
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
