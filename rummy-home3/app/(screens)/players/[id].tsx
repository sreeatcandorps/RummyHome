import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button, Avatar, Divider, useTheme } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { storage } from '../../../utils/storage';
import { Player } from '../../../types/player';

export default function PlayerDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlayer();
  }, [id]);

  const loadPlayer = async () => {
    try {
      const players = await storage.getPlayers();
      const foundPlayer = players.find(p => p.id === id);
      setPlayer(foundPlayer || null);
    } catch (error) {
      console.error('Error loading player:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!player) {
    return (
      <View style={styles.container}>
        <Text>Player not found</Text>
        <Button onPress={() => router.back()}>Go Back</Button>
      </View>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content style={styles.headerContent}>
          <Avatar.Text 
            size={80} 
            label={getInitials(player.name)}
            style={{ 
              backgroundColor: player.role === 'admin' 
                ? theme.colors.error 
                : theme.colors.primary,
              marginBottom: 16
            }}
          />
          <Text variant="headlineMedium" style={styles.name}>
            {player.name}
          </Text>
          <Text variant="bodyLarge" style={styles.role}>
            {player.role === 'admin' ? 'Administrator' : 'Player'}
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Contact Information
          </Text>
          <Divider style={styles.divider} />
          
          {player.email && (
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>Email:</Text>
              <Text variant="bodyMedium" style={styles.value}>{player.email}</Text>
            </View>
          )}
          
          {player.phone && (
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>Phone:</Text>
              <Text variant="bodyMedium" style={styles.value}>{player.phone}</Text>
            </View>
          )}
          
          {!player.email && !player.phone && (
            <Text variant="bodyMedium" style={styles.noInfo}>
              No contact information available
            </Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Game Statistics
          </Text>
          <Divider style={styles.divider} />
          
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={styles.statNumber}>
                {player.gamesPlayed || 0}
              </Text>
              <Text variant="bodyMedium">Games Played</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={styles.statNumber}>
                {player.gamesWon || 0}
              </Text>
              <Text variant="bodyMedium">Games Won</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={styles.statNumber}>
                {player.gamesPlayed && player.gamesWon 
                  ? Math.round((player.gamesWon / player.gamesPlayed) * 100)
                  : 0}%
              </Text>
              <Text variant="bodyMedium">Win Rate</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.buttonContainer}>
        <Button 
          mode="contained"
          onPress={() => router.push(`/players/${player.id}/edit`)}
          style={styles.button}
        >
          Edit Player
        </Button>
        
        <Button 
          mode="outlined"
          onPress={() => router.back()}
          style={styles.button}
        >
          Back to Players
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  headerContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  name: {
    marginBottom: 8,
    textAlign: 'center',
  },
  role: {
    opacity: 0.7,
    textTransform: 'capitalize',
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
  },
  divider: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  label: {
    fontWeight: 'bold',
    width: 80,
  },
  value: {
    flex: 1,
  },
  noInfo: {
    fontStyle: 'italic',
    opacity: 0.7,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 24,
  },
  button: {
    marginBottom: 8,
  },
}); 