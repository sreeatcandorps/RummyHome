# F07 — Edit or undo a round

Requirements: R18, R19 · Screens / pop-ups / warnings in this flow: 8 · untested (red): 0

![F07](../png/F07-edit-or-undo-a-round.png)

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 230, "nodeSpacing": 30, "rankSpacing": 40}, "themeVariables": {"fontSize": "14px"}}}%%
flowchart TD
  s14["S14 Scorecard (Points / Pool)"]:::screen
  p18(["P18 Scorecard ⋮ menu (Players · Admins, Seating, Edit round, Reopen…"]):::popup
  p19(["P19 Edit which round?"]):::popup
  p20(["P20 Remove the last round? (Undo)"]):::popup
  s15["S15 Enter Scores (Add round / Edit round)"]:::screen
  p34(["P34 Round notice (Round N already saved · scorecard refreshed · vie…"]):::popup
  s17["S17 Log (game log)"]:::screen
  w24[/"W24 Changed after sharing · removed / deleted notes · History"/]:::warning
  which{"Edit or Undo?"}:::decision
  retire("Old row retired at 1000+N, new row saved"):::step
  undo("undo_last_round: mark undone, current_round back"):::step
  next("Next Add round reuses number N"):::step
  inresult{"Game in a saved result?"}:::decision
  s14 --> which
  which -->|"Edit"| p18
  p18 -->|"Edit round"| p19
  p19 -->|"pick round"| s15
  s15 -->|"Save"| retire
  retire --> s14
  which -->|"Undo round"| p20
  p20 -->|"Remove"| undo
  undo --> next
  next --> s14
  s15 -->|"round undone meanwhile"| p34
  s14 -->|"Log: edited was→now / undone"| s17
  retire --> inresult
  undo --> inresult
  inresult -->|"yes: result_changed"| w24
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
| F07-1 | happy | Undo last round → Add round saves the same number again | [`smoke/13-undo-then-add-round.yaml`](../../../e2e/smoke/13-undo-then-add-round.yaml) · [`undo-round-035.test.ts`](../../../tests/undo-round-035.test.ts) · [`pgTAP/25_undo_035.sql`](../../../supabase/tests/25_undo_035.sql) |
| F07-2 | happy | Edit round N → old row retired, Log shows Was / Now | [`full/70-game-log.yaml`](../../../e2e/full/70-game-log.yaml) · [`nov11-rounds.test.ts`](../../../tests/nov11-rounds.test.ts) · [`pgTAP/26_event_log_036.sql`](../../../supabase/tests/26_event_log_036.sql) |
| F07-3 | edge | Undo three times then round 1 again | [`pgTAP/25_undo_035.sql`](../../../supabase/tests/25_undo_035.sql) |
| F07-4 | edge | Undo while another admin types → their Save refused with the refresh message | [`pgTAP/25_undo_035.sql`](../../../supabase/tests/25_undo_035.sql) · [`security-concurrency-019.test.ts`](../../../tests/security-concurrency-019.test.ts) |
| F07-5 | misuse | Player (non-admin) cannot undo (42501) | [`pgTAP/25_undo_035.sql`](../../../supabase/tests/25_undo_035.sql) · [`roles/r01-player-view-only.yaml`](../../../e2e/roles/r01-player-view-only.yaml) |
| F07-6 | edge | Edit / undo a game inside a saved result → result_changed row + amber line | [`pgTAP/26_event_log_036.sql`](../../../supabase/tests/26_event_log_036.sql) · [`event-log-036.test.ts`](../../../tests/event-log-036.test.ts) |
| F07-7 | edge | Edit which round? dialog on the device (pick an older round) | <span style="color:#c62828">**GAP**</span> |

## Nodes

| ID | Name | File | Tests touching it |
| --- | --- | --- | --- |
| S14 | Scorecard (Points / Pool) | `app/(screens)/games/[id].tsx` | 91 |
| P18 | Scorecard ⋮ menu (Players · Admins, Seating, Edit round, Reopen, Log, Hide, Delete, Settings) | `app/(screens)/games/[id].tsx` | 15 |
| P19 | Edit which round? | `app/(screens)/games/[id].tsx` | 6 |
| P20 | Remove the last round? (Undo) | `app/(screens)/games/[id].tsx` | 12 |
| S15 | Enter Scores (Add round / Edit round) | `app/(screens)/score-entry.tsx` | 64 |
| P34 | Round notice (Round N already saved · scorecard refreshed · view only) | `app/(screens)/score-entry.tsx` | 8 |
| S17 | Log (game log) | `app/(screens)/games/log.tsx` | 24 |
| W24 | Changed after sharing · removed / deleted notes · History | `components/results/ResultHistory.tsx` | 2 |
