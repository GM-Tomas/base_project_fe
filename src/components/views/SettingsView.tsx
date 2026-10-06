'use client';

import React from 'react';
import { Paintbrush, Pencil, Plus, Trash2 } from 'lucide-react';
import { useWealth } from '@/context/WealthContext';
import { useUi } from '@/context/UiContext';
import { IconButton } from '@/components/ui/IconButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PlatformAvatar } from '@/components/ui/PlatformAvatar';
import { ClassFormDialog } from '@/components/settings/ClassFormDialog';
import { DeleteClassDialog } from '@/components/settings/DeleteClassDialog';
import { PlatformCustomizeDialog } from '@/components/settings/PlatformCustomizeDialog';
import { formatCurrency } from '@/lib/calculations';
import { formatReturn } from '@/lib/returns';
import type { AssetClassInfo, Platform } from '@/types/wealth';

// Where the user sets up what they group their assets by (their classes) and how their platforms look.
export const SettingsView: React.FC = () => {
  const { assetClassInfos, platforms, classLook, platformLook } = useWealth();
  const { openDialog } = useUi();

  const newClass = () => openDialog((close) => <ClassFormDialog onClose={close} />);
  const editClass = (c: AssetClassInfo) => openDialog((close) => <ClassFormDialog assetClass={c} onClose={close} />);
  const removeClass = (c: AssetClassInfo) => openDialog((close) => <DeleteClassDialog assetClass={c} onClose={close} />);
  const customize = (p: Platform) => openDialog((close) => <PlatformCustomizeDialog platform={p} onClose={close} />);

  return (
    <div className="settings">
      <section className="card elev-sm" aria-labelledby="settings-classes">
        <div className="settings-head">
          <div>
            <h2 id="settings-classes" className="settings-title">
              Asset classes
            </h2>
            <p className="text-muted settings-sub">
              What you group your assets by. Those ready to spend count in the dashboard&apos;s &quot;Ready to spend&quot;; a
              default return applies to assets without one of their own.
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={newClass}>
            <Plus size={14} aria-hidden />
            New class
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Liquidity</th>
                <th>Default return</th>
                <th>Assets</th>
                <th>Value</th>
                <th style={{ width: '88px' }}>
                  <span className="sr-only">Actions</span>
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
                      {c.isDefault && <span className="tag tag-neutral">Default</span>}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>{c.liquid ? 'Ready to spend' : <span className="text-muted">Locked in</span>}</td>
                  <td style={{ padding: '10px', fontVariantNumeric: 'tabular-nums' }}>
                    {c.expectedReturnPct === null ? <span className="text-muted">—</span> : `${formatReturn(c.expectedReturnPct, 2)} a year`}
                  </td>
                  <td style={{ padding: '10px', fontVariantNumeric: 'tabular-nums' }}>{c.holdingsCount}</td>
                  <td style={{ padding: '10px' }} className="text-nowrap">
                    {formatCurrency(c.valueUsd)}
                  </td>
                  <td style={{ padding: '6px', textAlign: 'right' }}>
                    <div className="row-actions">
                      <IconButton label={`Edit ${c.name}`} onClick={() => editClass(c)}>
                        <Pencil size={15} aria-hidden />
                      </IconButton>
                      <IconButton label={`Remove ${c.name}`} tone="danger" onClick={() => removeClass(c)}>
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

      <section className="card elev-sm" aria-labelledby="settings-platforms">
        <div className="settings-head">
          <div>
            <h2 id="settings-platforms" className="settings-title">
              Platforms
            </h2>
            <p className="text-muted settings-sub">
              Where your assets live. Give each one letters or an emoji and a color you recognize at a glance; renaming
              one renames it on all its assets.
            </p>
          </div>
        </div>
        {platforms.length === 0 ? (
          <EmptyState title="Platforms appear as you add assets">
            Each bank, broker, exchange or wallet you name when adding an asset shows up here to customize.
          </EmptyState>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Type</th>
                  <th>Assets</th>
                  <th>Value</th>
                  <th style={{ width: '56px' }}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {platforms.map((p) => {
                  const look = platformLook(p.name);
                  return (
                    <tr key={p.id}>
                      <td style={{ padding: '8px 10px' }}>
                        <span className="class-name">
                          <PlatformAvatar text={look.text} color={look.color} size={26} />
                          {p.name}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>{p.type}</td>
                      <td style={{ padding: '10px', fontVariantNumeric: 'tabular-nums' }}>{p.holdingsCount}</td>
                      <td style={{ padding: '10px' }} className="text-nowrap">
                        {formatCurrency(p.valueUsd)}
                      </td>
                      <td style={{ padding: '6px', textAlign: 'right' }}>
                        <IconButton label={`Customize ${p.name}`} onClick={() => customize(p)}>
                          <Paintbrush size={15} aria-hidden />
                        </IconButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
