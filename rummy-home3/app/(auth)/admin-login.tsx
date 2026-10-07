import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, Icon } from 'react-native-paper';
import { router } from 'expo-router';
import { storage } from '../../utils/storage';
import { AuthShell } from '../../components/ui/AuthShell';
import { MIN_TOUCH_TARGET, radius, spacing, useAppTheme } from '../../constants/theme';

export default function AdminLoginScreen() {
  const theme = useAppTheme();
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
    <AuthShell
      title="Admin access"
      subtitle="Login as administrator to access all features"
      icon="shield-account-outline"
      footer={
        <Button
          mode="outlined"
          onPress={() => router.push('/(auth)/login')}
          icon="arrow-left"
          style={styles.pill}
          contentStyle={styles.buttonContent}
        >
          Back to normal login
        </Button>
      }
    >
      <Text variant="titleMedium" style={styles.sectionTitle}>
        Quick admin login
      </Text>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        This will create an admin account with full access to all features
      </Text>

      <Button
        mode="contained"
        onPress={handleAdminLogin}
        buttonColor={theme.colors.error}
        textColor={theme.colors.onError}
        loading={loading}
        disabled={loading}
        icon="account-cog"
        style={styles.pill}
        contentStyle={styles.buttonContent}
      >
        Login as admin
      </Button>

      <View style={[styles.features, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          Admin features
        </Text>
        {[
          'Full access to all game settings',
          'Create and manage games',
          'View all player data',
          'Clear games and reset data',
          'Access to admin-only features',
        ].map((feature) => (
          <View key={feature} style={styles.featureRow}>
            <Icon source="check" size={16} color={theme.colors.primary} />
            <Text variant="bodyMedium" style={styles.featureText}>
              {feature}
            </Text>
          </View>
        ))}
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontWeight: '700',
  },
  pill: {
    borderRadius: radius.full,
  },
  buttonContent: {
    height: MIN_TOUCH_TARGET,
  },
  features: {
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    flex: 1,
  },
});
