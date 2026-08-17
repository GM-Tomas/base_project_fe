'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  Holding,
  PlatformMeta,
  HistorySnapshot,
  AssetClass,
  Currency,
  ViewType,
  EstimateParams,
} from '@/types/wealth';
import {
  INITIAL_HOLDINGS,
  INITIAL_PLATFORMS,
  INITIAL_HISTORY,
  DEFAULT_FX_USD_ARS,
  ASSET_CLASS_COLORS,
  ASSET_CLASS_TAG_CLASSES,
  PLATFORM_COLORS,
  PLATFORM_TAG_CLASSES,
} from '@/lib/constants';
import {
  formatCurrency,
  formatPercentage,
} from '@/lib/calculations';

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
  type: PlatformMeta['type'];
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
  currency: 'USD' | 'ARS';
  fxRate: number;
  view: ViewType;
  selectedPlatform: string | null;
  assetFilter: string;
  holdings: Holding[];
  platforms: PlatformMeta[];
  history: HistorySnapshot[];
  estimateParams: EstimateParams;
  isAddModalOpen: boolean;

  // Computed Values
  netWorthUSD: number;
  netWorthFormatted: string;
  ytdGrowthFormatted: string;
  liquidityPct: number;
  illiquidPct: number;
  classDistribution: ClassDistributionItem[];
  platformDistribution: PlatformCardItem[];
  filteredHoldings: Holding[];
  selectedPlatformHoldings: Holding[];

  // Actions
  setCurrency: (currency: 'USD' | 'ARS') => void;
  setView: (view: ViewType) => void;
  setSelectedPlatform: (platform: string | null) => void;
  setAssetFilter: (filter: string) => void;
  setEstimateParams: React.Dispatch<React.SetStateAction<EstimateParams>>;
  addHolding: (holding: Omit<Holding, 'id' | 'change'> & { change?: number }) => void;
  deleteHolding: (id: string | number) => void;
  takeSnapshot: () => void;
  openAddModal: () => void;
  closeAddModal: () => void;
}

const WealthContext = createContext<WealthContextType | undefined>(undefined);

