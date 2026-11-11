// Picking a preset as the player does: tap its search field, type its name, tap it in the results.
import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

export async function pickPreset(user: UserEvent, label: string, name: string) {
  const field = screen.getByRole('combobox', { name: label });
  await user.click(field);
  await user.type(field, name);
  await user.click(
    within(screen.getByRole('listbox', { name: label })).getByRole('option', { name: new RegExp(`^${escape(name)}`) }),
  );
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
