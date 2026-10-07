'use client';

import React from 'react';
import { Paintbrush, Pencil, Plus, Trash2 } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { IconButton } from '@/components/ui/IconButton';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlatformAvatar } from '@/components/ui/PlatformAvatar';
import { ClassFormDialog } from '@/components/settings/ClassFormDialog';
import { DeleteClassDialog } from '@/components/settings/DeleteClassDialog';
import { PlatformCustomizeDialog } from '@/components/settings/PlatformCustomizeDialog';
import { PreferencesSection } from '@/components/settings/PreferencesSection';
import { DataSection } from '@/components/settings/DataSection';
import { formatCurrency } from '@/lib/calculations';
import { formatReturn } from '@/lib/returns';
import type { AssetClassInfo, Platform, SettingsTab } from '@/types/wealth';
import { useT } from '@/lib/i18n';

const TABS: SettingsTab[] = ['general', 'classes', 'platforms', 'data'];

// Where the user sets up how the app opens, what they group their assets by (their classes) and how their
// platforms look, and takes their data with them: one tab each.
export const SettingsView: React.FC = () => {
  const { settingsTab: tab, setSettingsTab } = useWealth();
  const t = useT().settings.tabs;
  return (
    <div className="settings">
      <Tabs label={t.label} tabs={TABS.map((id) => ({ id, label: t[id] }))} value={tab} onChange={setSettingsTab}>
        {tab === 'general' && <PreferencesSection />}
        {tab === 'classes' && <ClassesSection />}
        {tab === 'platforms' && <PlatformsSection />}
        {tab === 'data' && <DataSection />}
      </Tabs>
    </div>
  );
};

function ClassesSection() {
  const { assetClassInfos, classLook } = useWealth();
  const { openDialog } = useUi();
  const tAll = useT();
  const t = tAll.settings;
  const newClass = () => openDialog((close) => <ClassFormDialog onClose={close} />);
  const editClass = (c: AssetClassInfo) => openDialog((close) => <ClassFormDialog assetClass={c} onClose={close} />);
  const removeClass = (c: AssetClassInfo) => openDialog((close) => <DeleteClassDialog assetClass={c} onClose={close} />);

  return (
    <section className="card elev-sm" aria-labelledby="settings-classes">
      <div className="settings-head">
        <div>
          <h2 id="settings-classes" className="sr-only">
            {t.classesHeading}
          </h2>
          <p className="text-muted settings-sub">{t.classesSub}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={newClass}>
          <Plus size={14} aria-hidden />
          {t.newClass}
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>{t.classColumns.name}</th>
              <th className="col-optional">{t.classColumns.liquidity}</th>
              <th>{t.classColumns.defaultReturn}</th>
              <th className="col-optional">{t.classColumns.assets}</th>
              <th className="col-optional">{t.classColumns.value}</th>
              <th style={{ width: '88px' }}>
                <span className="sr-only">{tAll.common.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {assetClassInfos.map((c) => (
              <tr key={c.id}>
                <td style={{ padding: '10px' }}>
                  <span className="class-name">
                    <span className="class-dot" style={{ background: classLook(c.name).color }} aria-hidden />
                    {c.name}
                    {c.isDefault && <span className="tag tag-neutral">{t.defaultTag}</span>}
                  </span>
                </td>
                <td style={{ padding: '10px' }} className="col-optional">
                  {c.liquid ? t.ready : <span className="text-muted">{t.locked}</span>}
                </td>
                <td style={{ padding: '10px', fontVariantNumeric: 'tabular-nums' }}>
                  {c.expectedReturnPct === null ? <span className="text-muted">—</span> : tAll.common.aYear(formatReturn(c.expectedReturnPct, 2))}
                </td>
                <td style={{ padding: '10px', fontVariantNumeric: 'tabular-nums' }} className="col-optional">
                  {c.holdingsCount}
                </td>
                <td style={{ padding: '10px' }} className="text-nowrap col-optional">
                  {formatCurrency(c.valueUsd)}
                </td>
                <td style={{ padding: '6px', textAlign: 'right' }}>
                  <div className="row-actions">
                    <IconButton label={tAll.common.edited(c.name)} onClick={() => editClass(c)}>
                      <Pencil size={15} aria-hidden />
                    </IconButton>
                    <IconButton label={tAll.common.removeNamed(c.name)} tone="danger" onClick={() => removeClass(c)}>
                      <Trash2 size={15} aria-hidden />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlatformsSection() {
  const { platforms, platformLook } = useWealth();
  const { openDialog } = useUi();
  const tAll = useT();
  const t = tAll.settings;
  const customize = (p: Platform) => openDialog((close) => <PlatformCustomizeDialog platform={p} onClose={close} />);

  return (
    <section className="card elev-sm" aria-labelledby="settings-platforms">
      <div className="settings-head">
        <div>
          <h2 id="settings-platforms" className="sr-only">
            {t.platformsHeading}
          </h2>
          <p className="text-muted settings-sub">{t.platformsSub}</p>
        </div>
      </div>
      {platforms.length === 0 ? (
        <EmptyState title={t.platformsEmpty}>{t.platformsEmptyText}</EmptyState>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t.platformColumns.name}</th>
                <th className="col-optional">{t.platformColumns.type}</th>
                <th className="col-optional">{t.platformColumns.assets}</th>
                <th>{t.platformColumns.value}</th>
                <th style={{ width: '56px' }}>
                  <span className="sr-only">{tAll.common.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {platforms.map((p) => (
                <tr key={p.id}>
                  <td style={{ padding: '8px 10px' }}>
                    <span className="class-name">
                      <PlatformAvatar {...platformLook(p.name)} size={26} />
                      {p.name}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }} className="col-optional">
                    {p.type === 'Other' ? tAll.platformForm.noType : p.type}
                  </td>
                  <td style={{ padding: '10px', fontVariantNumeric: 'tabular-nums' }} className="col-optional">
                    {p.holdingsCount}
                  </td>
                  <td style={{ padding: '10px' }} className="text-nowrap">
                    {formatCurrency(p.valueUsd)}
                  </td>
                  <td style={{ padding: '6px', textAlign: 'right' }}>
                    <IconButton label={tAll.common.customize(p.name)} onClick={() => customize(p)}>
                      <Paintbrush size={15} aria-hidden />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
