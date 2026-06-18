import AsyncStorage from '@react-native-async-storage/async-storage';
import { Game } from '../types/game';
import { Player } from '../types/player';
import { User } from '../types/user';

const STORAGE_KEYS = {
  PLAYERS: 'players',
  CURRENT_PLAYER: 'currentPlayer',
  GAMES: 'games',  // Make sure we use consistent key
  USERS: 'users',  // Add this line
};

export const storage = {
  async getGames(): Promise<Game[]> {
    try {
      const gamesJson = await AsyncStorage.getItem(STORAGE_KEYS.GAMES);
      return gamesJson ? JSON.parse(gamesJson) : [];
    } catch (error) {
      console.error('Error loading games:', error);
      return [];
    }
  },

  async saveGames(games: Game[]): Promise<boolean> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.GAMES, JSON.stringify(games));
      return true;
    } catch (error) {
      console.error('Error saving games:', error);
      return false;
    }
  },

  async addGame(game: Game): Promise<boolean> {
    try {
      const gamesJson = await AsyncStorage.getItem(STORAGE_KEYS.GAMES);
      const existingGames = gamesJson ? JSON.parse(gamesJson) : [];
      const updatedGames = [...existingGames, game];
      await AsyncStorage.setItem(STORAGE_KEYS.GAMES, JSON.stringify(updatedGames));
      return true;
    } catch (error) {
      console.error('Error adding game:', error);
      return false;
    }
  },

  async updateGame(updatedGame: Game): Promise<void> {
    const games = await this.getGames();
    const index = games.findIndex(g => g.id === updatedGame.id);
    if (index !== -1) {
      games[index] = updatedGame;
      await this.saveGames(games);
    }
  },

  async getPlayers(): Promise<Player[]> {
    try {
      const playersJson = await AsyncStorage.getItem(STORAGE_KEYS.PLAYERS);
      return playersJson ? JSON.parse(playersJson) : [];
    } catch (error) {
      console.error('Error loading players:', error);
      return [];
    }
  },

  async savePlayers(players: Player[]): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PLAYERS, JSON.stringify(players));
    } catch (error) {
      console.error('Error saving players:', error);
    }
  },

  async addPlayer(player: Player): Promise<void> {
    const players = await this.getPlayers();
    players.push(player);
    await this.savePlayers(players);
  },

  async updatePlayer(updatedPlayer: Player): Promise<void> {
    const players = await this.getPlayers();
    const index = players.findIndex(p => p.id === updatedPlayer.id);
    if (index !== -1) {
      players[index] = updatedPlayer;
      await this.savePlayers(players);
    }
  },

  async getCurrentPlayer(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_PLAYER);
    } catch (error) {
      console.error('Error getting current player:', error);
      throw error;
    }
  },

  async setCurrentPlayer(playerId: string | null): Promise<void> {
    try {
      if (playerId === null) {
        await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_PLAYER);
      } else {
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_PLAYER, playerId);
      }
    } catch (error) {
      console.error('Error setting current player:', error);
      throw error;
    }
  },

  async getPlayerGames(playerId: string): Promise<Game[]> {
    const games = await this.getGames();
    return games.filter(game => 
      game.players && 
      Array.isArray(game.players) && 
      game.players.includes(playerId)
    );
  },

  async setUser(user: User): Promise<void> {
    try {
      const users = await this.getUsers();
      const updatedUsers = [...users.filter(u => u.id !== user.id), user];
      await AsyncStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updatedUsers));
    } catch (error) {
      console.error('Error setting user:', error);
      throw error;
    }
  },

  async getUsers(): Promise<User[]> {
    try {
      const users = await AsyncStorage.getItem(STORAGE_KEYS.USERS);
      return users ? JSON.parse(users) : [];
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  },

  async getUserByCredentials(email?: string, phone?: string): Promise<User | null> {
    try {
      const users = await this.getUsers();
      const user = users.find(u => 
        (email && u.email === email) || (phone && u.phone === phone)
      );
      return user || null;
    } catch (error) {
      console.error('Error getting user by credentials:', error);
      throw error;
    }
  },

  async getUser(userId: string): Promise<User | null> {
    try {
      const users = await this.getUsers();
      const user = users.find(u => u.id === userId);
      return user || null;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  },

  async getCurrentGame(): Promise<Game | null> {
    try {
      const games = await this.getGames();
      return games.find(game => !game.isComplete) || null;
    } catch (error) {
      console.error('Error getting current game:', error);
      return null;
    }
  },

  // Generic storage methods for email verification
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Error setting item:', error);
      throw error;
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Error getting item:', error);
      throw error;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing item:', error);
      throw error;
    }
  },
};