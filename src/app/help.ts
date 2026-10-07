// Which help page is open, if any. Help is a sheet over the current screen.

import { create } from 'zustand';

type HelpState = { open: { topic: string; title: string } | null };

export const useHelpStore = create<HelpState>(() => ({ open: null }));

export const openHelp = (topic: string, title = 'Help') => useHelpStore.setState({ open: { topic, title } });
export const closeHelp = () => useHelpStore.setState({ open: null });
