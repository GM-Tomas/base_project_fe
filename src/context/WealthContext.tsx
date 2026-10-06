'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import {
  Holding,
  Platform,
  Snapshot,
  WealthSummary,
  AssetClass,
  AssetClassInfo,
  ViewType,
  Movement,
  Debt,
  EstimatePreferences,
  ExpectedReturn,
  Preferences,
} from '@/types/wealth';
import { assetClassColor, assetClassTag, platformColor, platformTag } from '@/lib/constants';
import { initialOf } from '@/lib/initial';
import { formatCurrency, formatPercentage } from '@/lib/calculations';
import {
  api,
  ApiError,
  AssetClassInput,
  AssetClassPatch,
  DebtInput,
  DebtPatch,
  ExpectedReturnItem,
  HoldingInput,
  HoldingPatch,
  MovementInput,
  PastCheckpointInput,
  PlatformPatch,
} from '@/lib/api';
import { DEFAULT_PREFERENCES, withDefaults } from '@/lib/preferences';
import { INITIAL_ASSETS_TABLE, type AssetsTableState } from '@/lib/assetsTable';
import { DEFAULT_PERIOD, type PeriodPreset } from '@/lib/periods';
import { useAmountsHidden } from '@/lib/privacy';

/** How History is looked at: its period (a preset, or two dates), and whether today's value is in it. */
export interface HistoryPeriodState {
  preset: PeriodPreset;
  /** A custom period's dates (YYYY-MM-DD). */
  from: string;
  to: string;
  includeToday: boolean;
}

export const INITIAL_HISTORY_PERIOD: HistoryPeriodState = { preset: DEFAULT_PERIOD, from: '', to: '', includeToday: true };

interface ClassDistributionItem {
  label: AssetClass;
  value: number;
  pct: number;
  color: string;
  tagClass: string;
  pctLabel: string;
  /** Whether it counts as ready to spend. */
  liquid: boolean;
}

interface PlatformCardItem {
  name: string;
  type: string;
  balanceUSD: number;
  balanceFormatted: string;
  pctOfTotal: number;
  pctLabel: string;
  /** Its color: the user's, or one picked from its name. */
  color: string;
  tagClass: string;
  /** What its thumbnail shows: the user's text, or its initial. */
  initial: string;
  isActive: boolean;
}

/** How a class looks: its color (the user's or its default) and, with the user's, the tag that shows it. */
export interface ClassLook {
  color: string;
  /** The user's color, if they set one. */
  custom: string | null;
}

/** How a platform's thumbnail looks: the user's text and color, or its initial and a color from its name. */
export interface PlatformLook {
  text: string;
  color: string;
}

interface WealthContextType {
  // State
  view: ViewType;
  selectedPlatform: string | null;
  assetsTable: AssetsTableState;
  /** History's period: it outlives a trip to another view. */
  historyPeriod: HistoryPeriodState;
  holdings: Holding[];
  /** Largest balance first. */
  debts: Debt[];
  platforms: Platform[];
  snapshots: Snapshot[];
  /** How the user left Estimate: saved for every device, a second after each change. */
  /** Whether amounts are hidden (privacy mode): the formatters hide them; this re-renders what shows them. */
  amountsHidden: boolean;
  estimatePrefs: EstimatePreferences;
  /** All of them: Estimate's, the monthly checkpoint, the view to open on and History's period. */
  preferences: Preferences;
  /** Goes up each time saving the preferences fails (the change stays on screen, and is saved with the next). */
  preferencesSaveFailures: number;
  loading: boolean;
  loadError: string | null;
  /** Goes up each time fresh data is on screen: what's fetched apart (an activity list) reloads with it. */
  dataVersion: number;

  // Computed Values
  /** Assets minus debts: below zero when more is owed than owned. */
  netWorthUSD: number;
  netWorthFormatted: string;
  assetsUSD: number;
  debtsUSD: number;
  /** The debts' monthly payments, those that have one. */
  monthlyDebtPaymentsUSD: number;
  /** What the portfolio is expected to earn in a year (each holding's return weighted by value). */
  expectedReturn: ExpectedReturn;
  ytdGrowthFormatted: string;
  ytdLabel: string;
  liquidityPct: number;
  illiquidPct: number;
  classDistribution: ClassDistributionItem[];
  platformDistribution: PlatformCardItem[];
  selectedPlatformHoldings: Holding[];
  /** The user's classes, in the order they're offered. */
  availableAssetClasses: AssetClass[];
  /** The same, each with how it's set up and what it holds. */
  assetClassInfos: AssetClassInfo[];
  /** How a class looks, as the user set it up. */
  classLook: (name: string) => ClassLook;
  /** How a platform's thumbnail looks, as the user set it up. */
  platformLook: (name: string) => PlatformLook;

