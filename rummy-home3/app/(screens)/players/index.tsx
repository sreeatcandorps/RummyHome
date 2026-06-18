import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, ScrollView } from 'react-native';
import { Text, Card, FAB, IconButton, Searchbar, Menu, Portal, Dialog, TextInput, Button, List } from 'react-native-paper';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { storage } from '../../../utils/storage';
import { Player } from '../../../types/player';
import * as Linking from 'expo-linking';
import * as SMS from 'expo-sms';
import * as Contacts from 'expo-contacts';

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
  const [hasContactPermission, setHasContactPermission] = useState(false);
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [contactPickerVisible, setContactPickerVisible] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [filteredContacts, setFilteredContacts] = useState<Contacts.Contact[]>([]);
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
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      setHasContactPermission(status === 'granted');
    })();
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
    const loadedPlayers = await storage.getPlayers();
    
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

  const handleSelectContact = async () => {
    try {
      if (!hasContactPermission) {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status !== 'granted') {
          return;
        }
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
        sort: Contacts.SortTypes.FirstName
      });

      // Show contact selection dialog
      setContacts(data);
      setContactPickerVisible(true);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const selectContact = (contact: Contacts.Contact) => {
    setNewPlayerName(contact.name || '');
    if (contact.emails && contact.emails.length > 0) {
      setNewPlayerEmail(contact.emails[0].email || '');
    }
    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
      setNewPlayerPhone(contact.phoneNumbers[0].number || '');
    }
    setContactPickerVisible(false);
  };

  const handleContactSearch = async (query: string) => {
    setContactSearch(query);
    if (query.length < 2) {
      setFilteredContacts([]);
      return;
    }

    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
        name: query,  // This filters contacts by name
      });
      setFilteredContacts(data);
    } catch (error) {
      console.error('Error searching contacts:', error);
    }
  };



  const renderPlayer = ({ item }: { item: Player }) => {
    try {
      return (
        <Card 
          style={styles.card}
          onPress={() => router.push(`/players/${item.id}`)}
        >
          <Card.Content style={styles.cardContent}>
            <View style={styles.playerInfo}>
              <Text variant="titleMedium">{item.name || 'Unknown Player'}</Text>
              <Text variant="bodyMedium">
                Games: {item.gamesPlayed || 0} | Wins: {item.gamesWon || 0}
              </Text>
            </View>
            <View style={styles.actions}>
              <IconButton
                icon="pencil"
                onPress={() => router.push(`/players/${item.id}/edit`)}
              />
              <IconButton
                icon="delete"
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
          style={styles.searchBar}
        />
        <Menu
          visible={sortMenuVisible}
          onDismiss={() => setSortMenuVisible(false)}
          anchor={
            <IconButton
              icon="sort"
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
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>
            {searchQuery ? 'No matching players found' : 'No players added yet'}
          </Text>
        )}
      />
      
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/players/new')}
      />

      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}
        >
          <Dialog.Title>Delete Player</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to delete {selectedPlayer?.name}?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <IconButton
              icon="close"
              onPress={() => setDeleteDialogVisible(false)}
              mode="contained"
            />
            <IconButton
              icon="delete"
              onPress={handleDeletePlayer}
              mode="contained"
            />
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={addDialogVisible} onDismiss={handleDialogClose}>
          <Dialog.Title>Add New Player</Dialog.Title>
          <Dialog.Content>
            <Button 
              mode="outlined"
              icon="account-search"
              onPress={() => router.push('/players/search')}
              style={styles.input}
            >
              Search Contacts
            </Button>
            
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
          <Dialog.Actions>
            <Button onPress={() => setAddDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleAddPlayer}>Add</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog visible={contactPickerVisible} onDismiss={() => setContactPickerVisible(false)}>
          <Dialog.Title>Select Contact</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Search contacts"
              value={contactSearch}
              onChangeText={handleContactSearch}
              mode="outlined"
              style={{ marginBottom: 10 }}
            />
            <ScrollView style={{ maxHeight: 300 }}>
              {filteredContacts.map((contact, index) => (
                <List.Item
                  key={`contact-${contact.name ?? 'unknown'}-${contact.phoneNumbers?.[0]?.number ?? index}`}
                  title={contact.name}
                  description={
                    contact.phoneNumbers && contact.phoneNumbers[0]
                      ? contact.phoneNumbers[0].number
                      : 'No phone number'
                  }
                  onPress={() => selectContact(contact)}
                />
              ))}
              {contactSearch.length >= 2 && filteredContacts.length === 0 && (
                <Text style={{ padding: 16, textAlign: 'center' }}>No contacts found</Text>
              )}
            </ScrollView>
          </Dialog.Content>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchBar: {
    flex: 1,
    marginRight: 8,
  },
  card: {
    marginBottom: 8,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerInfo: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
    opacity: 0.5,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#6200ee',
  },
  input: {
    marginBottom: 16,
  },
  contactButton: {
    marginBottom: 16,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#ffebee',
    borderRadius: 4,
  },
}); 