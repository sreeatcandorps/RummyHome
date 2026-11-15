# F16 — Help

Requirements: R42 · Screens / pop-ups / warnings in this flow: 7 · untested (red): 0

![F16](../png/F16-help.png)

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 230, "nodeSpacing": 30, "rankSpacing": 40}, "themeVariables": {"fontSize": "14px"}}}%%
flowchart TD
  any("Any screen with ?"):::step
  p30(["P30 Help"]):::popup
  s04["S04 Home (Live · Recent · bottom bar)"]:::screen
  s14["S14 Scorecard (Points / Pool)"]:::screen
  s15["S15 Enter Scores (Add round / Edit round)"]:::screen
  s21["S21 Results · pick games + Past results"]:::screen
  s16["S16 Players · Admins"]:::screen
  s19["S19 Awards (pool)"]:::screen
  rules("≤ 7 bullets, one screen each (build3 rule)"):::step
  redesign(("PR 11 Help redesign (on hold)")):::stop
  s04 --> any
  s14 --> any
  s15 --> any
  s21 --> any
  s16 --> any
  s19 --> any
  any -->|"tap ?"| p30
  p30 --> rules
  p30 -->|"Got it"| any
  rules -->|"later"| redesign
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
| F16-1 | happy | Every Help note opens and matches the screen | [`full/50-help-notes.yaml`](../../../e2e/full/50-help-notes.yaml) · [`smoke/02-scorecard.yaml`](../../../e2e/smoke/02-scorecard.yaml) · [`build3.test.ts`](../../../tests/build3.test.ts) · [`build4.test.ts`](../../../tests/build4.test.ts) |
| F16-2 | edge | Help copy stays ≤ 7 bullets and within line length | [`build3.test.ts`](../../../tests/build3.test.ts) |
| F16-3 | happy | Pool, multiplier, seating and deleted-games bullets present | [`pool-pr13.test.ts`](../../../tests/pool-pr13.test.ts) · [`multiplier-pr14.test.ts`](../../../tests/multiplier-pr14.test.ts) · [`seating-pr21.test.ts`](../../../tests/seating-pr21.test.ts) · [`going-rogue.test.ts`](../../../tests/going-rogue.test.ts) |

## Nodes

| ID | Name | File | Tests touching it |
| --- | --- | --- | --- |
| P30 | Help | `components/ui/HelpButton.tsx` | 16 |
| S04 | Home (Live · Recent · bottom bar) | `app/(tabs)/index.tsx` | 69 |
| S14 | Scorecard (Points / Pool) | `app/(screens)/games/[id].tsx` | 86 |
| S15 | Enter Scores (Add round / Edit round) | `app/(screens)/score-entry.tsx` | 57 |
| S21 | Results · pick games + Past results | `app/(screens)/results/index.tsx` | 37 |
| S16 | Players · Admins | `app/(screens)/games/players.tsx` | 50 |
| S19 | Awards (pool) | `app/(screens)/games/award.tsx` | 19 |
