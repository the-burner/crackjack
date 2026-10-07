// Home screen: the four drills, the game and the settings.

import { useStore } from 'zustand';
import { useApp } from '@/react/app-context';
import { ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ListButton, ScreenLayout, Section } from '@/components/screen-layout';
import { reactScreen } from '@/react/screen';
import type { App } from '@/app/app';
import { toast } from 'sonner';
import { alert, confirm } from '@/components/dialogs';
import { openTable } from '@/game/launch';
import { WORDMARK_SVG } from '@/ui/wordmark';
import { currentNavigator, installHintWanted } from '@/ui/install-hint';

export const APP_VERSION = '3.0.0';

const DRILLS = [
  ['Flash Drills', 'Strategy and index plays', 'drills.flash.options'],
  ['Depth Drills', 'Estimate decks played', 'drills.depth.options'],
  ['Count Drills', 'Running and true count', 'drills.count.options'],
  ['Full Table Drills', 'Count a whole table', 'drills.full.options'],
] as const;

export function Home() {
  const app = useApp();
  const dismissed = useStore(app.installHintDismissed, state => state.value);
  const installHint = installHintWanted(currentNavigator(), dismissed);
  const dismissInstallHint = () => app.installHintDismissed.setState({ value: true });
  return (
    <ScreenLayout title="" help="home" back={false}>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <h1 className="mx-auto mt-2 w-64 leading-none" dangerouslySetInnerHTML={{ __html: WORDMARK_SVG }} />
        {installHint && (
          <Card size="sm" role="note">
            <CardContent className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex-1">
                To use Crackjack offline, install it: tap <strong>Share</strong>, then{' '}
                <strong>Add to Home Screen</strong>.
              </span>
              <Button variant="ghost" onClick={dismissInstallHint} data-action="dismiss-install">
                OK
              </Button>
            </CardContent>
          </Card>
        )}
        <Button size="lg" className="h-12 text-base" onClick={() => openTable(app)} data-action="play">
          Play Blackjack
          <ChevronRightIcon />
        </Button>
        <section className="space-y-2">
          <h2 className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Drills</h2>
          <div className="grid grid-cols-2 gap-3">
            {DRILLS.map(([name, detail, screen]) => (
              <button
                key={screen}
                type="button"
                className="flex flex-col gap-1 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted active:bg-muted"
                onClick={() => app.open(screen)}
              >
                <span className="font-medium">{name}</span>
                <span className="text-sm text-muted-foreground">{detail}</span>
              </button>
            ))}
          </div>
        </section>
        <Section>
          <ListButton onClick={() => app.open('settings')} data-action="settings">
            Settings
          </ListButton>
          <ListButton chevron={false} onClick={() => resetDefaults(app)}>
            Reset Defaults
          </ListButton>
          <ListButton chevron={false} onClick={() => screenInfo()}>
            Screen Info
          </ListButton>
        </Section>
        <p className="text-center text-xs text-muted-foreground">
          {`Crackjack ${APP_VERSION} · Copyright 2025 Crackjack, all rights reserved`}
        </p>
      </div>
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

export const homeScreen = reactScreen(Home);
