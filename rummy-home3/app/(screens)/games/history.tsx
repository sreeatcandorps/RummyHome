import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import { storage } from '@/utils/storage';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { router, useFocusEffect } from 'expo-router';
import { gamesService } from '@/services/games';
import { authService } from '@/services/auth';
import { isSupabaseConfigured } from '@/services/supabase';

type GameStatus = 'active' | 'completed';

export default function GameHistory() {
  const theme = useTheme();
  const [games, setGames] = useState<Game[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    const playerId = isSupabaseConfigured
      ? await authService.getCurrentUserId()
      : await storage.getCurrentPlayer();
    if (playerId) {
      const players = await storage.getPlayers();
      const player = players.find(p => p.id === playerId);
      setCurrentPlayer(player || null);

      const games = await gamesService.listGamesForCurrentUser(playerId);
      setGames(games);
    }
  };

  const navigateToGame = (gameId: string) => {
    router.push(`/(screens)/games/${gameId}`);
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.section}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.title}>
            Game History
          </Text>
          {games.length > 0 ? (
            games.map((game, index) => (
              <TouchableOpacity 
                key={`history-game-${game.id}-${index}`}
                onPress={() => navigateToGame(game.id)}
                activeOpacity={0.7}
              >
                <Card 
                  style={[
                    styles.gameCard,
                    { 
                      borderLeftWidth: 4,
                      borderLeftColor: game.isComplete 
                        ? '#9e9e9e'
                        : theme.colors.primary,
                      backgroundColor: game.isComplete 
                        ? '#f5f5f5'
                        : '#ffffff',
                      elevation: 1,
                      marginBottom: 8,
                    }
                  ]}
                >
                  <Card.Content>
                    <Text variant="titleMedium">Game #{game.id}</Text>
                    <Text style={styles.dateText}>
                      {new Date(game.date).toLocaleString('en-US', { 
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    <View style={styles.infoRow}>
                      <Text>Players: {game.players?.length || 0}</Text>
                      <Text> • </Text>
                      <Text 
                        style={[
                          styles.status,
                          { 
                            color: game.isComplete 
                              ? '#9e9e9e'
                              : theme.colors.primary 
                          }
                        ]}
                      >
                        {game.isComplete ? 'COMPLETED' : 'ACTIVE'}
                      </Text>
                    </View>
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            ))
          ) : (
            <Text>No games found</Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 16,
  },
  gameCard: {
    marginBottom: 8,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  status: {
    textTransform: 'capitalize',
    fontWeight: 'bold',
  },
  dateText: {
    marginVertical: 4,
    fontSize: 14,
    color: '#666',  // Slightly muted color for date
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
