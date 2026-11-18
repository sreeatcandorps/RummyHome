# F13 — Delete, hide, restore, Deleted games

Requirements: R34, R35, R36, R37 · Screens / pop-ups / warnings in this flow: 15 · untested (red): 0

![F13](../png/F13-delete-hide-restore-deleted-games.png)

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 230, "nodeSpacing": 30, "rankSpacing": 40}, "themeVariables": {"fontSize": "14px"}}}%%
flowchart TD
  s14["S14 Scorecard (Points / Pool)"]:::screen
  p18(["P18 Scorecard ⋮ menu (Players · Admins, Seating, Edit round, Reopen…"]):::popup
  p21(["P21 Delete this game?"]):::popup
  p23(["P23 Something went wrong (scorecard action error)"]):::popup
  s04["S04 Home (Live · Recent · bottom bar)"]:::screen
  w04[/"W04 Deleted games card (read-only, hidden for good on …, Ask / Rest…"/]:::warning
  w09[/"W09 Deleted game banner (Deleted by …, Ask to restore / Restore)"/]:::warning
  w39[/"W39 Deleted game read-only (no Add round / Undo / Share)"/]:::warning
  p03(["P03 Home toast (Asked · Game restored)"]):::popup
  e06[["E06 Restore requested"]]:::email
  s08["S08 Hidden & deleted"]:::screen
  w30[/"W30 Support card (Can’t find a game? support@ezscore.app)"/]:::warning
  p59(["P59 Hidden & deleted toast (restored · unhidden)"]):::popup
  s17["S17 Log (game log)"]:::screen
  w24[/"W24 Changed after sharing · removed / deleted notes · History"/]:::warning
  which{"Hide (just me) or Delete (everyone)?"}:::decision
  who{"Who opens it?"}:::decision
  days{"30 days passed?"}:::decision
  purge("Nightly job (046): hide for good, keep every row"):::step
  s14 --> p18
  p18 --> which
  which -->|"Hide game: off my Home"| s04
  which -->|"Delete game"| p21
  p21 -->|"Delete"| s04
  p21 -->|"failed"| p23
  s04 -->|"Deleted games (players who scored)"| w04
  w04 -->|"open"| s14
  s14 --> who
  who -->|"player: read-only"| w39
  w39 --> w09
  w09 -->|"Ask to restore"| p03
  p03 --> e06
  who -->|"creator / admin: Restore"| w09
  w09 -->|"Game restored"| s04
  s04 -->|"Me → Hidden & deleted"| s08
  s08 -->|"Unhide / Restore"| p59
  s08 --> w30
  w04 --> days
  days -->|"yes"| purge
  s14 -->|"Log: deleted · restore asked · restored"| s17
  p21 -->|"game in a result: removed note"| w24
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
| F13-1 | happy | Hide game → off my Home only; others unchanged; Unhide from Hidden & deleted | [`archive.test.ts`](../../../tests/archive.test.ts) · [`pgTAP/13_hide_delete_023.sql`](../../../supabase/tests/13_hide_delete_023.sql) |
| F13-2 | happy | Delete game (admin) → dialog body "Nothing is lost for 30 days" → gone from Home for everyone | [`roles/r05-deleted-game-ask-restore.yaml`](../../../e2e/roles/r05-deleted-game-ask-restore.yaml) · [`going-rogue.test.ts`](../../../tests/going-rogue.test.ts) · [`pgTAP/36_going_rogue_045.sql`](../../../supabase/tests/36_going_rogue_045.sql) |
| F13-3 | happy | Player who scored sees it under Deleted games, opens read-only, Ask to restore → toast + email | [`roles/r05-deleted-game-ask-restore.yaml`](../../../e2e/roles/r05-deleted-game-ask-restore.yaml) · [`going-rogue.test.ts`](../../../tests/going-rogue.test.ts) · [`pgTAP/36_going_rogue_045.sql`](../../../supabase/tests/36_going_rogue_045.sql) |
| F13-4 | happy | Creator sees "Player One asked to restore it" → Restore → Game restored, back on Home | [`roles/r05-deleted-game-ask-restore.yaml`](../../../e2e/roles/r05-deleted-game-ask-restore.yaml) · [`pgTAP/36_going_rogue_045.sql`](../../../supabase/tests/36_going_rogue_045.sql) |
| F13-5 | edge | Deleted game in a saved result → result re-totals, "S5 removed" version | [`pgTAP/24_results_design_034.sql`](../../../supabase/tests/24_results_design_034.sql) · [`pgTAP/13_hide_delete_023.sql`](../../../supabase/tests/13_hide_delete_023.sql) |
| F13-6 | misuse | Outsider / non-scorer cannot read a deleted game | [`pgTAP/36_going_rogue_045.sql`](../../../supabase/tests/36_going_rogue_045.sql) · [`pgTAP/13_hide_delete_023.sql`](../../../supabase/tests/13_hide_delete_023.sql) |
| F13-7 | edge | 30-day step (046): hidden for good, nothing deleted; support can still find it; restore refused with PT410 | [`pgTAP/37_no_permanent_delete_046.sql`](../../../supabase/tests/37_no_permanent_delete_046.sql) · [`pgTAP/36_going_rogue_045.sql`](../../../supabase/tests/36_going_rogue_045.sql) · [`no-permanent-delete-pr22.test.ts`](../../../tests/no-permanent-delete-pr22.test.ts) |
| F13-8 | happy | Log rows: Game deleted · Restore asked · Game restored | [`pgTAP/36_going_rogue_045.sql`](../../../supabase/tests/36_going_rogue_045.sql) · [`going-rogue.test.ts`](../../../tests/going-rogue.test.ts) |
| F13-9 | happy | Support card with support@ezscore.app on Hidden & deleted | [`going-rogue.test.ts`](../../../tests/going-rogue.test.ts) |
| F13-10 | edge | Hidden & deleted screen on the device (Unhide, Restore, toast) | <span style="color:#c62828">**GAP**</span> |

