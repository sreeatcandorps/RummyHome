import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { TextInput, Button, List, Text, Portal, Dialog } from 'react-native-paper';
import * as Contacts from 'expo-contacts';
import { router } from 'expo-router';
import { storage } from '../../../utils/storage';
import { Player } from '../../../types/player';

export default function AddPlayerScreen() {
  const [contactSearch, setContactSearch] = useState('');
  const [filteredContacts, setFilteredContacts] = useState<Contacts.Contact[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [newPlayerPhone, setNewPlayerPhone] = useState('');

  const handleSearch = async () => {
    if (contactSearch.length < 2) return;

    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') return;

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
        name: contactSearch,
      });
      setFilteredContacts(data);
      setHasSearched(true);
    } catch (error) {
      console.error('Error searching contacts:', error);
    }
  };

  const handleClear = () => {
    setContactSearch('');
    setFilteredContacts([]);
    setHasSearched(false);
  };

  const selectContact = (contact: Contacts.Contact) => {
    setNewPlayerName(contact.name || '');
    setNewPlayerEmail(contact.emails?.[0]?.email || '');
    setNewPlayerPhone(contact.phoneNumbers?.[0]?.number || '');
    setFilteredContacts([]);
    setContactSearch('');
    setHasSearched(false);
  };

  const handleAddPlayer = async () => {
    if (newPlayerName.trim()) {
      const newPlayer: Player = {
        id: Date.now().toString(),
        name: newPlayerName.trim(),
        email: newPlayerEmail.trim(),
        phone: newPlayerPhone.trim(),
        gamesPlayed: 0,
        gamesWon: 0,
        role: 'player',
      };
      
      const existingPlayers = await storage.getPlayers();
      const updatedPlayers = [...existingPlayers, newPlayer];
      await storage.savePlayers(updatedPlayers);
      
      // Clear form and go back
      resetForm();
      router.back();
    }
  };

  const resetForm = () => {
    setNewPlayerName('');
    setNewPlayerEmail('');
    setNewPlayerPhone('');
    setContactSearch('');
    setFilteredContacts([]);
    setHasSearched(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchSection}>
        <TextInput
          label="Search contacts"
          value={contactSearch}
          onChangeText={setContactSearch}
          mode="outlined"
          style={styles.input}
        />
        <View style={styles.buttonContainer}>
          <Button 
            mode="contained" 
            onPress={handleSearch}
            style={styles.button}
          >
            Search
          </Button>
          <Button 
            mode="outlined" 
            onPress={handleClear}
            style={styles.button}
          >
            Clear
          </Button>
        </View>
      </View>

      {hasSearched && (
        <ScrollView style={styles.results}>
          {filteredContacts.length === 0 ? (
            <Text style={styles.noResults}>No contacts found</Text>
          ) : (
            filteredContacts.map((contact, index) => (
              <List.Item
                key={`contact-${contact.name ?? 'unknown'}-${contact.phoneNumbers?.[0]?.number ?? index}`}
                title={contact.name}
                description={
                  contact.phoneNumbers && contact.phoneNumbers[0]
                    ? contact.phoneNumbers[0].number
                    : 'No phone number'
                }
                onPress={() => selectContact(contact)}
                left={props => <List.Icon {...props} icon="account" />}
              />
            ))
          )}
        </ScrollView>
      )}

      <View style={styles.formSection}>
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
        <View style={styles.buttonContainer}>
          <Button 
            mode="outlined" 
            onPress={() => router.back()}
            style={styles.button}
          >
            Cancel
          </Button>
          <Button 
            mode="contained" 
            onPress={handleAddPlayer}
            style={styles.button}
          >
            Add Player
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchSection: {
    marginBottom: 16,
  },
  formSection: {
    marginTop: 16,
  },
  input: {
    marginBottom: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  button: {
    flex: 1,
  },
  results: {
    maxHeight: 200,
  },
  noResults: {
    textAlign: 'center',
    padding: 16,
    opacity: 0.5,
  },
}); 