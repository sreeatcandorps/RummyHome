import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Text, Card, Button, useTheme } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { storage } from '@/utils/storage';
import { Player } from '@/types/player';
import { Game } from '@/types/game';
import { authService } from '@/services/auth';
import { gamesService } from '@/services/games';
import { playersService } from '@/services/players';
import { isSupabaseConfigured } from '@/services/supabase';
import { formatSupabaseError, isClockSkewError } from '@/utils/supabaseErrors';

export default function Dashboard() {
  const theme = useTheme();
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);

    try {
      const player = await authService.getCurrentPlayer();
      if (!player) {
        setCurrentPlayer(null);
        setLoadError('Not signed in. Please log in again.');
        return;
      }

      setCurrentPlayer(player);

      try {
        const [allPlayers, games] = await Promise.all([
          isSupabaseConfigured ? playersService.listPlayers() : storage.getPlayers(),
          gamesService.listGamesForCurrentUser(player.id, { limit: 5, includeScores: false }),
        ]);
        setPlayers(allPlayers);
        setRecentGames(games);
      } catch (innerError) {
        if (isClockSkewError(innerError) && isSupabaseConfigured) {
          await authService.refreshSession();
          const [allPlayers, games] = await Promise.all([
            playersService.listPlayers(),
            gamesService.listGamesForCurrentUser(player.id, { limit: 5, includeScores: false }),
          ]);
          setPlayers(allPlayers);
          setRecentGames(games);
        } else {
          throw innerError;
        }
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
      setLoadError(formatSupabaseError(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  if (!currentPlayer) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{loadError ?? 'Not signed in.'}</Text>
        <Button mode="contained" onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 16 }}>
          Go to Login
        </Button>
      </View>
    );
  }

  const activeGames = recentGames.filter((game) => !game.isComplete).length;
  const gamesToday = recentGames.filter((game) => {
    const gameDate = new Date(game.date);
    const today = new Date();
    return gameDate.toDateString() === today.toDateString();
  }).length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
    >
      {loadError ? (
        <Card style={[styles.section, styles.errorCard]}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.errorTitle}>Couldn’t load everything</Text>
            <Text style={styles.errorText}>{loadError}</Text>
            <Button mode="contained" onPress={() => loadData(true)} style={{ marginTop: 12 }}>
              Retry
            </Button>
          </Card.Content>
        </Card>
      ) : null}

      <Card style={styles.section}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Stats Overview
          </Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text variant="headlineMedium">{activeGames}</Text>
              <Text variant="bodyMedium">Active Games</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="headlineMedium">{players.length}</Text>
              <Text variant="bodyMedium">Players</Text>
            </View>
            <View style={styles.statItem}>
              <Text variant="headlineMedium">{gamesToday}</Text>
              <Text variant="bodyMedium">Games Today</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

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
                Find Players
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
              <Button
                mode="contained"
                onPress={() => router.push('/(screens)/players')}
                style={styles.actionButton}
              >
                All Players
              </Button>
            </View>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.section}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Recent Games
          </Text>
          {recentGames.length > 0 ? (
            recentGames.map((game, index) => (
              <TouchableOpacity
                key={`recent-game-${game.id}-${index}`}
                onPress={() => navigateToGame(game.id)}
                activeOpacity={0.7}
              >
                <Card
                  style={[
                    styles.gameCard,
                    {
                      borderLeftWidth: 4,
                      borderLeftColor: game.isComplete ? '#9e9e9e' : theme.colors.primary,
                      backgroundColor: game.isComplete ? '#f5f5f5' : '#ffffff',
                      elevation: 1,
                      marginBottom: 8,
                    },
                  ]}
                >
                  <Card.Content>
                    <Text variant="titleMedium">
                      {game.shareCode ? `Code ${game.shareCode}` : `Game #${game.id.slice(-6)}`}
                    </Text>
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
                          { color: game.isComplete ? '#9e9e9e' : theme.colors.primary },
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
            <Text>
              No games yet. Tap New Game and pick at least one other registered player.
            </Text>
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
    padding: 24,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  errorCard: {
    backgroundColor: '#fff5f5',
  },
  errorTitle: {
    marginBottom: 8,
    color: '#b00020',
  },
  errorText: {
    color: '#666',
    lineHeight: 20,
    textAlign: 'center',
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
});
