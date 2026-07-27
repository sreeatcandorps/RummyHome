import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { 
  Text, 
  Card, 
  Button, 
  Avatar, 
  Divider, 
  useTheme, 
  TextInput, 
  Portal, 
  Modal, 
  HelperText,
  IconButton
} from 'react-native-paper';
import { router } from 'expo-router';
import { storage } from '../../utils/storage';
import { authService } from '../../services/auth';
import { supabase } from '../../services/supabase';
import { Player } from '../../types/player';

export default function ProfileScreen() {
  const theme = useTheme();
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Change passcode modal state
  const [showChangePasscode, setShowChangePasscode] = useState(false);
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState('');
  const [passcodeLoading, setPasscodeLoading] = useState(false);
  
  // Change email modal state
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    loadCurrentPlayer();
  }, []);

  const loadCurrentPlayer = async () => {
    try {
      const player = await authService.getCurrentPlayer();
      setCurrentPlayer(player);
    } catch (error) {
      console.error('Error loading current player:', error);
    } finally {
      setLoading(false);
    }
  };

  // Change passcode functionality
  const handleChangePasscode = async () => {
    setPasscodeError('');
    
    // Validation
    if (!currentPasscode || !newPasscode || !confirmPasscode) {
      setPasscodeError('Please fill in all fields');
      return;
    }
    
    if (newPasscode.length !== 6) {
      setPasscodeError('New passcode must be exactly 6 digits');
      return;
    }
    
    if (!/^\d{6}$/.test(newPasscode)) {
      setPasscodeError('New passcode must contain only numbers');
      return;
    }
    
    if (newPasscode !== confirmPasscode) {
      setPasscodeError('New passcodes do not match');
      return;
    }
    
    setPasscodeLoading(true);
    
    try {
      // First verify current passcode
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: currentPlayer?.email || '',
        password: currentPasscode,
      });
      
      if (verifyError) {
        setPasscodeError('Current passcode is incorrect');
        return;
      }
      
      // Update passcode
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPasscode,
      });
      
      if (updateError) {
        setPasscodeError(updateError.message);
        return;
      }
      
      Alert.alert(
        'Success',
        'Your passcode has been updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowChangePasscode(false);
              setCurrentPasscode('');
              setNewPasscode('');
              setConfirmPasscode('');
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Change passcode error:', error);
      setPasscodeError('Failed to update passcode. Please try again.');
    } finally {
      setPasscodeLoading(false);
    }
  };

  // Change email functionality
  const handleChangeEmail = async () => {
    setEmailError('');
    
    // Validation
    if (!newEmail) {
      setEmailError('Please enter a new email address');
      return;
    }
    
    if (!newEmail.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    if (newEmail.toLowerCase() === currentPlayer?.email?.toLowerCase()) {
      setEmailError('New email must be different from current email');
      return;
    }
    
    setEmailLoading(true);
    
    try {
      // Update email in Supabase (this will send a confirmation email)
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });
      
      if (error) {
        setEmailError(error.message);
        return;
      }
      
      Alert.alert(
        'Email Update Requested',
        `A confirmation email has been sent to ${newEmail.trim()}. Please check your email and click the confirmation link to complete the email change. You will also receive a notification email at your current address.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowChangeEmail(false);
              setNewEmail('');
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('Change email error:', error);
      setEmailError('Failed to update email. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!currentPlayer) {
    return (
      <View style={styles.container}>
        <Text>No user profile found</Text>
        <Button onPress={() => router.replace('/(auth)/login')}>Login</Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content style={styles.headerContent}>
          <Avatar.Text 
            size={80} 
            label={getInitials(currentPlayer.name)}
            style={{ 
              backgroundColor: currentPlayer.role === 'admin' 
                ? theme.colors.error 
                : theme.colors.primary,
              marginBottom: 16
            }}
          />
          <Text variant="headlineMedium" style={styles.name}>
            {currentPlayer.name}
          </Text>
          <Text variant="bodyLarge" style={styles.role}>
            {currentPlayer.role === 'admin' ? 'Administrator' : 'Player'}
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Account Settings
          </Text>
          <Divider style={styles.divider} />
          
          <Button 
            mode="outlined"
            onPress={() => setShowChangePasscode(true)}
            style={styles.button}
            icon="lock"
          >
            Change Passcode
          </Button>
          
          <Button 
            mode="outlined"
            onPress={() => setShowChangeEmail(true)}
            style={styles.button}
            icon="email"
          >
            Change Email
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Contact Information
          </Text>
          <Divider style={styles.divider} />
          
          {currentPlayer.email && (
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>Email:</Text>
              <Text variant="bodyMedium" style={styles.value}>{currentPlayer.email}</Text>
            </View>
          )}
          
          {currentPlayer.phone && (
            <View style={styles.infoRow}>
              <Text variant="bodyMedium" style={styles.label}>Phone:</Text>
              <Text variant="bodyMedium" style={styles.value}>{currentPlayer.phone}</Text>
            </View>
          )}
          
          {!currentPlayer.email && !currentPlayer.phone && (
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
                {currentPlayer.gamesPlayed || 0}
              </Text>
              <Text variant="bodyMedium">Games Played</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={styles.statNumber}>
                {currentPlayer.gamesWon || 0}
              </Text>
              <Text variant="bodyMedium">Games Won</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text variant="headlineMedium" style={styles.statNumber}>
                {currentPlayer.gamesPlayed && currentPlayer.gamesWon 
                  ? Math.round((currentPlayer.gamesWon / currentPlayer.gamesPlayed) * 100)
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
          onPress={() => router.push(`/players/${currentPlayer.id}/edit`)}
          style={styles.button}
          icon="account-edit"
        >
          Edit Profile
        </Button>
        
        <Button 
          mode="outlined"
          onPress={() => router.back()}
          style={styles.button}
          icon="arrow-left"
        >
          Back
        </Button>
      </View>

      {/* Change Passcode Modal */}
      <Portal>
        <Modal
          visible={showChangePasscode}
          onDismiss={() => setShowChangePasscode(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text variant="titleLarge" style={styles.modalTitle}>
              Change Passcode
            </Text>
            <IconButton
              icon="close"
              size={24}
              onPress={() => {
                setShowChangePasscode(false);
                setCurrentPasscode('');
                setNewPasscode('');
                setConfirmPasscode('');
                setPasscodeError('');
              }}
            />
          </View>
          
          <TextInput
            label="Current Passcode"
            value={currentPasscode}
            onChangeText={(text) => {
              const numericText = text.replace(/[^0-9]/g, '');
              if (numericText.length <= 6) {
                setCurrentPasscode(numericText);
              }
            }}
            mode="outlined"
            style={styles.modalInput}
            keyboardType="numeric"
            maxLength={6}
            secureTextEntry
            placeholder="Enter current 6-digit passcode"
          />
          
          <TextInput
            label="New Passcode"
            value={newPasscode}
            onChangeText={(text) => {
              const numericText = text.replace(/[^0-9]/g, '');
              if (numericText.length <= 6) {
                setNewPasscode(numericText);
              }
            }}
            mode="outlined"
            style={styles.modalInput}
            keyboardType="numeric"
            maxLength={6}
            secureTextEntry
            placeholder="Enter new 6-digit passcode"
          />
          
          <TextInput
            label="Confirm New Passcode"
            value={confirmPasscode}
            onChangeText={(text) => {
              const numericText = text.replace(/[^0-9]/g, '');
              if (numericText.length <= 6) {
                setConfirmPasscode(numericText);
              }
            }}
            mode="outlined"
            style={styles.modalInput}
            keyboardType="numeric"
            maxLength={6}
            secureTextEntry
            placeholder="Confirm new 6-digit passcode"
          />
          
          {passcodeError ? (
            <HelperText type="error" visible={!!passcodeError}>
              {passcodeError}
            </HelperText>
          ) : null}
          
          <View style={styles.modalButtons}>
            <Button 
              mode="outlined"
              onPress={() => {
                setShowChangePasscode(false);
                setCurrentPasscode('');
                setNewPasscode('');
                setConfirmPasscode('');
                setPasscodeError('');
              }}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            
            <Button 
              mode="contained"
              onPress={handleChangePasscode}
              style={styles.modalButton}
              loading={passcodeLoading}
              disabled={passcodeLoading}
            >
              Update Passcode
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Change Email Modal */}
      <Portal>
        <Modal
          visible={showChangeEmail}
          onDismiss={() => setShowChangeEmail(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text variant="titleLarge" style={styles.modalTitle}>
              Change Email
            </Text>
            <IconButton
              icon="close"
              size={24}
              onPress={() => {
                setShowChangeEmail(false);
                setNewEmail('');
                setEmailError('');
              }}
            />
          </View>
          
          <Text variant="bodyMedium" style={styles.modalSubtitle}>
            Current email: {currentPlayer?.email}
          </Text>
          
          <TextInput
            label="New Email Address"
            value={newEmail}
            onChangeText={setNewEmail}
            mode="outlined"
            style={styles.modalInput}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="Enter new email address"
          />
          
          {emailError ? (
            <HelperText type="error" visible={!!emailError}>
              {emailError}
            </HelperText>
          ) : null}
          
          <HelperText type="info" visible={true}>
            A confirmation email will be sent to verify your new email address.
          </HelperText>
          
          <View style={styles.modalButtons}>
            <Button 
              mode="outlined"
              onPress={() => {
                setShowChangeEmail(false);
                setNewEmail('');
                setEmailError('');
              }}
              style={styles.modalButton}
            >
              Cancel
            </Button>
            
            <Button 
              mode="contained"
              onPress={handleChangeEmail}
              style={styles.modalButton}
              loading={emailLoading}
              disabled={emailLoading}
            >
              Send Confirmation Email
            </Button>
          </View>
        </Modal>
      </Portal>
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
  modal: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 10,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
  },
  modalSubtitle: {
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.7,
  },
  modalInput: {
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
}); 