import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { TextInput, Button, Text, HelperText, Card } from 'react-native-paper';
import { router } from 'expo-router';
import { supabase } from '../../services/supabase';
import 'react-native-url-polyfill/auto'

export default function ForgotPasswordScreen() {
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
        'If an account with this email exists, you will receive a passcode reset link. Please check your email and spam folder. Click the link in your email to reset your 4-digit passcode.',
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
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>
        Forgot Passcode?
      </Text>
      
      <Text variant="bodyMedium" style={styles.subtitle}>
        Enter your email address and we'll send you a link to reset your 4-digit passcode.
      </Text>

      <Text variant="bodySmall" style={styles.note}>
        Note: For security reasons, we'll send a reset link even if the email doesn't exist in our system.
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          disabled={loading}
          right={<TextInput.Icon icon="close" onPress={() => setEmail('')} />}
        />
      </View>
      
      {error ? (
        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>
      ) : null}

      {success ? (
        <HelperText type="info" visible={!!success}>
          Passcode reset email sent successfully!
        </HelperText>
      ) : null}

      <Button 
        mode="contained" 
        onPress={handleResetPassword}
        style={styles.button}
        loading={loading}
        disabled={loading}
      >
        Send Reset Link
      </Button>

      <Button 
        mode="outlined"
        onPress={clearFields}
        style={styles.button}
        disabled={loading}
      >
        Clear
      </Button>

      <Button 
        mode="text"
        onPress={() => router.push('/(auth)/register')}
        style={styles.button}
        disabled={loading}
      >
        Don't have an account? Create one
      </Button>

      <Button 
        mode="text"
        onPress={() => router.back()}
        style={styles.button}
        disabled={loading}
      >
        Back to Login
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 16,
    opacity: 0.7,
  },
  note: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 0,
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  },
}); 