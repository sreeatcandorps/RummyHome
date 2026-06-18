import { useTheme } from 'react-native-paper';
import { Avatar } from 'react-native-paper';
import { TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { storage } from '@/utils/storage';
import { Player } from '@/types/player';

export function HeaderRight() {
  const theme = useTheme();
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

  useEffect(() => {
    loadCurrentPlayer();
  }, []);

  const loadCurrentPlayer = async () => {
    const playerId = await storage.getCurrentPlayer();
    if (playerId) {
      const players = await storage.getPlayers();
      const player = players.find(p => p.id === playerId);
      setCurrentPlayer(player || null);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <TouchableOpacity 
      onPress={() => router.push('/settings')}
      style={{ marginRight: 15 }}
    >
      <Avatar.Text 
        size={32} 
        label={currentPlayer ? getInitials(currentPlayer.name) : '?'}
        style={{ 
          backgroundColor: currentPlayer?.role === 'admin' 
            ? theme.colors.error
            : theme.colors.primary
        }}
      />
    </TouchableOpacity>
  );
} 