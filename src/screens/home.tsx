// Home screen: the four drills, the game and the settings.

import { Button } from '@/components/ui/button';
import { ListRow, Section, SettingsGroup } from '@/components/ui/settings-group';
import { FooterNote } from '@/components/ui/text';
import { Column, ScreenLayout } from '@/components/screen-layout';
import { alert } from '@/components/dialogs';
import { CardButton } from '@/components/ui/card-button';
import { WORDMARK_SVG } from '@/lib/wordmark';
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
  const navigate = useNavigate();
  return (
    <ScreenLayout title="" help="home" back={false}>
      <Column className="gap-6 pt-2">
        <h1
          className="mx-auto mt-2 mb-0 w-[270px] leading-[0] [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: WORDMARK_SVG }}
        />
        <Button
          variant="primary"
          large
          block
          icon="arrow-r"
          onClick={() => navigate(PATHS['game.options'])}
          data-action="play"
        >
          Play Blackjack
        </Button>
        <Section title="Drills">
          <div className="grid grid-cols-2 gap-2.5 max-[340px]:grid-cols-1">
            {DRILLS.map(([name, detail, screen]) => (
              <CardButton key={screen} title={name} detail={detail} onClick={() => navigate(PATHS[screen])} />
            ))}
          </div>
        </Section>
        <SettingsGroup>
          <ListRow block onClick={() => navigate(PATHS.settings)} data-action="settings">
            Settings
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

function screenInfo() {
  const info = [
    `Window: ${innerWidth} x ${innerHeight}`,
    `Screen: ${screen.width} x ${screen.height}`,
    `Pixel ratio: ${devicePixelRatio}`,
    navigator.userAgent,
  ];
  return alert(`${info.join('\n')}`);
}
