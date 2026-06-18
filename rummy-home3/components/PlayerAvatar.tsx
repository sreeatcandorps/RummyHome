import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Avatar, useTheme } from 'react-native-paper';
import { storage } from '@/utils/storage';
import { Player } from '@/types/player';

export function PlayerAvatar() {
  const [player, setPlayer] = useState<Player | null>(null);
  const theme = useTheme();

  useEffect(() => {
    loadCurrentPlayer();
  }, []);

  const loadCurrentPlayer = async () => {
    try {
      const currentPlayerId = await storage.getCurrentPlayer();
      if (currentPlayerId) {
        const players = await storage.getPlayers();
        const currentPlayer = players.find(p => p.id === currentPlayerId);
        setPlayer(currentPlayer || null);
      }
    } catch (error) {
      console.error('Error loading current player:', error);
    }
  };

  if (!player) return null;

  const initials = player.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const backgroundColor = player.role === 'admin' 
    ? theme.colors.primary 
    : theme.colors.secondary;

  return (
    <Avatar.Text 
      size={40} 
      label={initials}
      style={[styles.avatar, { backgroundColor }]}
    />
  );
}

const styles = StyleSheet.create({
  avatar: {
    marginRight: 16,
  },
}); 