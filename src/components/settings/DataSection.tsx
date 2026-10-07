'use client';

import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useUi } from '@/context/UiContext';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';
import { useT } from '@/lib/i18n';
import { activityCsv, allMovements, assetsCsv, checkpointsCsv, debtsCsv, download, exportEverything, exportName } from '@/lib/export';

const CSV = 'text/csv;charset=utf-8';

// What each CSV has, and how it's read from the API.
const LISTS: { what: string; build: () => Promise<string> }[] = [
  { what: 'assets', build: async () => assetsCsv(await api.getHoldings()) },
  { what: 'debts', build: async () => debtsCsv(await api.getDebts()) },
  { what: 'activity', build: async () => activityCsv(await allMovements(api)) },
  { what: 'checkpoints', build: async () => checkpointsCsv(await api.getSnapshots()) },
];

// Settings → Your data: download everything recorded, as it is now.
export function DataSection() {
  const { toast } = useUi();
  const t = useT().settings;
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (what: string, make: () => Promise<{ name: string; content: string; type: string }>) => {
    setBusy(what);
    try {
      const file = await make();
      download(file.name, file.content, file.type);
      toast.success(t.downloaded(file.name));
    } catch (e) {
      toast.error(errorMessage(e, t.exportFailed));
    } finally {
      setBusy(null);
    }
  };
  const everything = () =>
    run('everything', async () => ({
      name: exportName('export', 'json'),
      content: `${JSON.stringify(await exportEverything(api), null, 2)}\n`,
      type: 'application/json',
    }));

  return (
    <section className="card elev-sm" aria-labelledby="settings-data">
      <div className="settings-head">
        <div>
          <h2 id="settings-data" className="sr-only">
            {t.dataHeading}
          </h2>
          <p className="text-muted settings-sub">{t.dataSub}</p>
        </div>
      </div>
      <div className="data-actions" aria-busy={busy !== null}>
        <button type="button" className="btn btn-primary" onClick={everything} disabled={busy !== null}>
          <Download size={14} aria-hidden />
          {busy === 'everything' ? t.preparing : t.exportEverything}
        </button>
        {LISTS.map((list) => (
          <button
            key={list.what}
            type="button"
            className="btn btn-secondary"
            disabled={busy !== null}
            onClick={() => run(list.what, async () => ({ name: exportName(list.what, 'csv'), content: await list.build(), type: CSV }))}
          >
            {busy === list.what ? t.preparing : t.csv(t.lists[list.what])}
          </button>
        ))}
      </div>
    </section>
  );
}
