export interface User {
  id: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  createdAt: string;
  defaultSettings?: GameSettings;
}

export interface GameSettings {
  gameType: 'stake' | 'pool';
  expenseEnabled: boolean;
  defaultExpense: number;
  dropValue: number;
  mdValue: number;
  maxCount: number;
  defaultPoolAmount?: number;
} 