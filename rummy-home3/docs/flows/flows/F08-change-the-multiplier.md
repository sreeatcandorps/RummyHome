# F08 — Change the multiplier

Requirements: R20, R21 · Screens / pop-ups / warnings in this flow: 10 · untested (red): 0

![F08](../png/F08-change-the-multiplier.png)

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 230, "nodeSpacing": 30, "rankSpacing": 40}, "themeVariables": {"fontSize": "14px"}}}%%
flowchart TD
  s14["S14 Scorecard (Points / Pool)"]:::screen
  p18(["P18 Scorecard ⋮ menu (Players · Admins, Seating, Edit round, Reopen…"]):::popup
  p26(["P26 Game settings (Full count, multiplier, pool rules)"]):::popup
  p27(["P27 Change the multiplier? / Large multiplier"]):::popup
  w11[/"W11 Multiplier chip + entered-points banner"/]:::warning
  p28(["P28 Exact points (multiplier totals)"]):::popup
  s17["S17 Log (game log)"]:::screen
  w19[/"W19 Game settings error / locked note"/]:::warning
  s20["S20 Final screen (final scores / awards · Share + Done)"]:::screen
  s23["S23 Results · saved result"]:::screen
  rounds{"Rounds exist?"}:::decision
  high{"≥ ×1,000?"}:::decision
  apply("Whole game re-valued (entered points unchanged)"):::step
  s14 --> p18
  p18 -->|"Game settings"| p26
  p26 -->|"new multiplier"| rounds
  rounds -->|"yes: confirm"| p27
  rounds -->|"no"| high
  p27 -->|"Apply to whole game"| high
  high -->|"yes: Large multiplier"| p27
  high -->|"no"| apply
  p27 -->|"keep"| apply
  apply --> s14
  s14 -->|"chip ×N · entered banner"| w11
  w11 -->|"Exact points"| p28
  p26 -->|"out of range"| w19
  apply -->|"Log: Multiplier changed"| s17
  apply -->|"Final scores × N"| s20
  apply -->|"Result bands show ×N"| s23
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
| F08-1 | happy | Change ×1 → ×10 with rounds → confirm → whole game re-valued | [`smoke/18-multiplier-change.yaml`](../../../e2e/smoke/18-multiplier-change.yaml) · [`multiplier-pr14.test.ts`](../../../tests/multiplier-pr14.test.ts) · [`pgTAP/34_multiplier_043.sql`](../../../supabase/tests/34_multiplier_043.sql) |
| F08-2 | happy | Chip, entered-points banner and Exact points sheet | [`smoke/18-multiplier-change.yaml`](../../../e2e/smoke/18-multiplier-change.yaml) · [`multiplier-pr14.test.ts`](../../../tests/multiplier-pr14.test.ts) |
| F08-3 | edge | ×1,000 / ×10,000 display (K / M, ≤ 5 characters) on 20 players | [`full/50-multiplier-20p.yaml`](../../../e2e/full/50-multiplier-20p.yaml) · [`multiplier-pr14.test.ts`](../../../tests/multiplier-pr14.test.ts) |
| F08-4 | misuse | Non-admin cannot change; value outside 1–10,000 refused | [`pgTAP/34_multiplier_043.sql`](../../../supabase/tests/34_multiplier_043.sql) · [`multiplier-pr14.test.ts`](../../../tests/multiplier-pr14.test.ts) |
| F08-5 | happy | Final scores, share image, PDF and /r/ show the multiplied values | [`multiplier-pr14.test.ts`](../../../tests/multiplier-pr14.test.ts) · [`final-scores.test.ts`](../../../tests/final-scores.test.ts) |
| F08-6 | happy | Log row "Multiplier changed ×1 → ×10" | [`pgTAP/34_multiplier_043.sql`](../../../supabase/tests/34_multiplier_043.sql) · [`multiplier-pr14.test.ts`](../../../tests/multiplier-pr14.test.ts) |

## Nodes

| ID | Name | File | Tests touching it |
| --- | --- | --- | --- |
| S14 | Scorecard (Points / Pool) | `app/(screens)/games/[id].tsx` | 91 |
| P18 | Scorecard ⋮ menu (Players · Admins, Seating, Edit round, Reopen, Log, Hide, Delete, Settings) | `app/(screens)/games/[id].tsx` | 15 |
| P26 | Game settings (Full count, multiplier, pool rules) | `components/game/GameSettingsDialog.tsx` | 9 |
| P27 | Change the multiplier? / Large multiplier | `components/game/GameSettingsDialog.tsx` | 3 |
| W11 | Multiplier chip + entered-points banner | `components/game/MultiplierStrip.tsx` | 2 |
| P28 | Exact points (multiplier totals) | `components/game/MultiplierStrip.tsx` | 4 |
| S17 | Log (game log) | `app/(screens)/games/log.tsx` | 24 |
| W19 | Game settings error / locked note | `components/game/GameSettingsDialog.tsx` | 3 |
| S20 | Final screen (final scores / awards · Share + Done) | `app/(screens)/games/final-scores.tsx` | 11 |
| S23 | Results · saved result | `app/(screens)/results/[id].tsx` | 35 |
