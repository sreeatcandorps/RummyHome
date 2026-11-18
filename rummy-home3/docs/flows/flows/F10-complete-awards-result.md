# F10 — Complete → Awards → Result

Requirements: R25, R26, R27 · Screens / pop-ups / warnings in this flow: 16 · untested (red): 0

![F10](../png/F10-complete-awards-result.png)

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 230, "nodeSpacing": 30, "rankSpacing": 40}, "themeVariables": {"fontSize": "14px"}}}%%
flowchart TD
  s14["S14 Scorecard (Points / Pool)"]:::screen
  s18["S18 Complete (game / pool)"]:::screen
  p40(["P40 Complete this game? / Complete this pool?"]):::popup
  p41(["P41 Could not complete"]):::popup
  s19["S19 Awards (pool)"]:::screen
  p42(["P42 Not all given out (save awards anyway?)"]):::popup
  p43(["P43 Not for this pool"]):::popup
  w20[/"W20 Awards hints (given out · winner warning · blocked)"/]:::warning
  w36[/"W36 Pool awards card (after complete)"/]:::warning
  s20["S20 Final scores (single game share)"]:::screen
  s21["S21 Results · pick games + Past results"]:::screen
  p50(["P50 Give awards first"]):::popup
  p22(["P22 Reopen this game?"]):::popup
  p44(["P44 Could not save awards"]):::popup
  w08[/"W08 Game status tag (Active · Completed · Closed · Deleted)"/]:::warning
  w32[/"W32 Final scores note + multiplier line"/]:::warning
  pool{"Pool?"}:::decision
  given{"Whole pot given out?"}:::decision
  completed("Status Completed · number freed"):::step
  s14 -->|"Complete"| s18
  s18 --> p40
  p40 -->|"Yes"| completed
  p40 -->|"RPC failed"| p41
  completed --> pool
  pool -->|"no: Final scores / share"| s20
  pool -->|"yes: Give awards"| s19
  s19 --> w20
  s19 -->|"Save awards"| given
  given -->|"no"| p42
  p42 -->|"save anyway"| s14
  given -->|"yes"| s14
  s19 -->|"preset does not fit"| p43
  s14 -->|"awards card"| w36
  s14 -->|"Results"| s21
  s21 -->|"pool without awards"| p50
  completed -->|"Reopen (admin, not Closed)"| p22
  p22 -->|"Active again"| s14
  s19 -->|"RPC failed"| p44
  completed -->|"Completed tag"| w08
  s20 --> w32
  classDef screen fill:#e3f2fd,stroke:#1565c0,color:#0d2c54
  classDef popup fill:#fff8e1,stroke:#f9a825,color:#4e3a00
  classDef warning fill:#f3e5f5,stroke:#6a1b9a,color:#2e0b40
  classDef email fill:#e8f5e9,stroke:#2e7d32,color:#0b3d12
  classDef step fill:#ffffff,stroke:#616161,color:#212121
  classDef decision fill:#fafafa,stroke:#616161,color:#212121
  classDef stop fill:#eeeeee,stroke:#424242,color:#212121
  classDef flow fill:#e3f2fd,stroke:#1565c0,color:#0d2c54
  classDef gap fill:#fde2e2,stroke:#c62828,color:#7f0000,stroke-width:2px
```

## Scenarios

| # | Kind | Scenario | Tests |
| --- | --- | --- | --- |
| F10-1 | happy | Complete a Points game → Completed tag → Final scores | [`smoke/05-complete-game.yaml`](../../../e2e/smoke/05-complete-game.yaml) · [`final-scores.test.ts`](../../../tests/final-scores.test.ts) · [`pgTAP/02_games_visibility.sql`](../../../supabase/tests/02_games_visibility.sql) |
| F10-2 | happy | Complete a pool → Give awards → preset / custom → saved → card on scorecard | [`smoke/16-pool-game.yaml`](../../../e2e/smoke/16-pool-game.yaml) · [`pool-pr13.test.ts`](../../../tests/pool-pr13.test.ts) · [`pgTAP/32_pool_041.sql`](../../../supabase/tests/32_pool_041.sql) |
| F10-3 | edge | Not all given out → save anyway; preset not viable → Not for this pool | [`smoke/16-pool-game.yaml`](../../../e2e/smoke/16-pool-game.yaml) · [`pool-pr13.test.ts`](../../../tests/pool-pr13.test.ts) |
| F10-4 | edge | Double Complete taps → one completion | [`chaos/c02-double-complete.yaml`](../../../e2e/chaos/c02-double-complete.yaml) |
| F10-5 | happy | Pool without awards cannot join a result (Give awards first) | [`smoke/16-pool-game.yaml`](../../../e2e/smoke/16-pool-game.yaml) · [`pool-pr13.test.ts`](../../../tests/pool-pr13.test.ts) · [`pgTAP/32_pool_041.sql`](../../../supabase/tests/32_pool_041.sql) |
| F10-6 | happy | Reopen a Completed (not Closed) game as admin | [`archive.test.ts`](../../../tests/archive.test.ts) · [`pgTAP/13_hide_delete_023.sql`](../../../supabase/tests/13_hide_delete_023.sql) |
| F10-7 | misuse | Non-admin cannot complete or reopen | [`roles/r01-player-view-only.yaml`](../../../e2e/roles/r01-player-view-only.yaml) · [`pgTAP/02_games_visibility.sql`](../../../supabase/tests/02_games_visibility.sql) |
| F10-8 | edge | Complete with 20 players: Standings fit (F6) | [`test-findings-pr19.test.ts`](../../../tests/test-findings-pr19.test.ts) · [`smoke/17-pool-wide-initials-20p.yaml`](../../../e2e/smoke/17-pool-wide-initials-20p.yaml) |
| F10-9 | edge | Reopen dialog on the device | <span style="color:#c62828">**GAP**</span> |

## Nodes

| ID | Name | File | Tests touching it |
| --- | --- | --- | --- |
| S14 | Scorecard (Points / Pool) | `app/(screens)/games/[id].tsx` | 87 |
| S18 | Complete (game / pool) | `app/(screens)/games/complete.tsx` | 24 |
| P40 | Complete this game? / Complete this pool? | `app/(screens)/games/complete.tsx` | 3 |
| P41 | Could not complete | `app/(screens)/games/complete.tsx` | 1 |
| S19 | Awards (pool) | `app/(screens)/games/award.tsx` | 20 |
| P42 | Not all given out (save awards anyway?) | `app/(screens)/games/award.tsx` | 2 |
| P43 | Not for this pool | `app/(screens)/games/award.tsx` | 2 |
| W20 | Awards hints (given out · winner warning · blocked) | `app/(screens)/games/award.tsx` | 1 |
| W36 | Pool awards card (after complete) | `components/game/PoolAwardsCard.tsx` | 4 |
| S20 | Final scores (single game share) | `app/(screens)/games/final-scores.tsx` | 9 |
| S21 | Results · pick games + Past results | `app/(screens)/results/index.tsx` | 38 |
| P50 | Give awards first | `app/(screens)/results/index.tsx` | 3 |
| P22 | Reopen this game? | `app/(screens)/games/[id].tsx` | 1 |
| P44 | Could not save awards | `app/(screens)/games/award.tsx` | 3 |
| W08 | Game status tag (Active · Completed · Closed · Deleted) | `app/(screens)/games/[id].tsx` | 1 |
| W32 | Final scores note + multiplier line | `app/(screens)/games/final-scores.tsx` | 2 |
