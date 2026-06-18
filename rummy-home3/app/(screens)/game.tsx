import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { router } from 'expo-router';

export default function GameScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineMedium" style={styles.title}>Game Details</Text>
      
      <Button 
        mode="contained"
        onPress={() => router.push('/score-entry')}
        style={styles.button}
        icon="plus"
      >
        Add Round 1 Score
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    marginBottom: 24,
  },
  button: {
    margin: 16,
  }
}); 