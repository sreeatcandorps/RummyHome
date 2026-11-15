# F05 — Seating order

Requirements: R14 · Screens / pop-ups / warnings in this flow: 5 · untested (red): 0

![F05](../png/F05-seating-order.png)

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 230, "nodeSpacing": 30, "rankSpacing": 40}, "themeVariables": {"fontSize": "14px"}}}%%
flowchart TD
  s14["S14 Scorecard (Points / Pool)"]:::screen
  p25(["P25 Seating order sheet"]):::popup
  w18[/"W18 Seating note / error (dealer, order unchanged)"/]:::warning
  p18(["P18 Scorecard ⋮ menu (Players · Admins, Seating, Edit round, Reopen…"]):::popup
  s17["S17 Log (game log)"]:::screen
  first{"First open after Start?"}:::decision
  order("Tap players in order / move up · down"):::step
  dealer("Dealer = next in the order"):::step
  keep("Keep this order"):::step
  s14 --> first
  first -->|"yes: prompt"| p25
  first -->|"no"| p18
  p18 -->|"Seating order"| p25
  p25 --> order
  order -->|"incomplete"| w18
  order -->|"Done"| p25
  p25 -->|"Cancel / Keep"| keep
  keep --> s14
  p25 -->|"saved: columns reordered"| s14
  s14 --> dealer
  s14 -->|"Log: Seating changed"| s17
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
| F05-1 | happy | Pop-up after Start: pick the order → columns follow it | [`smoke/19-seating-order.yaml`](../../../e2e/smoke/19-seating-order.yaml) · [`seating-pr21.test.ts`](../../../tests/seating-pr21.test.ts) · [`pgTAP/35_seating_order_044.sql`](../../../supabase/tests/35_seating_order_044.sql) |
| F05-2 | happy | Keep this order (default) → nothing changes | [`smoke/19-seating-order.yaml`](../../../e2e/smoke/19-seating-order.yaml) · [`seating-pr21.test.ts`](../../../tests/seating-pr21.test.ts) |
| F05-3 | happy | Rearrange mid-game from ⋮; dealer follows the new order | [`seating-pr21.test.ts`](../../../tests/seating-pr21.test.ts) · [`pgTAP/35_seating_order_044.sql`](../../../supabase/tests/35_seating_order_044.sql) · [`dealer-rotation-031.test.ts`](../../../tests/dealer-rotation-031.test.ts) |
| F05-4 | edge | 20 players: sheet scrolls, every chip reachable | [`full/51-seating-20p.yaml`](../../../e2e/full/51-seating-20p.yaml) |
| F05-5 | misuse | Non-admin cannot change the order (RPC refused) | [`pgTAP/35_seating_order_044.sql`](../../../supabase/tests/35_seating_order_044.sql) |
| F05-6 | happy | Log row "Seating changed" | [`pgTAP/35_seating_order_044.sql`](../../../supabase/tests/35_seating_order_044.sql) · [`seating-pr21.test.ts`](../../../tests/seating-pr21.test.ts) |

## Nodes

| ID | Name | File | Tests touching it |
| --- | --- | --- | --- |
| S14 | Scorecard (Points / Pool) | `app/(screens)/games/[id].tsx` | 87 |
| P25 | Seating order sheet | `components/game/SeatingSheet.tsx` | 4 |
| W18 | Seating note / error (dealer, order unchanged) | `components/game/SeatingSheet.tsx` | 3 |
| P18 | Scorecard ⋮ menu (Players · Admins, Seating, Edit round, Reopen, Log, Hide, Delete, Settings) | `app/(screens)/games/[id].tsx` | 15 |
| S17 | Log (game log) | `app/(screens)/games/log.tsx` | 24 |
