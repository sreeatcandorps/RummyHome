import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput, Button, List, Searchbar, Divider, Avatar, Surface, HelperText } from 'react-native-paper';
import { router } from 'expo-router';
import * as Contacts from 'expo-contacts';
import { storage } from '../../../utils/storage';
import { supabase } from '../../../services/supabase';
import { Player } from '../../../types/player';
import * as Linking from 'expo-linking';
import * as SMS from 'expo-sms';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AddPlayerScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contacts.Contact[]>([]);
  const [loading, setLoading] = useState(false);

  // Validation states
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    requestContactsPermission();
  }, []);

  const requestContactsPermission = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === 'granted') {
      loadContacts();
    }
  };

  const loadContacts = async () => {
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
        sort: Contacts.SortTypes.FirstName
      });
      setContacts(data);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setFilteredContacts([]);
      return;
    }

    const filtered = contacts.filter(contact => 
      contact.name?.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredContacts(filtered);
  };

  const selectContact = (contact: Contacts.Contact) => {
    setName(contact.name || '');
    if (contact.emails && contact.emails.length > 0) {
      setEmail(contact.emails[0].email || '');
    }
    if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
      setPhone(contact.phoneNumbers[0].number || '');
    }
    setSearchQuery('');
    setFilteredContacts([]);
    setError(''); // Clear any previous errors
  };

  const renderContactDetails = (contact: Contacts.Contact) => {
    const emails = contact.emails?.map(e => e.email).join(', ') || 'No email';
    const phones = contact.phoneNumbers?.map(p => p.number).join(', ') || 'No phone';
    
    return (
      <Surface style={styles.contactPreview}>
        <View style={styles.contactHeader}>
          <Avatar.Text 
            size={40} 
            label={contact.name?.[0]?.toUpperCase() || '?'} 
          />
          <View style={styles.contactInfo}>
            <Text variant="titleMedium">{contact.name}</Text>
            <Text variant="bodySmall">{phones}</Text>
            <Text variant="bodySmall">{emails}</Text>
          </View>
        </View>
      </Surface>
    );
  };

  const sendInvitations = async (player: Player) => {
    try {
      // Priority: Email first, then SMS if no email
      if (player.email) {
        await sendEmailInvite(player);
      } else if (player.phone) {
        await sendSMSInvite(player);
      }
    } catch (error) {
      console.error('Error sending invitations:', error);
      setError('Failed to send invitations');
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

  const validateForm = () => {
    let isValid = true;
    
    // Name validation
    if (!name.trim()) {
      setError('Name is required');
      isValid = false;
    }

    // Email validation (only if provided)
    if (email.trim() && !EMAIL_REGEX.test(email.trim())) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    }

    return isValid;
  };

  const handleAddPlayer = async () => {
    setError('');
    setEmailError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Generate unique ID for local player
      const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newPlayer: Player = {
        id: playerId,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        gamesPlayed: 0,
        gamesWon: 0,
        role: 'player'
      };

      await storage.addPlayer(newPlayer);
      
      // Only send invitations if contact info exists
      if (newPlayer.email || newPlayer.phone) {
        await sendInvitations(newPlayer);
        alert('Player added and invitation sent successfully!');
      } else {
        alert('Player added successfully!');
      }
      
      router.back();
    } catch (err: any) {
      console.error('Error adding player:', err);
      setError(err.message || 'Failed to add player');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>New Player</Text>
      
      <Surface style={styles.contactSearchCard} elevation={2}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          📱 Add from Contacts
        </Text>
        <Text variant="bodySmall" style={styles.sectionSubtitle}>
          Search your phone contacts to quickly add players
        </Text>
        
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="Type contact name to search..."
            mode="outlined"
            left={<TextInput.Icon icon="account-search" />}
          />
        </View>

        {searchQuery.length >= 2 && (
          <View style={styles.contactsList}>
            {filteredContacts.slice(0, 5).map((contact, index) => (
              <List.Item
                key={`contact-${contact.name ?? 'unknown'}-${contact.emails?.[0]?.email ?? contact.phoneNumbers?.[0]?.number ?? index}`}
                title={contact.name}
                description={
                  <View>
                    {contact.emails && contact.emails.length > 0 && (
                      <Text variant="bodySmall">📧 {contact.emails[0].email}</Text>
                    )}
                    {contact.phoneNumbers && contact.phoneNumbers.length > 0 && (
                      <Text variant="bodySmall">📞 {contact.phoneNumbers[0].number}</Text>
                    )}
                  </View>
                }
                left={props => (
                  <Avatar.Text 
                    {...props}
                    size={40} 
                    label={contact.name?.[0]?.toUpperCase() || '?'} 
                  />
                )}
                onPress={() => selectContact(contact)}
                style={styles.contactItem}
              />
            ))}
            {filteredContacts.length === 0 && searchQuery.length >= 2 && (
              <Text style={styles.noResults}>No contacts found for "{searchQuery}"</Text>
            )}
            {filteredContacts.length > 5 && (
              <Text style={styles.moreResults}>
                Showing first 5 results. Type more to narrow search.
              </Text>
            )}
          </View>
        )}
      </Surface>

      <ScrollView>
        <Divider style={styles.divider} />

        <View style={styles.form}>
          <TextInput
            label="Player Name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError('');
            }}
            mode="outlined"
            style={styles.input}
            error={!!error}
          />

          <TextInput
            label="Email (optional)"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setEmailError('');
            }}
            mode="outlined"
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            error={!!emailError}
          />
          {emailError ? <HelperText type="error">{emailError}</HelperText> : null}



          <TextInput
            label="Phone (optional)"
            value={phone}
            onChangeText={setPhone}
            mode="outlined"
            style={styles.input}
            keyboardType="phone-pad"
          />

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <Button
            mode="contained"
            onPress={handleAddPlayer}
            style={styles.button}
            loading={loading}
            disabled={loading}
          >
            {email.trim() || phone.trim() ? 'Add & Invite Player' : 'Add Player'}
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
  },
  searchButton: {
    minWidth: 100,
  },
  contactsList: {
    maxHeight: 300,
  },
  divider: {
    marginVertical: 16,
  },
  form: {
    padding: 16,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
  },
  noResults: {
    textAlign: 'center',
    padding: 16,
    opacity: 0.5,
  },
  contactItem: {
    paddingVertical: 8,
  },
  contactPreview: {
    padding: 8,
    marginTop: 4,
    borderRadius: 8,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactInfo: {
    marginLeft: 12,
    flex: 1,
  },
  selectedContact: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  contactSearchCard: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    marginBottom: 16,
    opacity: 0.7,
  },
  moreResults: {
    textAlign: 'center',
    padding: 8,
    opacity: 0.6,
    fontSize: 12,
  },
});

const additionalStyles = StyleSheet.create({
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: -12,
    marginBottom: 12,
  },
}); 