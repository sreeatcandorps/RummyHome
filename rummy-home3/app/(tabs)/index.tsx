import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, Card, Button, useTheme } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { storage } from '@/utils/storage';
import { Player } from '@/types/player';
import { Game } from '@/types/game';
import { authService } from '@/services/auth';
import { gamesService } from '@/services/games';
import { playersService } from '@/services/players';
import { isSupabaseConfigured } from '@/services/supabase';

export default function Dashboard() {
  const theme = useTheme();
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const player = await authService.getCurrentPlayer();
      if (!player) {
        setCurrentPlayer(null);
        return;
      }

      setCurrentPlayer(player);

      const allPlayers = isSupabaseConfigured
        ? await playersService.listPlayers()
        : await storage.getPlayers();
      setPlayers(allPlayers);

      const games = await gamesService.listGamesForCurrentUser(player.id);
      setRecentGames(games.slice(0, 5));
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToGame = (gameId: string) => {
    router.push(`/(screens)/games/${gameId}`);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!currentPlayer) return null;

  // Admin View
  if (currentPlayer.role === 'admin') {
    return (
      <ScrollView style={styles.container}>

        {/* Stats Overview */}
        <Card style={styles.section}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Stats Overview
            </Text>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text variant="headlineMedium">
                  {recentGames.filter(game => !game.isComplete).length}
                </Text>
                <Text variant="bodyMedium">Active Games</Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineMedium">
                  {players.length}
                </Text>
                <Text variant="bodyMedium">Total Players</Text>
              </View>
              <View style={styles.statItem}>
                <Text variant="headlineMedium">
                  {recentGames.filter(game => {
                    const gameDate = new Date(game.date);
                    const today = new Date();
                    return gameDate.toDateString() === today.toDateString();
                  }).length}
                </Text>
                <Text variant="bodyMedium">Games Today</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <Card style={styles.section}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Quick Actions
            </Text>
            <View style={styles.actionsContainer}>
              <View style={styles.actionsRow}>
                <Button 
                  mode="contained"
                  onPress={() => router.push('/(screens)/games/new')}
                  style={styles.actionButton}
                >
                  New Game
                </Button>
                <Button 
                  mode="contained"
                  onPress={() => router.push('/(screens)/players/new')}
                  style={styles.actionButton}
                >
                  New Player
                </Button>
              </View>
              <View style={styles.actionsRow}>
                <Button 
                  mode="contained"
                  onPress={() => router.push('/(screens)/games/history')}
                  style={styles.actionButton}
                >
                  Game History
                </Button>
              </View>
              <View style={styles.actionsRow}>
                <Button 
                  mode="contained"
                  onPress={() => router.push('/(screens)/players')}
                  style={[styles.actionButton, { flex: 1 }]}
                >
                  Manage Players
                </Button>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Recent Games */}
        <Card style={styles.section}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Recent Games
            </Text>
            {recentGames.length > 0 ? (
              recentGames.map((game, index) => (
                <TouchableOpacity 
                  key={`recent-game-${game.id}-${index}-admin`}
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
              <Text>No recent games found</Text>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    );
  }

  // Player View
  return (
    <ScrollView style={styles.container}>

      {/* Quick Actions - For players */}
      <Card style={styles.section}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Quick Actions
          </Text>
          <View style={styles.actionsContainer}>
            <Button 
              mode="contained"
              onPress={() => router.push('/(screens)/games/history')}
              style={[styles.actionButton, { flex: 1 }]}
            >
              Game History
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Recent Games */}
      <Card style={styles.section}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Recent Games
          </Text>
          {recentGames.length > 0 ? (
            recentGames.map((game, index) => (
              <TouchableOpacity 
                key={`recent-game-${game.id}-${index}-player`}
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
            <Text>No recent games found</Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  actionsContainer: {
    gap: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
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
    color: '#666',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  versionCard: {
    marginBottom: 16,
    padding: 16,
    alignItems: 'center',
  },
  versionTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  versionNumber: {
    marginBottom: 4,
  },
  versionDate: {
    marginBottom: 4,
  },
  versionNote: {
    textAlign: 'center',
  },
}); 