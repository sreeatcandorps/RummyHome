import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText, Card, Icon, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase';
import { MIN_TOUCH_TARGET, radius, spacing } from '../../constants/theme';
import 'react-native-url-polyfill/auto'

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const clearFields = () => {
    setEmail('');
    setError('');
    setSuccess(false);
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Send password reset email with the hosted GitHub Pages URL
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'https://sreeatcandorps.github.io/Games/',
      });

      if (resetError) {
        // Check if it's a "user not found" error
        if (resetError.message.includes('User not found') || 
            resetError.message.includes('No user found') ||
            resetError.message.includes('does not exist') ||
            resetError.message.includes('Invalid login credentials')) {
          setError(`Email "${email.trim()}" does not exist in our system. Please check the email address carefully or create a new account.`);
          return;
        }
        throw resetError;
      }

      setSuccess(true);
      
      Alert.alert(
        'Passcode Reset Email Sent',
        'If an account with this email exists, you will receive a passcode reset link. Please check your email and spam folder. Click the link in your email to reset your 6-digit passcode.',
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );

    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: theme.colors.secondaryContainer }]}>
            <Icon source="lock-reset" size={32} color={theme.colors.onSecondaryContainer} />
          </View>
          <Text variant="headlineSmall" style={styles.title}>
            Forgot passcode?
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Enter your email and we'll send a link to reset your 6-digit passcode.
          </Text>
        </View>

        <Card mode="elevated" style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              disabled={loading}
              left={<TextInput.Icon icon="email-outline" />}
              right={email ? <TextInput.Icon icon="close" onPress={() => setEmail('')} /> : undefined}
            />

            {error ? (
              <HelperText type="error" visible={!!error}>
                {error}
              </HelperText>
            ) : null}

            {success ? (
              <HelperText type="info" visible={!!success}>
                Passcode reset email sent successfully.
              </HelperText>
            ) : null}

            <Button
              mode="contained"
              onPress={handleResetPassword}
              loading={loading}
              disabled={loading}
              contentStyle={styles.primaryContent}
              labelStyle={styles.primaryLabel}
            >
              Send reset link
            </Button>

            <Button
              mode="text"
              onPress={clearFields}
              disabled={loading}
              contentStyle={styles.secondaryContent}
            >
              Clear
            </Button>
          </Card.Content>
        </Card>

        <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
          For security, we send a reset link even if the email isn't registered.
        </Text>

        <View style={styles.footerActions}>
          <Button
            mode="outlined"
            onPress={() => router.back()}
            disabled={loading}
            icon="arrow-left"
            contentStyle={styles.secondaryContent}
            style={styles.footerButton}
          >
            Back to login
          </Button>
          <Button
            mode="text"
            onPress={() => router.push('/(auth)/register')}
            disabled={loading}
            contentStyle={styles.secondaryContent}
            style={styles.footerButton}
          >
            Create account
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  card: {
    borderRadius: radius.lg,
  },
  cardContent: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  primaryContent: {
    height: 56,
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryContent: {
    height: MIN_TOUCH_TARGET,
  },
  note: {
    textAlign: 'center',
    lineHeight: 18,
  },
  footerActions: {
    gap: spacing.sm,
  },
  footerButton: {
    width: '100%',
  },
});
