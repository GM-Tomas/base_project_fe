'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { Holding, Platform, Snapshot, WealthSummary, AssetClass, ViewType, EstimateParams } from '@/types/wealth';
import { ASSET_CLASS_COLORS, ASSET_CLASS_TAG_CLASSES, PLATFORM_COLORS, PLATFORM_TAG_CLASSES } from '@/lib/constants';
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

const EMPTY_SUMMARY: WealthSummary = {
  netWorth: { usd: 0, ars: null, fxRate: { available: false } },
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
    const [summaryRes, holdingsRes, platformsRes, assetClassesRes, snapshotsRes] = await Promise.all([
      api.getSummary(),
      api.getHoldings(),
      api.getPlatforms(),
      api.getAssetClasses(),
      api.getSnapshots(),
    ]);
    setSummary(summaryRes);
    setHoldings(holdingsRes);
    setPlatforms(platformsRes);
    setAssetClasses(assetClassesRes.all);
    setSnapshots(snapshotsRes);
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

  // Computed values — all sourced from GET /wealth/summary (SQL-side aggregation), not
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
        color: ASSET_CLASS_COLORS[item.assetClass] || 'var(--color-neutral-400)',
        tagClass: ASSET_CLASS_TAG_CLASSES[item.assetClass] || 'tag tag-neutral',
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
        color: PLATFORM_COLORS[item.name] || 'var(--color-neutral-400)',
        tagClass: PLATFORM_TAG_CLASSES[item.type] || 'tag tag-neutral',
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

  // Actions
  const addHolding = useCallback(
    async (input: HoldingInput) => {
      await api.createHolding(input);
      await refresh();
    },
    [refresh],
  );

  const deleteHolding = useCallback(
    async (id: string) => {
      await api.deleteHolding(id);
      await refresh();
    },
    [refresh],
  );

  const takeSnapshot = useCallback(async () => {
    await api.createSnapshot();
    await refresh();
  }, [refresh]);

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
