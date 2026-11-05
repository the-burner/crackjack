// Playing Strategy Flash Cards: Statistics - which hands and situations the recorded
// strategy errors come from, and each one's share of all errors.

import { useStore } from 'zustand';
import { useApp } from '@/react/app-context';
import { Column, ScreenLayout } from '@/components/screen-layout';
import { ListRow, Section, SettingsGroup } from '@/components/ui/settings-group';
import { StatTiles } from '@/components/ui/stat-tiles';
import { Note } from '@/components/ui/text';
import { confirm } from '@/components/dialogs';
import { errorSummary, describeEntry, percent } from './logic';
import { accuracy, emptyRecord } from './record';

const shown = (percentRight: number | null) => (percentRight === null ? '-' : `${percentRight}%`);

/** One statistic: a label, the count and share on the right, and a bar under them. */
const StatRow = ({ label, count, share }: { label: string; count: number; share: number }) => (
  <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5">
    <span className="text-body text-(--text)">{label}</span>
    <span className="text-body font-medium text-(--text-secondary) tabular-nums">{`${count} · ${percent(share)}`}</span>
    <div className="col-span-full h-1 overflow-hidden rounded-xs bg-(--separator)" aria-hidden="true">
      <span className="block h-full rounded-xs bg-(--accent)" style={{ width: `${Math.max(2, share * 100)}%` }} />
    </div>
  </div>
);

export function FlashStats() {
  const app = useApp();
  // Read live: the drills record errors while this screen exists.
  useStore(app.errorTallies.store, state => state.value);
  const { total, hands, situations } = errorSummary(app.errorTallies.cells());
  const record = useStore(app.flashRecord, state => state.value);

  async function resetStats() {
    if (!(await confirm('Reset the statistics? This also empties the Drill Errors hand list.'))) return;
    app.errorTallies.clear();
    app.flashRecord.setState({ value: emptyRecord() });
  }

  return (
    <ScreenLayout title="Statistics" help="drills.flash.stats">
      <Column>
        <Section title="Summary">
          <StatTiles
            stats={[
              { label: 'Total Hands', value: record.hands },
              { label: 'Total Errors', value: total },
              { label: 'Hands Missed', value: hands.length },
            ]}
          />
        </Section>
        <Section title="Accuracy">
          <StatTiles
            className="grid-cols-4"
            stats={[
              { label: 'All Time', value: shown(accuracy(record)) },
              ...[1000, 500, 100].map(last => ({ label: `Last ${last}`, value: shown(accuracy(record, last)) })),
            ]}
          />
        </Section>
        {total === 0 ? (
          <Note>No errors have been recorded yet.</Note>
        ) : (
          <>
            <Section title="By situation">
              <SettingsGroup>
                {situations.map(s => (
                  <StatRow key={s.label} label={s.label} count={s.count} share={s.share} />
                ))}
              </SettingsGroup>
            </Section>
            <Section title="Hands">
              <SettingsGroup>
                {hands.map((x, i) => (
                  <StatRow key={i} label={describeEntry(x.entry)} count={x.count} share={x.share} />
                ))}
              </SettingsGroup>
            </Section>
          </>
        )}
        <SettingsGroup>
          <ListRow chevron={false} block onClick={resetStats}>
            Reset Stats
          </ListRow>
        </SettingsGroup>
      </Column>
    </ScreenLayout>
  );
}
