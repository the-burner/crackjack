// A module that is on its way: its screen, saying so.

import { Column, ScreenLayout } from '@/components/screen-layout';
import { SettingsNote } from '@/components/ui/settings-group';

export function ComingSoon({ title }: { title: string }) {
  return (
    <ScreenLayout title={title}>
      <Column className="pt-1">
        <SettingsNote>Coming soon.</SettingsNote>
      </Column>
    </ScreenLayout>
  );
}
