// What sits above every screen: the dialogs and the toasts.

import { DialogHost } from '@/components/dialogs';
import { Toaster } from '@/components/ui/sonner';
import { useSetting } from '@/react/app-context';

export function OverlayRoot() {
  const theme = useSetting('display.theme');
  return (
    <>
      <DialogHost />
      <Toaster dark={theme === 'mocha'} position="top-center" />
    </>
  );
}