  // Actions
  setView: (view: ViewType) => void;
  setSelectedPlatform: (platform: string | null) => void;
  /** Platforms view, with that platform's holdings open. */
  openPlatform: (platform: string) => void;
  setAssetsTable: React.Dispatch<React.SetStateAction<AssetsTableState>>;
  setHistoryPeriod: React.Dispatch<React.SetStateAction<HistoryPeriodState>>;
  /** Changes how Estimate is set up (saved a second later). */
  setEstimatePrefs: (change: (prefs: EstimatePreferences) => EstimatePreferences) => void;
  /** Changes how the app opens (saved at once). A new History period applies to History now too. */
  setGeneralPrefs: (change: Partial<Omit<Preferences, 'estimate'>>) => void;
  addHolding: (holding: HoldingInput) => Promise<void>;
  updateHolding: (id: string, patch: HoldingPatch) => Promise<void>;
  deleteHolding: (id: string) => Promise<void>;
  /** Sets many holdings' expected returns at once, all or none. */
  setExpectedReturns: (items: ExpectedReturnItem[]) => Promise<void>;
  /** Saves today's net worth, or, given one, a checkpoint from the past. */
  takeSnapshot: (past?: PastCheckpointInput) => Promise<void>;
  deleteSnapshot: (id: string) => Promise<void>;
  addDebt: (input: DebtInput) => Promise<Debt>;
  updateDebt: (id: string, patch: DebtPatch) => Promise<void>;
  deleteDebt: (id: string) => Promise<void>;
  /** Records a gain, loss, deposit, withdrawal, transfer or what happened to a debt; resolves to it once data is reloaded. */
  recordMovement: (input: MovementInput) => Promise<Movement>;
  /** Undoes a movement: its effect on values is reverted and it's gone from the activity. */
  revertMovement: (id: string) => Promise<void>;
  createAssetClass: (input: AssetClassInput) => Promise<AssetClassInfo>;
  /** Changes a class; a new name renames it on all its holdings (merging, with mergeIfExists). */
  updateAssetClass: (id: string, patch: AssetClassPatch) => Promise<AssetClassInfo>;
  /** Removes a class; its holdings, if any, move to moveTo. */
  deleteAssetClass: (id: string, moveTo?: string) => Promise<void>;
  /** Changes how a platform looks, or its name on all its holdings (merging, with mergeIfExists). */
  updatePlatform: (id: string, patch: PlatformPatch) => Promise<Platform>;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
}

const WealthContext = createContext<WealthContextType | undefined>(undefined);

