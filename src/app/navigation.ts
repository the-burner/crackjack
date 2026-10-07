// Moving between screens: every screen has a URL (hash routes), and Back goes
// back through the browser history.

import { useLocation, useNavigate } from 'react-router';
import { openHelp } from './help';

/** Back: the previous entry, or the parent screen when the app was opened here. */
export function useGoBack(): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key === 'default') void navigate('..', { relative: 'path' });
    else void navigate(-1);
  };
}

/** Opens the help sheet for a topic. */
export const useHelp = () => openHelp;
