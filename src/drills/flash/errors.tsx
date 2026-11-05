// Playing Strategy Flash Cards: Error History - which hands and situations the recorded
// strategy errors come from, and each one's share of all errors.

import { useStore } from 'zustand';
import { useApp } from '@/react/app-context';
import { Column, ScreenLayout } from '@/components/screen-layout';
import { Section, SettingsGroup } from '@/components/ui/settings-group';
import { StatTiles } from '@/components/ui/stat-tiles';
import { Note } from '@/components/ui/text';
import { errorSummary, describeEntry, percent } from './logic';

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

export function FlashErrors() {
  const app = useApp();
  // Read live: the drills record errors while this screen exists.
  useStore(app.errorTallies.store, state => state.value);
  const { total, hands, situations } = errorSummary(app.errorTallies.cells());

  return (
    <ScreenLayout title="Error History" help="drills.flash.errors">
      <Column>
        {total === 0 ? (
          <Note>No errors have been recorded yet.</Note>
        ) : (
          <>
            <Section title="Summary">
              <StatTiles
                stats={[
                  { label: 'Total errors', value: total },
                  { label: 'Hands missed', value: hands.length },
                  { label: 'Most missed', value: describeEntry(hands[0].entry) },
                ]}
              />
            </Section>
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
      </Column>
    </ScreenLayout>
  );
}
