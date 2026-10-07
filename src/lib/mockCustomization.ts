import type { AssetClassInfo, AvailableAssetClasses, Holding, Platform } from '@/types/wealth';
import type { AssetClassInput, AssetClassPatch, PlatformPatch } from './api';
import { ApiError } from './apiError';
import {
  AVATAR_MESSAGE,
  TEXT_COLOR_MESSAGE,
  byName,
  classIdOf,
  COLOR_MESSAGE,
  fromBase64url,
  isHexColor,
  MAX_CLASS_NAME,
  MAX_CLASS_SETTINGS,
  MAX_PLATFORM_NAME,
  MAX_PLATFORM_SETTINGS,
  MAX_PLATFORM_TYPE,
  normalizeAvatar,
  platformIdOf,
  validAvatar,
} from './customization';
import { normalizeLabel as label, platformKey } from './labels';
import { RETURN_RANGE, round2, validReturn } from './returns';

// The API's classes and platforms as each user sets them up (base_project_go: AssetClassService,
// PlatformService), for the demo: what's changed is kept per class and per platform on top of the defaults,
// and renaming, merging or removing one moves its holdings.

interface ClassSettings {
  color: string | null;
  liquid: boolean | null;
  expectedReturnPct: number | null;
  /** A default class the user removed. */
  hidden: boolean;
}

interface PlatformLook {
  type: string | null;
  avatarText: string | null;
  color: string | null;
  textColor: string | null;
}

type FieldError = { field: string; message: string };

const cents = (n: number) => Math.round(n * 100) / 100;
const length = (text: string) => [...text].length;

const reject = (errors: FieldError[]) => {
  if (errors.length) throw new ApiError(400, errors.map((e) => e.message).join('; '), errors);
};

export interface MockCustomizationOptions {
  /** The demo's holdings, changed in place by renames and merges. */
  holdings: Holding[];
  /** The classes every account starts with, in order, and those that count as ready to spend. */
  defaultClasses: string[];
  liquidClasses: string[];
  /** The type a platform had before users could set it (earlier versions'), by name. */
  legacyType: (name: string) => string | null;
  /** How many classes and platforms a user can set up (the API's, unless a test says otherwise). */
  limits?: { classes: number; platforms: number };
}