const PREFERENCES_SAVE_DELAY_MS = 1000;

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
  assets: { usd: 0 },
  debts: { usd: 0, count: 0, monthlyPaymentUsd: 0 },
  holdingsCount: 0,
  expectedReturn: { weightedPct: null, coveragePct: 0, annualUsd: 0 },
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
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriodState>(INITIAL_HISTORY_PERIOD);

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const holdingsRef = useRef<Holding[]>([]);
  // Overlapping refreshes (a mutation's while an earlier one is still out) can answer out of order: only
  // the answer to a newer one than what's on screen is shown.
  const refreshesStarted = useRef(0);
  const refreshShown = useRef(0);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [summary, setSummary] = useState<WealthSummary>(EMPTY_SUMMARY);
  const [assetClasses, setAssetClasses] = useState<string[]>([]);
  const [assetClassInfos, setAssetClassInfos] = useState<AssetClassInfo[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  // Amounts are formatted as "$•••••" in privacy mode: everything that shows them follows it from here.
  const amountsHidden = useAmountsHidden();

  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const preferencesRef = useRef<Preferences>(DEFAULT_PREFERENCES);
  const [preferencesSaveFailures, setPreferencesSaveFailures] = useState(0);
  const pendingSave = useRef<{ timer: ReturnType<typeof setTimeout>; preferences: Preferences } | null>(null);
  // Whether the app has opened: how it opens (the view, History's period) is applied once, on the first load.
  const opened = useRef(false);

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
        api.getDebts(),
      ]);
    } catch (e) {
      // Newer data is already on screen: nothing to report.
      if (refreshId < refreshShown.current) return;
      // A newer refresh that failed still supersedes older ones: they'd show data from before it.
      refreshShown.current = refreshId;
      throw e;
    }
    const [summaryRes, holdingsRes, platformsRes, assetClassesRes, snapshotsRes, debtsRes] = results;
    if (refreshId < refreshShown.current) return;
    refreshShown.current = refreshId;
    setLoadError(null); // an earlier refresh's failure, if any, is moot now
    const before = holdingsRef.current;
    holdingsRef.current = holdingsRes;
    setSummary(summaryRes);
    setHoldings(holdingsRes);
    setPlatforms(platformsRes);
    setAssetClasses(assetClassesRes.all);
    setAssetClassInfos(assetClassesRes.classes ?? []);
    setSnapshots(snapshotsRes);
    setDebts(debtsRes);
    setSelectedPlatform((selected) => followPlatform(selected, before, holdingsRes));
    setDataVersion((v) => v + 1);
  }, []);

  // The first load, and Retry on the error screen, which reloads in place: the view and selection stay.
  // Preferences that can't be read aren't worth an error screen: Estimate starts from the defaults.
  const load = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      setLoading(true);
      setLoadError(null);
      try {
        const [read] = await Promise.all([api.getPreferences().catch(() => null), refresh()]);
        const saved = read && withDefaults(read);
        if (saved && isCurrent() && !pendingSave.current) {
          preferencesRef.current = saved;
          setPreferences(saved);
        }
        if (isCurrent() && !opened.current) {
          opened.current = true;
          const start = saved ?? DEFAULT_PREFERENCES;
          setViewState(start.defaultView);
          setHistoryPeriod((period) => ({ ...period, preset: start.historyPeriod }));
        }
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

  // Preferences are saved a second after the last change, whole (PUT replaces them); leaving (signing out)
  // saves what's pending at once.
  const savePreferences = useCallback((next: Preferences) => {
    api.savePreferences(next).catch(() => setPreferencesSaveFailures((n) => n + 1));
  }, []);
  const changePreferences = useCallback(
    (change: (prefs: Preferences) => Preferences, delayMs: number) => {
      const next = change(preferencesRef.current);
      preferencesRef.current = next;
      setPreferences(next);
      if (pendingSave.current) clearTimeout(pendingSave.current.timer);
      const timer = setTimeout(() => {
        pendingSave.current = null;
        savePreferences(next);
      }, delayMs);
      pendingSave.current = { timer, preferences: next };
    },
    [savePreferences],
  );
  const setEstimatePrefs = useCallback(
    (change: (prefs: EstimatePreferences) => EstimatePreferences) =>
      changePreferences((prefs) => ({ ...prefs, estimate: change(prefs.estimate) }), PREFERENCES_SAVE_DELAY_MS),
    [changePreferences],
  );
  const setGeneralPrefs = useCallback(
    (change: Partial<Omit<Preferences, 'estimate'>>) => {
      changePreferences((prefs) => ({ ...prefs, ...change }), 0);
      const preset = change.historyPeriod;
      if (preset) setHistoryPeriod((period) => ({ ...period, preset }));
    },
    [changePreferences],
  );
  useEffect(
    () => () => {
      const pending = pendingSave.current;
      if (!pending) return;
      clearTimeout(pending.timer);
      pendingSave.current = null;
      savePreferences(pending.preferences);
    },
    [savePreferences],
  );

  // Computed values — all sourced from GET /wealth/summary (server-side aggregation), not
  // recomputed from the raw holdings list on every render.
  const netWorthUSD = summary.netWorth.usd;
  const netWorthFormatted = useMemo(() => formatCurrency(netWorthUSD), [netWorthUSD, amountsHidden]); // eslint-disable-line react-hooks/exhaustive-deps
  const assetsUSD = summary.assets.usd;
  const debtsUSD = summary.debts.usd;
  const monthlyDebtPaymentsUSD = summary.debts.monthlyPaymentUsd;
  const expectedReturn = summary.expectedReturn;
  const ytdGrowthFormatted = useMemo(() => formatPercentage(summary.ytd.growthPct), [summary.ytd.growthPct]);
  const ytdLabel = useMemo(() => {
    if (summary.ytd.basis === 'YEAR_START_SNAPSHOT') return 'since January';
    if (summary.ytd.basis === 'EARLIEST_SNAPSHOT') return 'since your first snapshot';
    return 'no history yet';
  }, [summary.ytd.basis]);

  const liquidityPct = summary.liquidity.liquidPct;
  const illiquidPct = summary.liquidity.illiquidPct;

  // How classes and platforms look, as the user set them up (from the lists, which have them all).
  const classColors = useMemo(() => new Map(assetClassInfos.map((c) => [c.name, c.color])), [assetClassInfos]);
  const classLook = useCallback(
    (name: string): ClassLook => {
      const custom = classColors.get(name) ?? null;
      return { color: custom ?? assetClassColor(name), custom };
    },
    [classColors],
  );
  const platformsByName = useMemo(() => new Map(platforms.map((p) => [p.name, p])), [platforms]);
  const platformLook = useCallback(
    (name: string): PlatformLook => {
      const p = platformsByName.get(name);
      return { text: p?.avatarText ?? initialOf(name), color: p?.color ?? platformColor(name) };
    },
    [platformsByName],
  );

  const classDistribution = useMemo<ClassDistributionItem[]>(
    () =>
      summary.byAssetClass.map((item) => ({
        label: item.assetClass,
        value: item.valueUsd,
        pct: item.pct,
        color: item.color ?? assetClassColor(item.assetClass),
        tagClass: assetClassTag(item.assetClass),
        pctLabel: item.pct.toFixed(1) + '%',
        liquid: item.liquid ?? false,
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
        color: item.color ?? platformColor(item.name),
        tagClass: platformTag(item.type),
        initial: item.avatarText ?? initialOf(item.name),
        isActive: selectedPlatform === item.name,
      })),
    [summary.byPlatform, selectedPlatform, amountsHidden], // eslint-disable-line react-hooks/exhaustive-deps
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

  const setExpectedReturns = useCallback(
    async (items: ExpectedReturnItem[]) => {
      try {
        await api.setExpectedReturns(items);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) refresh().catch(() => {});
        throw e;
      }
      await reloadAfterChange();
    },
    [refresh, reloadAfterChange],
  );

  const takeSnapshot = useCallback(
    async (past?: PastCheckpointInput) => {
      await api.createSnapshot(past);
      await reloadAfterChange();
    },
    [reloadAfterChange],
  );

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

  const addDebt = useCallback(
    async (input: DebtInput) => {
      const debt = await api.createDebt(input);
      await reloadAfterChange();
      return debt;
    },
    [reloadAfterChange],
  );

  const updateDebt = useCallback(
    async (id: string, patch: DebtPatch) => {
      try {
        await api.updateDebt(id, patch);
      } catch (e) {
        throw reloadIfStale(e);
      }
      await reloadAfterChange();
    },
    [reloadAfterChange, reloadIfStale],
  );

  const deleteDebt = useCallback(
    async (id: string) => {
      try {
        await api.deleteDebt(id);
      } catch (e) {
        throw reloadIfStale(e);
      }
      await reloadAfterChange();
    },
    [reloadAfterChange, reloadIfStale],
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

  // Classes and platforms: a change that's out of date (renamed or removed on another device) reloads.
  const createAssetClass = useCallback(
    async (input: AssetClassInput) => {
      let created: AssetClassInfo;
      try {
        created = await api.createAssetClass(input);
      } catch (e) {
        throw reloadIfStale(e);
      }
      await reloadAfterChange();
      return created;
    },
    [reloadAfterChange, reloadIfStale],
  );

  const updateAssetClass = useCallback(
    async (id: string, patch: AssetClassPatch) => {
      let updated: AssetClassInfo;
      try {
        updated = await api.updateAssetClass(id, patch);
      } catch (e) {
        throw reloadIfStale(e);
      }
      await reloadAfterChange();
      return updated;
    },
    [reloadAfterChange, reloadIfStale],
  );

  const deleteAssetClass = useCallback(
    async (id: string, moveTo?: string) => {
      try {
        await api.deleteAssetClass(id, moveTo);
      } catch (e) {
        throw reloadIfStale(e);
      }
      await reloadAfterChange();
    },
    [reloadAfterChange, reloadIfStale],
  );

  const updatePlatform = useCallback(
    async (id: string, patch: PlatformPatch) => {
      let updated: Platform;
      try {
        updated = await api.updatePlatform(id, patch);
      } catch (e) {
        throw reloadIfStale(e);
      }
      await reloadAfterChange();
      return updated;
    },
    [reloadAfterChange, reloadIfStale],
  );

  return (
    <WealthContext.Provider
      value={{
        view,
        selectedPlatform,
        assetsTable,
        historyPeriod,
        holdings,
        debts,
        platforms,
        snapshots,
        amountsHidden,
        estimatePrefs: preferences.estimate,
        preferences,
        preferencesSaveFailures,
        loading,
        loadError,
        dataVersion,

        netWorthUSD,
        netWorthFormatted,
        assetsUSD,
        debtsUSD,
        monthlyDebtPaymentsUSD,
        expectedReturn,
        ytdGrowthFormatted,
        ytdLabel,
        liquidityPct,
        illiquidPct,
        classDistribution,
        platformDistribution,
        selectedPlatformHoldings,
        availableAssetClasses: assetClasses,
        assetClassInfos,
        classLook,
        platformLook,

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
        setHistoryPeriod,
        setEstimatePrefs,
        setGeneralPrefs,
        addHolding,
        updateHolding,
        deleteHolding,
        setExpectedReturns,
        takeSnapshot,
        deleteSnapshot,
        addDebt,
        updateDebt,
        deleteDebt,
        recordMovement,
        revertMovement,
        createAssetClass,
        updateAssetClass,
        deleteAssetClass,
        updatePlatform,
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
