# F09 — Pool: out, re-entry, limit

Requirements: R22, R23, R24 · Screens / pop-ups / warnings in this flow: 8 · untested (red): 0

![F09](../png/F09-pool-out-re-entry-limit.png)

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 230, "nodeSpacing": 30, "rankSpacing": 40}, "themeVariables": {"fontSize": "14px"}}}%%
flowchart TD
  s14["S14 Scorecard (Points / Pool)"]:::screen
  s15["S15 Enter Scores (Add round / Edit round)"]:::screen
  p32(["P32 Round saved (pool: out · eligible · re-enter)"]):::popup
  w35[/"W35 Pool standings (OUT · re-entry eligible · re-entered · limit)"/]:::warning
  w10[/"W10 Pool over hint (everyone out / limit reached)"/]:::warning
  p31(["P31 Over the Full count / Are you sure? (pool)"]):::popup
  w19[/"W19 Game settings error / locked note"/]:::warning
  s18["S18 Complete (game / pool)"]:::screen
  over{"Total ≥ pool limit?"}:::decision
  reentry{"Re-entries left (Unlimited / Limited N)?"}:::decision
  reenter("Re-enter at the highest live total"):::step
  left{"One player left?"}:::decision
  s14 -->|"Add round (pool)"| s15
  s15 -->|"value ≥ limit: Are you sure?"| p31
  s15 -->|"Save"| over
  over -->|"yes: who is out"| p32
  over -->|"no"| s14
  p32 --> s14
  s14 -->|"OUT · eligible · re-entered"| w35
  w35 -->|"Re-enter"| reentry
  reentry -->|"yes"| reenter
  reenter --> s14
  reentry -->|"no: limit reached"| w10
  s14 --> left
  left -->|"yes: everyone out"| w10
  w10 -->|"Complete"| s18
  s14 -->|"settings locked after round 1"| w19
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
| F09-1 | happy | Pool round: player crosses the limit → Round saved sheet says who is out → OUT chip | [`smoke/16-pool-game.yaml`](../../../e2e/smoke/16-pool-game.yaml) · [`pool-pr13.test.ts`](../../../tests/pool-pr13.test.ts) · [`pgTAP/32_pool_041.sql`](../../../supabase/tests/32_pool_041.sql) |
| F09-2 | happy | Re-enter (Unlimited) at the highest live total | [`smoke/16-pool-game.yaml`](../../../e2e/smoke/16-pool-game.yaml) · [`pgTAP/33_pool_reentries_042.sql`](../../../supabase/tests/33_pool_reentries_042.sql) · [`pool-pr13.test.ts`](../../../tests/pool-pr13.test.ts) |
| F09-3 | edge | Limited re-entries: N used → Re-enter gone, message (F3 fix) | [`pgTAP/33_pool_reentries_042.sql`](../../../supabase/tests/33_pool_reentries_042.sql) · [`test-findings-pr19.test.ts`](../../../tests/test-findings-pr19.test.ts) |
| F09-4 | edge | Everyone out / one left → Complete offered; Give awards | [`chaos/c10-pool-everyone-out.yaml`](../../../e2e/chaos/c10-pool-everyone-out.yaml) · [`pgTAP/32_pool_041.sql`](../../../supabase/tests/32_pool_041.sql) |
| F09-5 | misuse | Pool settings locked after round 1 (PT423); spectator cannot re-enter anyone | [`pgTAP/33_pool_reentries_042.sql`](../../../supabase/tests/33_pool_reentries_042.sql) · [`roles/r02-spectator-pool.yaml`](../../../e2e/roles/r02-spectator-pool.yaml) |
| F09-6 | edge | 20 players wide initials in the pool strip | [`smoke/17-pool-wide-initials-20p.yaml`](../../../e2e/smoke/17-pool-wide-initials-20p.yaml) · [`initials-fit.test.ts`](../../../tests/initials-fit.test.ts) |
| F09-7 | edge | Re-entry a second time after going out again (Unlimited) on the device | <span style="color:#c62828">**GAP**</span> |

## Nodes

| ID | Name | File | Tests touching it |
| --- | --- | --- | --- |
| S14 | Scorecard (Points / Pool) | `app/(screens)/games/[id].tsx` | 87 |
| S15 | Enter Scores (Add round / Edit round) | `app/(screens)/score-entry.tsx` | 58 |
| P32 | Round saved (pool: out · eligible · re-enter) | `app/(screens)/score-entry.tsx` | 2 |
| W35 | Pool standings (OUT · re-entry eligible · re-entered · limit) | `components/game/PoolStandings.tsx` | 4 |
| W10 | Pool over hint (everyone out / limit reached) | `app/(screens)/games/[id].tsx` | 1 |
| P31 | Over the Full count / Are you sure? (pool) | `app/(screens)/score-entry.tsx` | 4 |
| W19 | Game settings error / locked note | `components/game/GameSettingsDialog.tsx` | 3 |
| S18 | Complete (game / pool) | `app/(screens)/games/complete.tsx` | 24 |
