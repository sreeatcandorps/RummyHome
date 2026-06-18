import React, { createContext, useContext, useState } from 'react';
import { Portal, ActivityIndicator, MD2Colors, Text } from 'react-native-paper';
import { View, StyleSheet } from 'react-native';

type LoadingContextType = {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <LoadingContext.Provider value={{ loading, setLoading, setError }}>
      {children}
      {loading && (
        <Portal>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={MD2Colors.blue500} />
          </View>
        </Portal>
      )}
      {error && (
        <Portal>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </Portal>
      )}
    </LoadingContext.Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: MD2Colors.red100,
    padding: 16,
    borderRadius: 8,
  },
  errorText: {
    color: MD2Colors.red800,
  },
});

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
} 