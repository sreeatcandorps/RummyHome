import React from 'react';
import { IconButton, Menu } from 'react-native-paper';
import { SEAT_MENU_ICON, SEAT_MENU_LABEL, SeatMenu, SeatMenuItem } from '@/utils/gamePlayers';

/**
 * The one ⋮ menu for a player, on the game's Players page and on My players. The entries
 * come from utils/gamePlayers (seatMenu / myPlayerMenu) so both screens show the same order
 * and the same disabled reasons.
 */
export function PlayerActionMenu({ name, items, visible, disabled, onOpen, onDismiss, onSelect }: {
  name: string;
  items: SeatMenu;
  visible: boolean;
  disabled?: boolean;
  onOpen: () => void;
  onDismiss: () => void;
  onSelect: (item: SeatMenuItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <Menu
      visible={visible}
      onDismiss={onDismiss}
      anchor={<IconButton icon="dots-vertical" onPress={onOpen} disabled={disabled} accessibilityLabel={`Options for ${name}`} testID={`player-menu-${name}`} />}
    >
      {items.map((entry) => (
        <Menu.Item
          key={entry.item}
          title={entry.enabled || !entry.reason ? SEAT_MENU_LABEL[entry.item] : `${SEAT_MENU_LABEL[entry.item]} · ${entry.reason}`}
          disabled={!entry.enabled}
          leadingIcon={SEAT_MENU_ICON[entry.item]}
          onPress={() => onSelect(entry.item)}
        />
      ))}
    </Menu>
  );
}
