// Flash Drills: Error History - which hands and situations the recorded
// strategy errors come from, and each one's share of all errors.

import { useReducer } from 'react';
import { useApp } from '@/react/app-context';
import { ScreenLayout, Section } from '@/components/screen-layout';
import { reactScreen, useOnShow } from '@/react/screen';
import { errorSummary, describeEntry, percent } from './logic';

/** One statistic: a label, the count and share on the right, and a bar under them. */
const StatRow = ({ label, count, share }: { label: string; count: number; share: number }) => (
  <div className="space-y-1.5 px-4 py-2.5">
    <div className="flex items-baseline gap-3">
      <span className="flex-1">{label}</span>
      <span className="text-sm text-muted-foreground tabular-nums">{`${count} · ${percent(share)}`}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, share * 100)}%` }} />
    </div>
  </div>
);

const ValueRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex min-h-11 items-center gap-3 px-4 py-2">
    <span className="flex-1">{label}</span>
    <span className="text-muted-foreground tabular-nums">{value}</span>
  </div>
);

export function FlashErrors() {
  const app = useApp();
  // The tallies change while the drills cover this screen.
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useOnShow(refresh);
  const { total, hands, situations } = errorSummary(app.errorTallies.cells());

  return (
    <ScreenLayout title="Error History" help="drills.flash.errors">
      <div className="mx-auto grid max-w-4xl items-start gap-4 md:grid-cols-2">
        {total === 0 ? (
          <p className="text-center text-sm text-muted-foreground md:col-span-2">No errors have been recorded yet.</p>
        ) : (
          <>
            <Section title="Summary">
              <ValueRow label="Total errors" value={String(total)} />
              <ValueRow label="Hands missed" value={String(hands.length)} />
              <ValueRow label="Most missed" value={describeEntry(hands[0].entry)} />
            </Section>
            <Section title="By situation">
              {situations.map(s => (
                <StatRow key={s.label} label={s.label} count={s.count} share={s.share} />
              ))}
            </Section>
            <Section title="Hands" className="md:col-span-2">
              {hands.map((x, i) => (
                <StatRow key={i} label={describeEntry(x.entry)} count={x.count} share={x.share} />
              ))}
            </Section>
          </>
        )}
      </div>
    </ScreenLayout>
  );
}

export const flashErrorsScreen = reactScreen(FlashErrors);
