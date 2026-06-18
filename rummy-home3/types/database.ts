export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = 'app_admin' | 'player';
export type GameStatus = 'active' | 'completed' | 'cancelled';
export type GameType = 'stake' | 'pool';
export type GameMemberRole = 'game_admin' | 'player' | 'spectator';
export type ScoreType = 'drop' | 'middle_drop' | 'rummy' | 'count' | 'expense';
export type TokenEntryType = 'deposit' | 'prize' | 'transfer' | 'adjustment';

export type ProfileDefaults = {
  gameType: GameType;
  expenseEnabled: boolean;
  expenseAmount: number;
  stakeDrop: number;
  stakeMiddleDrop: number;
  poolDrop: number;
  poolMiddleDrop: number;
  maxCount: number;
  poolAmount: number;
  poolDefaultDeposit: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          email: string | null;
          phone: string | null;
          first_name: string | null;
          last_name: string | null;
          display_name: string;
          avatar_url: string | null;
          role: AppRole;
          default_settings: ProfileDefaults;
        };
        Insert: {
          id: string;
          email?: string | null;
          phone?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          display_name: string;
          avatar_url?: string | null;
          role?: AppRole;
          default_settings?: ProfileDefaults;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      games: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          created_by: string;
          status: GameStatus;
          game_type: GameType;
          settings: ProfileDefaults;
          current_round: number;
          share_code: string;
          spectator_access: boolean;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          created_by: string;
          status?: GameStatus;
          game_type: GameType;
          settings: ProfileDefaults;
          current_round?: number;
          share_code: string;
          spectator_access?: boolean;
          completed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['games']['Insert']>;
      };
      game_players: {
        Row: {
          id: string;
          game_id: string;
          profile_id: string;
          joined_at: string;
          player_order: number;
          display_number: number | null;
          color_code: string | null;
          role: GameMemberRole;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          game_id: string;
          profile_id: string;
          player_order: number;
          display_number?: number | null;
          color_code?: string | null;
          role?: GameMemberRole;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['game_players']['Insert']>;
      };
      rounds: {
        Row: {
          id: string;
          game_id: string;
          created_at: string;
          round_number: number;
          dealer_profile_id: string | null;
          created_by: string;
          undone_at: string | null;
          undone_by: string | null;
          undo_reason: string | null;
        };
        Insert: {
          id?: string;
          game_id: string;
          round_number: number;
          dealer_profile_id?: string | null;
          created_by: string;
          undone_at?: string | null;
          undone_by?: string | null;
          undo_reason?: string | null;
        };
        Update: Partial<Database['public']['Tables']['rounds']['Insert']>;
      };
      scores: {
        Row: {
          id: string;
          round_id: string;
          game_id: string;
          profile_id: string | null;
          score_type: ScoreType;
          value: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          round_id: string;
          game_id: string;
          profile_id?: string | null;
          score_type: ScoreType;
          value: number;
        };
        Update: Partial<Database['public']['Tables']['scores']['Insert']>;
      };
      token_ledger: {
        Row: {
          id: string;
          game_id: string | null;
          profile_id: string;
          counterparty_profile_id: string | null;
          amount: number;
          entry_type: TokenEntryType;
          note: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id?: string | null;
          profile_id: string;
          counterparty_profile_id?: string | null;
          amount: number;
          entry_type: TokenEntryType;
          note?: string | null;
          created_by: string;
        };
        Update: Partial<Database['public']['Tables']['token_ledger']['Insert']>;
      };
    };
  };
};
