// What sits above every screen: the dialogs and the toasts.

import { DialogHost } from '@/components/dialogs';
import { Toaster } from '@/components/ui/toast';

export function OverlayRoot() {
  return (
    <>
      <DialogHost />
      <Toaster />
    </>
  );
}
