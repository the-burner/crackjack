// Home screen: the four drills, the game and the settings.

import { useStore } from 'zustand';
import { useApp } from '@/react/app-context';
import { Button } from '@/components/ui/button';
import { ListRow, Section, SettingsGroup } from '@/components/ui/settings-group';
import { BarButton } from '@/components/ui/top-bar';
import { FooterNote } from '@/components/ui/text';
import { Column, ScreenLayout } from '@/components/screen-layout';
import type { App } from '@/app/app';
import { toast } from '@/components/ui/toast';
import { alert, confirm } from '@/components/dialogs';
import { openTable } from '@/game/launch';
import { WORDMARK_SVG } from '@/lib/wordmark';
import { currentNavigator, installHintWanted } from '@/lib/install-hint';
import { useNavigate } from 'react-router';
import { PATHS } from '@/app/paths';

export const APP_VERSION = '3.0.0';

const DRILLS = [
  ['Flash Drills', 'Strategy and index plays', 'drills.flash.options'],
  ['Depth Drills', 'Estimate decks played', 'drills.depth.options'],
  ['Count Drills', 'Running and true count', 'drills.count.options'],
  ['Full Table Drills', 'Count a whole table', 'drills.full.options'],
] as const;

export function Home() {
  const app = useApp();
  const navigate = useNavigate();
  const dismissed = useStore(app.installHintDismissed, state => state.value);
  const installHint = installHintWanted(currentNavigator(), dismissed);
  const dismissInstallHint = () => app.installHintDismissed.setState({ value: true });
  return (
    <ScreenLayout title="" help="home" back={false}>
      <Column className="gap-6 pt-2">
        <h1
          className="mx-auto mt-2 mb-0 w-[270px] leading-[0] [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: WORDMARK_SVG }}
        />
        {installHint && (
          <SettingsGroup role="note">
            <div className="flex items-center gap-2 py-1 pl-3.5">
              <span className="flex-1 text-caption leading-[1.4] text-(--text-secondary)">
                To use Crackjack offline, install it: tap <strong>Share</strong>, then{' '}
                <strong>Add to Home Screen</strong>.
              </span>
              <BarButton onClick={dismissInstallHint} data-action="dismiss-install">
                OK
              </BarButton>
            </div>
          </SettingsGroup>
        )}
        <Button
          variant="primary"
          large
          block
          icon="arrow-r"
          onClick={() => openTable(app, () => navigate(PATHS['game.table']))}
          data-action="play"
        >
          Play Blackjack
        </Button>
        <Section title="Drills">
          <div className="grid grid-cols-2 gap-2.5 max-[340px]:grid-cols-1">
            {DRILLS.map(([name, detail, screen]) => (
              <button
                key={screen}
                type="button"
                className="flex min-h-[76px] cursor-pointer flex-col items-start gap-1 rounded-(--radius) border-0 bg-(--group-bg) p-3.5 text-left text-(--text) transition-[transform,background-color] duration-150 active:scale-[0.98] active:bg-(--btn-bg-active)"
                onClick={() => navigate(PATHS[screen])}
              >
                <span className="text-body font-semibold">{name}</span>
                <span className="text-caption leading-[1.3] text-(--text-secondary)">{detail}</span>
              </button>
            ))}
          </div>
        </Section>
        <SettingsGroup>
          <ListRow block onClick={() => navigate(PATHS.settings)} data-action="settings">
            Settings
          </ListRow>
          <ListRow block chevron={false} onClick={() => resetDefaults(app)}>
            Reset Defaults
          </ListRow>
          <ListRow block chevron={false} onClick={() => screenInfo()}>
            Screen Info
          </ListRow>
        </SettingsGroup>
      </Column>
      <FooterNote>{`Crackjack ${APP_VERSION} · Copyright 2025 Crackjack, all rights reserved`}</FooterNote>
    </ScreenLayout>
  );
}

async function resetDefaults(app: App) {
  if (!(await confirm('Are you sure that you want to reset all options to their defaults?'))) return;
  app.settings.reset();
  toast('Settings reset to defaults');
}

function screenInfo() {
  const info = [
    `Window: ${innerWidth} x ${innerHeight}`,
    `Screen: ${screen.width} x ${screen.height}`,
    `Pixel ratio: ${devicePixelRatio}`,
    navigator.userAgent,
  ];
  return alert(`${info.join('\n')}`);
}
