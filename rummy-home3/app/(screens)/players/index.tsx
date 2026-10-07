import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, FAB, IconButton, Searchbar, Menu, Portal, Dialog, TextInput, Button, TouchableRipple } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { storage } from '../../../utils/storage';
import { Player } from '../../../types/player';
import * as Linking from 'expo-linking';
import * as SMS from 'expo-sms';
import { playersService } from '../../../services/players';
import { isSupabaseConfigured } from '../../../services/supabase';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SeatAvatar } from '../../../components/ui/SeatAvatar';
import { MAX_CONTENT_WIDTH, radius, seatColor, spacing, useAppTheme } from '../../../constants/theme';
import { useLayout } from '../../../hooks/useLayout';

const SORT_LABELS = { name: 'Name', games: 'Games played', wins: 'Wins' } as const;

export default function PlayersScreen() {
  const { colors } = useAppTheme();
  const { isWide, gutterLeft, gutterRight, insets } = useLayout();
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

  const renderPlayer = ({ item, index }: { item: Player; index: number }) => {
    try {
      return (
        <View
          style={[
            styles.card,
            isWide && styles.gridCard,
            { backgroundColor: colors.surface, borderColor: colors.outlineVariant },
          ]}
        >
          <TouchableRipple
            onPress={() => router.push(`/players/${item.id}`)}
            borderless
            style={styles.cardRipple}
            accessibilityRole="button"
            accessibilityLabel={item.name || 'Unknown Player'}
          >
            <View style={styles.cardContent}>
              <SeatAvatar name={item.name || '?'} size={44} color={seatColor(index)} />
              <View style={styles.playerInfo}>
                <Text variant="titleMedium" numberOfLines={1} style={styles.playerName}>
                  {item.name || 'Unknown Player'}
                </Text>
                <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }} numberOfLines={1}>
                  {item.playerCode
                    ? `Player ID ${item.playerCode}`
                    : `${item.gamesPlayed || 0} games · ${item.gamesWon || 0} wins`}
                </Text>
              </View>
              <View style={styles.actions}>
                <IconButton
                  icon="pencil-outline"
                  size={22}
                  iconColor={colors.onSurfaceVariant}
                  accessibilityLabel={`Edit ${item.name}`}
                  onPress={() => router.push(`/players/${item.id}/edit`)}
                />
                <IconButton
                  icon="delete-outline"
                  size={22}
                  iconColor={colors.error}
                  accessibilityLabel={`Delete ${item.name}`}
                  onPress={() => {
                    setSelectedPlayer(item);
                    setDeleteDialogVisible(true);
                  }}
                />
              </View>
            </View>
          </TouchableRipple>
        </View>
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.column, { paddingLeft: gutterLeft, paddingRight: gutterRight }]}>
        {error ? (
          <Text style={[styles.errorText, { color: colors.onErrorContainer, backgroundColor: colors.errorContainer }]}>
            {error}
          </Text>
        ) : null}

        <View style={styles.header}>
          <Searchbar
            placeholder="Search players"
            onChangeText={setSearchQuery}
            value={searchQuery}
            mode="bar"
            style={[styles.searchBar, { backgroundColor: colors.surfaceVariant }]}
            inputStyle={styles.searchInput}
          />
          <Menu
            visible={sortMenuVisible}
            onDismiss={() => setSortMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                icon="sort"
                compact
                accessibilityLabel="Sort players"
                onPress={() => setSortMenuVisible(true)}
                style={styles.sortButton}
                contentStyle={styles.sortButtonContent}
              >
                {SORT_LABELS[sortBy]}
              </Button>
            }
          >
            <Menu.Item
              onPress={() => {
                setSortBy('name');
                setSortMenuVisible(false);
              }}
              leadingIcon={sortBy === 'name' ? 'check' : undefined}
              title="Sort by name"
            />
            <Menu.Item
              onPress={() => {
                setSortBy('games');
                setSortMenuVisible(false);
              }}
              leadingIcon={sortBy === 'games' ? 'check' : undefined}
              title="Sort by games played"
            />
            <Menu.Item
              onPress={() => {
                setSortBy('wins');
                setSortMenuVisible(false);
              }}
              leadingIcon={sortBy === 'wins' ? 'check' : undefined}
              title="Sort by wins"
            />
          </Menu>
        </View>

        <Text variant="labelLarge" style={[styles.count, { color: colors.onSurfaceVariant }]}>
          {filteredPlayers.length} {filteredPlayers.length === 1 ? 'player' : 'players'}
        </Text>
      </View>

      <FlatList
        key={isWide ? 'grid' : 'list'}
        data={filteredPlayers}
        renderItem={renderPlayer}
        numColumns={isWide ? 2 : 1}
        columnWrapperStyle={isWide ? styles.gridRow : undefined}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          { paddingLeft: gutterLeft, paddingRight: gutterRight, paddingBottom: insets.bottom + 96 },
        ]}
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
        style={[styles.fab, { right: gutterRight, bottom: insets.bottom + spacing.lg }]}
        onPress={() => router.push('/players/new')}
      />

      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}
          style={[styles.dialog, { backgroundColor: colors.surface }]}
        >
          <Dialog.Icon icon="delete-outline" color={colors.error} />
          <Dialog.Title style={styles.dialogTitle}>Delete player?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium" style={[styles.dialogBody, { color: colors.onSurfaceVariant }]}>
              {selectedPlayer?.name} will be removed from this device's local list.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
            <Button mode="contained" buttonColor={colors.error} textColor={colors.onError} onPress={handleDeletePlayer}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={addDialogVisible} onDismiss={handleDialogClose} style={[styles.dialog, { backgroundColor: colors.surface }]}>
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
  },
  column: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH + spacing.xxl * 2,
    alignSelf: 'center',
    paddingTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    borderRadius: radius.full,
  },
  searchInput: {
    minHeight: 0,
  },
  sortButton: {
    borderRadius: radius.full,
  },
  sortButtonContent: {
    height: 48,
  },
  count: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  list: {
    flex: 1,
  },
  listContent: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH + spacing.xxl * 2,
    alignSelf: 'center',
    gap: spacing.sm,
  },
  gridRow: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  gridCard: {
    flex: 1,
  },
  cardRipple: {
    borderRadius: radius.lg,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.sm,
    minHeight: 72,
  },
  playerInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  playerName: {
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
  },
  fab: {
    position: 'absolute',
    borderRadius: radius.lg,
  },
  input: {
    marginBottom: spacing.lg,
  },
  dialog: {
    borderRadius: radius.xl,
    maxWidth: 480,
    width: '90%',
    alignSelf: 'center',
  },
  dialogTitle: {
    textAlign: 'center',
  },
  dialogBody: {
    textAlign: 'center',
  },
  dialogActions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
});
