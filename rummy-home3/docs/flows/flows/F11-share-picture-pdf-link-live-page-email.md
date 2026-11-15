# F11 — Share: picture, PDF, link, live page, email

Requirements: R28, R29, R30 · Screens / pop-ups / warnings in this flow: 16 · untested (red): 1 — P29

![F11](../png/F11-share-picture-pdf-link-live-page-email.png)

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 230, "nodeSpacing": 30, "rankSpacing": 40}, "themeVariables": {"fontSize": "14px"}}}%%
flowchart TD
  s14["S14 Scorecard (Points / Pool)"]:::screen
  s20["S20 Final scores (single game share)"]:::screen
  s23["S23 Results · saved result"]:::screen
  p24(["P24 Share sheet (picture · PDF · link)"]):::popup
  p58(["P58 Share results preview (picture)"]):::popup
  p29(["P29 Link copied (scorecard)"]):::gap
  p35(["P35 Enter Scores ⋮ menu (Game settings · Share live scorecard · Cle…"]):::popup
  s25["S25 Web · live scorecard page"]:::screen
  s26["S26 Web · result page"]:::screen
  w33[/"W33 Web result banners (deleted · edited after it was saved · older…"/]:::warning
  w34[/"W34 Web scorecard Changes card"/]:::warning
  e07[["E07 Scorecard by email"]]:::email
  p55(["P55 Delete a shared result?"]):::popup
  s29["S29 Web · privacy policy"]:::screen
  s31["S31 Web · get the app"]:::screen
  s32["S32 Web · 404"]:::screen
  site("Share site (GitHub Pages)"):::step
  what{"Picture · PDF · Link · Email"}:::decision
  os("OS share sheet"):::step
  marker("Shared-from-this-phone marker stored"):::step
  s14 -->|"share icon"| p24
  s20 --> p24
  s23 --> p24
  s14 -->|"Enter Scores ⋮ → Share live scorecard"| p35
  p35 --> p24
  p24 --> what
  what -->|"Picture"| p58
  p58 --> os
  what -->|"PDF (phone pages)"| os
  what -->|"Copy link"| p29
  what -->|"Email"| e07
  p29 -->|"live scorecard link"| s25
  p29 -->|"/r/ result link"| s26
  s26 --> w33
  s25 --> w34
  os --> marker
  marker -->|"later Delete asks"| p55
  s26 --> site
  s25 --> site
  site -->|"/get"| s31
  site -->|"/privacy"| s29
  site -->|"unknown path"| s32
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
| F11-1 | happy | Share result picture → preview → OS sheet; generated-by initials | [`full/41-share-images.yaml`](../../../e2e/full/41-share-images.yaml) · [`results-design.test.ts`](../../../tests/results-design.test.ts) · [`results-share-unsaved.test.ts`](../../../tests/results-share-unsaved.test.ts) |
| F11-2 | happy | Share PDF (phone-sized pages) for a result; Rounds PDF for one game | [`results-design.test.ts`](../../../tests/results-design.test.ts) · [`final-scores.test.ts`](../../../tests/final-scores.test.ts) |
| F11-3 | happy | Copy link → toast; /r/ page shows the same result read-only | [`results-design.test.ts`](../../../tests/results-design.test.ts) · [`pgTAP/24_results_design_034.sql`](../../../supabase/tests/24_results_design_034.sql) · [`pgTAP/08_public_scorecard.sql`](../../../supabase/tests/08_public_scorecard.sql) |
| F11-4 | happy | Live scorecard page (signed out) follows rounds; Changes card | [`pgTAP/08_public_scorecard.sql`](../../../supabase/tests/08_public_scorecard.sql) · [`pgTAP/26_event_log_036.sql`](../../../supabase/tests/26_event_log_036.sql) · [`volume-client.test.ts`](../../../tests/volume-client.test.ts) |
| F11-5 | edge | Deleted / edited result → /r/ banner and version links | [`pgTAP/24_results_design_034.sql`](../../../supabase/tests/24_results_design_034.sql) · [`pgTAP/30_results_delete.sql`](../../../supabase/tests/30_results_delete.sql) |
| F11-6 | misuse | Anon can call only the allow-listed RPCs | [`pgTAP/23_security_033.sql`](../../../supabase/tests/23_security_033.sql) · [`security-033.test.ts`](../../../tests/security-033.test.ts) |
| F11-7 | edge | Share before Save carries the "Not saved yet" banner on picture and PDF | [`results-share-unsaved.test.ts`](../../../tests/results-share-unsaved.test.ts) · [`smoke/06-results.yaml`](../../../e2e/smoke/06-results.yaml) |
| F11-8 | happy | Final scores share (yellow sheet, Game N Final Scores) | [`smoke/05-complete-game.yaml`](../../../e2e/smoke/05-complete-game.yaml) · [`final-scores.test.ts`](../../../tests/final-scores.test.ts) |
| F11-9 | edge | Email a scorecard (send-email kind scorecard) end to end | <span style="color:#c62828">**GAP**</span> |
| F11-10 | edge | Web pages in a real browser (Playwright) — /r/, scorecard.html, link.html, unsubscribe.html | <span style="color:#c62828">**GAP**</span> |

## Nodes

| ID | Name | File | Tests touching it |
| --- | --- | --- | --- |
| S14 | Scorecard (Points / Pool) | `app/(screens)/games/[id].tsx` | 87 |
| S20 | Final scores (single game share) | `app/(screens)/games/final-scores.tsx` | 9 |
| S23 | Results · saved result | `app/(screens)/results/[id].tsx` | 34 |
| P24 | Share sheet (picture · PDF · link) | `components/share/ShareSheet.tsx` | 3 |
| P58 | Share results preview (picture) | `components/share/ShareImageDialog.tsx` | 2 |
| P29 | Link copied (scorecard) | `app/(screens)/games/[id].tsx` | <span style="color:#c62828">**GAP**</span> |
| P35 | Enter Scores ⋮ menu (Game settings · Share live scorecard · Clear / Undo my changes · Help) | `app/(screens)/score-entry.tsx` | 2 |
| S25 | Web · live scorecard page | `public/scorecard.html` | 21 |
| S26 | Web · result page | `public/r/index.html` | 14 |
| W33 | Web result banners (deleted · edited after it was saved · older versions) | `public/r/index.html` | 13 |
| W34 | Web scorecard Changes card | `public/scorecard.html` | 13 |
| E07 | Scorecard by email | `supabase/functions/send-email/index.ts (kind scorecard)` | 6 |
| P55 | Delete a shared result? | `app/(screens)/results/[id].tsx` | 2 |
| S29 | Web · privacy policy | `public/privacy/index.html` | 1 |
| S31 | Web · get the app | `public/get/index.html` | 1 |
| S32 | Web · 404 | `public/404.html` | 1 |
