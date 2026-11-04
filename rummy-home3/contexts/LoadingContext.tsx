import React, { createContext, useContext, useState } from 'react';
import { Portal, ActivityIndicator, Text } from 'react-native-paper';
import { View, StyleSheet } from 'react-native';
import { radius, spacing, useAppTheme } from '@/constants/theme';

type LoadingContextType = {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <LoadingContext.Provider value={{ loading, setLoading, setError }}>
      {children}
      {loading && (
        <Portal>
          <View style={[styles.loadingContainer, { backgroundColor: theme.colors.backdrop }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        </Portal>
      )}
      {error && (
        <Portal>
          <View style={[styles.errorContainer, { backgroundColor: theme.colors.errorContainer }]}>
            <Text style={{ color: theme.colors.onErrorContainer }}>{error}</Text>
          </View>
        </Portal>
      )}
    </LoadingContext.Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.xl,
    right: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.md,
  },
});

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}