## Nodes

| ID | Name | File | Tests touching it |
| --- | --- | --- | --- |
| S14 | Scorecard (Points / Pool) | `app/(screens)/games/[id].tsx` | 91 |
| P18 | Scorecard ⋮ menu (Players · Admins, Seating, Edit round, Reopen, Log, Hide, Delete, Settings) | `app/(screens)/games/[id].tsx` | 15 |
| P21 | Delete this game? | `app/(screens)/games/[id].tsx` | 4 |
| P23 | Something went wrong (scorecard action error) | `app/(screens)/games/[id].tsx` | 7 |
| S04 | Home (Live · Recent · bottom bar) | `app/(tabs)/index.tsx` | 73 |
| W04 | Deleted games card (read-only, hidden for good on …, Ask / Restore) | `components/home/DeletedGamesCard.tsx` | 6 |
| W09 | Deleted game banner (Deleted by …, Ask to restore / Restore) | `components/game/DeletedGameBanner.tsx` | 3 |
| W39 | Deleted game read-only (no Add round / Undo / Share) | `app/(screens)/games/[id].tsx` | 3 |
| P03 | Home toast (Asked · Game restored) | `app/(tabs)/index.tsx` | 2 |
| E06 | Restore requested | `supabase/functions/send-email/index.ts (restore_requested)` | 3 |
| S08 | Hidden & deleted | `app/(screens)/hidden-deleted.tsx` | 24 |
| W30 | Support card (Can’t find a game? support@ezscore.app) | `app/(screens)/hidden-deleted.tsx` | 3 |
| P59 | Hidden & deleted toast (restored · unhidden) | `app/(screens)/hidden-deleted.tsx` | 6 |
| S17 | Log (game log) | `app/(screens)/games/log.tsx` | 24 |
| W24 | Changed after sharing · removed / deleted notes · History | `components/results/ResultHistory.tsx` | 2 |
