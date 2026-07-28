import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Share } from 'react-native';
import {
  Text,
  Card,
  Button,
  Avatar,
  Divider,
  useTheme,
  TextInput,
  Portal,
  Dialog,
  HelperText,
  IconButton,
  List,
} from 'react-native-paper';
import { router } from 'expo-router';
import { authService } from '../../services/auth';
import { supabase } from '../../services/supabase';
import { Player } from '../../types/player';
import { Screen } from '../../components/ui/Screen';
import { SectionCard } from '../../components/ui/SectionCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { MIN_TOUCH_TARGET, radius, spacing } from '../../constants/theme';

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
  
  const [showPlayerIdInfo, setShowPlayerIdInfo] = useState(false);

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

  const sharePlayerId = async () => {
    if (!currentPlayer?.playerCode) return;

    try {
      await Share.share({
        message: `Add me on Rummy Home. My player ID is ${currentPlayer.playerCode}.`,
      });
    } catch (error) {
      console.error('Share player ID failed:', error);
    }
  };

  const closePasscodeDialog = () => {
    setShowChangePasscode(false);
    setCurrentPasscode('');
    setNewPasscode('');
    setConfirmPasscode('');
    setPasscodeError('');
  };

  const closeEmailDialog = () => {
    setShowChangeEmail(false);
    setNewEmail('');
    setEmailError('');
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!currentPlayer) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          icon="account-alert-outline"
          title="No profile found"
          message="Sign in again to load your profile."
          actionLabel="Go to login"
          onAction={() => router.replace('/(auth)/login')}
        />
      </View>
    );
  }

  const gamesPlayed = currentPlayer.gamesPlayed || 0;
  const gamesWon = currentPlayer.gamesWon || 0;
  const winRate = gamesPlayed && gamesWon ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

  const stats = [
    { label: 'Played', value: `${gamesPlayed}` },
    { label: 'Won', value: `${gamesWon}` },
    { label: 'Win rate', value: `${winRate}%` },
  ];

  return (
    <Screen>
      <Card
        mode="contained"
        style={[styles.hero, { backgroundColor: theme.colors.primaryContainer }]}
      >
        <Card.Content style={styles.heroContent}>
          <Avatar.Text
            size={88}
            label={getInitials(currentPlayer.name)}
            style={{
              backgroundColor: currentPlayer.role === 'admin'
                ? theme.colors.error
                : theme.colors.primary,
            }}
          />
          <Text variant="headlineSmall" style={[styles.heroName, { color: theme.colors.onPrimaryContainer }]}>
            {currentPlayer.name}
          </Text>
          <Text variant="labelLarge" style={{ color: theme.colors.onPrimaryContainer, opacity: 0.8 }}>
            {currentPlayer.role === 'admin' ? 'Administrator' : 'Player'}
          </Text>

          <Button
            mode="contained"
            onPress={() => router.push(`/players/${currentPlayer.id}/edit`)}
            icon="account-edit-outline"
            style={styles.heroButton}
            contentStyle={styles.buttonContent}
          >
            Edit profile
          </Button>
        </Card.Content>
      </Card>

      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <Card key={stat.label} mode="outlined" style={styles.statCard}>
            <Card.Content style={styles.statContent}>
              <Text variant="headlineSmall" style={styles.statValue}>
                {stat.value}
              </Text>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {stat.label}
              </Text>
            </Card.Content>
          </Card>
        ))}
      </View>

      <Card mode="outlined" style={styles.playerIdCard}>
        <Card.Content style={styles.playerIdContent}>
          <View style={styles.playerIdHeader}>
            <Text variant="titleMedium" style={styles.playerIdTitle}>
              Your player ID
            </Text>
            <IconButton
              icon="information-outline"
              size={20}
              accessibilityLabel="What is a player ID?"
              onPress={() => setShowPlayerIdInfo(true)}
            />
          </View>

          <View style={styles.playerIdRow}>
            <View style={[styles.playerIdPill, { backgroundColor: theme.colors.secondaryContainer }]}>
              <Text
                variant="headlineSmall"
                style={[styles.playerIdText, { color: theme.colors.onSecondaryContainer }]}
              >
                {currentPlayer.playerCode ?? '—'}
              </Text>
            </View>

            <Button
              mode="contained-tonal"
              icon="share-variant"
              onPress={sharePlayerId}
              disabled={!currentPlayer.playerCode}
              contentStyle={styles.buttonContent}
            >
              Share
            </Button>
          </View>

          {!currentPlayer.playerCode ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Run migration 004 in Supabase to generate player IDs.
            </Text>
          ) : null}
        </Card.Content>
      </Card>

      <SectionCard title="Contact information">
        {currentPlayer.email || currentPlayer.phone ? (
          <View>
            {currentPlayer.email ? (
              <List.Item
                title={currentPlayer.email}
                description="Email"
                left={(props) => <List.Icon {...props} icon="email-outline" />}
                style={styles.infoItem}
              />
            ) : null}
            {currentPlayer.phone ? (
              <List.Item
                title={currentPlayer.phone}
                description="Phone"
                left={(props) => <List.Icon {...props} icon="phone-outline" />}
                style={styles.infoItem}
              />
            ) : null}
          </View>
        ) : (
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            No contact information yet. Add it from Edit profile.
          </Text>
        )}
      </SectionCard>

      <SectionCard title="Security">
        <List.Item
          title="Change passcode"
          description="Update your 6-digit login passcode"
          left={(props) => <List.Icon {...props} icon="lock-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => setShowChangePasscode(true)}
          style={styles.actionItem}
        />
        <Divider />
        <List.Item
          title="Change email"
          description="Requires confirmation from your inbox"
          left={(props) => <List.Icon {...props} icon="email-sync-outline" />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          onPress={() => setShowChangeEmail(true)}
          style={styles.actionItem}
        />
      </SectionCard>

      <Portal>
        <Dialog
          visible={showPlayerIdInfo}
          onDismiss={() => setShowPlayerIdInfo(false)}
          style={styles.dialog}
        >
          <Dialog.Icon icon="badge-account-horizontal-outline" />
          <Dialog.Title style={styles.dialogTitle}>About your player ID</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text variant="bodyMedium" style={styles.dialogBody}>
              Every player gets a permanent short ID. Share it instead of your email or phone, and
              friends can find you in Find Players without knowing anything else about you.
            </Text>
            <Text variant="bodyMedium" style={styles.dialogBody}>
              Tap Share to send it over WhatsApp, text, email, or anything else on your phone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button mode="contained" onPress={() => setShowPlayerIdInfo(false)}>
              Got it
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Change Passcode Dialog */}
      <Portal>
        <Dialog visible={showChangePasscode} onDismiss={closePasscodeDialog} style={styles.dialog}>
          <Dialog.Icon icon="lock-outline" />
          <Dialog.Title style={styles.dialogTitle}>Change passcode</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <TextInput
              label="Current passcode"
              value={currentPasscode}
              onChangeText={(text) => {
                const numericText = text.replace(/[^0-9]/g, '');
                if (numericText.length <= 6) {
                  setCurrentPasscode(numericText);
                }
              }}
              mode="outlined"
              keyboardType="numeric"
              maxLength={6}
              secureTextEntry
            />

            <TextInput
              label="New passcode"
              value={newPasscode}
              onChangeText={(text) => {
                const numericText = text.replace(/[^0-9]/g, '');
                if (numericText.length <= 6) {
                  setNewPasscode(numericText);
                }
              }}
              mode="outlined"
              keyboardType="numeric"
              maxLength={6}
              secureTextEntry
            />

            <TextInput
              label="Confirm new passcode"
              value={confirmPasscode}
              onChangeText={(text) => {
                const numericText = text.replace(/[^0-9]/g, '');
                if (numericText.length <= 6) {
                  setConfirmPasscode(numericText);
                }
              }}
              mode="outlined"
              keyboardType="numeric"
              maxLength={6}
              secureTextEntry
            />

            {passcodeError ? (
              <HelperText type="error" visible={!!passcodeError}>
                {passcodeError}
              </HelperText>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={closePasscodeDialog}>Cancel</Button>
            <Button
              mode="contained"
              onPress={handleChangePasscode}
              loading={passcodeLoading}
              disabled={passcodeLoading}
            >
              Update
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Change Email Dialog */}
      <Portal>
        <Dialog visible={showChangeEmail} onDismiss={closeEmailDialog} style={styles.dialog}>
          <Dialog.Icon icon="email-sync-outline" />
          <Dialog.Title style={styles.dialogTitle}>Change email</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Current: {currentPlayer?.email}
            </Text>

            <TextInput
              label="New email address"
              value={newEmail}
              onChangeText={setNewEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {emailError ? (
              <HelperText type="error" visible={!!emailError}>
                {emailError}
              </HelperText>
            ) : null}

            <HelperText type="info" visible>
              A confirmation email will be sent to verify your new address.
            </HelperText>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button onPress={closeEmailDialog}>Cancel</Button>
            <Button
              mode="contained"
              onPress={handleChangeEmail}
              loading={emailLoading}
              disabled={emailLoading}
            >
              Send email
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  hero: {
    borderRadius: radius.lg,
  },
  heroContent: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  heroName: {
    fontWeight: '600',
    textAlign: 'center',
  },
  heroButton: {
    marginTop: spacing.lg,
    minWidth: 200,
  },
  buttonContent: {
    height: MIN_TOUCH_TARGET,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: radius.md,
  },
  statContent: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  statValue: {
    fontWeight: '700',
  },
  playerIdCard: {
    borderRadius: radius.lg,
  },
  playerIdContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  playerIdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerIdTitle: {
    fontWeight: '600',
  },
  playerIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  playerIdPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  playerIdText: {
    fontWeight: '700',
    letterSpacing: 4,
  },
  infoItem: {
    paddingHorizontal: 0,
  },
  actionItem: {
    paddingHorizontal: 0,
    minHeight: MIN_TOUCH_TARGET + spacing.md,
  },
  dialog: {
    borderRadius: radius.lg,
  },
  dialogTitle: {
    textAlign: 'center',
  },
  dialogContent: {
    gap: spacing.md,
  },
  dialogBody: {
    lineHeight: 20,
  },
  dialogActions: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
});
