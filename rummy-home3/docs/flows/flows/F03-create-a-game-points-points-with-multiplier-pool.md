# F03 — Create a game (Points · Points with multiplier · Pool)

Requirements: R07, R08, R09, R21 · Screens / pop-ups / warnings in this flow: 11 · untested (red): 0

![F03](../png/F03-create-a-game-points-points-with-multiplier-pool.png)

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 230, "nodeSpacing": 30, "rankSpacing": 40}, "themeVariables": {"fontSize": "14px"}}}%%
flowchart TD
  s04["S04 Home (Live · Recent · bottom bar)"]:::screen
  s10["S10 New game · Players picker / Add players to this game"]:::screen
  s09["S09 New game · Game type (Points / Pool, rules, multiplier)"]:::screen
  s11["S11 Fix initials (before Start)"]:::screen
  w14[/"W14 New game problem line (players, Full count, multiplier range)"/]:::warning
  p47(["P47 Large multiplier (Game type)"]):::popup
  p45(["P45 Add a co-admin?"]):::popup
  w28[/"W28 Guardrail refusals (GRD01: 20 seats, 500 rounds, 10 live games,…"/]:::warning
  type{"Points or Pool?"}:::decision
  mult{"Multiplier ≥ ×1,000?"}:::decision
  clash{"Initials clash among seated players?"}:::decision
  coadmin{"Registered seated player and no co-admin?"}:::decision
  e03[["E03 Game started (live link)"]]:::email
  s14["S14 Scorecard (Points / Pool)"]:::screen
  p25(["P25 Seating order sheet"]):::popup
  s04 -->|"New game"| s10
  s10 -->|"Next (≥ 2 players)"| s09
  s09 --> type
  type -->|"Points: Full count, multiplier"| s09
  type -->|"Pool: limit, re-entries"| s09
  s09 -->|"invalid rule"| w14
  w14 --> s09
  s09 -->|"Start game"| mult
  mult -->|"yes"| p47
  p47 -->|"keep"| clash
  mult -->|"no"| clash
  clash -->|"yes"| s11
  s11 -->|"fixed"| coadmin
  clash -->|"no"| coadmin
  coadmin -->|"yes"| p45
  p45 -->|"pick / skip"| s14
  coadmin -->|"no"| s14
  s09 -->|"GRD01: 10 live games / 50 per day"| w28
  s14 -->|"game_started email"| e03
  s14 -->|"Seating prompt (F05)"| p25
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
| F03-1 | happy | Points game, 4 players, Full count 80 → scorecard S-number | [`smoke/09-new-game.yaml`](../../../e2e/smoke/09-new-game.yaml) · [`pgTAP/18_game_labels_028.sql`](../../../supabase/tests/18_game_labels_028.sql) · [`pgTAP/28_game_numbers_038.sql`](../../../supabase/tests/28_game_numbers_038.sql) |
| F03-2 | happy | Pool game: two-screen New game, limit + re-entries → P-number | [`smoke/16-pool-game.yaml`](../../../e2e/smoke/16-pool-game.yaml) · [`pool-pr13.test.ts`](../../../tests/pool-pr13.test.ts) · [`pgTAP/32_pool_041.sql`](../../../supabase/tests/32_pool_041.sql) |
| F03-3 | happy | Points with multiplier ×10 → chip on card and scorecard | [`smoke/18-multiplier-change.yaml`](../../../e2e/smoke/18-multiplier-change.yaml) · [`multiplier-pr14.test.ts`](../../../tests/multiplier-pr14.test.ts) · [`pgTAP/34_multiplier_043.sql`](../../../supabase/tests/34_multiplier_043.sql) |
| F03-4 | edge | Multiplier ×1,000+ → Large multiplier confirm once | [`multiplier-pr14.test.ts`](../../../tests/multiplier-pr14.test.ts) |
| F03-5 | misuse | Multiplier outside 1–10,000 or bad K/M form → problem line, Start off | [`multiplier-pr14.test.ts`](../../../tests/multiplier-pr14.test.ts) |
| F03-6 | edge | Two seated players share initials → Fix initials before Start | [`smoke/17-pool-wide-initials-20p.yaml`](../../../e2e/smoke/17-pool-wide-initials-20p.yaml) · [`initials-022.test.ts`](../../../tests/initials-022.test.ts) · [`pgTAP/12_player_initials_022.sql`](../../../supabase/tests/12_player_initials_022.sql) |
| F03-7 | edge | Co-admin nudge when a registered player is seated | [`emails-024.test.ts`](../../../tests/emails-024.test.ts) |
| F03-8 | misuse | 11th live game / 51st game today refused by GRD01 | [`pgTAP/19_guardrails_029.sql`](../../../supabase/tests/19_guardrails_029.sql) · [`guardrails-029.test.ts`](../../../tests/guardrails-029.test.ts) |
| F03-9 | happy | Game numbers reused once a game leaves Active; share code unique | [`pgTAP/28_game_numbers_038.sql`](../../../supabase/tests/28_game_numbers_038.sql) · [`game-labels-028.test.ts`](../../../tests/game-labels-028.test.ts) |
| F03-10 | happy | Game started email with live link to seated registered players | [`pgTAP/14_emails_024.sql`](../../../supabase/tests/14_emails_024.sql) |
| F03-11 | edge | Co-admin nudge and Large multiplier confirm on the device | <span style="color:#c62828">**GAP**</span> |

## Nodes

| ID | Name | File | Tests touching it |
| --- | --- | --- | --- |
| S04 | Home (Live · Recent · bottom bar) | `app/(tabs)/index.tsx` | 73 |
| S10 | New game · Players picker / Add players to this game | `app/(screens)/games/new.tsx` | 41 |
| S09 | New game · Game type (Points / Pool, rules, multiplier) | `app/(screens)/games/new.tsx + components/game/GameTypeStep.tsx` | 29 |
| S11 | Fix initials (before Start) | `components/players/FixInitialsScreen.tsx` | 17 |
| W14 | New game problem line (players, Full count, multiplier range) | `components/game/GameTypeStep.tsx, components/game/RulesForm.tsx` | 3 |
| P47 | Large multiplier (Game type) | `components/game/GameTypeStep.tsx` | 1 |
| P45 | Add a co-admin? | `components/game/CoAdminNudge.tsx` | 2 |
| W28 | Guardrail refusals (GRD01: 20 seats, 500 rounds, 10 live games, 50 games/day, 100 players/day, 20 pending links) | `utils/guardrails.ts` | 5 |
| E03 | Game started (live link) | `supabase/functions/send-email/index.ts (game_started)` | 7 |
| S14 | Scorecard (Points / Pool) | `app/(screens)/games/[id].tsx` | 91 |
| P25 | Seating order sheet | `components/game/SeatingSheet.tsx` | 5 |
