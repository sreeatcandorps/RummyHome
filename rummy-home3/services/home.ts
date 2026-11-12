import { authService, profileToPlayer } from '@/services/auth';
import { archiveService } from '@/services/archive';
import { gamesService, legacyGameFromServer, missingRpc } from '@/services/games';
import { playerIdentityService, linkFromRow } from '@/services/playerIdentity';
import { playersService } from '@/services/players';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { Game } from '@/types/game';
import { Player } from '@/types/player';
import { isHomeBundle } from '@/utils/bundles';
import { CreatorNotice, PendingLink } from '@/utils/playerIdentity';
import { REQUEST_TIMEOUT_MS, withTimeout } from '@/utils/withTimeout';

export type HomeData = {
  player: Player;
  games: Game[];
  /** Creator notices taken (cleared) on this load, the same rows takeNotices returns. */
  notices: CreatorNotice[];
  /** Open claim requests for players this person created; `null` when the card must load its own. */
  claimRequests: PendingLink[] | null;
};

export const HOME_GAME_LIMIT = 50;

/**
 * get_home_bundle (020) is tried first: profile, visible games, notices, claim
 * requests and My Players in one round-trip. A database without it answers
 * PGRST202 once and the rest of the session uses the per-table requests.
 */
let homeBundleAvailable = true;

async function loadHomeBundle(): Promise<HomeData | null | undefined> {
  if (!homeBundleAvailable) return undefined;
  const { data, error } = await withTimeout(
    supabase.rpc('get_home_bundle', { p_limit: HOME_GAME_LIMIT }),
    REQUEST_TIMEOUT_MS,
    'Couldn’t load your games.',
  );
  if (error) {
    if (missingRpc(error)) {
      homeBundleAvailable = false;
      return undefined;
    }
    throw error;
  }
  if (!isHomeBundle(data)) return undefined;
  if (!data.profile) return null;

  const profile = authService.primeProfile(data.profile);
  if (!profile) return null;
  const player = profileToPlayer(profile);
  const games = (data.games ?? []).map((game) => legacyGameFromServer(game, [], game.game_players ?? []));
  await playersService.primeMyPlayers(player.id, data.my_players ?? []).catch(() => {});
  return {
    player,
    games,
    notices: (data.notices ?? []).map((row) => playerIdentityService.noticeFromRow(player.id, row)),
    claimRequests: (data.claim_requests ?? []).map(linkFromRow),
  };
}

export const homeService = {
  /**
   * Everything the Home screen shows. Resolves to null when nobody is signed in.
   * Before 020 the sequence is the one the screen used to run itself: session,
   * profile, games, then notices (the claim card loads its own list).
   */
  async load(): Promise<HomeData | null> {
    if (isSupabaseConfigured) {
      await authService.ensureFreshSession();
      const bundled = await loadHomeBundle();
      if (bundled !== undefined) return bundled;
    }

    const player = await authService.getCurrentPlayer();
    if (!player) return null;
    const hidden = await archiveService.hiddenGameIds(player.id);
    const games = (await gamesService.listGamesForCurrentUser(player.id, {
      limit: HOME_GAME_LIMIT,
      includeScores: false,
      email: player.email,
    })).filter((game) => !hidden.has(game.id));
    const notices = await playerIdentityService.takeNotices(player.id).catch(() => [] as CreatorNotice[]);
    return { player, games, notices, claimRequests: null };
  },
};
