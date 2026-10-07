import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL cleans up by itself only when test globals are enabled. Toasts and
// dialogs are added to the body outside React, so they go too.
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});
