// Flash Drills: Error History - which hands and situations the recorded
// strategy errors come from, and each one's share of all errors.

import { useReducer } from 'react';
import type { ReactNode } from 'react';
import { useApp } from '../../react/app-context.ts';
import { StandardScreen } from '../../react/components.tsx';
import { reactScreen, useOnShow } from '../../react/screen.tsx';
import { Section } from '../shared/options-screen.tsx';
import { errorSummary, describeEntry, percent } from './logic.ts';

/** One statistic: a label, the count and share on the right, and a bar under them. */
const StatRow = ({ label, count, share }: { label: string; count: number; share: number }) => (
  <div className="stat-row">
    <span className="stat-row__label">{label}</span>
    <span className="stat-row__value">{`${count} · ${percent(share)}`}</span>
    <div className="stat-row__bar">
      <span style={{ width: `${Math.max(2, share * 100)}%` }} />
    </div>
  </div>
);

const Group = ({ children }: { children: ReactNode }) => <div className="settings-group">{children}</div>;

const ValueRow = ({ label, value }: { label: string; value: string }) => (
  <div className="settings-row stat-summary">
    <span className="label">{label}</span>
    <span className="stat-summary__value">{value}</span>
  </div>
);

export function FlashErrors() {
  const app = useApp();
  // The tallies change while the drills cover this screen.
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useOnShow(refresh);
  const { total, hands, situations } = errorSummary(app.errorTallies.cells());

  return (
    <StandardScreen title="Error History" help="drills.flash.errors">
      <div className="column">
        {total === 0 ? (
          <p className="note">No errors have been recorded yet.</p>
        ) : (
          <>
            <Section title="Summary">
              <Group>
                <ValueRow label="Total errors" value={String(total)} />
                <ValueRow label="Hands missed" value={String(hands.length)} />
                <ValueRow label="Most missed" value={describeEntry(hands[0].entry)} />
              </Group>
            </Section>
            <Section title="By situation">
              <Group>
                {situations.map(s => (
                  <StatRow key={s.label} label={s.label} count={s.count} share={s.share} />
                ))}
              </Group>
            </Section>
            <Section title="Hands">
              <Group>
                {hands.map((x, i) => (
                  <StatRow key={i} label={describeEntry(x.entry)} count={x.count} share={x.share} />
                ))}
              </Group>
            </Section>
          </>
        )}
      </div>
    </StandardScreen>
  );
}

export const flashErrorsScreen = reactScreen(FlashErrors);
