import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Dimensions } from 'react-native';
import { Button, Text, Chip, Portal, Modal, Surface, TextInput, IconButton } from 'react-native-paper';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Game } from '../../types/game';
import { gamesService } from '../../services/games';
import { authService } from '../../services/auth';
import { isSupabaseConfigured } from '../../services/supabase';
import { storage } from '../../utils/storage';
import { validateRoundScores } from '../../utils/scoring';

const { width, height } = Dimensions.get('window');
const isLandscape = width > height;

type ScoreType = 'drop' | 'middle_drop' | 'rummy' | 'count' | 'expense';

interface Player {
  id: string;
  name: string;
  selected?: boolean;
}

interface PlayerScore {
  playerId: string;
  playerName: string;
  score: number;
  scoreType?: ScoreType;
}

const SCORE_TYPES: { type: ScoreType; value: number; label: string }[] = [
  { type: 'drop', value: -10, label: 'DROP' },
  { type: 'middle_drop', value: -30, label: 'MD' },
  { type: 'rummy', value: 0, label: 'RUMMY' },
];

export default function ScoreEntryScreen() {
  const { gameId } = useLocalSearchParams();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedScoreType, setSelectedScoreType] = useState<ScoreType | null>(null);
  const [playerScores, setPlayerScores] = useState<PlayerScore[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showManualScoreModal, setShowManualScoreModal] = useState(false);
  const [manualScorePlayer, setManualScorePlayer] = useState<Player | null>(null);
  const [manualScoreValue, setManualScoreValue] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadGameData();
  }, [gameId]);

  const loadGameData = async () => {
    if (!gameId) {
      Alert.alert('Error', 'No game selected');
      router.back();
      return;
    }

    const currentGame = await gamesService.getGame(String(gameId));
    
    if (!currentGame) {
      Alert.alert('Error', 'Game not found');
      router.back();
      return;
    }

    setGame(currentGame);
    
    // Load only players in this game
    const gamePlayers = await gamesService.listGamePlayers(currentGame.id);
    setPlayers(gamePlayers);

    // Initialize player scores with EX player if expense is enabled
    const initialScores: PlayerScore[] = [];
    if (currentGame.settings.expense) {
      // Add EX player with default expense
      initialScores.push({
        playerId: 'EX',
        playerName: 'EX',
        score: currentGame.settings.expenseAmount || -10,
          scoreType: 'expense'
      });
    }
    setPlayerScores(initialScores);
  };

  const handleScoreTypeSelect = (type: ScoreType) => {
    if (selectedScoreType === type) {
      // Toggle off if same type is selected
      setSelectedScoreType(null);
      setSelectedPlayers(new Set());
    } else {
      // Select new type
      setSelectedScoreType(type);
      setSelectedPlayers(new Set());
    }
  };

  const handlePlayerSelect = (player: Player) => {
    if (!selectedScoreType) {
      // No score type selected - open manual score entry
      setManualScorePlayer(player);
      setManualScoreValue('-'); // Start with minus sign
      setShowManualScoreModal(true);
      return;
    }

    if (selectedScoreType === 'rummy') {
      // For RUMMY, toggle player selection
      const newSelectedPlayers = new Set(selectedPlayers);
      
      if (newSelectedPlayers.has(player.id)) {
        // Deselect player
        newSelectedPlayers.delete(player.id);
        setSelectedPlayers(newSelectedPlayers);
        
        // Remove player from scores
        setPlayerScores(prev => prev.filter(ps => ps.playerId !== player.id));
      } else {
        // Select player
        newSelectedPlayers.add(player.id);
        setSelectedPlayers(newSelectedPlayers);
      }
      
      // Recalculate distribution for all selected RUMMY players
      const playersToBalance = Array.from(newSelectedPlayers).map(id => 
        allAvailablePlayers.find(p => p.id === id)
      ).filter(Boolean) as Player[];
      
      if (playersToBalance.length > 0) {
        // Calculate total negative score to balance
        const currentTotal = getTotalTally();
        const totalToBalance = Math.abs(currentTotal);
        
        // Distribute positive score evenly among selected RUMMY players
        const scorePerPlayer = totalToBalance / playersToBalance.length;
        
        playersToBalance.forEach(rummyPlayer => {
          const existingScoreIndex = playerScores.findIndex(ps => ps.playerId === rummyPlayer.id);
          
          if (existingScoreIndex >= 0) {
            // Update existing score
            const updatedScores = [...playerScores];
            updatedScores[existingScoreIndex] = {
              ...updatedScores[existingScoreIndex],
              score: scorePerPlayer,
              scoreType: 'rummy'
            };
            setPlayerScores(updatedScores);
          } else {
            // Add new score
            setPlayerScores(prev => [...prev, {
              playerId: rummyPlayer.id,
              playerName: rummyPlayer.name,
              score: scorePerPlayer,
              scoreType: 'rummy'
            }]);
          }
        });
      }
      
      return;
    }

    // For DROP and MD, use the predefined negative values
    const scoreValue = SCORE_TYPES.find(st => st.type === selectedScoreType)?.value || 0;
    
    // Check if player already has a score
    const existingScoreIndex = playerScores.findIndex(ps => ps.playerId === player.id);
    
    if (existingScoreIndex >= 0) {
      // Update existing score
      const updatedScores = [...playerScores];
      updatedScores[existingScoreIndex] = {
        ...updatedScores[existingScoreIndex],
        score: scoreValue,
        scoreType: selectedScoreType
      };
      setPlayerScores(updatedScores);
    } else {
      // Add new score
      setPlayerScores(prev => [...prev, {
        playerId: player.id,
        playerName: player.name,
        score: scoreValue,
        scoreType: selectedScoreType
      }]);
    }

    // Auto-balance if this is the last player
    const remainingPlayers = allAvailablePlayers.filter(p => p.id !== player.id);
    if (remainingPlayers.length === 1) {
      const lastPlayer = remainingPlayers[0];
      const currentTotal = getTotalTally() + scoreValue;
      const balancingScore = -currentTotal; // Make total 0
      
      setPlayerScores(prev => [...prev, {
        playerId: lastPlayer.id,
        playerName: lastPlayer.name,
        score: balancingScore,
        scoreType: 'rummy'
      }]);
    }
  };

  const handleRummyScore = (selectedPlayers: Player[]) => {
    if (selectedPlayers.length === 0) return;
    
    const currentTotal = getTotalTally();
    const balancingScore = Math.abs(currentTotal) / selectedPlayers.length; // Distribute evenly
    
    selectedPlayers.forEach(player => {
      const existingScoreIndex = playerScores.findIndex(ps => ps.playerId === player.id);
      
      if (existingScoreIndex >= 0) {
        // Update existing score
        const updatedScores = [...playerScores];
        updatedScores[existingScoreIndex] = {
          ...updatedScores[existingScoreIndex],
          score: balancingScore,
          scoreType: 'rummy'
        };
        setPlayerScores(updatedScores);
      } else {
        // Add new score
        setPlayerScores(prev => [...prev, {
          playerId: player.id,
          playerName: player.name,
          score: balancingScore,
          scoreType: 'rummy'
        }]);
      }
    });
  };

  const handleManualScore = (player: Player) => {
    setManualScorePlayer(player);
    setManualScoreValue('');
    setShowManualScoreModal(true);
  };

  const handleManualScoreSubmit = () => {
    if (!manualScorePlayer || !manualScoreValue) return;

    const scoreValue = parseInt(manualScoreValue, 10);
    if (isNaN(scoreValue)) {
      Alert.alert('Error', 'Please enter a valid number');
      return;
    }

    // Check if player already has a score
    const existingScoreIndex = playerScores.findIndex(ps => ps.playerId === manualScorePlayer.id);
    
    if (existingScoreIndex >= 0) {
      // Update existing score
      const updatedScores = [...playerScores];
      updatedScores[existingScoreIndex] = {
        ...updatedScores[existingScoreIndex],
        score: scoreValue
      };
      setPlayerScores(updatedScores);
    } else {
      // Add new score
      setPlayerScores(prev => [...prev, {
        playerId: manualScorePlayer.id,
        playerName: manualScorePlayer.name,
        score: scoreValue
      }]);
    }

    setShowManualScoreModal(false);
  };

  const handleScoreUpdate = (playerId: string, newScore: number) => {
    setPlayerScores(prev => prev.map(ps => 
      ps.playerId === playerId ? { ...ps, score: newScore } : ps
    ));
  };

  const handleRemoveScore = (playerId: string) => {
    setPlayerScores(prev => prev.filter(ps => ps.playerId !== playerId));
  };

  const calculateRummyScore = (playerId: string): number => {
    if (!game || !game.scores) return 0;
    
    const playerScores = game.scores[playerId] || [];
    const totalNegative = playerScores.reduce((sum, score) => sum + (score < 0 ? score : 0), 0);
    
    // Return positive value to balance the negative
    return Math.abs(totalNegative);
  };

  const getTotalTally = (): number => {
    return playerScores.reduce((sum, ps) => sum + ps.score, 0);
  };

  const handleSubmitAllScores = async () => {
    if (!game || playerScores.length === 0) {
      Alert.alert('Error', 'No scores to submit');
      return;
    }

    const totalTally = getTotalTally();
    
    if (totalTally !== 0) {
      Alert.alert('Invalid Round', `Total tally is ${totalTally}. A round must total 0 before it can be submitted.`);
    } else {
      submitScores();
    }
  };

  const submitScores = async () => {
    if (!game) return;

    setIsSubmitting(true);
    try {
      const currentRound = game.currentRound || 1;
      const createdBy = isSupabaseConfigured
        ? await authService.getCurrentUserId()
        : await storage.getCurrentPlayer();

      if (!createdBy) {
        throw new Error('You must be signed in to submit scores.');
      }

      const scores = playerScores.map((playerScore) => ({
        playerId: playerScore.playerId === 'EX' ? null : playerScore.playerId,
        value: playerScore.score,
        scoreType: playerScore.scoreType ?? 'count',
      }));

      const validation = validateRoundScores(scores);
      if (!validation.valid) {
        throw new Error(validation.error ?? 'Invalid round scores.');
      }

      await gamesService.addRound({
        gameId: game.id,
        roundNumber: currentRound,
        scores,
        createdBy,
      });

      Alert.alert(
        'Success',
        'Scores saved successfully',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Score submission error:', error);
      Alert.alert('Error', `Failed to save scores: ${error}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderManualScoreModal = () => (
    <Portal>
      <Modal
        visible={showManualScoreModal}
        onDismiss={() => setShowManualScoreModal(false)}
        contentContainerStyle={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text variant="titleLarge" style={styles.modalTitle}>
            Enter Score for {manualScorePlayer?.name}
          </Text>
          
          <TextInput
            value={manualScoreValue}
            onChangeText={setManualScoreValue}
            keyboardType="numeric"
            mode="outlined"
            label="Score"
            style={styles.modalInput}
            autoFocus={true}
            selectTextOnFocus={false}
            selection={{ start: 1, end: 1 }}
          />
          
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowManualScoreModal(false)}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleManualScoreSubmit}
              style={styles.modalButton}
            >
              Save
            </Button>
          </View>
        </View>
      </Modal>
    </Portal>
  );

  // Get players that don't have scores yet
  const availablePlayers = players.filter(player => 
    !playerScores.some(ps => ps.playerId === player.id)
  );

  // Add EX player to available players if it's not in scores
  const exPlayerInScores = playerScores.some(ps => ps.playerId === 'EX');
  const allAvailablePlayers = exPlayerInScores || !game?.settings.expense ? availablePlayers : [
    ...availablePlayers,
    { id: 'EX', name: 'EX' } as Player
  ];

  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Enter Scores',
          headerShown: true,
        }} 
      />
      <ScrollView style={styles.container}>
        {/* Game Info Header */}
        {game && (
          <Surface style={styles.gameInfoSection} elevation={1}>
            <Text variant="titleMedium" style={styles.gameInfoTitle}>
              Game #{game.id.slice(-6)}
            </Text>
            <Text variant="bodyMedium" style={styles.roundInfo}>
              Entering scores for Round {game.currentRound}
            </Text>
            <Text variant="bodySmall" style={styles.gameType}>
              {game.gameType.toUpperCase()} Game
            </Text>
          </Surface>
        )}

        {/* Score Type Section */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Score Type</Text>
          <View style={styles.scoreTypeButtons}>
            {SCORE_TYPES.map((scoreType) => (
              <Button
                key={scoreType.type}
                mode={selectedScoreType === scoreType.type ? "contained" : "outlined"}
                onPress={() => handleScoreTypeSelect(scoreType.type)}
                style={styles.scoreTypeButton}
                contentStyle={styles.scoreTypeButtonContent}
                buttonColor={selectedScoreType === scoreType.type ? '#4CAF50' : undefined}
              >
                {scoreType.label} ({scoreType.value})
              </Button>
            ))}
          </View>
        </Surface>

        {/* Players Section */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Select Players</Text>
          
          {allAvailablePlayers.length === 0 ? (
            <Text style={styles.emptyMessage}>All players have scores</Text>
          ) : (
            <View style={styles.playersGrid}>
              {allAvailablePlayers.map((player) => (
                <Surface 
                  key={player.id} 
                  style={[
                    styles.playerCard,
                    selectedPlayers.has(player.id) && styles.selectedPlayerCard
                  ]} 
                  elevation={1}
                >
                  <Text 
                    variant="bodyLarge" 
                    style={styles.playerName}
                    onPress={() => handlePlayerSelect(player)}
                  >
                    {player.name}
                  </Text>
                  {selectedScoreType === 'rummy' && selectedPlayers.has(player.id) && (
                    <Text variant="bodySmall" style={styles.rummyIndicator}>
                      RUMMY
                    </Text>
                  )}
                </Surface>
              ))}
            </View>
          )}
        </Surface>

        {/* Scores Section */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Scores</Text>
          
          {playerScores.length === 0 ? (
            <Text style={styles.emptyMessage}>No scores entered yet</Text>
          ) : (
            <View style={styles.scoresList}>
              {playerScores.map((playerScore) => (
                <Surface key={playerScore.playerId} style={styles.scoreCard} elevation={1}>
                  <View style={styles.scoreCardContent}>
                    <Text variant="bodyLarge" style={styles.scorePlayerName}>
                      {playerScore.playerName}
                    </Text>
                    <View style={styles.scoreActions}>
                      <TextInput
                        value={playerScore.score.toString()}
                        onChangeText={(text) => {
                          const newScore = parseInt(text, 10);
                          if (!isNaN(newScore)) {
                            handleScoreUpdate(playerScore.playerId, newScore);
                          }
                        }}
                        keyboardType="numeric"
                        mode="outlined"
                        style={styles.scoreInput}
                        dense
                      />
                      <IconButton
                        icon="delete"
                        onPress={() => handleRemoveScore(playerScore.playerId)}
                        style={styles.removeButton}
                        size={20}
                      />
                    </View>
                  </View>
                </Surface>
              ))}
            </View>
          )}
        </Surface>

        {/* Tally Section */}
        <Surface style={styles.section} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>Total Tally</Text>
          
          <Surface style={styles.tallyCard} elevation={2}>
            <Text variant="headlineLarge" style={[
              styles.tallyValue,
              { color: getTotalTally() === 0 ? '#28a745' : '#dc3545' }
            ]}>
              {getTotalTally()}
            </Text>
            <Text variant="bodyMedium" style={styles.tallyDescription}>
              {getTotalTally() === 0 ? 'Perfect! Round is balanced.' : 'Round is not balanced.'}
            </Text>
          </Surface>
        </Surface>

        {/* Submit Button */}
        <Button
          mode="contained"
          onPress={handleSubmitAllScores}
          style={styles.submitButton}
          loading={isSubmitting}
          disabled={playerScores.length === 0 || isSubmitting}
          contentStyle={styles.submitButtonContent}
        >
          Submit All Scores
        </Button>

        {renderManualScoreModal()}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  gameInfoSection: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  gameInfoTitle: {
    marginBottom: 4,
    fontSize: 16,
  },
  roundInfo: {
    marginBottom: 4,
    fontSize: 14,
  },
  gameType: {
    opacity: 0.7,
    fontSize: 12,
  },
  section: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedTypeChip: {
    marginLeft: 8,
  },
  scoreTypeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  scoreTypeButton: {
    flex: 1,
  },
  scoreTypeButtonContent: {
    paddingVertical: 6,
  },
  playersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  playerCard: {
    width: '48%',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  playerName: {
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
    fontSize: 14,
    color: '#495057',
  },
  playerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  playerActionButton: {
    flex: 1,
    marginHorizontal: 2,
  },
  scoresList: {
    gap: 8,
  },
  scoreCard: {
    borderRadius: 8,
    padding: 10,
  },
  scoreCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scorePlayerName: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 14,
  },
  scorePlayerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  scoreValue: {
    fontWeight: 'bold',
    fontSize: 18,
    color: '#4CAF50', // Default color for positive scores
  },
  scoreActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreInput: {
    width: 80,
    height: 40,
  },
  removeButton: {
    padding: 0,
  },
  selectedPlayerCard: {
    borderColor: '#4CAF50',
    borderWidth: 2,
    backgroundColor: '#e8f5e8',
  },
  tallyCard: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
  },
  tallyValue: {
    fontWeight: 'bold',
    marginBottom: 4,
    fontSize: 24,
  },
  tallyDescription: {
    opacity: 0.7,
    fontSize: 12,
  },
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalContent: {
    gap: 16,
  },
  modalTitle: {
    textAlign: 'center',
  },
  modalInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonContent: {
    paddingVertical: 12,
  },
  emptyMessage: {
    textAlign: 'center',
    opacity: 0.5,
    padding: 16,
  },
  rummyIndicator: {
    marginTop: 4,
    backgroundColor: '#4CAF50',
    color: 'white',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 5,
    fontSize: 12,
    fontWeight: 'bold',
  },
}); 