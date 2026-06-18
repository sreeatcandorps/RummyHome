import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, Card, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { storage } from '../../utils/storage';

export default function AdminLoginScreen() {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async () => {
    setLoading(true);
    
    try {
      // Create admin player with unique ID
      const adminId = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const adminPlayer = {
        id: adminId,
        name: 'Admin',
        email: 'admin@rummyhome.com',
        role: 'admin' as const,
        gamesPlayed: 0,
        gamesWon: 0
      };

      // Save admin to storage
      const players = await storage.getPlayers();
      const existingAdmin = players.find(p => p.email === 'admin@rummyhome.com');
      
      if (!existingAdmin) {
        await storage.savePlayers([...players, adminPlayer]);
        await storage.setCurrentPlayer(adminPlayer.id);
      } else {
        // Use existing admin
        await storage.setCurrentPlayer(existingAdmin.id);
      }
      
      // Navigate to main app
      router.replace('/(tabs)');
      
    } catch (err) {
      console.error('Admin login error:', err);
      Alert.alert('Error', 'Failed to login as admin. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.title}>
            🔐 Admin Access
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Login as administrator to access all features
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Quick Admin Login
          </Text>
          <Text variant="bodySmall" style={styles.note}>
            This will create an admin account with full access to all features
          </Text>
          
          <Button
            mode="contained"
            onPress={handleAdminLogin}
            style={[styles.adminButton, { backgroundColor: theme.colors.error }]}
            loading={loading}
            disabled={loading}
            icon="account-cog"
          >
            Login as Admin
          </Button>

          <Button
            mode="outlined"
            onPress={() => router.push('/(auth)/login')}
            style={styles.backButton}
            icon="arrow-left"
          >
            Back to Normal Login
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Admin Features
          </Text>
          
          <View style={styles.featureList}>
            <Text variant="bodyMedium">• Full access to all game settings</Text>
            <Text variant="bodyMedium">• Create and manage games</Text>
            <Text variant="bodyMedium">• View all player data</Text>
            <Text variant="bodyMedium">• Clear games and reset data</Text>
            <Text variant="bodyMedium">• Access to admin-only features</Text>
          </View>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  card: {
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  note: {
    marginBottom: 16,
    opacity: 0.7,
  },
  adminButton: {
    marginBottom: 16,
  },
  backButton: {
    marginBottom: 16,
  },
  featureList: {
    gap: 8,
  },
}); 