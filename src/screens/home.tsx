// Home screen: the modules (the game, the drills, the tools) and the settings.

import { ListRow, Section, SettingsGroup } from '@/components/ui/settings-group';
import { FooterNote } from '@/components/ui/text';
import { Column, ScreenLayout } from '@/components/screen-layout';
import { alert } from '@/components/dialogs';
import { CardButton } from '@/components/ui/card-button';
import { WORDMARK_SVG } from '@/lib/wordmark';
import { useNavigate } from 'react-router';
import { PATHS, tablesSearch } from '@/app/paths';

declare const __APP_VERSION__: string;
/** The last commit's date and short hash, stamped in at build time. */
export const APP_VERSION = __APP_VERSION__;

const SLOGAN = 'Get cracked at blackjack';

/** Each module: its name and where it opens. */
const MODULES = [
  ['Blackjack', PATHS['game.options']],
  ['Playing Strategy Flash Cards', PATHS['drills.flash.options']],
  ['Deck Estimation and TC Conversion', PATHS['drills.depth.options']],
  ['Simple Running Count', PATHS['drills.count.options']],
  ['Compound Running Count', PATHS['drills.full.options']],
  [
    'Playing Strategy Charts',
    PATHS['strategy.tables'] + tablesSearch({ mode: 'view', pick: true, title: 'Playing Strategy Charts' }),
  ],
] as const;

export function Home() {
  const navigate = useNavigate();
  return (
    <ScreenLayout title="" help="home" back={false}>
      <Column className="gap-6 pt-2">
        <div className="flex flex-col items-center gap-2">
          <h1
            className="mx-auto mt-2 mb-0 w-[270px] leading-[0] [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: WORDMARK_SVG }}
          />
          <p className="m-0 text-body text-(--text-secondary)">{SLOGAN}</p>
        </div>
        <Section>
          <div className="grid grid-cols-2 gap-2.5 max-[340px]:grid-cols-1">
            {MODULES.map(([name, to]) => (
              <CardButton
                key={name}
                title={name}
                onClick={() => navigate(to)}
                data-action={to === PATHS['game.options'] ? 'play' : undefined}
              />
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
      <FooterNote className="flex flex-col gap-1">
        <span>Copyright 2025 Crackjack, all rights reserved</span>
        <span>{`Crackjack ${APP_VERSION}`}</span>
      </FooterNote>
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