export function createMockCustomization({
  holdings,
  defaultClasses,
  liquidClasses,
  legacyType,
  limits = { classes: MAX_CLASS_SETTINGS, platforms: MAX_PLATFORM_SETTINGS },
}: MockCustomizationOptions) {
  // Maps: names are typed by users, and "__proto__" is just another class.
  const classSettings = new Map<string, ClassSettings>();
  const looks = new Map<string, PlatformLook>();

  // ── Classes ─────────────────────────────────────────────────────────────────────────────────────────────

  const isDefault = (name: string) => defaultClasses.includes(name);
  const inUse = () => [...new Set(holdings.map((h) => h.assetClass))];

  /** The defaults the user kept, in order, then the ones they created or use, by name. */
  const visible = () => {
    const kept = defaultClasses.filter((d) => !classSettings.get(d)?.hidden);
    const others = new Set<string>();
    for (const [name, s] of classSettings) if (!s.hidden && !kept.includes(name)) others.add(name);
    for (const name of inUse()) if (!kept.includes(name)) others.add(name);
    return [...kept, ...[...others].sort(byName)];
  };

  const liquid = (name: string) => classSettings.get(name)?.liquid ?? liquidClasses.includes(name);
  const classReturn = (name: string) => classSettings.get(name)?.expectedReturnPct ?? null;
  const classColor = (name: string) => classSettings.get(name)?.color ?? null;

  const info = (name: string): AssetClassInfo => {
    const members = holdings.filter((h) => h.assetClass === name);
    return {
      id: classIdOf(name),
      name,
      color: classColor(name),
      liquid: liquid(name),
      expectedReturnPct: classReturn(name),
      isDefault: isDefault(name),
      holdingsCount: members.length,
      valueUsd: cents(members.reduce((sum, h) => sum + h.valueUsd, 0)),
    };
  };

  const notFound = () => new ApiError(404, 'Asset class not found');
  const classExists = (name: string) => new ApiError(409, `There's already a class named "${name}"`, undefined, 'class-exists');

  /** The class an id names (an id this API could have given). */
  const parseId = (id: string) => {
    const name = fromBase64url(id);
    if (name === null || !name || label(name) !== name || length(name) > MAX_CLASS_NAME) throw notFound();
    return name;
  };

  /** The class an id names, if it's one of the user's. */
  const classOf = (id: string) => {
    const name = parseId(id);
    if (!visible().includes(name)) throw notFound();
    return name;
  };

  /** A default class's settings are only kept for what differs from its defaults; a created class by them. */
  const keep = (name: string, s: ClassSettings | null) => {
    const differs = !!s && (s.hidden || s.color !== null || s.liquid !== null || s.expectedReturnPct !== null);
    return s && (differs || !isDefault(name)) ? s : null;
  };

  /** What's left of a class the user removed (or renamed, or merged): a default one stays hidden. */
  const removed = (name: string): ClassSettings | null =>
    isDefault(name) ? { color: null, liquid: null, expectedReturnPct: null, hidden: true } : null;

  /** Applies these settings changes, within the user's cap. */
  const writeClasses = (changes: [name: string, after: ClassSettings | null][]) => {
    const added = changes.reduce((n, [name, after]) => n + (after ? 1 : 0) - (classSettings.has(name) ? 1 : 0), 0);
    if (added > 0 && classSettings.size + added > limits.classes) {
      throw new ApiError(409, `You can set up to ${limits.classes} asset classes. Remove one to add another.`, undefined, 'limit-exceeded');
    }
    for (const [name, after] of changes) {
      if (after) classSettings.set(name, after);
      else classSettings.delete(name);
    }
  };

  const moveHoldings = (from: string, to: string) => {
    for (const h of holdings) if (h.assetClass === from) h.assetClass = to;
  };

  const classChecks = (fields: Partial<Record<keyof AssetClassPatch, unknown>>, nameRequired: boolean) => {
    const errors: FieldError[] = [];
    if ('name' in fields || nameRequired) {
      const name = typeof fields.name === 'string' ? label(fields.name) : '';
      if (!name) errors.push({ field: 'name', message: 'Name is required' });
      else if (length(name) > MAX_CLASS_NAME) errors.push({ field: 'name', message: `Name must be at most ${MAX_CLASS_NAME} characters` });
    }
    const { color, expectedReturnPct: pct } = fields;
    if (color !== undefined && color !== null && !(typeof color === 'string' && isHexColor(color))) {
      errors.push({ field: 'color', message: COLOR_MESSAGE });
    }
    if (pct !== undefined && pct !== null && !(typeof pct === 'number' && validReturn(pct))) {
      errors.push({ field: 'expectedReturnPct', message: RETURN_RANGE });
    }
    reject(errors);
  };

  const getAssetClasses = (): AvailableAssetClasses => {
    const all = visible();
    return { defaults: [...defaultClasses], inUse: inUse().sort(byName), all, classes: all.map(info) };
  };

  const createAssetClass = (input: AssetClassInput): AssetClassInfo => {
    classChecks(input, true);
    const name = label(input.name);
    if (visible().includes(name)) throw classExists(name);
    const settings: ClassSettings = {
      color: input.color?.toLowerCase() ?? null,
      liquid: input.liquid ?? null,
      expectedReturnPct: input.expectedReturnPct == null ? null : round2(input.expectedReturnPct),
      hidden: false,
    };
    writeClasses([[name, keep(name, settings)]]);
    return info(name);
  };

  const updateAssetClass = (id: string, patch: AssetClassPatch): AssetClassInfo => {
    classChecks(patch, false);
    const name = classOf(id);
    const target = patch.name === undefined ? name : label(patch.name);
    const current = classSettings.get(name) ?? { color: null, liquid: null, expectedReturnPct: null, hidden: false };
    const updated: ClassSettings = {
      ...current,
      ...(patch.color !== undefined && { color: patch.color?.toLowerCase() ?? null }),
      ...(patch.liquid !== undefined && { liquid: patch.liquid }),
      ...(patch.expectedReturnPct !== undefined && { expectedReturnPct: patch.expectedReturnPct === null ? null : round2(patch.expectedReturnPct) }),
    };
    if (target === name) {
      const same = (['color', 'liquid', 'expectedReturnPct'] as const).every((k) => updated[k] === current[k]);
      if (!same) writeClasses([[name, keep(name, updated)]]);
      return info(name);
    }
    if (visible().includes(target)) {
      if (!patch.mergeIfExists) throw classExists(target);
      // The class merged into keeps its settings.
      writeClasses([[name, removed(name)]]);
      moveHoldings(name, target);
      return info(target);
    }
    // A new name: the class goes there as set up (over a removed default's note, if any).
    writeClasses([
      [name, removed(name)],
      [target, keep(target, { ...updated, hidden: false })],
    ]);
    moveHoldings(name, target);
    return info(target);
  };

  const deleteAssetClass = (id: string, moveTo?: string) => {
    const parsed = parseId(id);
    if (moveTo !== undefined) {
      const to = label(moveTo);
      if (!to) reject([{ field: 'moveTo', message: 'AssetClass must not be blank' }]);
      if (length(to) > MAX_CLASS_NAME) reject([{ field: 'moveTo', message: `AssetClass exceeds max length (${length(to)} > ${MAX_CLASS_NAME})` }]);
      if (parsed === to) reject([{ field: 'moveTo', message: 'moveTo must be another class' }]);
    }
    const name = classOf(id);
    if (inUse().includes(name)) {
      if (moveTo === undefined) {
        throw new ApiError(409, `${name} still has assets: say which class they move to (moveTo)`, undefined, 'class-in-use');
      }
      moveHoldings(name, label(moveTo));
    }
    writeClasses([[name, removed(name)]]);
  };

  // ── Platforms ───────────────────────────────────────────────────────────────────────────────────────────

  /** A platform as the user set it up: its type (theirs, else an earlier version's, else Other) and thumbnail. */
  const look = (name: string) => {
    const l = looks.get(platformKey(name));
    return {
      type: l?.type ?? legacyType(name) ?? 'Other',
      avatarText: l?.avatarText ?? null,
      color: l?.color ?? null,
      textColor: l?.textColor ?? null,
    };
  };

  const getPlatforms = (): Platform[] => {
    // Holdings are kept oldest first, so a platform's first one is its earliest (and spells it).
    const groups = new Map<string, { first: Holding; count: number; value: number }>();
    for (const h of holdings) {
      const g = groups.get(platformKey(h.platform));
      if (g) {
        g.count++;
        g.value += h.valueUsd;
      } else {
        groups.set(platformKey(h.platform), { first: h, count: 1, value: h.valueUsd });
      }
    }
    return [...groups.values()]
      .map(({ first: h, count, value }) => ({
        id: platformIdOf(h.platform),
        name: h.platform,
        ...look(h.platform),
        holdingsCount: count,
        valueUsd: cents(value),
        createdAt: h.createdAt,
      }))
      .sort((a, b) => byName(a.name, b.name));
  };

  const updatePlatform = (id: string, patch: PlatformPatch): Platform => {
    const errors: FieldError[] = [];
    if (patch.name !== undefined) {
      const name = typeof patch.name === 'string' ? label(patch.name) : '';
      if (!name) errors.push({ field: 'name', message: 'Name is required' });
      else if (length(name) > MAX_PLATFORM_NAME) errors.push({ field: 'name', message: `Name must be at most ${MAX_PLATFORM_NAME} characters` });
    }
    if (typeof patch.type === 'string' && length(label(patch.type)) > MAX_PLATFORM_TYPE) {
      errors.push({ field: 'type', message: `type must be at most ${MAX_PLATFORM_TYPE} characters` });
    }
    if (typeof patch.avatarText === 'string' && !validAvatar(patch.avatarText)) errors.push({ field: 'avatarText', message: AVATAR_MESSAGE });
    if (typeof patch.color === 'string' && !isHexColor(patch.color)) errors.push({ field: 'color', message: COLOR_MESSAGE });
    if (typeof patch.textColor === 'string' && !isHexColor(patch.textColor)) errors.push({ field: 'textColor', message: TEXT_COLOR_MESSAGE });
    reject(errors);

    const platforms = getPlatforms();
    const current = platforms.find((p) => p.id === id);
    if (!current) throw new ApiError(404, 'Platform not found');
    const key = platformKey(current.name);
    const stored = looks.get(key) ?? { type: null, avatarText: null, color: null, textColor: null };
    const updated: PlatformLook = {
      ...stored,
      ...(patch.type !== undefined && { type: patch.type?.trim() ? label(patch.type) : null }),
      ...(patch.avatarText !== undefined && { avatarText: patch.avatarText === null ? null : normalizeAvatar(patch.avatarText) }),
      ...(patch.color !== undefined && { color: patch.color?.toLowerCase() ?? null }),
      ...(patch.textColor !== undefined && { textColor: patch.textColor?.toLowerCase() ?? null }),
    };
    const kept = (l: PlatformLook) => (Object.values(l).some((v) => v !== null) ? l : null);
    const writeLooks = (changes: [key: string, after: PlatformLook | null][]) => {
      const added = changes.reduce((n, [k, after]) => n + (after ? 1 : 0) - (looks.has(k) ? 1 : 0), 0);
      if (added > 0 && looks.size + added > limits.platforms) {
        throw new ApiError(409, `You can customize up to ${limits.platforms} platforms. Reset one to customize another.`, undefined, 'limit-exceeded');
      }
      for (const [k, after] of changes) {
        if (after) looks.set(k, after);
        else looks.delete(k);
      }
    };
    const rename = (to: string) => {
      for (const h of holdings) if (platformKey(h.platform) === key) h.platform = to;
    };

    const name = patch.name === undefined ? current.name : label(patch.name);
    const newKey = platformKey(name);
    if (newKey === key) {
      writeLooks([[key, kept(updated)]]);
      rename(name);
      return getPlatforms().find((p) => platformKey(p.name) === key)!;
    }
    const existing = platforms.find((p) => platformKey(p.name) === newKey);
    if (existing) {
      if (!patch.mergeIfExists) {
        throw new ApiError(409, `There's already a platform named "${existing.name}"`, undefined, 'platform-exists');
      }
      // The platform merged into keeps its look; the other's goes.
      writeLooks([[key, null]]);
      rename(existing.name);
      return getPlatforms().find((p) => platformKey(p.name) === newKey)!;
    }
    // A new name: the look goes with it (over one kept from when a platform had that name).
    writeLooks([
      [key, null],
      [newKey, kept(updated)],
    ]);
    rename(name);
    return getPlatforms().find((p) => platformKey(p.name) === newKey)!;
  };

  return {
    getAssetClasses,
    createAssetClass,
    updateAssetClass,
    deleteAssetClass,
    getPlatforms,
    updatePlatform,
    /** What a class counts with: ready to spend or not, its default return and color, as the user set them. */
    liquid,
    classReturn,
    classColor,
    /** The user's classes that count as ready to spend, in the order they're offered. */
    liquidClasses: () => visible().filter(liquid),
    look,
  };
}

export type MockCustomization = ReturnType<typeof createMockCustomization>;
