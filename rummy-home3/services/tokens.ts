import { supabase } from '@/services/supabase';
import { TokenEntryType } from '@/types/database';
import { calculateFinalTotals } from '@/utils/scoring';

export type TokenLedgerEntry = {
  id: string;
  gameId?: string;
  profileId: string;
  counterpartyProfileId?: string;
  amount: number;
  entryType: TokenEntryType;
  note?: string;
  createdAt: string;
};

const toEntry = (row: any): TokenLedgerEntry => ({
  id: row.id,
  gameId: row.game_id ?? undefined,
  profileId: row.profile_id,
  counterpartyProfileId: row.counterparty_profile_id ?? undefined,
  amount: row.amount,
  entryType: row.entry_type,
  note: row.note ?? undefined,
  createdAt: row.created_at,
});

export const tokensService = {
  async listLedger(profileId?: string): Promise<TokenLedgerEntry[]> {
    let query = supabase
      .from('token_ledger')
      .select('*')
      .order('created_at', { ascending: false });

    if (profileId) {
      query = query.eq('profile_id', profileId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(toEntry);
  },

  async getBalances() {
    const entries = await this.listLedger();
    return entries.reduce<Record<string, number>>((balances, entry) => {
      balances[entry.profileId] = (balances[entry.profileId] ?? 0) + entry.amount;
      return balances;
    }, {});
  },

  async addEntry(input: {
    gameId?: string;
    profileId: string;
    counterpartyProfileId?: string;
    amount: number;
    entryType: TokenEntryType;
    note?: string;
    createdBy: string;
  }) {
    const { data, error } = await supabase
      .from('token_ledger')
      .insert({
        game_id: input.gameId ?? null,
        profile_id: input.profileId,
        counterparty_profile_id: input.counterpartyProfileId ?? null,
        amount: input.amount,
        entry_type: input.entryType,
        note: input.note,
        created_by: input.createdBy,
      })
      .select('*')
      .single();

    if (error) throw error;
    return toEntry(data);
  },

  calculateStakeSettlements(scores: Record<string, number[]>) {
    const totals = calculateFinalTotals(scores);
    return Object.entries(totals).map(([profileId, amount]) => ({
      profileId,
      amount,
      entryType: 'prize' as const,
    }));
  },
};