export const WealthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currency, setCurrency] = useState<'USD' | 'ARS'>('USD');
  const [fxRate] = useState<number>(DEFAULT_FX_USD_ARS);
  const [view, setView] = useState<ViewType>('dashboard');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [assetFilter, setAssetFilter] = useState<string>('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  const [holdings, setHoldings] = useState<Holding[]>(INITIAL_HOLDINGS);
  const [platforms] = useState<PlatformMeta[]>(INITIAL_PLATFORMS);
  const [history, setHistory] = useState<HistorySnapshot[]>(INITIAL_HISTORY);

  const [estimateParams, setEstimateParams] = useState<EstimateParams>({
    contribution: 900,
    yieldPct: 9,
    years: 12,
  });

  // Hydrate from localStorage if available
  useEffect(() => {
    try {
      const savedHoldings = localStorage.getItem('base_holdings');
      if (savedHoldings) {
        setHoldings(JSON.parse(savedHoldings));
      }
      const savedHistory = localStorage.getItem('base_history');
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
      const savedCurrency = localStorage.getItem('base_currency');
      if (savedCurrency === 'USD' || savedCurrency === 'ARS') {
        setCurrency(savedCurrency);
      }
    } catch {
      // Ignore localStorage errors in SSR/sandboxed mode
    }
  }, []);

  // Save changes to localStorage
  const saveHoldings = (newHoldings: Holding[]) => {
    setHoldings(newHoldings);
    try {
      localStorage.setItem('base_holdings', JSON.stringify(newHoldings));
    } catch {
      // Ignore
    }
  };

  const saveHistory = (newHistory: HistorySnapshot[]) => {
    setHistory(newHistory);
    try {
      localStorage.setItem('base_history', JSON.stringify(newHistory));
    } catch {
      // Ignore
    }
  };

  const handleSetCurrency = (newCurrency: 'USD' | 'ARS') => {
    setCurrency(newCurrency);
    try {
      localStorage.setItem('base_currency', newCurrency);
    } catch {
      // Ignore
    }
  };

  // Calculations
  const netWorthUSD = useMemo(() => {
    return holdings.reduce((sum, h) => sum + h.value, 0);
  }, [holdings]);

  const netWorthFormatted = useMemo(() => {
    return formatCurrency(netWorthUSD, currency, fxRate);
  }, [netWorthUSD, currency, fxRate]);

  const ytdGrowthFormatted = useMemo(() => {
    const startYearValue = history[0]?.v || netWorthUSD;
    const growth = ((netWorthUSD - startYearValue) / startYearValue) * 100;
    return formatPercentage(growth);
  }, [netWorthUSD, history]);

  // Asset Class Distribution
  const classDistribution = useMemo(() => {
    const map: Partial<Record<AssetClass, number>> = {};
    holdings.forEach((h) => {
      map[h.cls] = (map[h.cls] || 0) + h.value;
    });

    const items: ClassDistributionItem[] = (Object.keys(map) as AssetClass[]).map((cls) => {
      const val = map[cls] || 0;
      const pct = netWorthUSD > 0 ? (val / netWorthUSD) * 100 : 0;
      return {
        label: cls,
        value: val,
        pct,
        color: ASSET_CLASS_COLORS[cls] || 'var(--color-neutral-400)',
        tagClass: ASSET_CLASS_TAG_CLASSES[cls] || 'tag tag-neutral',
        pctLabel: pct.toFixed(1) + '%',
      };
    });

    return items.sort((a, b) => b.value - a.value);
  }, [holdings, netWorthUSD]);

  // Liquidity breakdown
  const { liquidityPct, illiquidPct } = useMemo(() => {
    const liquidClasses: AssetClass[] = ['Cash', 'Equity', 'Crypto', 'Index Fund'];
    const liquidVal = holdings
      .filter((h) => liquidClasses.includes(h.cls))
      .reduce((sum, h) => sum + h.value, 0);

    const liqPct = netWorthUSD > 0 ? Number(((liquidVal / netWorthUSD) * 100).toFixed(1)) : 0;
    const illiqPct = Number((100 - liqPct).toFixed(1));
    return { liquidityPct: liqPct, illiquidPct: illiqPct };
  }, [holdings, netWorthUSD]);

  // Platform Distribution
  const platformDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    holdings.forEach((h) => {
      map[h.platform] = (map[h.platform] || 0) + h.value;
    });

    return platforms.map((p) => {
      const bal = map[p.name] || 0;
      const pct = netWorthUSD > 0 ? (bal / netWorthUSD) * 100 : 0;
      return {
        name: p.name,
        type: p.type,
        balanceUSD: bal,
        balanceFormatted: formatCurrency(bal, currency, fxRate),
        pctOfTotal: pct,
        pctLabel: pct.toFixed(1) + '%',
        color: PLATFORM_COLORS[p.name] || 'var(--color-neutral-400)',
        tagClass: PLATFORM_TAG_CLASSES[p.type] || 'tag tag-neutral',
        initial: p.name[0],
        isActive: selectedPlatform === p.name,
      };
    });
  }, [holdings, platforms, netWorthUSD, currency, fxRate, selectedPlatform]);

  // Filtered holdings
  const filteredHoldings = useMemo(() => {
    if (assetFilter === 'All') return holdings;
    return holdings.filter((h) => h.cls === assetFilter);
  }, [holdings, assetFilter]);

  // Selected Platform holdings
  const selectedPlatformHoldings = useMemo(() => {
    if (!selectedPlatform) return [];
    return holdings.filter((h) => h.platform === selectedPlatform);
  }, [holdings, selectedPlatform]);

  // Actions
  const addHolding = (newHolding: Omit<Holding, 'id' | 'change'> & { change?: number }) => {
    const item: Holding = {
      ...newHolding,
      id: Date.now().toString(),
      change: newHolding.change ?? 0,
    };
    saveHoldings([...holdings, item]);
  };

  const deleteHolding = (id: string | number) => {
    saveHoldings(holdings.filter((h) => h.id !== id));
  };

  const takeSnapshot = () => {
    const snapMonth = `Snap ${history.length - INITIAL_HISTORY.length + 1}`;
    const newSnap: HistorySnapshot = {
      m: snapMonth,
      v: Math.round(netWorthUSD),
    };
    saveHistory([...history, newSnap]);
  };

  return (
    <WealthContext.Provider
      value={{
        currency,
        fxRate,
        view,
        selectedPlatform,
        assetFilter,
        holdings,
        platforms,
        history,
        estimateParams,
        isAddModalOpen,

        netWorthUSD,
        netWorthFormatted,
        ytdGrowthFormatted,
        liquidityPct,
        illiquidPct,
        classDistribution,
        platformDistribution,
        filteredHoldings,
        selectedPlatformHoldings,

        setCurrency: handleSetCurrency,
        setView: (v) => {
          setView(v);
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
