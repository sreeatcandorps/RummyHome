# F14 — Offline and sync

Requirements: R38, R39 · Screens / pop-ups / warnings in this flow: 7 · untested (red): 0

![F14](../png/F14-offline-and-sync.png)

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 230, "nodeSpacing": 30, "rankSpacing": 40}, "themeVariables": {"fontSize": "14px"}}}%%
flowchart TD
  s04["S04 Home (Live · Recent · bottom bar)"]:::screen
  s14["S14 Scorecard (Points / Pool)"]:::screen
  s15["S15 Enter Scores (Add round / Edit round)"]:::screen
  w29[/"W29 Offline / network copy (cannot reach server · saved on this pho…"/]:::warning
  w37[/"W37 Toast errors (formatSupabaseError) on every write"/]:::warning
  p34(["P34 Round notice (Round N already saved · scorecard refreshed · vie…"]):::popup
  s01["S01 Sign in"]:::screen
  net{"Network?"}:::decision
  cache("Cached bundle shown (stale-while-revalidate)"):::step
  save("Save round"):::step
  retry("Retry when back online"):::step
  kill("App killed mid-save"):::step
  consistent(("One round, no blank row")):::stop
  s04 --> net
  net -->|"off"| cache
  cache --> s14
  net -->|"on"| s14
  s14 --> s15
  s15 --> save
  save -->|"offline: cannot reach server"| w29
  w29 --> retry
  retry -->|"saved once"| s14
  save --> kill
  kill -->|"save_round is one transaction"| consistent
  save -->|"server error"| w37
  save -->|"conflict"| p34
  net -->|"off at launch, no session"| s01
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
| F14-1 | edge | Save with the network off → clear message, nothing half-written | [`chaos/c05-offline-save--net-off.yaml`](../../../e2e/chaos/c05-offline-save--net-off.yaml) · [`degrade.test.ts`](../../../tests/degrade.test.ts) |
| F14-2 | edge | Reconnect → retry saves exactly one round | [`chaos/c06-reconnect-retry.yaml`](../../../e2e/chaos/c06-reconnect-retry.yaml) · [`pgTAP/05_save_round_014.sql`](../../../supabase/tests/05_save_round_014.sql) |
| F14-3 | edge | Kill the app mid-save → after relaunch the scorecard is consistent | [`chaos/c07-kill-mid-save--kill-after.yaml`](../../../e2e/chaos/c07-kill-mid-save--kill-after.yaml) · [`chaos/c08-after-kill-consistent.yaml`](../../../e2e/chaos/c08-after-kill-consistent.yaml) |
| F14-4 | edge | Launch offline with a session → cached Home, no sign-out | [`chaos/c11-launch-offline--net-off.yaml`](../../../e2e/chaos/c11-launch-offline--net-off.yaml) · [`test-findings-pr19.test.ts`](../../../tests/test-findings-pr19.test.ts) |
| F14-5 | happy | Stale-while-revalidate cache seeds scorecard / players / round entry | [`nov10-speed.test.ts`](../../../tests/nov10-speed.test.ts) · [`performance-020.test.ts`](../../../tests/performance-020.test.ts) |
| F14-6 | happy | Older server (RPC missing) → graceful fallback paths | [`degrade.test.ts`](../../../tests/degrade.test.ts) · [`performance-020.test.ts`](../../../tests/performance-020.test.ts) |
| F14-7 | edge | Clock skew / paused project message | [`runtime-fixes.test.ts`](../../../tests/runtime-fixes.test.ts) |
| F14-8 | edge | Two phones offline then both online with the same round number | <span style="color:#c62828">**GAP**</span> |

## Nodes

| ID | Name | File | Tests touching it |
| --- | --- | --- | --- |
| S04 | Home (Live · Recent · bottom bar) | `app/(tabs)/index.tsx` | 69 |
| S14 | Scorecard (Points / Pool) | `app/(screens)/games/[id].tsx` | 86 |
| S15 | Enter Scores (Add round / Edit round) | `app/(screens)/score-entry.tsx` | 57 |
| W29 | Offline / network copy (cannot reach server · saved on this phone) | `utils/supabaseErrors.ts` | 6 |
| W37 | Toast errors (formatSupabaseError) on every write | `utils/supabaseErrors.ts` | 3 |
| P34 | Round notice (Round N already saved · scorecard refreshed · view only) | `app/(screens)/score-entry.tsx` | 8 |
| S01 | Sign in | `app/(auth)/login.tsx` | 12 |
