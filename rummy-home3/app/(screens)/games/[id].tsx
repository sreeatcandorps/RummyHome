import React from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Alert } from 'react-native';
import { Button, Text, Card, IconButton, Surface, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useState, useEffect } from 'react';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { gamesService } from '@/services/games';
import { authService } from '@/services/auth';
import { isSupabaseConfigured } from '@/services/supabase';
import { realtimeService } from '@/services/realtime';

const { width, height } = Dimensions.get('window');
const isLandscape = width > height;

// Dynamic cell sizing based on orientation
const getCellWidth = (playerCount: number, currentWidth: number, isLandscape: boolean) => {
  const padding = isLandscape ? 20 : 40; // Less padding in landscape
  const availableWidth = currentWidth - padding;
  const totalColumns = playerCount + 2; // Players + Round + Total
  
  // In landscape, we can use smaller minimum width
  const minWidth = isLandscape ? 40 : 60;
  const calculatedWidth = availableWidth / totalColumns;
  
  return Math.max(minWidth, calculatedWidth);
};

export default function GameScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [dimensions, setDimensions] = useState({ width, height });

  // Handle orientation changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription?.remove();
  }, []);

  const isLandscape = dimensions.width > dimensions.height;
  const cellWidth = getCellWidth(players.length, dimensions.width, isLandscape);

  // Generate styles dynamically based on cellWidth
  const getStyles = () => StyleSheet.create({
    container: {
      flex: 1,
      padding: isLandscape ? 8 : 16, // Less padding in landscape
    },
    gameInfoCard: {
      marginBottom: 8, // Reduced margin
      elevation: 2,
    },
    compactGameInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4, // Reduced padding
    },
    gameInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flex: 1,
    },
    gameTitle: {
      fontWeight: 'bold',
      fontSize: 16, // Slightly smaller
    },
    gameType: {
      fontWeight: 'bold',
      color: '#007bff',
      fontSize: 12, // Smaller font
    },
    gameDate: {
      color: '#666',
      fontSize: 12, // Smaller font
    },
    currentRound: {
      fontWeight: 'bold',
      color: '#007bff',
      fontSize: 12, // Smaller font
    },
    playerCount: {
      fontWeight: 'bold',
      color: '#28a745',
      fontSize: 12, // Smaller font
    },
    gameStatus: {
      fontWeight: 'bold',
      color: '#dc3545',
      fontSize: 12, // Smaller font
    },
    headerRow: {
      flexDirection: 'row',
      backgroundColor: '#f8f9fa',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: '#dee2e6',
      paddingVertical: isLandscape ? 8 : 4, // Increased padding in landscape for bigger fonts
    },
    cell: {
      width: cellWidth,
      alignItems: 'center',
      justifyContent: 'center',
      padding: isLandscape ? 8 : 6, // Increased padding in landscape for bigger fonts
      borderRightWidth: 1,
      borderColor: '#dee2e6',
    },
    roundHeaderCell: {
      width: cellWidth * (isLandscape ? 1.3 : 1.2), // Match roundCell width
      backgroundColor: '#e9ecef',
    },
    playerHeaderCell: {
      width: cellWidth * 1.0,
      backgroundColor: '#f8f9fa',
    },
    totalHeaderCell: {
      width: cellWidth * (isLandscape ? 1.2 : 1.2), // Match totalCell width
      backgroundColor: '#e9ecef',
    },
    headerText: {
      fontWeight: 'bold',
      textAlign: 'center',
      color: '#495057',
      fontSize: isLandscape ? 20 : 12, // Double font size in landscape
    },
    roundHeaderText: {
      fontWeight: 'bold',
      textAlign: 'left',
      color: '#495057',
      fontSize: isLandscape ? 20 : 12, // Double font size in landscape
      paddingLeft: 8,
    },
    scoreRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderColor: '#dee2e6',
      backgroundColor: '#ffffff',
      paddingVertical: isLandscape ? 6 : 2, // Increased padding in landscape for bigger fonts
    },
    roundCell: {
      width: cellWidth * (isLandscape ? 1.3 : 1.2), // Increased width in landscape for bigger text
      alignItems: 'center',
      backgroundColor: '#f8f9fa',
    },
    roundText: {
      fontWeight: 'bold',
      color: '#495057',
      fontSize: isLandscape ? 20 : 12, // Double font size in landscape
      textAlign: 'left',
      alignSelf: 'flex-start',
      paddingLeft: 8,
    },

    scoreCell: {
      width: cellWidth * 1.0, // Reduced multiplier
      alignItems: 'center',
      backgroundColor: '#ffffff',
    },
    scoreText: {
      textAlign: 'center',
      fontWeight: '500',
      fontSize: isLandscape ? 20 : 12, // Double font size in landscape
    },
    totalCell: {
      width: cellWidth * (isLandscape ? 1.2 : 1.2), // Increased width in landscape for bigger text
      alignItems: 'center',
      backgroundColor: '#f8f9fa',
    },
    totalText: {
      fontWeight: 'bold',
      textAlign: 'center',
      fontSize: isLandscape ? 20 : 12, // Double font size in landscape
    },
    totalsRow: {
      marginTop: 8,
      borderTopWidth: 2,
      borderTopColor: '#495057',
      backgroundColor: '#e9ecef',
    },
    totalsLabel: {
      fontWeight: 'bold',
      textAlign: 'center',
      color: '#495057',
    },
    totalScoreText: {
      fontWeight: 'bold',
      textAlign: 'center',
      color: '#495057',
    },
    actions: {
      flexDirection: isLandscape ? 'row' : 'column',
      justifyContent: 'space-around',
      marginTop: 16,
      paddingHorizontal: 16,
    },
    button: {
      marginHorizontal: 4,
      minWidth: 100,
      marginVertical: isLandscape ? 0 : 4,
    },
    tableContainer: {
      flex: 1,
      width: '100%',
    },
    scrollableContent: {
      paddingTop: 0, // No padding to align with header
    },
    stickyHeader: {
      backgroundColor: '#f8f9fa',
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
    },
  });

  const styles = getStyles();

  useEffect(() => {
    loadGameData();
  }, [id]);

  useEffect(() => {
    if (!isSupabaseConfigured || typeof id !== 'string') return;
    const channel = realtimeService.subscribeToGame(id, { onChange: loadGameData });
    return () => {
      realtimeService.unsubscribe(channel);
    };
  }, [id]);

  // Reload game data when screen comes into focus (e.g., after adding scores)
  useFocusEffect(
    React.useCallback(() => {
      loadGameData();
    }, [id])
  );

  const loadGameData = async () => {
    if (typeof id !== 'string') return;

    const [currentGame, gamePlayers] = await Promise.all([
      gamesService.getGame(id),
      gamesService.listGamePlayers(id)
    ]);

    if (currentGame) {
      setGame(currentGame);
      setPlayers(gamePlayers);
      
      // Add EX player if expense is enabled
      if (currentGame.settings?.expense) {
        setPlayers(prev => [...prev, { id: 'EX', name: 'EX', role: 'player' } as Player]);
      }
    }
  };

  const getPlayerInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getPlayerTotal = (playerId: string): number => {
    if (!game?.scores) return 0;
    return Object.values(game.scores[playerId] || []).reduce((sum, score) => sum + score, 0);
  };

  const getRoundTotal = (roundIndex: number): number => {
    if (!game?.scores) return 0;
    return Object.values(game.scores).reduce((sum, playerScores) => {
      return sum + (playerScores[roundIndex] || 0);
    }, 0);
  };

  const getDealerForRound = (roundIndex: number): string => {
    if (!players.length) return '';
    const dealerIndex = roundIndex % players.length;
    return getPlayerInitials(players[dealerIndex]?.name || '');
  };

  const getMaxRounds = (): number => {
    if (!game?.scores) return 0;
    return Math.max(...Object.values(game.scores).map(scores => scores.length), 0);
  };

  const handleUndoLastRound = async () => {
    if (!game) return;
    
    const maxRounds = getMaxRounds();
    
    if (maxRounds > 0) {
      const currentUserId = isSupabaseConfigured
        ? await authService.getCurrentUserId()
        : null;
      const nextGame = await gamesService.undoLastRound(game.id, currentUserId ?? 'local-admin');
      if (nextGame) setGame(nextGame);
    }
  };

  const handleCompleteGame = async () => {
    if (!game) return;
    
    try {
      const updatedGame = await gamesService.completeGame(game.id);
      if (updatedGame) setGame(updatedGame);
      
      Alert.alert(
        'Game Completed',
        'The game has been marked as complete.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error completing game:', error);
      Alert.alert('Error', 'Failed to complete game');
    }
  };

  if (!game || !players.length) {
    return (
      <View style={styles.container}>
        <Text>Loading game...</Text>
      </View>
    );
  }

  const maxRounds = getMaxRounds();

  return (
    <View style={styles.container}>
      {/* Game Info Header */}
      <Card style={styles.gameInfoCard}>
        <Card.Content style={styles.compactGameInfo}>
          <View style={styles.gameInfoRow}>
            <Text variant="titleMedium" style={styles.gameTitle}>
              {game.shareCode ? `Code ${game.shareCode}` : `Game #${game.id.slice(-6)}`}
            </Text>
            <Text variant="bodySmall" style={styles.gameType}>
              {game.gameType.toUpperCase()}
            </Text>
            <Text variant="bodySmall" style={styles.gameDate}>
              {new Date(game.date).toLocaleDateString()}
            </Text>
            <Text variant="bodySmall" style={styles.currentRound}>
              Round {game.currentRound}
            </Text>
            <Text variant="bodySmall" style={styles.playerCount}>
              {players.length} Players
            </Text>
            <Text variant="bodySmall" style={styles.gameStatus}>
              {game.isComplete ? 'COMPLETED' : 'ACTIVE'}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.tableContainer}>
        {/* Fixed Header Row - Player Names */}
        <View style={[styles.headerRow, styles.stickyHeader]}>
          <View style={[styles.cell, styles.roundHeaderCell]}>
            <Text variant="labelSmall" style={styles.roundHeaderText}>Round</Text>
          </View>
          <View style={[styles.cell, styles.totalHeaderCell]}>
            <Text variant="labelSmall" style={styles.headerText}>Total</Text>
          </View>
          {players.map(player => (
            <View key={player.id} style={[styles.cell, styles.playerHeaderCell]}>
              <Text variant="labelSmall" style={styles.headerText}>
                {getPlayerInitials(player.name)}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView 
          horizontal={!isLandscape || players.length > 6} 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={isLandscape && players.length <= 6 ? { width: '100%' } : undefined}
        >
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollableContent}>
            {/* Score Rows */}
            {Array.from({ length: Math.max(maxRounds, 1) }, (_, roundIndex) => {
              const roundNumber = roundIndex + 1;
              const roundTotal = getRoundTotal(roundIndex);
              const dealer = getDealerForRound(roundIndex);
              
              return (
                <View key={roundIndex} style={styles.scoreRow}>
                  {/* Round Number and Dealer */}
                  <View style={[styles.cell, styles.roundCell]}>
                    <Text variant="bodySmall" style={styles.roundText}>
                      {roundNumber}, {dealer}
                    </Text>
                  </View>

                  {/* Round Total */}
                  <View style={[styles.cell, styles.totalCell]}>
                    <Text 
                      variant="bodyMedium" 
                      style={[
                        styles.totalText,
                        roundTotal !== 0 && { color: theme.colors.error }
                      ]}
                    >
                      {roundTotal}
                    </Text>
                  </View>

                  {/* Player Scores */}
                  {players.map(player => {
                    const score = game.scores[player.id]?.[roundIndex] || 0;
                    return (
                      <View key={player.id} style={[styles.cell, styles.scoreCell]}>
                        <Text 
                          variant="bodyMedium" 
                          style={[
                            styles.scoreText,
                            score !== 0 && { color: theme.colors.primary }
                          ]}
                        >
                          {score !== 0 ? score : '-'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {/* Running Totals Row */}
            <View style={[styles.scoreRow, styles.totalsRow]}>
              <View style={[styles.cell, styles.roundCell]}>
                <Text variant="titleSmall" style={styles.totalsLabel}>TOTAL</Text>
              </View>
              <View style={[styles.cell, styles.totalCell]}>
                <Text variant="titleMedium" style={styles.totalScoreText}>
                  {players.reduce((sum, player) => sum + getPlayerTotal(player.id), 0)}
                </Text>
              </View>
              {players.map(player => {
                const total = getPlayerTotal(player.id);
                return (
                  <View key={player.id} style={[styles.cell, styles.scoreCell]}>
                    <Text 
                      variant="titleMedium" 
                      style={[
                        styles.totalScoreText,
                        total !== 0 && { color: theme.colors.primary }
                      ]}
                    >
                      {total}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </ScrollView>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {!game.isComplete && (
          <>
            <Button 
              mode="contained" 
              onPress={() => router.push({
                pathname: '/(screens)/score-entry',
                params: { gameId: game.id }
              })}
              style={styles.button}
              icon="plus"
            >
              Add Round
            </Button>

            {maxRounds > 0 && (
              <Button 
                mode="outlined"
                onPress={handleUndoLastRound}
                style={styles.button}
                icon="undo"
              >
                Undo Last Round
              </Button>
            )}

            <Button 
              mode="outlined"
              onPress={handleCompleteGame}
              style={styles.button}
              icon="flag-checkered"
            >
              Complete Game
            </Button>
          </>
        )}
      </View>
    </View>
  );
}
