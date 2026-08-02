import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, FAB, IconButton, Searchbar, Menu, Portal, Dialog, TextInput, Button, Avatar } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { storage } from '../../../utils/storage';
import { Player } from '../../../types/player';
import * as Linking from 'expo-linking';
import * as SMS from 'expo-sms';
import { playersService } from '../../../services/players';
import { isSupabaseConfigured } from '../../../services/supabase';
import { EmptyState } from '../../../components/ui/EmptyState';
import { radius, spacing } from '../../../constants/theme';

export default function PlayersScreen() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'games' | 'wins'>('name');
  const [addDialogVisible, setAddDialogVisible] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [newPlayerPhone, setNewPlayerPhone] = useState('');
  const [error, setError] = useState('');
  const params = useLocalSearchParams();

  // Add filteredPlayers state
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);

  useEffect(() => {
    loadPlayers();
    if (params.name) {
      setNewPlayerName(params.name as string);
      setNewPlayerEmail(params.email as string);
      setNewPlayerPhone(params.phone as string);
      setAddDialogVisible(true);
    }
  }, [params]);

  // Add effect to filter players based on search query and sort
  useEffect(() => {
    try {
      let filtered = players.filter(player =>
        player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (player.email && player.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (player.phone && player.phone.includes(searchQuery))
      );

      // Sort players
      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'games':
            return (b.gamesPlayed || 0) - (a.gamesPlayed || 0);
          case 'wins':
            return (b.gamesWon || 0) - (a.gamesWon || 0);
          default:
            return 0;
        }
      });

      setFilteredPlayers(filtered);
    } catch (error) {
      console.error('Error filtering players:', error);
      setFilteredPlayers([]);
    }
  }, [players, searchQuery, sortBy]);

  const loadPlayers = async () => {
    const loadedPlayers = isSupabaseConfigured
      ? await playersService.listPlayers()
      : await storage.getPlayers();
    
    // Check for duplicate IDs and fix them
    const uniquePlayers = loadedPlayers.reduce((acc, player, index) => {
      const existingIndex = acc.findIndex(p => p.id === player.id);
      if (existingIndex !== -1) {
        // Duplicate ID found, create a new unique ID
        const newPlayer = {
          ...player,
          id: `player_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
        };
        acc.push(newPlayer);
      } else {
        acc.push(player);
      }
      return acc;
    }, [] as Player[]);
    
    setPlayers(uniquePlayers);
  };

  const handleDeletePlayer = async () => {
    if (selectedPlayer) {
      const updatedPlayers = players.filter(p => p.id !== selectedPlayer.id);
      await storage.savePlayers(updatedPlayers);
      setPlayers(updatedPlayers);
      setDeleteDialogVisible(false);
      setSelectedPlayer(null);
    }
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) {
      setError('Player name is required');
      return;
    }

    // Check for duplicate names
    const existingPlayer = players.find(p => 
      p.name.toLowerCase() === newPlayerName.trim().toLowerCase()
    );
    
    if (existingPlayer) {
      setError('A player with this name already exists');
      return;
    }

    try {
      const newPlayer: Player = {
        id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: newPlayerName.trim(),
        email: newPlayerEmail.trim() || undefined,
        phone: newPlayerPhone.trim() || undefined,
        gamesPlayed: 0,
        gamesWon: 0,
        role: 'player'
      };
      
      const updatedPlayers = [...players, newPlayer];
      await storage.savePlayers(updatedPlayers);
      setPlayers(updatedPlayers);
      setNewPlayerName('');
      setNewPlayerEmail('');
      setNewPlayerPhone('');
      setAddDialogVisible(false);
      setError('');
    } catch (error) {
      setError('Failed to add player. Please try again.');
      console.error('Error adding player:', error);
    }
  };

  const sendEmailInvite = async (player: Player) => {
    if (player.email) {
      const inviteLink = Linking.createURL(`/invite/${player.id}`);
      const mailtoUrl = `mailto:${player.email}?subject=Join%20Rummy%20Game&body=You've%20been%20invited%20to%20join%20a%20Rummy%20game.%20Click%20here%20to%20join:%20${inviteLink}`;
      await Linking.openURL(mailtoUrl);
    }
  };

  const sendSMSInvite = async (player: Player) => {
    if (player.phone) {
      const inviteLink = Linking.createURL(`/invite/${player.id}`);
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) {
        await SMS.sendSMSAsync(
          [player.phone],
          `You've been invited to join a Rummy game. Click here to join: ${inviteLink}`
        );
      }
    }
  };

  const renderPlayer = ({ item }: { item: Player }) => {
    try {
      const initials = (item.name || '?')
        .split(' ')
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);

      return (
        <Card
          mode="outlined"
          style={styles.card}
          onPress={() => router.push(`/players/${item.id}`)}
        >
          <Card.Content style={styles.cardContent}>
            <Avatar.Text size={44} label={initials} />
            <View style={styles.playerInfo}>
              <Text variant="titleMedium" numberOfLines={1}>
                {item.name || 'Unknown Player'}
              </Text>
              <Text variant="bodySmall" style={styles.playerMeta}>
                {item.playerCode
                  ? `Player ID ${item.playerCode}`
                  : `${item.gamesPlayed || 0} games · ${item.gamesWon || 0} wins`}
              </Text>
            </View>
            <View style={styles.actions}>
              <IconButton
                icon="pencil-outline"
                size={22}
                accessibilityLabel={`Edit ${item.name}`}
                onPress={() => router.push(`/players/${item.id}/edit`)}
              />
              <IconButton
                icon="delete-outline"
                size={22}
                accessibilityLabel={`Delete ${item.name}`}
                onPress={() => {
                  setSelectedPlayer(item);
                  setDeleteDialogVisible(true);
                }}
              />
            </View>
          </Card.Content>
        </Card>
      );
    } catch (error) {
      console.error('Error rendering player:', error, item);
      return null;
    }
  };

  const handleDialogClose = () => {
    setAddDialogVisible(false);
    setNewPlayerName('');
    setNewPlayerEmail('');
    setNewPlayerPhone('');
    router.setParams({});
  };

  return (
    <View style={styles.container}>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
      
      <View style={styles.header}>
        <Searchbar
          placeholder="Search players"
          onChangeText={setSearchQuery}
          value={searchQuery}
          mode="bar"
          style={styles.searchBar}
          inputStyle={styles.searchInput}
        />
        <Menu
          visible={sortMenuVisible}
          onDismiss={() => setSortMenuVisible(false)}
          anchor={
            <IconButton
              icon="sort"
              size={24}
              accessibilityLabel="Sort players"
              onPress={() => setSortMenuVisible(true)}
            />
          }
        >
          <Menu.Item 
            onPress={() => {
              setSortBy('name');
              setSortMenuVisible(false);
            }} 
            title="Sort by name"
          />
          <Menu.Item 
            onPress={() => {
              setSortBy('games');
              setSortMenuVisible(false);
            }} 
            title="Sort by games played"
          />
          <Menu.Item 
            onPress={() => {
              setSortBy('wins');
              setSortMenuVisible(false);
            }} 
            title="Sort by wins"
          />
        </Menu>
      </View>

      <FlatList
        data={filteredPlayers}
        renderItem={renderPlayer}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <EmptyState
            icon="account-group-outline"
            title={searchQuery ? 'No matching players' : 'No players yet'}
            message={
              searchQuery
                ? 'Try a different name, email, or phone number.'
                : 'Invite friends so they show up here once they register.'
            }
          />
        )}
      />

      <FAB
        icon="account-plus-outline"
        label="Find players"
        style={styles.fab}
        onPress={() => router.push('/players/new')}
      />

      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Icon icon="delete-outline" />
          <Dialog.Title style={styles.dialogTitle}>Delete player?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {selectedPlayer?.name} will be removed from this device's local list.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleDeletePlayer}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={addDialogVisible} onDismiss={handleDialogClose} style={styles.dialog}>
          <Dialog.Title>Add new player</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Player Name"
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Email (optional)"
              value={newPlayerEmail}
              onChangeText={setNewPlayerEmail}
              mode="outlined"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              label="Phone (optional)"
              value={newPlayerPhone}
              onChangeText={setNewPlayerPhone}
              mode="outlined"
              style={styles.input}
              keyboardType="phone-pad"
            />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setAddDialogVisible(false)}>Cancel</Button>
            <Button mode="contained" onPress={handleAddPlayer}>
              Add
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  searchBar: {
    flex: 1,
    borderRadius: radius.full,
  },
  searchInput: {
    minHeight: 0,
  },
  listContent: {
    gap: spacing.md,
    paddingBottom: 96,
  },
  card: {
    borderRadius: radius.md,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 76,
  },
  playerInfo: {
    flex: 1,
    gap: 2,
  },
  playerMeta: {
    opacity: 0.7,
  },
  actions: {
    flexDirection: 'row',
  },
  fab: {
    position: 'absolute',
    margin: spacing.lg,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
  },
  input: {
    marginBottom: spacing.lg,
  },
  dialog: {
    borderRadius: radius.lg,
  },
  dialogTitle: {
    textAlign: 'center',
  },
  dialogActions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    color: '#b3261e',
    textAlign: 'center',
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: '#f9dedc',
    borderRadius: radius.sm,
  },
}); 