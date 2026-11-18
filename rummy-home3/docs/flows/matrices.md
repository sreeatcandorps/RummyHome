# Traceability matrices

CSV twins in `csv/`. Red = no flow / no test.

## a. Requirements → spec section → screens / pop-ups

| Requirement | Text | Source | Screens / pop-ups / warnings | Untested among them |
| --- | --- | --- | --- | --- |
| R01 | Sign in with email + 6-digit passcode | [product-contract.md](../product-contract.md#authentication) | S01 W01 |  |
| R02 | Create account; one account per email (anti-enumeration answer handled) | [link](https://github.com/sreeatcandorps/RummyHome/pull/7) | S02 P16 W02 E01 |  |
| R03 | Forgot passcode: OTP typed in the app, no browser page | [link](https://github.com/sreeatcandorps/RummyHome/issues/8) | S03 E02 W03 |  |
| R04 | Edit own initials from Me (040) | [link](https://github.com/sreeatcandorps/RummyHome/pull/25) | S06 P05 W15 |  |
| R05 | Game defaults in User settings: Full count, pool re-entries, multiplier | [pool-design.md](../pool-design.md#3-screens-p01p30) | S07 W31 |  |
| R06 | Delete account (Play policy): dialog lists what goes / stays; web page | [link](https://github.com/sreeatcandorps/RummyHome/pull/7) | S06 P07 P04 S30 |  |
| R07 | Two-screen New game: players first, then Game type (Points / Pool) | [pool-design.md](../pool-design.md#3-screens-p01p30) | S10 S09 S11 |  |
| R08 | Pool rules: limit and re-entries Unlimited / Limited | [pool-design.md](../pool-design.md#1-the-rules-in-one-paragraph) | S09 W14 |  |
| R09 | Co-admin nudge at Start | [link](https://github.com/sreeatcandorps/RummyHome/pull/7) | P45 |  |
| R10 | Initials: any free 2–3 characters, first a letter; clash → digit form (039) | [link](https://github.com/sreeatcandorps/RummyHome/pull/20) | S12 P60 P05 W15 P48 |  |
| R11 | From database: search by name, initials or #ID | [link](https://github.com/sreeatcandorps/RummyHome/pull/21) | S13 |  |
| R12 | Link a seat to a Player ID as a request the owner answers (email + Home, 7 days) | [players-and-identity.md](../players-and-identity.md#claims-player_links) | P10 P11 E05 S27 P01 W17 W05 P02 S24 W06 |  |
| R13 | Guardrails enforced in the database (GRD01) | [guardrails.md](../guardrails.md#limits) | W28 W27 |  |
| R14 | Seating order: pop-up after Start, rearrange mid-game, dealer follows (044) | [seating-order-design.md](../seating-order-design.md#3-screens-s01s08) | P25 W18 |  |
| R15 | Atomic save_round with a per-game lock; named PT409 messages | [link](https://github.com/sreeatcandorps/RummyHome/pull/7) | S15 P34 |  |
| R16 | Count warnings, over-the-Full-count asked once per cell, Rummy negative share (037) | [link](https://github.com/sreeatcandorps/RummyHome/pull/17) | W12 P31 P33 W13 W38 |  |
| R17 | Dealer follows the actual rotation (031) | [link](https://github.com/sreeatcandorps/RummyHome/pull/7) | S14 |  |
| R18 | Undo then Add round saves the same number again (035) | [link](https://github.com/sreeatcandorps/RummyHome/pull/15) | P20 |  |
| R19 | Edit round retires the old row; Log shows Was / Now (036) | [link](https://github.com/sreeatcandorps/RummyHome/pull/16) | P19 S17 |  |
| R20 | Multiplier changeable any time, always the whole game, confirm when rounds exist (043) | [multiplier-design.md](../multiplier-design.md#0-srees-requirements-nov-14-346-pm-pt-and-how-this-spec-reads-them) | P26 P27 W11 P28 P47 |  |
| R21 | Multiplier range 1–10,000; one ≤ 5-character K / M display rule | [multiplier-design.md](../multiplier-design.md#3-display-rules-mockups-m19-m21) | W11 W14 W32 |  |
| R22 | Pool: a player at or over the limit is out; Round saved sheet says who | [pool-design.md](../pool-design.md#3-screens-p01p30) | P32 W35 |  |
| R23 | Re-entry at the highest live total; Unlimited or Limited N (042) | [pool-design.md](../pool-design.md#0-srees-decisions-nov-14-and-what-changed) | W35 W10 |  |
| R24 | Pool settings locked after round 1 (PT423) | [pool-design.md](../pool-design.md#4-data-and-rpcs--migration-041_poolsql-applied-to-live-nov-14--042_pool_reentries_and_limit_locksql-applied-to-live-by-sree-nov-15) | W19 P26 |  |
| R25 | Complete is one dialog on the scorecard (Nov 18; the Complete page is gone); the Final screen is Share + Done, Done = Home | [link](https://github.com/sreeatcandorps/RummyHome/pull/7) | P40 P41 S20 W08 | <span style="color:#c62828">W08</span> |
| R26 | Awards for a completed pool; a pool joins a result only through its awards | [pool-design.md](../pool-design.md#3-screens-p01p30) | S19 P42 P43 P44 W20 W36 P50 |  |
| R27 | Save result moves games to Closed and lists each change | [link](https://github.com/sreeatcandorps/RummyHome/pull/7) | S22 P53 W22 W23 E04 |  |
| R28 | Share picture (summary, generated-by initials) and phone-page PDF per the approved design (034) | [link](https://github.com/sreeatcandorps/RummyHome/pull/14) | P24 P58 |  |
| R29 | Public /r/ page and live scorecard page; anon limited to the allow-list (033) | [link](https://github.com/sreeatcandorps/RummyHome/pull/7) | S25 S26 W33 W34 P29 P57 | <span style="color:#c62828">P29 P57</span> |
| R30 | Deleting a result shared from this phone asks first | [results-delete.md](../results-delete.md#undo-and-confirm-d92) | P55 |  |
| R31 | Roles: creator, admin, player, view only; non-playing admin by Player ID | [product-contract.md](../product-contract.md#roles) | S16 P39 W40 P14 |  |
| R32 | Remove a seat only when every round score is 0 (016) | [link](https://github.com/sreeatcandorps/RummyHome/pull/7) | P36 P37 P46 | <span style="color:#c62828">P46</span> |
| R33 | Privacy: contact columns owner-only, role lock, column grants (019) | [link](https://github.com/sreeatcandorps/RummyHome/pull/7) | S06 |  |
| R34 | Hide is per person; Delete is soft and for everyone (023) | [link](https://github.com/sreeatcandorps/RummyHome/pull/7) | P18 P21 P23 |  |
| R35 | Deleted games stay visible to players who scored: read-only, Ask to restore (045) | [going-rogue-design.md](../going-rogue-design.md#5-screens-g01g08) | W04 W09 W39 P03 E06 |  |
| R36 | Restore by creator / admin; Hidden & deleted lists hidden games, deleted games and results | [going-rogue-design.md](../going-rogue-design.md#5-screens-g01g08) | S08 P59 W30 |  |
| R37 | Nothing is ever permanently deleted; after 30 days a second-layer soft delete (Sree, Nov 15; PR 22 / 046) | [going-rogue-design.md](../going-rogue-design.md) | W04 |  |
| R38 | Realtime scorecard updates, one reload per burst | [realtime-offline.md](../realtime-offline.md#realtime) | S14 |  |
| R39 | Offline: cached bundles, no false sign-out, retry | [realtime-offline.md](../realtime-offline.md#local-storage) | W29 W37 |  |
| R40 | Emails through an idempotent outbox: Game started, Result saved, preferences, unsubscribe (024) | [link](https://github.com/sreeatcandorps/RummyHome/pull/7) | E03 E04 E07 S28 |  |
| R41 | Email daily cap 90 with backoff; nothing dropped (029) | [guardrails.md](../guardrails.md#limits) | E03 E04 |  |
| R42 | Help on every screen, ≤ 7 bullets | [help-design.md](../help-design.md#1-what-exists-today) | P30 |  |
| R43 | Delete this result visible, 10-second Undo, Deleted list for 30 days (D9.1–D9.3) | [results-delete.md](../results-delete.md) | P56 W25 W26 P52 P54 P49 P51 W21 |  |
| R44 | Result history: versions, "Changed after sharing", result_* log rows (036) | [link](https://github.com/sreeatcandorps/RummyHome/pull/16) | W24 |  |
| R45 | Scorecard: header sized from type, one scroller, 20 players portrait and landscape (PR 4 / 10a) | [link](https://github.com/sreeatcandorps/RummyHome/pull/24) | S14 W08 | <span style="color:#c62828">W08</span> |
| R46 | Home: two bottom buttons, My players badge, Light default; game numbers reused (038) | [link](https://github.com/sreeatcandorps/RummyHome/pull/19) | S04 S05 W07 W40 |  |
| R47 | Remove from My players is a soft remove with Undo; refused during a live game (027) | [link](https://github.com/sreeatcandorps/RummyHome/pull/7) | P08 P15 P13 | <span style="color:#c62828">P13</span> |
| R48 | Invite to register; registration tags | [players-and-identity.md](../players-and-identity.md#player-statuses) | P09 P12 W16 |  |
| R49 | Enter Scores ⋮: Game settings, Share live scorecard, Clear / Undo my changes | [link](https://github.com/sreeatcandorps/RummyHome/pull/32) | P35 P26 |  |
| R50 | Country picker on Create account (phone code) | [link](https://github.com/sreeatcandorps/RummyHome/pull/7) | P17 | <span style="color:#c62828">P17</span> |
| R51 | Web: privacy, get-the-app and 404 pages | [link](https://github.com/sreeatcandorps/RummyHome/pull/7) | S29 S31 S32 |  |

## b. Screen / pop-up / warning × flow

| ID | Name | F01 | F02 | F03 | F04 | F05 | F06 | F07 | F08 | F09 | F10 | F11 | F12 | F13 | F14 | F15 | F16 | F17 | In no flow |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | Sign in | x |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |
| S02 | Create account | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| S03 | Forgot passcode (OTP → new passcode) | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| S04 | Home (Live · Recent · bottom bar) | x | x | x |  |  |  |  |  |  | x |  | x | x | x |  | x | x |  |
| S05 | My players |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| S06 | Me (profile) | x | x |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |
| S07 | User settings (game defaults) |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| S08 | Hidden & deleted |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |
| S09 | New game · Game type (Points / Pool, rules, multiplier) |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| S10 | New game · Players picker / Add players to this game |  |  | x | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| S11 | Fix initials (before Start) |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| S12 | Add by initials |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| S13 | Find in database |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| S14 | Scorecard (Points / Pool) |  |  | x |  | x | x | x | x | x | x | x | x | x | x |  | x |  |  |
| S15 | Enter Scores (Add round / Edit round) |  |  |  |  |  | x | x |  | x | x |  |  |  | x |  | x |  |  |
| S16 | Players · Admins |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  | x |  |  |
| S17 | Log (game log) |  |  |  |  | x |  | x | x |  |  |  |  | x |  |  |  |  |  |
| S19 | Awards (pool) |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  | x |  |  |
| S20 | Final screen (final scores / awards · Share + Done) |  |  |  |  |  |  |  | x |  | x | x |  |  |  |  |  |  |  |
| S21 | Results · pick games + Past results |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  | x | x |  |
| S22 | Results · view (unsaved) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |
| S23 | Results · saved result |  |  |  |  |  |  |  | x |  |  | x |  |  |  |  |  | x |  |
| S24 | Claim link landing (remembers token → sign up / Home) |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| S25 | Web · live scorecard page |  |  |  |  |  | x |  |  |  |  | x |  |  |  | x |  |  |  |
| S26 | Web · result page |  |  |  |  |  |  |  |  |  |  | x |  |  |  | x |  |  |  |
| S27 | Web · link request Yes / No |  |  |  | x |  |  |  |  |  |  |  |  |  |  | x |  |  |  |
| S28 | Web · unsubscribe |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |
| S29 | Web · privacy policy |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |
| S30 | Web · delete account page |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| S31 | Web · get the app |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |
| S32 | Web · 404 |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |
| P01 | Linked (link complete notice) |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P02 | One quick check (join / claim requests) |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P03 | Home toast (Asked · Game restored) |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |
| P04 | Me notice (Couldn’t save · Couldn’t log out · Demo data · Account deleted) |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P05 | Initials for {name} (shared editor) |  | x |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P06 | Change passcode |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P07 | Delete your account? |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P08 | Remove {name} from My players? |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P09 | Invite {name} to register |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |
| P10 | Link {name} to Player ID |  |  |  | x |  |  |  |  |  |  |  | x |  |  |  |  |  |  |
| P11 | Request sent (link request) |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P12 | Edit name |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |
| P13 | Player detail (initials, Close / Remove) |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P14 | Player ⋮ menu (Invite · Link · Edit initials · Edit name · Admin · Remove) |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |
| P15 | Removed · UNDO (My players) |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P16 | Account created | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P17 | Country picker (phone code) | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P18 | Scorecard ⋮ menu (Players · Admins, Seating, Edit round, Reopen, Log, Hide, Delete, Settings) |  |  |  |  | x |  | x | x |  |  |  |  | x |  |  |  |  |  |
| P19 | Edit which round? |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |
| P20 | Remove the last round? (Undo) |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |
| P21 | Delete this game? |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |
| P22 | Reopen this game? |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |
| P23 | Something went wrong (scorecard action error) |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |
| P24 | Share sheet (picture · PDF · link) |  |  |  |  |  |  |  |  |  | x | x |  |  |  |  |  |  |  |
| P25 | Seating order sheet |  |  | x |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P26 | Game settings (Full count, multiplier, pool rules) |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |  |  |
| P27 | Change the multiplier? / Large multiplier |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |  |  |
| P28 | Exact points (multiplier totals) |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |  |  |
| P29 | Link copied (scorecard) |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |
| P30 | Help |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |
| P31 | Over the Full count / Are you sure? (pool) |  |  |  |  |  | x |  |  | x |  |  |  |  |  |  |  |  |  |
| P32 | Round saved (pool: out · eligible · re-enter) |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |  |
| P33 | Rummy share is not a win |  |  |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |
| P34 | Round notice (Round N already saved · scorecard refreshed · view only) |  |  |  |  |  | x | x |  |  |  |  |  |  | x |  |  |  |  |
| P35 | Enter Scores ⋮ menu (Game settings · Share live scorecard · Clear / Undo my changes · Help) |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |
| P36 | Remove {name}? (seat) |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |
| P37 | Remove from game (blocked: player has a score) |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |
| P38 | Something went wrong (Players · Admins) |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |
| P39 | Add non-playing admin (by Player ID) |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |
| P40 | Complete this game? / Complete this pool? (Nov 18: one dialog; Fix round N first when a Points round is off) |  |  |  |  |  |  |  |  | x | x |  |  |  |  |  |  |  |  |
| P41 | Could not complete |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |
| P42 | Not all given out (save awards anyway?) |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |
| P43 | Not for this pool |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |
| P44 | Could not save awards |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |
| P45 | Add a co-admin? |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P46 | Can’t remove this player (picker) |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P47 | Large multiplier (Game type) |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P48 | Unsaved letters |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| P49 | Deselect games? |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |
| P50 | Give awards first |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  | x |  |
| P51 | Not an admin (locked card) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |
| P52 | Results toast (Result deleted · UNDO / restored) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |
| P53 | Result saved (status changes) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |
| P54 | Result ⋮ menu (History · Copy link · Delete result) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |
| P55 | Delete a shared result? |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  | x |  |
| P56 | Result deleted · UNDO (saved result) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |
| P57 | Link copied (result) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |
| P58 | Share results preview (picture) |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |
| P59 | Hidden & deleted toast (restored · unhidden) |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |
| P60 | Initials clash sentence (stored form) |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| W01 | Sign-in error (wrong passcode · cannot reach server · locked) | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| W02 | An account with this email already exists | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| W03 | OTP / passcode validation (6 digits, mismatch) | x | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| W04 | Deleted games card (read-only, hidden for good on …, Ask / Restore) |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |
| W05 | Link requests card (Yes / No) |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |
| W06 | Claim requests card |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |
| W07 | Empty states (no live games · no players · no results) |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| W08 | Game status tag (Active · Completed · Closed · Deleted) |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |
| W09 | Deleted game banner (Deleted by …, Ask to restore / Restore) |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |
| W10 | Pool over hint (everyone out / limit reached) |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |  |
| W11 | Multiplier chip + entered-points banner |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |  |  |
| W12 | Count warning line (half / Full count) |  |  |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |
| W13 | Balance pill (Save off until 0) |  |  |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |
| W14 | New game problem line (players, Full count, multiplier range) |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| W15 | Initials format line / Change the letters to save |  | x |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| W16 | Registration tags (Unregistered · Pending registration · Link pending) |  |  |  | x |  |  |  |  |  |  |  | x |  |  |  |  |  |  |
| W17 | Can’t link yet (conflict names each game) |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| W18 | Seating note / error (dealer, order unchanged) |  |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |
| W19 | Game settings error / locked note |  |  |  |  |  |  |  | x | x |  |  |  |  |  |  |  |  |  |
| W20 | Awards hints (given out · winner warning · blocked) |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |
| W21 | Results picker count + locked (non-admin) cards |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |
| W22 | Not saved yet. This result may change. |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |
| W23 | Result warnings (Active game · already in a previous result) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |
| W24 | Changed after sharing · removed / deleted notes · History |  |  |  |  |  |  | x |  |  |  |  |  | x |  |  |  | x |  |
| W25 | Delete consequence line (games go back to Completed) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |
| W26 | Deleted results section (Restore, 30 days) |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |
| W27 | My players search-full note + 1,000 limit |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| W28 | Guardrail refusals (GRD01: 20 seats, 500 rounds, 10 live games, 50 games/day, 100 players/day, 20 pending links) |  |  | x | x |  | x |  |  |  |  |  |  |  |  |  |  |  |  |
| W29 | Offline / network copy (cannot reach server · saved on this phone) |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |
| W30 | Support card (Can’t find a game? support@ezscore.app) |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |
| W31 | Settings Saved banner |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| W32 | Final scores note + multiplier line |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |
| W33 | Web result banners (deleted · edited after it was saved · older versions) |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |
| W34 | Web scorecard Changes card |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |
| W35 | Pool standings (OUT · re-entry eligible · re-entered · limit) |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |  |
| W36 | Pool awards card (after complete) |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |  |  |
| W37 | Toast errors (formatSupabaseError) on every write |  |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |
| W38 | Rummy / positive pot colours (yellow selected, green win, red penalty) |  |  |  |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |
| W39 | Deleted game read-only (no Add round / Undo / Share) |  |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |
| W40 | Role tags on Home cards (Creator · Admin · Player · View only) |  |  |  |  |  |  |  |  |  |  |  | x |  |  |  |  |  |  |

## c. Screen / pop-up / warning × test type (number of test files)

| ID | Name | unit | pgTAP | concurrency | smoke | full | roles | chaos | two-device | monkey | volume | Total | Untouched |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | Sign in | 6 |  |  |  | 1 |  | 5 |  |  |  | 12 |  |
| S02 | Create account | 4 |  |  |  |  |  |  |  |  |  | 4 |  |
| S03 | Forgot passcode (OTP → new passcode) | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| S04 | Home (Live · Recent · bottom bar) | 30 | 7 |  | 14 | 13 | 5 | 4 |  |  |  | 73 |  |
| S05 | My players | 28 | 4 |  | 5 | 2 |  |  |  |  |  | 39 |  |
| S06 | Me (profile) | 21 |  |  | 3 | 2 |  | 1 |  |  |  | 27 |  |
| S07 | User settings (game defaults) | 21 | 1 |  | 5 | 2 |  |  |  |  |  | 29 |  |
| S08 | Hidden & deleted | 17 | 3 |  | 3 | 1 |  |  |  |  |  | 24 |  |
| S09 | New game · Game type (Points / Pool, rules, multiplier) | 19 | 2 | 1 | 4 | 2 |  | 1 |  |  |  | 29 |  |
| S10 | New game · Players picker / Add players to this game | 29 | 4 | 1 | 4 | 2 |  | 1 |  |  |  | 41 |  |
| S11 | Fix initials (before Start) | 14 |  |  | 2 | 1 |  |  |  |  |  | 17 |  |
| S12 | Add by initials | 21 | 6 |  | 6 | 3 |  | 1 |  |  |  | 37 |  |
| S13 | Find in database | 18 |  |  | 4 | 3 |  |  |  |  |  | 25 |  |
| S14 | Scorecard (Points / Pool) | 40 | 7 | 1 | 14 | 10 | 4 | 11 | 4 |  |  | 91 |  |
| S15 | Enter Scores (Add round / Edit round) | 36 | 6 | 1 | 8 | 5 |  | 7 | 1 |  |  | 64 |  |
| S16 | Players · Admins | 34 | 7 | 1 | 5 | 4 |  |  |  |  |  | 51 |  |
| S17 | Log (game log) | 14 |  |  | 4 | 3 |  | 2 | 1 |  |  | 24 |  |
| S19 | Awards (pool) | 15 | 1 |  | 3 | 1 |  | 1 |  |  |  | 21 |  |
| S20 | Final screen (final scores / awards · Share + Done) | 7 |  |  | 2 | 1 |  | 1 |  |  |  | 11 |  |
| S21 | Results · pick games + Past results | 24 | 4 |  | 4 | 3 | 3 |  |  |  |  | 38 |  |
| S22 | Results · view (unsaved) | 18 | 2 |  | 3 | 2 |  |  |  |  |  | 25 |  |
| S23 | Results · saved result | 24 | 3 |  | 5 | 3 |  |  |  |  |  | 35 |  |
| S24 | Claim link landing (remembers token → sign up / Home) | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| S25 | Web · live scorecard page | 10 | 11 |  |  |  |  |  |  |  |  | 21 |  |
| S26 | Web · result page | 6 | 8 |  |  |  |  |  |  |  |  | 14 |  |
| S27 | Web · link request Yes / No | 3 | 2 |  |  |  |  |  |  |  |  | 5 |  |
| S28 | Web · unsubscribe | 2 | 2 |  |  |  |  |  |  |  |  | 4 |  |
| S29 | Web · privacy policy | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| S30 | Web · delete account page | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| S31 | Web · get the app | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| S32 | Web · 404 | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| P01 | Linked (link complete notice) | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| P02 | One quick check (join / claim requests) | 2 |  |  |  |  |  |  |  |  |  | 2 |  |
| P03 | Home toast (Asked · Game restored) | 1 |  |  |  |  | 1 |  |  |  |  | 2 |  |
| P04 | Me notice (Couldn’t save · Couldn’t log out · Demo data · Account deleted) | 1 |  |  |  |  |  | 1 |  |  |  | 2 |  |
| P05 | Initials for {name} (shared editor) | 1 |  |  |  | 1 |  |  |  |  |  | 2 |  |
| P06 | Change passcode | 2 |  |  | 1 |  |  |  |  |  |  | 3 |  |
| P07 | Delete your account? | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| P08 | Remove {name} from My players? | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| P09 | Invite {name} to register | 2 |  |  |  |  |  |  |  |  |  | 2 |  |
| P10 | Link {name} to Player ID | 3 | 1 |  |  |  |  |  |  |  |  | 4 |  |
| P11 | Request sent (link request) | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| P12 | Edit name | 3 |  |  | 1 |  |  |  |  |  |  | 4 |  |
| P13 | Player detail (initials, Close / Remove) |  |  |  |  |  |  |  |  |  |  | 0 | <span style="color:#c62828">**GAP**</span> |
| P14 | Player ⋮ menu (Invite · Link · Edit initials · Edit name · Admin · Remove) | 4 |  |  | 1 |  |  |  |  |  |  | 5 |  |
| P15 | Removed · UNDO (My players) | 2 | 2 |  |  |  |  |  |  |  |  | 4 |  |
| P16 | Account created | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| P17 | Country picker (phone code) |  |  |  |  |  |  |  |  |  |  | 0 | <span style="color:#c62828">**GAP**</span> |
| P18 | Scorecard ⋮ menu (Players · Admins, Seating, Edit round, Reopen, Log, Hide, Delete, Settings) | 4 | 1 |  | 3 | 2 | 1 | 3 | 1 |  |  | 15 |  |
| P19 | Edit which round? | 2 | 2 |  | 1 | 1 |  |  |  |  |  | 6 |  |
| P20 | Remove the last round? (Undo) | 2 | 3 | 1 | 2 | 1 | 2 | 1 |  |  |  | 12 |  |
| P21 | Delete this game? | 1 |  |  | 2 |  | 1 |  |  |  |  | 4 |  |
| P22 | Reopen this game? | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| P23 | Something went wrong (scorecard action error) |  |  |  |  |  |  | 6 | 1 |  |  | 7 |  |
| P24 | Share sheet (picture · PDF · link) | 3 |  |  | 1 | 1 |  |  |  |  |  | 5 |  |
| P25 | Seating order sheet | 2 |  |  | 2 | 1 |  |  |  |  |  | 5 |  |
| P26 | Game settings (Full count, multiplier, pool rules) | 4 | 2 |  | 1 | 2 |  |  |  |  |  | 9 |  |
| P27 | Change the multiplier? / Large multiplier | 1 |  |  | 1 | 1 |  |  |  |  |  | 3 |  |
| P28 | Exact points (multiplier totals) | 2 |  |  | 1 | 1 |  |  |  |  |  | 4 |  |
| P29 | Link copied (scorecard) |  |  |  |  |  |  |  |  |  |  | 0 | <span style="color:#c62828">**GAP**</span> |
| P30 | Help | 14 |  |  | 2 | 1 |  |  |  |  |  | 17 |  |
| P31 | Over the Full count / Are you sure? (pool) | 1 |  |  | 1 | 1 |  | 1 |  |  |  | 4 |  |
| P32 | Round saved (pool: out · eligible · re-enter) | 3 |  |  | 1 |  |  |  |  |  |  | 4 |  |
| P33 | Rummy share is not a win |  |  |  | 1 |  |  |  |  |  |  | 1 |  |
| P34 | Round notice (Round N already saved · scorecard refreshed · view only) | 3 | 2 | 1 | 1 |  |  |  | 1 |  |  | 8 |  |
| P35 | Enter Scores ⋮ menu (Game settings · Share live scorecard · Clear / Undo my changes · Help) | 2 |  |  |  |  |  |  |  |  |  | 2 |  |
| P36 | Remove {name}? (seat) | 3 | 3 | 1 |  |  |  |  |  |  |  | 7 |  |
| P37 | Remove from game (blocked: player has a score) | 3 | 1 |  |  |  |  |  |  |  |  | 4 |  |
| P38 | Something went wrong (Players · Admins) | 9 |  |  |  |  |  |  |  |  |  | 9 |  |
| P39 | Add non-playing admin (by Player ID) | 1 |  |  |  | 3 |  |  |  |  |  | 4 |  |
| P40 | Complete this game? / Complete this pool? (Nov 18: one dialog; Fix round N first when a Points round is off) | 2 |  |  | 2 |  |  | 3 | 1 |  |  | 8 |  |
| P41 | Could not complete |  |  |  |  |  |  | 1 |  |  |  | 1 |  |
| P42 | Not all given out (save awards anyway?) | 1 |  |  | 1 |  |  |  |  |  |  | 2 |  |
| P43 | Not for this pool | 1 |  |  | 1 |  |  |  |  |  |  | 2 |  |
| P44 | Could not save awards | 1 | 1 |  |  |  |  | 1 |  |  |  | 3 |  |
| P45 | Add a co-admin? | 2 |  |  |  |  |  |  |  |  |  | 2 |  |
| P46 | Can’t remove this player (picker) |  |  |  |  |  |  |  |  |  |  | 0 | <span style="color:#c62828">**GAP**</span> |
| P47 | Large multiplier (Game type) |  |  |  |  | 1 |  |  |  |  |  | 1 |  |
| P48 | Unsaved letters | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| P49 | Deselect games? | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| P50 | Give awards first | 2 | 1 |  |  |  |  |  |  |  |  | 3 |  |
| P51 | Not an admin (locked card) | 2 | 3 |  |  |  |  |  |  |  |  | 5 |  |
| P52 | Results toast (Result deleted · UNDO / restored) | 1 | 1 |  | 1 | 1 |  |  |  |  |  | 4 |  |
| P53 | Result saved (status changes) | 1 | 1 |  | 2 | 1 |  |  |  |  |  | 5 |  |
| P54 | Result ⋮ menu (History · Copy link · Delete result) | 3 | 2 |  |  |  |  |  |  |  |  | 5 |  |
| P55 | Delete a shared result? | 1 |  |  | 1 |  |  |  |  |  |  | 2 |  |
| P56 | Result deleted · UNDO (saved result) | 1 | 1 |  | 1 | 1 |  |  |  |  |  | 4 |  |
| P57 | Link copied (result) |  |  |  |  |  |  |  |  |  |  | 0 | <span style="color:#c62828">**GAP**</span> |
| P58 | Share results preview (picture) | 2 |  |  |  |  |  |  |  |  |  | 2 |  |
| P59 | Hidden & deleted toast (restored · unhidden) | 3 | 3 |  |  |  |  |  |  |  |  | 6 |  |
| P60 | Initials clash sentence (stored form) | 4 | 6 |  | 1 |  |  |  |  |  |  | 11 |  |
| W01 | Sign-in error (wrong passcode · cannot reach server · locked) | 3 |  |  |  |  |  |  |  |  |  | 3 |  |
| W02 | An account with this email already exists | 2 |  |  |  |  |  |  |  |  |  | 2 |  |
| W03 | OTP / passcode validation (6 digits, mismatch) | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| W04 | Deleted games card (read-only, hidden for good on …, Ask / Restore) | 2 | 3 |  |  |  | 1 |  |  |  |  | 6 |  |
| W05 | Link requests card (Yes / No) | 2 | 2 |  |  |  |  |  |  |  |  | 4 |  |
| W06 | Claim requests card |  | 2 |  |  |  |  |  |  |  |  | 2 |  |
| W07 | Empty states (no live games · no players · no results) | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| W08 | Game status tag (Active · Completed · Closed · Deleted) |  |  |  |  |  |  |  |  |  |  | 0 | <span style="color:#c62828">**GAP**</span> |
| W09 | Deleted game banner (Deleted by …, Ask to restore / Restore) | 2 |  |  |  |  | 1 |  |  |  |  | 3 |  |
| W10 | Pool over hint (everyone out / limit reached) | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| W11 | Multiplier chip + entered-points banner |  |  |  | 1 | 1 |  |  |  |  |  | 2 |  |
| W12 | Count warning line (half / Full count) | 1 |  |  |  | 1 |  |  |  |  |  | 2 |  |
| W13 | Balance pill (Save off until 0) | 3 |  |  | 3 | 1 |  | 1 |  |  |  | 8 |  |
| W14 | New game problem line (players, Full count, multiplier range) | 2 |  |  |  |  |  | 1 |  |  |  | 3 |  |
| W15 | Initials format line / Change the letters to save | 2 |  |  |  | 1 |  |  |  |  |  | 3 |  |
| W16 | Registration tags (Unregistered · Pending registration · Link pending) | 12 | 1 |  | 2 |  |  |  |  |  |  | 15 |  |
| W17 | Can’t link yet (conflict names each game) | 1 | 2 |  |  |  |  |  |  |  |  | 3 |  |
| W18 | Seating note / error (dealer, order unchanged) |  |  |  | 1 | 1 |  |  |  |  |  | 2 |  |
| W19 | Game settings error / locked note | 1 | 2 |  |  |  |  |  |  |  |  | 3 |  |
| W20 | Awards hints (given out · winner warning · blocked) | 1 |  |  |  |  |  |  |  |  |  | 1 |  |
| W21 | Results picker count + locked (non-admin) cards | 2 |  |  |  |  |  |  |  |  |  | 2 |  |
| W22 | Not saved yet. This result may change. | 1 |  |  |  | 1 |  |  |  |  |  | 2 |  |
| W23 | Result warnings (Active game · already in a previous result) | 2 | 1 |  |  |  |  |  |  |  |  | 3 |  |
| W24 | Changed after sharing · removed / deleted notes · History | 1 | 1 |  |  |  |  |  |  |  |  | 2 |  |
| W25 | Delete consequence line (games go back to Completed) | 1 | 1 |  |  |  |  |  |  |  |  | 2 |  |
| W26 | Deleted results section (Restore, 30 days) | 2 |  |  | 1 | 1 |  |  |  |  |  | 4 |  |
| W27 | My players search-full note + 1,000 limit | 1 | 1 |  |  |  |  |  |  |  |  | 2 |  |
| W28 | Guardrail refusals (GRD01: 20 seats, 500 rounds, 10 live games, 50 games/day, 100 players/day, 20 pending links) | 2 | 2 | 1 |  |  |  |  |  |  |  | 5 |  |
| W29 | Offline / network copy (cannot reach server · saved on this phone) | 3 |  |  |  |  |  | 3 |  |  |  | 6 |  |
| W30 | Support card (Can’t find a game? support@ezscore.app) | 2 | 1 |  |  |  |  |  |  |  |  | 3 |  |
| W31 | Settings Saved banner | 6 | 1 |  | 2 | 1 |  |  |  |  |  | 10 |  |
| W32 | Final scores note + multiplier line | 2 |  |  |  |  |  |  |  |  |  | 2 |  |
| W33 | Web result banners (deleted · edited after it was saved · older versions) | 5 | 8 |  |  |  |  |  |  |  |  | 13 |  |
| W34 | Web scorecard Changes card | 10 | 3 |  |  |  |  |  |  |  |  | 13 |  |
| W35 | Pool standings (OUT · re-entry eligible · re-entered · limit) | 3 |  |  | 3 |  |  |  |  |  |  | 6 |  |
| W36 | Pool awards card (after complete) | 2 |  |  | 2 |  |  |  |  |  |  | 4 |  |
| W37 | Toast errors (formatSupabaseError) on every write | 3 |  |  |  |  |  |  |  |  |  | 3 |  |
| W38 | Rummy / positive pot colours (yellow selected, green win, red penalty) | 7 |  |  |  |  |  |  |  |  |  | 7 |  |
| W39 | Deleted game read-only (no Add round / Undo / Share) | 2 |  |  |  |  | 1 |  |  |  |  | 3 |  |
| W40 | Role tags on Home cards (Creator · Admin · Player · View only) | 6 |  |  |  |  | 3 |  |  |  |  | 9 |  |

## d. Scenario → flow → requirement → screens → test file → last result

| Scenario | Kind | Flow | Requirements | Screens / pop-ups | Scenario text | Test file | Test type | Last result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F01-1 | happy | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Sign in with email + 6-digit passcode → Home | [`e2e/smoke/01-home.yaml`](../../e2e/smoke/01-home.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F01-1 | happy | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Sign in with email + 6-digit passcode → Home | [`e2e/lib/sign-in.yaml`](../../e2e/lib/sign-in.yaml) | lib | [pass (shared piece) · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F01-1 | happy | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Sign in with email + 6-digit passcode → Home | [`tests/passcode.test.ts`](../../tests/passcode.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F01-2 | happy | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Create account → Account created → welcome email → Home | [`tests/auth-errors.test.ts`](../../tests/auth-errors.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F01-2 | happy | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Create account → Account created → welcome email → Home | [`tests/emails-024.test.ts`](../../tests/emails-024.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F01-2 | happy | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Create account → Account created → welcome email → Home | [`supabase/tests/11_email_uniqueness_021.sql`](../../supabase/tests/11_email_uniqueness_021.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F01-3 | edge | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Sign up with an email that already has an account → "already exists", no welcome email | [`tests/email-uniqueness-021.test.ts`](../../tests/email-uniqueness-021.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F01-3 | edge | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Sign up with an email that already has an account → "already exists", no welcome email | [`supabase/tests/11_email_uniqueness_021.sql`](../../supabase/tests/11_email_uniqueness_021.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F01-4 | happy | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Forgot passcode → OTP email → new passcode → sign in | [`tests/passcode.test.ts`](../../tests/passcode.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F01-5 | misuse | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Wrong passcode → error, stays on Sign in | [`e2e/full/10-sign-out-bad-passcode.yaml`](../../e2e/full/10-sign-out-bad-passcode.yaml) | full | [fail · nightly Nov 15 on stale PR 19 branch](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F01-5 | misuse | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Wrong passcode → error, stays on Sign in | [`tests/auth-errors.test.ts`](../../tests/auth-errors.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F01-6 | happy | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Log out from Me → Sign in | [`e2e/full/10-sign-out-bad-passcode.yaml`](../../e2e/full/10-sign-out-bad-passcode.yaml) | full | [fail · nightly Nov 15 on stale PR 19 branch](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F01-6 | happy | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Log out from Me → Sign in | [`tests/test-findings-pr19.test.ts`](../../tests/test-findings-pr19.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F01-7 | edge | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Dead / revoked session → back to Sign in, not a spinner (F1) | [`e2e/chaos/c12-logout-dead-session--revoke-session.yaml`](../../e2e/chaos/c12-logout-dead-session--revoke-session.yaml) | chaos | [fail · non-blocking, PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F01-7 | edge | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Dead / revoked session → back to Sign in, not a spinner (F1) | [`tests/test-findings-pr19.test.ts`](../../tests/test-findings-pr19.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F01-8 | edge | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Launch offline → cached Home, not a sign-out (F2) | [`e2e/chaos/c11-launch-offline--net-off.yaml`](../../e2e/chaos/c11-launch-offline--net-off.yaml) | chaos | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F01-8 | edge | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Launch offline → cached Home, not a sign-out (F2) | [`tests/test-findings-pr19.test.ts`](../../tests/test-findings-pr19.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F01-9 | edge | F01 | R01 R02 R03 | S01 S02 S03 W01 W02 W03 P16 P17 E01 E02 S04 S06 | Create account on the device (register screen end to end) | <span style="color:#c62828">**GAP**</span> |  |  |
| F02-1 | happy | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | Open Me, see name · Player ID · version line | [`e2e/smoke/07-profile.yaml`](../../e2e/smoke/07-profile.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F02-1 | happy | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | Open Me, see name · Player ID · version line | [`tests/pr10b-apk9-fixes.test.ts`](../../tests/pr10b-apk9-fixes.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F02-2 | happy | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | Edit own initials from Me → scorecards use them | [`e2e/smoke/07-profile.yaml`](../../e2e/smoke/07-profile.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F02-2 | happy | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | Edit own initials from Me → scorecards use them | [`tests/pr10b-apk9-fixes.test.ts`](../../tests/pr10b-apk9-fixes.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F02-2 | happy | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | Edit own initials from Me → scorecards use them | [`supabase/tests/31_own_initials_040.sql`](../../supabase/tests/31_own_initials_040.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F02-3 | happy | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | User settings: pool re-entries Unlimited ↔ Limited (count field) | [`e2e/smoke/07-profile.yaml`](../../e2e/smoke/07-profile.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F02-3 | happy | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | User settings: pool re-entries Unlimited ↔ Limited (count field) | [`tests/pool-pr13.test.ts`](../../tests/pool-pr13.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F02-4 | happy | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | Default Full count / multiplier saved → next New game pre-filled | [`tests/multiplier-pr14.test.ts`](../../tests/multiplier-pr14.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F02-4 | happy | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | Default Full count / multiplier saved → next New game pre-filled | [`tests/design-nov12.test.ts`](../../tests/design-nov12.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F02-5 | happy | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | Appearance Light default; Dark applies everywhere; Phone follows OS | [`e2e/full/60-dark-mode.yaml`](../../e2e/full/60-dark-mode.yaml) | full | [pass · nightly Nov 15 (stale PR 19 branch)](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F02-5 | happy | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | Appearance Light default; Dark applies everywhere; Phone follows OS | [`e2e/full/61-first-launch-light-night-phone.yaml`](../../e2e/full/61-first-launch-light-night-phone.yaml) | full | [pass · nightly Nov 15 (stale PR 19 branch)](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F02-5 | happy | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | Appearance Light default; Dark applies everywhere; Phone follows OS | [`tests/home-pr5.test.ts`](../../tests/home-pr5.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F02-6 | happy | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | Change passcode with current passcode check | [`tests/passcode.test.ts`](../../tests/passcode.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F02-7 | misuse | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | Delete account: dialog lists what goes / stays; tick required; RPC anonymises | [`tests/delete-account-026.test.ts`](../../tests/delete-account-026.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F02-7 | misuse | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | Delete account: dialog lists what goes / stays; tick required; RPC anonymises | [`supabase/tests/16_delete_account_026.sql`](../../supabase/tests/16_delete_account_026.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F02-8 | edge | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | Email preferences off → no Game started / Result email | [`supabase/tests/14_emails_024.sql`](../../supabase/tests/14_emails_024.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F02-8 | edge | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | Email preferences off → no Game started / Result email | [`tests/emails-024.test.ts`](../../tests/emails-024.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F02-9 | edge | F02 | R04 R05 R06 | S04 S06 S07 P05 P06 P07 P04 W03 W15 W31 S30 | Change passcode and Delete account on the device | <span style="color:#c62828">**GAP**</span> |  |  |
| F03-1 | happy | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Points game, 4 players, Full count 80 → scorecard S-number | [`e2e/smoke/09-new-game.yaml`](../../e2e/smoke/09-new-game.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F03-1 | happy | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Points game, 4 players, Full count 80 → scorecard S-number | [`supabase/tests/18_game_labels_028.sql`](../../supabase/tests/18_game_labels_028.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F03-1 | happy | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Points game, 4 players, Full count 80 → scorecard S-number | [`supabase/tests/28_game_numbers_038.sql`](../../supabase/tests/28_game_numbers_038.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F03-2 | happy | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Pool game: two-screen New game, limit + re-entries → P-number | [`e2e/smoke/16-pool-game.yaml`](../../e2e/smoke/16-pool-game.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F03-2 | happy | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Pool game: two-screen New game, limit + re-entries → P-number | [`tests/pool-pr13.test.ts`](../../tests/pool-pr13.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F03-2 | happy | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Pool game: two-screen New game, limit + re-entries → P-number | [`supabase/tests/32_pool_041.sql`](../../supabase/tests/32_pool_041.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F03-3 | happy | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Points with multiplier ×10 → chip on card and scorecard | [`e2e/smoke/18-multiplier-change.yaml`](../../e2e/smoke/18-multiplier-change.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F03-3 | happy | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Points with multiplier ×10 → chip on card and scorecard | [`tests/multiplier-pr14.test.ts`](../../tests/multiplier-pr14.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F03-3 | happy | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Points with multiplier ×10 → chip on card and scorecard | [`supabase/tests/34_multiplier_043.sql`](../../supabase/tests/34_multiplier_043.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F03-4 | edge | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Multiplier ×1,000+ → Large multiplier confirm once | [`tests/multiplier-pr14.test.ts`](../../tests/multiplier-pr14.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F03-5 | misuse | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Multiplier outside 1–10,000 or bad K/M form → problem line, Start off | [`tests/multiplier-pr14.test.ts`](../../tests/multiplier-pr14.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F03-6 | edge | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Two seated players share initials → Fix initials before Start | [`e2e/smoke/17-pool-wide-initials-20p.yaml`](../../e2e/smoke/17-pool-wide-initials-20p.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F03-6 | edge | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Two seated players share initials → Fix initials before Start | [`tests/initials-022.test.ts`](../../tests/initials-022.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F03-6 | edge | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Two seated players share initials → Fix initials before Start | [`supabase/tests/12_player_initials_022.sql`](../../supabase/tests/12_player_initials_022.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F03-7 | edge | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Co-admin nudge when a registered player is seated | [`tests/emails-024.test.ts`](../../tests/emails-024.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F03-8 | misuse | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | 11th live game / 51st game today refused by GRD01 | [`supabase/tests/19_guardrails_029.sql`](../../supabase/tests/19_guardrails_029.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F03-8 | misuse | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | 11th live game / 51st game today refused by GRD01 | [`tests/guardrails-029.test.ts`](../../tests/guardrails-029.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F03-9 | happy | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Game numbers reused once a game leaves Active; share code unique | [`supabase/tests/28_game_numbers_038.sql`](../../supabase/tests/28_game_numbers_038.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F03-9 | happy | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Game numbers reused once a game leaves Active; share code unique | [`tests/game-labels-028.test.ts`](../../tests/game-labels-028.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F03-10 | happy | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Game started email with live link to seated registered players | [`supabase/tests/14_emails_024.sql`](../../supabase/tests/14_emails_024.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F03-11 | edge | F03 | R07 R08 R09 R21 | S04 S10 S09 S11 W14 P47 P45 W28 E03 S14 P25 | Co-admin nudge and Large multiplier confirm on the device | <span style="color:#c62828">**GAP**</span> |  |  |
| F04-1 | happy | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Pick seated players from My players (search, recent first) | [`e2e/smoke/09-new-game.yaml`](../../e2e/smoke/09-new-game.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F04-1 | happy | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Pick seated players from My players (search, recent first) | [`tests/add-players-pr7.test.ts`](../../tests/add-players-pr7.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-1 | happy | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Pick seated players from My players (search, recent first) | [`supabase/tests/09_candidates_and_roster.sql`](../../supabase/tests/09_candidates_and_roster.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-2 | happy | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Add new players by initials, 3 at a time; initials are the name | [`e2e/smoke/09-new-game.yaml`](../../e2e/smoke/09-new-game.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F04-2 | happy | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Add new players by initials, 3 at a time; initials are the name | [`tests/initials-pr6.test.ts`](../../tests/initials-pr6.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-2 | happy | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Add new players by initials, 3 at a time; initials are the name | [`supabase/tests/29_initials_039.sql`](../../supabase/tests/29_initials_039.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-3 | edge | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Initials clash → stored SK2 with the exact sentence | [`e2e/smoke/09-new-game.yaml`](../../e2e/smoke/09-new-game.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F04-3 | edge | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Initials clash → stored SK2 with the exact sentence | [`tests/initials-pr6.test.ts`](../../tests/initials-pr6.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-3 | edge | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Initials clash → stored SK2 with the exact sentence | [`supabase/tests/29_initials_039.sql`](../../supabase/tests/29_initials_039.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-4 | misuse | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Digit first / 1 character refused by all four gates | [`tests/initials-pr6.test.ts`](../../tests/initials-pr6.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-4 | misuse | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Digit first / 1 character refused by all four gates | [`supabase/tests/29_initials_039.sql`](../../supabase/tests/29_initials_039.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-5 | happy | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | From database: search by name, initials or #ID, add to My players and seat | [`tests/nov10-owner.test.ts`](../../tests/nov10-owner.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-5 | happy | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | From database: search by name, initials or #ID, add to My players and seat | [`supabase/tests/20_my_players_scale_030.sql`](../../supabase/tests/20_my_players_scale_030.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-6 | happy | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Mid-game: Add players to this game → Return to game → columns appear with zeros | [`e2e/full/32-add-players-to-game.yaml`](../../e2e/full/32-add-players-to-game.yaml) | full | [pass · nightly Nov 15 (stale PR 19 branch)](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F04-6 | happy | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Mid-game: Add players to this game → Return to game → columns appear with zeros | [`tests/nov10-midgame.test.ts`](../../tests/nov10-midgame.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-7 | happy | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Link a seat to a Player ID → request email + Home card → Yes → Linked pop-up | [`tests/link-player-025.test.ts`](../../tests/link-player-025.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-7 | happy | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Link a seat to a Player ID → request email + Home card → Yes → Linked pop-up | [`supabase/tests/15_link_player_025.sql`](../../supabase/tests/15_link_player_025.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-7 | happy | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Link a seat to a Player ID → request email + Home card → Yes → Linked pop-up | [`supabase/tests/07_seat_takeover_017.sql`](../../supabase/tests/07_seat_takeover_017.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-8 | misuse | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Link refused when the account already plays in a game with this seat (sentence names the game) | [`tests/link-player-025.test.ts`](../../tests/link-player-025.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-8 | misuse | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Link refused when the account already plays in a game with this seat (sentence names the game) | [`supabase/tests/15_link_player_025.sql`](../../supabase/tests/15_link_player_025.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-9 | misuse | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | 21st seat / 101st new player today / 1,001st roster row refused | [`supabase/tests/19_guardrails_029.sql`](../../supabase/tests/19_guardrails_029.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-9 | misuse | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | 21st seat / 101st new player today / 1,001st roster row refused | [`tests/guardrails-029.test.ts`](../../tests/guardrails-029.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-9 | misuse | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | 21st seat / 101st new player today / 1,001st roster row refused | [`tests/my-players-scale-030.test.ts`](../../tests/my-players-scale-030.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-10 | happy | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Claim link → remember token → sign up → One quick check accepted | [`tests/player-identity.test.ts`](../../tests/player-identity.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F04-11 | edge | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Unsaved letters dialog on Back | <span style="color:#c62828">**GAP**</span> |  |  |
| F04-12 | edge | F04 | R10 R11 R12 R13 | S10 S12 S13 S05 P60 P48 P05 W15 W16 W27 W28 P10 P11 E05 S27 P01 S24 P02 P13 P08 P15 W17 W07 P46 | Link to Player ID and claim flows on the device (two accounts) | <span style="color:#c62828">**GAP**</span> |  |  |
| F05-1 | happy | F05 | R14 | S14 P25 W18 P18 S17 | Pop-up after Start: pick the order → columns follow it | [`e2e/smoke/19-seating-order.yaml`](../../e2e/smoke/19-seating-order.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F05-1 | happy | F05 | R14 | S14 P25 W18 P18 S17 | Pop-up after Start: pick the order → columns follow it | [`tests/seating-pr21.test.ts`](../../tests/seating-pr21.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F05-1 | happy | F05 | R14 | S14 P25 W18 P18 S17 | Pop-up after Start: pick the order → columns follow it | [`supabase/tests/35_seating_order_044.sql`](../../supabase/tests/35_seating_order_044.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F05-2 | happy | F05 | R14 | S14 P25 W18 P18 S17 | Keep this order (default) → nothing changes | [`e2e/smoke/19-seating-order.yaml`](../../e2e/smoke/19-seating-order.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F05-2 | happy | F05 | R14 | S14 P25 W18 P18 S17 | Keep this order (default) → nothing changes | [`tests/seating-pr21.test.ts`](../../tests/seating-pr21.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F05-3 | happy | F05 | R14 | S14 P25 W18 P18 S17 | Rearrange mid-game from ⋮; dealer follows the new order | [`tests/seating-pr21.test.ts`](../../tests/seating-pr21.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F05-3 | happy | F05 | R14 | S14 P25 W18 P18 S17 | Rearrange mid-game from ⋮; dealer follows the new order | [`supabase/tests/35_seating_order_044.sql`](../../supabase/tests/35_seating_order_044.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F05-3 | happy | F05 | R14 | S14 P25 W18 P18 S17 | Rearrange mid-game from ⋮; dealer follows the new order | [`tests/dealer-rotation-031.test.ts`](../../tests/dealer-rotation-031.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F05-4 | edge | F05 | R14 | S14 P25 W18 P18 S17 | 20 players: sheet scrolls, every chip reachable | [`e2e/full/51-seating-20p.yaml`](../../e2e/full/51-seating-20p.yaml) | full | [pass · nightly Nov 15 (stale PR 19 branch)](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F05-5 | misuse | F05 | R14 | S14 P25 W18 P18 S17 | Non-admin cannot change the order (RPC refused) | [`supabase/tests/35_seating_order_044.sql`](../../supabase/tests/35_seating_order_044.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F05-6 | happy | F05 | R14 | S14 P25 W18 P18 S17 | Log row "Seating changed" | [`supabase/tests/35_seating_order_044.sql`](../../supabase/tests/35_seating_order_044.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F05-6 | happy | F05 | R14 | S14 P25 W18 P18 S17 | Log row "Seating changed" | [`tests/seating-pr21.test.ts`](../../tests/seating-pr21.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F06-1 | happy | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Three drops + Rummy → Balance 0 → Save → row appears | [`e2e/smoke/04-add-round.yaml`](../../e2e/smoke/04-add-round.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F06-1 | happy | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Three drops + Rummy → Balance 0 → Save → row appears | [`tests/scoring.test.ts`](../../tests/scoring.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F06-1 | happy | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Three drops + Rummy → Balance 0 → Save → row appears | [`supabase/tests/05_save_round_014.sql`](../../supabase/tests/05_save_round_014.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F06-2 | edge | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Count ≥ half / ≥ Full → amber / red line; over the Full count asked once per cell | [`e2e/full/80-add-round-count-warnings.yaml`](../../e2e/full/80-add-round-count-warnings.yaml) | full | [fail · nightly Nov 15 on stale PR 19 branch](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F06-2 | edge | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Count ≥ half / ≥ Full → amber / red line; over the Full count asked once per cell | [`tests/add-round-pr3.test.ts`](../../tests/add-round-pr3.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F06-3 | edge | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Rummy with a positive pot → share ≤ 0 → confirm → saved negative | [`e2e/smoke/14-rummy-positive-pot.yaml`](../../e2e/smoke/14-rummy-positive-pot.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F06-3 | edge | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Rummy with a positive pot → share ≤ 0 → confirm → saved negative | [`tests/rummy-distribution.test.ts`](../../tests/rummy-distribution.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F06-3 | edge | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Rummy with a positive pot → share ≤ 0 → confirm → saved negative | [`supabase/tests/27_rummy_negative_037.sql`](../../supabase/tests/27_rummy_negative_037.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F06-4 | edge | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Two admins save the same round: one wins, the other sees the named PT409 message | [`supabase/tests/25_undo_035.sql`](../../supabase/tests/25_undo_035.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F06-4 | edge | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Two admins save the same round: one wins, the other sees the named PT409 message | [`tests/security-concurrency-019.test.ts`](../../tests/security-concurrency-019.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F06-4 | edge | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Two admins save the same round: one wins, the other sees the named PT409 message | [`e2e/two-device/b-save-now.yaml`](../../e2e/two-device/b-save-now.yaml) | two-device | [fail · non-blocking, PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F06-4 | edge | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Two admins save the same round: one wins, the other sees the named PT409 message | [`e2e/two-device/c-verify-one-round.yaml`](../../e2e/two-device/c-verify-one-round.yaml) | two-device | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F06-5 | happy | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Dealer rotates by seat / seating order; a mid-game joiner lengthens the rotation | [`tests/dealer-rotation-031.test.ts`](../../tests/dealer-rotation-031.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F06-5 | happy | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Dealer rotates by seat / seating order; a mid-game joiner lengthens the rotation | [`supabase/tests/21_round_robin_031.sql`](../../supabase/tests/21_round_robin_031.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F06-6 | edge | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Rapid double Save taps → one round | [`e2e/chaos/c01-rapid-save-taps.yaml`](../../e2e/chaos/c01-rapid-save-taps.yaml) | chaos | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F06-6 | edge | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Rapid double Save taps → one round | [`supabase/tests/05_save_round_014.sql`](../../supabase/tests/05_save_round_014.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F06-7 | misuse | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Round 501 refused (GRD01) | [`supabase/tests/19_guardrails_029.sql`](../../supabase/tests/19_guardrails_029.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F06-7 | misuse | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Round 501 refused (GRD01) | [`tests/guardrails-029.test.ts`](../../tests/guardrails-029.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F06-8 | edge | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Huge numbers / bad input in a cell | [`e2e/chaos/c04-huge-numbers.yaml`](../../e2e/chaos/c04-huge-numbers.yaml) | chaos | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F06-8 | edge | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Huge numbers / bad input in a cell | [`e2e/chaos/c03-bad-input.yaml`](../../e2e/chaos/c03-bad-input.yaml) | chaos | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F06-9 | happy | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Realtime: the other phone sees the round within a few seconds | [`e2e/two-device/t1-realtime-add.yaml`](../../e2e/two-device/t1-realtime-add.yaml) | two-device | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F06-9 | happy | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | Realtime: the other phone sees the round within a few seconds | [`e2e/two-device/t1-a-expect.yaml`](../../e2e/two-device/t1-a-expect.yaml) | two-device | [fail · non-blocking, PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F06-10 | happy | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | 20 players × 60 rounds scorecard stays usable | [`e2e/chaos/c09-big-scorecard-20x60.yaml`](../../e2e/chaos/c09-big-scorecard-20x60.yaml) | chaos | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F06-10 | happy | F06 | R15 R16 R17 | S14 S15 W12 W13 P31 P33 P34 W38 W28 S25 | 20 players × 60 rounds scorecard stays usable | [`e2e/full/20-scorecard-20-players-swipe.yaml`](../../e2e/full/20-scorecard-20-players-swipe.yaml) | full | [pass · nightly Nov 15 (stale PR 19 branch)](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F07-1 | happy | F07 | R18 R19 | S14 P18 P19 P20 S15 P34 S17 W24 | Undo last round → Add round saves the same number again | [`e2e/smoke/13-undo-then-add-round.yaml`](../../e2e/smoke/13-undo-then-add-round.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F07-1 | happy | F07 | R18 R19 | S14 P18 P19 P20 S15 P34 S17 W24 | Undo last round → Add round saves the same number again | [`tests/undo-round-035.test.ts`](../../tests/undo-round-035.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F07-1 | happy | F07 | R18 R19 | S14 P18 P19 P20 S15 P34 S17 W24 | Undo last round → Add round saves the same number again | [`supabase/tests/25_undo_035.sql`](../../supabase/tests/25_undo_035.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F07-2 | happy | F07 | R18 R19 | S14 P18 P19 P20 S15 P34 S17 W24 | Edit round N → old row retired, Log shows Was / Now | [`e2e/full/70-game-log.yaml`](../../e2e/full/70-game-log.yaml) | full | [fail · nightly Nov 15 on stale PR 19 branch](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F07-2 | happy | F07 | R18 R19 | S14 P18 P19 P20 S15 P34 S17 W24 | Edit round N → old row retired, Log shows Was / Now | [`tests/nov11-rounds.test.ts`](../../tests/nov11-rounds.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F07-2 | happy | F07 | R18 R19 | S14 P18 P19 P20 S15 P34 S17 W24 | Edit round N → old row retired, Log shows Was / Now | [`supabase/tests/26_event_log_036.sql`](../../supabase/tests/26_event_log_036.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F07-3 | edge | F07 | R18 R19 | S14 P18 P19 P20 S15 P34 S17 W24 | Undo three times then round 1 again | [`supabase/tests/25_undo_035.sql`](../../supabase/tests/25_undo_035.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F07-4 | edge | F07 | R18 R19 | S14 P18 P19 P20 S15 P34 S17 W24 | Undo while another admin types → their Save refused with the refresh message | [`supabase/tests/25_undo_035.sql`](../../supabase/tests/25_undo_035.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F07-4 | edge | F07 | R18 R19 | S14 P18 P19 P20 S15 P34 S17 W24 | Undo while another admin types → their Save refused with the refresh message | [`tests/security-concurrency-019.test.ts`](../../tests/security-concurrency-019.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F07-5 | misuse | F07 | R18 R19 | S14 P18 P19 P20 S15 P34 S17 W24 | Player (non-admin) cannot undo (42501) | [`supabase/tests/25_undo_035.sql`](../../supabase/tests/25_undo_035.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F07-5 | misuse | F07 | R18 R19 | S14 P18 P19 P20 S15 P34 S17 W24 | Player (non-admin) cannot undo (42501) | [`e2e/roles/r01-player-view-only.yaml`](../../e2e/roles/r01-player-view-only.yaml) | roles | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F07-6 | edge | F07 | R18 R19 | S14 P18 P19 P20 S15 P34 S17 W24 | Edit / undo a game inside a saved result → result_changed row + amber line | [`supabase/tests/26_event_log_036.sql`](../../supabase/tests/26_event_log_036.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F07-6 | edge | F07 | R18 R19 | S14 P18 P19 P20 S15 P34 S17 W24 | Edit / undo a game inside a saved result → result_changed row + amber line | [`tests/event-log-036.test.ts`](../../tests/event-log-036.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F07-7 | edge | F07 | R18 R19 | S14 P18 P19 P20 S15 P34 S17 W24 | Edit which round? dialog on the device (pick an older round) | <span style="color:#c62828">**GAP**</span> |  |  |
| F08-1 | happy | F08 | R20 R21 | S14 P18 P26 P27 W11 P28 S17 W19 S20 S23 | Change ×1 → ×10 with rounds → confirm → whole game re-valued | [`e2e/smoke/18-multiplier-change.yaml`](../../e2e/smoke/18-multiplier-change.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F08-1 | happy | F08 | R20 R21 | S14 P18 P26 P27 W11 P28 S17 W19 S20 S23 | Change ×1 → ×10 with rounds → confirm → whole game re-valued | [`tests/multiplier-pr14.test.ts`](../../tests/multiplier-pr14.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F08-1 | happy | F08 | R20 R21 | S14 P18 P26 P27 W11 P28 S17 W19 S20 S23 | Change ×1 → ×10 with rounds → confirm → whole game re-valued | [`supabase/tests/34_multiplier_043.sql`](../../supabase/tests/34_multiplier_043.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F08-2 | happy | F08 | R20 R21 | S14 P18 P26 P27 W11 P28 S17 W19 S20 S23 | Chip, entered-points banner and Exact points sheet | [`e2e/smoke/18-multiplier-change.yaml`](../../e2e/smoke/18-multiplier-change.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F08-2 | happy | F08 | R20 R21 | S14 P18 P26 P27 W11 P28 S17 W19 S20 S23 | Chip, entered-points banner and Exact points sheet | [`tests/multiplier-pr14.test.ts`](../../tests/multiplier-pr14.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F08-3 | edge | F08 | R20 R21 | S14 P18 P26 P27 W11 P28 S17 W19 S20 S23 | ×1,000 / ×10,000 display (K / M, ≤ 5 characters) on 20 players | [`e2e/full/50-multiplier-20p.yaml`](../../e2e/full/50-multiplier-20p.yaml) | full | [pass · nightly Nov 15 (stale PR 19 branch)](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F08-3 | edge | F08 | R20 R21 | S14 P18 P26 P27 W11 P28 S17 W19 S20 S23 | ×1,000 / ×10,000 display (K / M, ≤ 5 characters) on 20 players | [`tests/multiplier-pr14.test.ts`](../../tests/multiplier-pr14.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F08-4 | misuse | F08 | R20 R21 | S14 P18 P26 P27 W11 P28 S17 W19 S20 S23 | Non-admin cannot change; value outside 1–10,000 refused | [`supabase/tests/34_multiplier_043.sql`](../../supabase/tests/34_multiplier_043.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F08-4 | misuse | F08 | R20 R21 | S14 P18 P26 P27 W11 P28 S17 W19 S20 S23 | Non-admin cannot change; value outside 1–10,000 refused | [`tests/multiplier-pr14.test.ts`](../../tests/multiplier-pr14.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F08-5 | happy | F08 | R20 R21 | S14 P18 P26 P27 W11 P28 S17 W19 S20 S23 | Final scores, share image, PDF and /r/ show the multiplied values | [`tests/multiplier-pr14.test.ts`](../../tests/multiplier-pr14.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F08-5 | happy | F08 | R20 R21 | S14 P18 P26 P27 W11 P28 S17 W19 S20 S23 | Final scores, share image, PDF and /r/ show the multiplied values | [`tests/final-scores.test.ts`](../../tests/final-scores.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F08-6 | happy | F08 | R20 R21 | S14 P18 P26 P27 W11 P28 S17 W19 S20 S23 | Log row "Multiplier changed ×1 → ×10" | [`supabase/tests/34_multiplier_043.sql`](../../supabase/tests/34_multiplier_043.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F08-6 | happy | F08 | R20 R21 | S14 P18 P26 P27 W11 P28 S17 W19 S20 S23 | Log row "Multiplier changed ×1 → ×10" | [`tests/multiplier-pr14.test.ts`](../../tests/multiplier-pr14.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F09-1 | happy | F09 | R22 R23 R24 | S14 S15 P32 W35 W10 P31 W19 P40 | Pool round: player crosses the limit → Round saved sheet says who is out → OUT chip | [`e2e/smoke/16-pool-game.yaml`](../../e2e/smoke/16-pool-game.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F09-1 | happy | F09 | R22 R23 R24 | S14 S15 P32 W35 W10 P31 W19 P40 | Pool round: player crosses the limit → Round saved sheet says who is out → OUT chip | [`tests/pool-pr13.test.ts`](../../tests/pool-pr13.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F09-1 | happy | F09 | R22 R23 R24 | S14 S15 P32 W35 W10 P31 W19 P40 | Pool round: player crosses the limit → Round saved sheet says who is out → OUT chip | [`supabase/tests/32_pool_041.sql`](../../supabase/tests/32_pool_041.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F09-2 | happy | F09 | R22 R23 R24 | S14 S15 P32 W35 W10 P31 W19 P40 | Re-enter (Unlimited) at the highest live total | [`e2e/smoke/16-pool-game.yaml`](../../e2e/smoke/16-pool-game.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F09-2 | happy | F09 | R22 R23 R24 | S14 S15 P32 W35 W10 P31 W19 P40 | Re-enter (Unlimited) at the highest live total | [`supabase/tests/33_pool_reentries_042.sql`](../../supabase/tests/33_pool_reentries_042.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F09-2 | happy | F09 | R22 R23 R24 | S14 S15 P32 W35 W10 P31 W19 P40 | Re-enter (Unlimited) at the highest live total | [`tests/pool-pr13.test.ts`](../../tests/pool-pr13.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F09-3 | edge | F09 | R22 R23 R24 | S14 S15 P32 W35 W10 P31 W19 P40 | Limited re-entries: N used → Re-enter gone, message (F3 fix) | [`supabase/tests/33_pool_reentries_042.sql`](../../supabase/tests/33_pool_reentries_042.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F09-3 | edge | F09 | R22 R23 R24 | S14 S15 P32 W35 W10 P31 W19 P40 | Limited re-entries: N used → Re-enter gone, message (F3 fix) | [`tests/test-findings-pr19.test.ts`](../../tests/test-findings-pr19.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F09-4 | edge | F09 | R22 R23 R24 | S14 S15 P32 W35 W10 P31 W19 P40 | Everyone out / one left → Complete offered; Give awards | [`e2e/chaos/c10-pool-everyone-out.yaml`](../../e2e/chaos/c10-pool-everyone-out.yaml) | chaos | [fail · non-blocking, PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F09-4 | edge | F09 | R22 R23 R24 | S14 S15 P32 W35 W10 P31 W19 P40 | Everyone out / one left → Complete offered; Give awards | [`supabase/tests/32_pool_041.sql`](../../supabase/tests/32_pool_041.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F09-5 | misuse | F09 | R22 R23 R24 | S14 S15 P32 W35 W10 P31 W19 P40 | Pool settings locked after round 1 (PT423); spectator cannot re-enter anyone | [`supabase/tests/33_pool_reentries_042.sql`](../../supabase/tests/33_pool_reentries_042.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F09-5 | misuse | F09 | R22 R23 R24 | S14 S15 P32 W35 W10 P31 W19 P40 | Pool settings locked after round 1 (PT423); spectator cannot re-enter anyone | [`e2e/roles/r02-spectator-pool.yaml`](../../e2e/roles/r02-spectator-pool.yaml) | roles | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F09-6 | edge | F09 | R22 R23 R24 | S14 S15 P32 W35 W10 P31 W19 P40 | 20 players wide initials in the pool strip | [`e2e/smoke/17-pool-wide-initials-20p.yaml`](../../e2e/smoke/17-pool-wide-initials-20p.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F09-6 | edge | F09 | R22 R23 R24 | S14 S15 P32 W35 W10 P31 W19 P40 | 20 players wide initials in the pool strip | [`tests/initials-fit.test.ts`](../../tests/initials-fit.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F09-7 | edge | F09 | R22 R23 R24 | S14 S15 P32 W35 W10 P31 W19 P40 | Re-entry a second time after going out again (Unlimited) on the device | <span style="color:#c62828">**GAP**</span> |  |  |
| F10-1 | happy | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Complete a Points game → one dialog → Final screen (Share + Done) → Done = Home; header arrow = completed scorecard | [`e2e/smoke/05-complete-game.yaml`](../../e2e/smoke/05-complete-game.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F10-1 | happy | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Complete a Points game → one dialog → Final screen (Share + Done) → Done = Home; header arrow = completed scorecard | [`tests/final-scores.test.ts`](../../tests/final-scores.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F10-1 | happy | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Complete a Points game → one dialog → Final screen (Share + Done) → Done = Home; header arrow = completed scorecard | [`tests/nov18-end-flow.test.ts`](../../tests/nov18-end-flow.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F10-1 | happy | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Complete a Points game → one dialog → Final screen (Share + Done) → Done = Home; header arrow = completed scorecard | [`supabase/tests/02_games_visibility.sql`](../../supabase/tests/02_games_visibility.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F10-2 | happy | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Complete a pool → Awards (Not now / Save awards) → Final screen with the Awards card → Done = Home | [`e2e/smoke/16-pool-game.yaml`](../../e2e/smoke/16-pool-game.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F10-2 | happy | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Complete a pool → Awards (Not now / Save awards) → Final screen with the Awards card → Done = Home | [`tests/pool-pr13.test.ts`](../../tests/pool-pr13.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F10-2 | happy | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Complete a pool → Awards (Not now / Save awards) → Final screen with the Awards card → Done = Home | [`tests/nov18-end-flow.test.ts`](../../tests/nov18-end-flow.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F10-2 | happy | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Complete a pool → Awards (Not now / Save awards) → Final screen with the Awards card → Done = Home | [`supabase/tests/32_pool_041.sql`](../../supabase/tests/32_pool_041.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F10-3 | edge | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Not all given out → save anyway; preset not viable → Not for this pool | [`e2e/smoke/16-pool-game.yaml`](../../e2e/smoke/16-pool-game.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F10-3 | edge | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Not all given out → save anyway; preset not viable → Not for this pool | [`tests/pool-pr13.test.ts`](../../tests/pool-pr13.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F10-4 | edge | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Double Complete taps → one completion | [`e2e/chaos/c02-double-complete.yaml`](../../e2e/chaos/c02-double-complete.yaml) | chaos | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F10-5 | happy | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | A pool without awards is "Completed" (no nag); the Results picker says Give awards first when it is picked | [`tests/pool-pr13.test.ts`](../../tests/pool-pr13.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F10-5 | happy | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | A pool without awards is "Completed" (no nag); the Results picker says Give awards first when it is picked | [`tests/nov18-end-flow.test.ts`](../../tests/nov18-end-flow.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F10-5 | happy | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | A pool without awards is "Completed" (no nag); the Results picker says Give awards first when it is picked | [`supabase/tests/32_pool_041.sql`](../../supabase/tests/32_pool_041.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F10-10 | happy | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Full-details PDF carries the pool: limit, drops, pool scores, entries, put in, gets, awards, out rounds, re-entries, every round | [`tests/nov18-end-flow.test.ts`](../../tests/nov18-end-flow.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F10-11 | edge | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Points round does not add to 0 → "Fix round N first" → Edit round | [`tests/design-tokens.test.ts`](../../tests/design-tokens.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F10-6 | happy | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Reopen a Completed (not Closed) game as admin | [`tests/archive.test.ts`](../../tests/archive.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F10-6 | happy | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Reopen a Completed (not Closed) game as admin | [`supabase/tests/13_hide_delete_023.sql`](../../supabase/tests/13_hide_delete_023.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F10-7 | misuse | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Non-admin cannot complete or reopen | [`e2e/roles/r01-player-view-only.yaml`](../../e2e/roles/r01-player-view-only.yaml) | roles | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F10-7 | misuse | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Non-admin cannot complete or reopen | [`supabase/tests/02_games_visibility.sql`](../../supabase/tests/02_games_visibility.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F10-8 | edge | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Complete with 20 players: Standings fit (F6) | [`tests/test-findings-pr19.test.ts`](../../tests/test-findings-pr19.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F10-8 | edge | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Complete with 20 players: Standings fit (F6) | [`e2e/smoke/17-pool-wide-initials-20p.yaml`](../../e2e/smoke/17-pool-wide-initials-20p.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F10-9 | edge | F10 | R25 R26 R27 | S14 S15 P40 P41 S19 P42 P43 W20 W36 S20 S21 P50 P22 P44 W08 W32 S04 P24 | Reopen dialog on the device | <span style="color:#c62828">**GAP**</span> |  |  |
| F11-1 | happy | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Share result picture → preview → OS sheet; generated-by initials | [`e2e/full/41-share-images.yaml`](../../e2e/full/41-share-images.yaml) | full | [fail · nightly Nov 15 on stale PR 19 branch](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F11-1 | happy | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Share result picture → preview → OS sheet; generated-by initials | [`tests/results-design.test.ts`](../../tests/results-design.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-1 | happy | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Share result picture → preview → OS sheet; generated-by initials | [`tests/results-share-unsaved.test.ts`](../../tests/results-share-unsaved.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-2 | happy | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Share PDF (phone-sized pages) for a result; Rounds PDF for one game | [`tests/results-design.test.ts`](../../tests/results-design.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-2 | happy | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Share PDF (phone-sized pages) for a result; Rounds PDF for one game | [`tests/final-scores.test.ts`](../../tests/final-scores.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-3 | happy | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Copy link → toast; /r/ page shows the same result read-only | [`tests/results-design.test.ts`](../../tests/results-design.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-3 | happy | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Copy link → toast; /r/ page shows the same result read-only | [`supabase/tests/24_results_design_034.sql`](../../supabase/tests/24_results_design_034.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-3 | happy | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Copy link → toast; /r/ page shows the same result read-only | [`supabase/tests/08_public_scorecard.sql`](../../supabase/tests/08_public_scorecard.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-4 | happy | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Live scorecard page (signed out) follows rounds; Changes card | [`supabase/tests/08_public_scorecard.sql`](../../supabase/tests/08_public_scorecard.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-4 | happy | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Live scorecard page (signed out) follows rounds; Changes card | [`supabase/tests/26_event_log_036.sql`](../../supabase/tests/26_event_log_036.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-4 | happy | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Live scorecard page (signed out) follows rounds; Changes card | [`tests/volume-client.test.ts`](../../tests/volume-client.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-5 | edge | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Deleted / edited result → /r/ banner and version links | [`supabase/tests/24_results_design_034.sql`](../../supabase/tests/24_results_design_034.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-5 | edge | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Deleted / edited result → /r/ banner and version links | [`supabase/tests/30_results_delete.sql`](../../supabase/tests/30_results_delete.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-6 | misuse | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Anon can call only the allow-listed RPCs | [`supabase/tests/23_security_033.sql`](../../supabase/tests/23_security_033.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-6 | misuse | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Anon can call only the allow-listed RPCs | [`tests/security-033.test.ts`](../../tests/security-033.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-7 | edge | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Share before Save carries the "Not saved yet" banner on picture and PDF | [`tests/results-share-unsaved.test.ts`](../../tests/results-share-unsaved.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-7 | edge | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Share before Save carries the "Not saved yet" banner on picture and PDF | [`e2e/smoke/06-results.yaml`](../../e2e/smoke/06-results.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F11-8 | happy | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Final screen Share: the picture (final scores, or the awards for an awarded pool) or the full-details PDF; nothing else | [`e2e/smoke/05-complete-game.yaml`](../../e2e/smoke/05-complete-game.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F11-8 | happy | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Final screen Share: the picture (final scores, or the awards for an awarded pool) or the full-details PDF; nothing else | [`tests/final-scores.test.ts`](../../tests/final-scores.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-8 | happy | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Final screen Share: the picture (final scores, or the awards for an awarded pool) or the full-details PDF; nothing else | [`tests/nov18-end-flow.test.ts`](../../tests/nov18-end-flow.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F11-9 | edge | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Email a scorecard (send-email kind scorecard) end to end | <span style="color:#c62828">**GAP**</span> |  |  |
| F11-10 | edge | F11 | R28 R29 R30 | S14 S20 S23 P24 P58 P29 P35 S25 S26 W33 W34 E07 P55 S29 S31 S32 | Web pages in a real browser (Playwright) — /r/, scorecard.html, link.html, unsubscribe.html | <span style="color:#c62828">**GAP**</span> |  |  |
| F12-1 | happy | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Make a seated player admin → they can score | [`e2e/full/30-players-admins-and-settings.yaml`](../../e2e/full/30-players-admins-and-settings.yaml) | full | [pass · nightly Nov 15 (stale PR 19 branch)](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F12-1 | happy | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Make a seated player admin → they can score | [`tests/game-admins.test.ts`](../../tests/game-admins.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F12-1 | happy | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Make a seated player admin → they can score | [`supabase/tests/02_games_visibility.sql`](../../supabase/tests/02_games_visibility.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F12-2 | happy | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Add non-playing admin by Player ID → listed under Admins not playing, no column | [`e2e/full/32-add-players-to-game.yaml`](../../e2e/full/32-add-players-to-game.yaml) | full | [pass · nightly Nov 15 (stale PR 19 branch)](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F12-2 | happy | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Add non-playing admin by Player ID → listed under Admins not playing, no column | [`tests/game-admins.test.ts`](../../tests/game-admins.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F12-3 | happy | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Player (non-admin) sees the scorecard read-only: no Add round / Undo / Complete | [`e2e/roles/r01-player-view-only.yaml`](../../e2e/roles/r01-player-view-only.yaml) | roles | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F12-3 | happy | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Player (non-admin) sees the scorecard read-only: no Add round / Undo / Complete | [`supabase/tests/02_games_visibility.sql`](../../supabase/tests/02_games_visibility.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F12-4 | happy | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Spectator on a pool: standings visible, no Re-enter | [`e2e/roles/r02-spectator-pool.yaml`](../../e2e/roles/r02-spectator-pool.yaml) | roles | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F12-5 | misuse | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Outsider sees none of the games (RLS, bundles) | [`e2e/roles/r03-outsider-no-break-games.yaml`](../../e2e/roles/r03-outsider-no-break-games.yaml) | roles | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F12-5 | misuse | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Outsider sees none of the games (RLS, bundles) | [`supabase/tests/10_bundles_020.sql`](../../supabase/tests/10_bundles_020.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F12-5 | misuse | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Outsider sees none of the games (RLS, bundles) | [`supabase/tests/02_games_visibility.sql`](../../supabase/tests/02_games_visibility.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F12-6 | happy | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Non-playing admin can add rounds and complete | [`e2e/roles/r04-nonplaying-admin.yaml`](../../e2e/roles/r04-nonplaying-admin.yaml) | roles | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F12-7 | edge | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Remove a seat: allowed only when every round score is 0 | [`tests/seat-removal.test.ts`](../../tests/seat-removal.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F12-7 | edge | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Remove a seat: allowed only when every round score is 0 | [`supabase/tests/06_seat_removal_016.sql`](../../supabase/tests/06_seat_removal_016.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F12-8 | misuse | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Self-promotion to app admin refused; contact columns owner-only | [`supabase/tests/04_profiles_privacy.sql`](../../supabase/tests/04_profiles_privacy.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F12-8 | misuse | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Self-promotion to app admin refused; contact columns owner-only | [`tests/security-concurrency-019.test.ts`](../../tests/security-concurrency-019.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F12-9 | edge | F12 | R31 R32 R33 | S14 S16 P14 P39 P36 P37 P12 P09 P10 W16 W40 S04 P38 | Remove player blocked dialog and Edit name on the device | <span style="color:#c62828">**GAP**</span> |  |  |
| F13-1 | happy | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Hide game → off my Home only; others unchanged; Unhide from Hidden & deleted | [`tests/archive.test.ts`](../../tests/archive.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-1 | happy | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Hide game → off my Home only; others unchanged; Unhide from Hidden & deleted | [`supabase/tests/13_hide_delete_023.sql`](../../supabase/tests/13_hide_delete_023.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-2 | happy | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Delete game (admin) → dialog body "Nothing is lost for 30 days" → gone from Home for everyone | [`e2e/roles/r05-deleted-game-ask-restore.yaml`](../../e2e/roles/r05-deleted-game-ask-restore.yaml) | roles | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F13-2 | happy | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Delete game (admin) → dialog body "Nothing is lost for 30 days" → gone from Home for everyone | [`tests/going-rogue.test.ts`](../../tests/going-rogue.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-2 | happy | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Delete game (admin) → dialog body "Nothing is lost for 30 days" → gone from Home for everyone | [`supabase/tests/36_going_rogue_045.sql`](../../supabase/tests/36_going_rogue_045.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-3 | happy | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Player who scored sees it under Deleted games, opens read-only, Ask to restore → toast + email | [`e2e/roles/r05-deleted-game-ask-restore.yaml`](../../e2e/roles/r05-deleted-game-ask-restore.yaml) | roles | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F13-3 | happy | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Player who scored sees it under Deleted games, opens read-only, Ask to restore → toast + email | [`tests/going-rogue.test.ts`](../../tests/going-rogue.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-3 | happy | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Player who scored sees it under Deleted games, opens read-only, Ask to restore → toast + email | [`supabase/tests/36_going_rogue_045.sql`](../../supabase/tests/36_going_rogue_045.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-4 | happy | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Creator sees "Player One asked to restore it" → Restore → Game restored, back on Home | [`e2e/roles/r05-deleted-game-ask-restore.yaml`](../../e2e/roles/r05-deleted-game-ask-restore.yaml) | roles | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F13-4 | happy | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Creator sees "Player One asked to restore it" → Restore → Game restored, back on Home | [`supabase/tests/36_going_rogue_045.sql`](../../supabase/tests/36_going_rogue_045.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-5 | edge | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Deleted game in a saved result → result re-totals, "S5 removed" version | [`supabase/tests/24_results_design_034.sql`](../../supabase/tests/24_results_design_034.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-5 | edge | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Deleted game in a saved result → result re-totals, "S5 removed" version | [`supabase/tests/13_hide_delete_023.sql`](../../supabase/tests/13_hide_delete_023.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-6 | misuse | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Outsider / non-scorer cannot read a deleted game | [`supabase/tests/36_going_rogue_045.sql`](../../supabase/tests/36_going_rogue_045.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-6 | misuse | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Outsider / non-scorer cannot read a deleted game | [`supabase/tests/13_hide_delete_023.sql`](../../supabase/tests/13_hide_delete_023.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-7 | edge | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | 30-day step (046): hidden for good, nothing deleted; support can still find it; restore refused with PT410 | [`supabase/tests/37_no_permanent_delete_046.sql`](../../supabase/tests/37_no_permanent_delete_046.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-7 | edge | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | 30-day step (046): hidden for good, nothing deleted; support can still find it; restore refused with PT410 | [`supabase/tests/36_going_rogue_045.sql`](../../supabase/tests/36_going_rogue_045.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-7 | edge | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | 30-day step (046): hidden for good, nothing deleted; support can still find it; restore refused with PT410 | [`tests/no-permanent-delete-pr22.test.ts`](../../tests/no-permanent-delete-pr22.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-8 | happy | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Log rows: Game deleted · Restore asked · Game restored | [`supabase/tests/36_going_rogue_045.sql`](../../supabase/tests/36_going_rogue_045.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-8 | happy | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Log rows: Game deleted · Restore asked · Game restored | [`tests/going-rogue.test.ts`](../../tests/going-rogue.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-9 | happy | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Support card with support@ezscore.app on Hidden & deleted | [`tests/going-rogue.test.ts`](../../tests/going-rogue.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F13-10 | edge | F13 | R34 R35 R36 R37 | S14 P18 P21 P23 S04 W04 W09 W39 P03 E06 S08 W30 P59 S17 W24 | Hidden & deleted screen on the device (Unhide, Restore, toast) | <span style="color:#c62828">**GAP**</span> |  |  |
| F14-1 | edge | F14 | R38 R39 | S04 S14 S15 W29 W37 P34 S01 | Save with the network off → clear message, nothing half-written | [`e2e/chaos/c05-offline-save--net-off.yaml`](../../e2e/chaos/c05-offline-save--net-off.yaml) | chaos | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F14-1 | edge | F14 | R38 R39 | S04 S14 S15 W29 W37 P34 S01 | Save with the network off → clear message, nothing half-written | [`tests/degrade.test.ts`](../../tests/degrade.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F14-2 | edge | F14 | R38 R39 | S04 S14 S15 W29 W37 P34 S01 | Reconnect → retry saves exactly one round | [`e2e/chaos/c06-reconnect-retry.yaml`](../../e2e/chaos/c06-reconnect-retry.yaml) | chaos | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F14-2 | edge | F14 | R38 R39 | S04 S14 S15 W29 W37 P34 S01 | Reconnect → retry saves exactly one round | [`supabase/tests/05_save_round_014.sql`](../../supabase/tests/05_save_round_014.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F14-3 | edge | F14 | R38 R39 | S04 S14 S15 W29 W37 P34 S01 | Kill the app mid-save → after relaunch the scorecard is consistent | [`e2e/chaos/c07-kill-mid-save--kill-after.yaml`](../../e2e/chaos/c07-kill-mid-save--kill-after.yaml) | chaos | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F14-3 | edge | F14 | R38 R39 | S04 S14 S15 W29 W37 P34 S01 | Kill the app mid-save → after relaunch the scorecard is consistent | [`e2e/chaos/c08-after-kill-consistent.yaml`](../../e2e/chaos/c08-after-kill-consistent.yaml) | chaos | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F14-4 | edge | F14 | R38 R39 | S04 S14 S15 W29 W37 P34 S01 | Launch offline with a session → cached Home, no sign-out | [`e2e/chaos/c11-launch-offline--net-off.yaml`](../../e2e/chaos/c11-launch-offline--net-off.yaml) | chaos | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F14-4 | edge | F14 | R38 R39 | S04 S14 S15 W29 W37 P34 S01 | Launch offline with a session → cached Home, no sign-out | [`tests/test-findings-pr19.test.ts`](../../tests/test-findings-pr19.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F14-5 | happy | F14 | R38 R39 | S04 S14 S15 W29 W37 P34 S01 | Stale-while-revalidate cache seeds scorecard / players / round entry | [`tests/nov10-speed.test.ts`](../../tests/nov10-speed.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F14-5 | happy | F14 | R38 R39 | S04 S14 S15 W29 W37 P34 S01 | Stale-while-revalidate cache seeds scorecard / players / round entry | [`tests/performance-020.test.ts`](../../tests/performance-020.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F14-6 | happy | F14 | R38 R39 | S04 S14 S15 W29 W37 P34 S01 | Older server (RPC missing) → graceful fallback paths | [`tests/degrade.test.ts`](../../tests/degrade.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F14-6 | happy | F14 | R38 R39 | S04 S14 S15 W29 W37 P34 S01 | Older server (RPC missing) → graceful fallback paths | [`tests/performance-020.test.ts`](../../tests/performance-020.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F14-7 | edge | F14 | R38 R39 | S04 S14 S15 W29 W37 P34 S01 | Clock skew / paused project message | [`tests/runtime-fixes.test.ts`](../../tests/runtime-fixes.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F14-8 | edge | F14 | R38 R39 | S04 S14 S15 W29 W37 P34 S01 | Two phones offline then both online with the same round number | <span style="color:#c62828">**GAP**</span> |  |  |
| F15-1 | happy | F15 | R40 R41 | E01 E02 E03 E04 E05 E06 E07 S28 S27 S26 S25 S06 W05 W06 | Game started → one email per registered seated player with the live link | [`supabase/tests/14_emails_024.sql`](../../supabase/tests/14_emails_024.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F15-1 | happy | F15 | R40 R41 | E01 E02 E03 E04 E05 E06 E07 S28 S27 S26 S25 S06 W05 W06 | Game started → one email per registered seated player with the live link | [`tests/emails-024.test.ts`](../../tests/emails-024.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F15-2 | happy | F15 | R40 R41 | E01 E02 E03 E04 E05 E06 E07 S28 S27 S26 S25 S06 W05 W06 | Result saved → email with /r/ link; declarer excluded | [`supabase/tests/14_emails_024.sql`](../../supabase/tests/14_emails_024.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F15-3 | happy | F15 | R40 R41 | E01 E02 E03 E04 E05 E06 E07 S28 S27 S26 S25 S06 W05 W06 | Link request email with Yes / No; answer by token once | [`supabase/tests/15_link_player_025.sql`](../../supabase/tests/15_link_player_025.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F15-3 | happy | F15 | R40 R41 | E01 E02 E03 E04 E05 E06 E07 S28 S27 S26 S25 S06 W05 W06 | Link request email with Yes / No; answer by token once | [`tests/link-player-025.test.ts`](../../tests/link-player-025.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F15-4 | happy | F15 | R40 R41 | E01 E02 E03 E04 E05 E06 E07 S28 S27 S26 S25 S06 W05 W06 | Restore requested email to creator and admins | [`supabase/tests/36_going_rogue_045.sql`](../../supabase/tests/36_going_rogue_045.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F15-4 | happy | F15 | R40 R41 | E01 E02 E03 E04 E05 E06 E07 S28 S27 S26 S25 S06 W05 W06 | Restore requested email to creator and admins | [`tests/going-rogue.test.ts`](../../tests/going-rogue.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F15-5 | edge | F15 | R40 R41 | E01 E02 E03 E04 E05 E06 E07 S28 S27 S26 S25 S06 W05 W06 | Same event twice → one outbox row (event_key) | [`supabase/tests/14_emails_024.sql`](../../supabase/tests/14_emails_024.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F15-6 | edge | F15 | R40 R41 | E01 E02 E03 E04 E05 E06 E07 S28 S27 S26 S25 S06 W05 W06 | 150 emails vs cap 90 → 90 sent, 60 deferred, 0 dropped | [`supabase/tests/19_guardrails_029.sql`](../../supabase/tests/19_guardrails_029.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F15-6 | edge | F15 | R40 R41 | E01 E02 E03 E04 E05 E06 E07 S28 S27 S26 S25 S06 W05 W06 | 150 emails vs cap 90 → 90 sent, 60 deferred, 0 dropped | [`tests/volume-client.test.ts`](../../tests/volume-client.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F15-7 | happy | F15 | R40 R41 | E01 E02 E03 E04 E05 E06 E07 S28 S27 S26 S25 S06 W05 W06 | Unsubscribe by kind or all; preferences on Me | [`supabase/tests/14_emails_024.sql`](../../supabase/tests/14_emails_024.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F15-7 | happy | F15 | R40 R41 | E01 E02 E03 E04 E05 E06 E07 S28 S27 S26 S25 S06 W05 W06 | Unsubscribe by kind or all; preferences on Me | [`supabase/tests/23_security_033.sql`](../../supabase/tests/23_security_033.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F15-8 | edge | F15 | R40 R41 | E01 E02 E03 E04 E05 E06 E07 S28 S27 S26 S25 S06 W05 W06 | Real delivery through Resend (staging inbox) | <span style="color:#c62828">**GAP**</span> |  |  |
| F16-1 | happy | F16 | R42 | P30 S04 S14 S15 S21 S16 S19 | Every Help note opens and matches the screen | [`e2e/full/50-help-notes.yaml`](../../e2e/full/50-help-notes.yaml) | full | [pass · nightly Nov 15 (stale PR 19 branch)](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F16-1 | happy | F16 | R42 | P30 S04 S14 S15 S21 S16 S19 | Every Help note opens and matches the screen | [`e2e/smoke/02-scorecard.yaml`](../../e2e/smoke/02-scorecard.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F16-1 | happy | F16 | R42 | P30 S04 S14 S15 S21 S16 S19 | Every Help note opens and matches the screen | [`tests/build3.test.ts`](../../tests/build3.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F16-1 | happy | F16 | R42 | P30 S04 S14 S15 S21 S16 S19 | Every Help note opens and matches the screen | [`tests/build4.test.ts`](../../tests/build4.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F16-2 | edge | F16 | R42 | P30 S04 S14 S15 S21 S16 S19 | Help copy stays ≤ 7 bullets and within line length | [`tests/build3.test.ts`](../../tests/build3.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F16-3 | happy | F16 | R42 | P30 S04 S14 S15 S21 S16 S19 | Pool, multiplier, seating and deleted-games bullets present | [`tests/pool-pr13.test.ts`](../../tests/pool-pr13.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F16-3 | happy | F16 | R42 | P30 S04 S14 S15 S21 S16 S19 | Pool, multiplier, seating and deleted-games bullets present | [`tests/multiplier-pr14.test.ts`](../../tests/multiplier-pr14.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F16-3 | happy | F16 | R42 | P30 S04 S14 S15 S21 S16 S19 | Pool, multiplier, seating and deleted-games bullets present | [`tests/seating-pr21.test.ts`](../../tests/seating-pr21.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F16-3 | happy | F16 | R42 | P30 S04 S14 S15 S21 S16 S19 | Pool, multiplier, seating and deleted-games bullets present | [`tests/going-rogue.test.ts`](../../tests/going-rogue.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F17-1 | happy | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Pick completed games → Show results → Save → games Closed → saved result | [`e2e/smoke/06-results.yaml`](../../e2e/smoke/06-results.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F17-1 | happy | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Pick completed games → Show results → Save → games Closed → saved result | [`e2e/full/40-results-save-and-past.yaml`](../../e2e/full/40-results-save-and-past.yaml) | full | [fail · nightly Nov 15 on stale PR 19 branch](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F17-1 | happy | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Pick completed games → Show results → Save → games Closed → saved result | [`tests/results-save.test.ts`](../../tests/results-save.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F17-1 | happy | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Pick completed games → Show results → Save → games Closed → saved result | [`supabase/tests/03_results_privacy.sql`](../../supabase/tests/03_results_privacy.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F17-2 | edge | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Completed game with no rounds → players at 0, not "0 players" | [`e2e/smoke/12-results-zero-players.yaml`](../../e2e/smoke/12-results-zero-players.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F17-2 | edge | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Completed game with no rounds → players at 0, not "0 players" | [`supabase/tests/24_results_design_034.sql`](../../supabase/tests/24_results_design_034.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F17-3 | misuse | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Non-admin card locked → Not an admin dialog | [`e2e/smoke/06-results.yaml`](../../e2e/smoke/06-results.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F17-3 | misuse | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Non-admin card locked → Not an admin dialog | [`tests/results-picker.test.ts`](../../tests/results-picker.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F17-4 | edge | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Deselect games? when a chip would hide a ticked game | [`tests/results-picker.test.ts`](../../tests/results-picker.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F17-5 | happy | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Delete this result → 10 s Undo → games Completed again | [`e2e/smoke/12-results-zero-players.yaml`](../../e2e/smoke/12-results-zero-players.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F17-5 | happy | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Delete this result → 10 s Undo → games Completed again | [`e2e/full/40-results-save-and-past.yaml`](../../e2e/full/40-results-save-and-past.yaml) | full | [fail · nightly Nov 15 on stale PR 19 branch](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F17-5 | happy | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Delete this result → 10 s Undo → games Completed again | [`tests/results-delete-pr9.test.ts`](../../tests/results-delete-pr9.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F17-5 | happy | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Delete this result → 10 s Undo → games Completed again | [`supabase/tests/30_results_delete.sql`](../../supabase/tests/30_results_delete.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F17-6 | edge | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Delete a result shared from this phone → confirm first | [`e2e/smoke/15-delete-shared-result-confirm.yaml`](../../e2e/smoke/15-delete-shared-result-confirm.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F17-6 | edge | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Delete a result shared from this phone → confirm first | [`tests/results-delete-pr9.test.ts`](../../tests/results-delete-pr9.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F17-7 | happy | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Deleted results list (30 days) → Restore → games Closed again | [`e2e/smoke/12-results-zero-players.yaml`](../../e2e/smoke/12-results-zero-players.yaml) | smoke | [pass · PR run 9817239](https://github.com/sreeatcandorps/RummyHome/actions/runs/43729169240) |
| F17-7 | happy | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Deleted results list (30 days) → Restore → games Closed again | [`supabase/tests/30_results_delete.sql`](../../supabase/tests/30_results_delete.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F17-8 | happy | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | History: versions, "Changed after sharing" line, result_* log rows | [`e2e/full/70-game-log.yaml`](../../e2e/full/70-game-log.yaml) | full | [fail · nightly Nov 15 on stale PR 19 branch](https://github.com/sreeatcandorps/RummyHome/actions/runs/43733029118) |
| F17-8 | happy | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | History: versions, "Changed after sharing" line, result_* log rows | [`tests/event-log-036.test.ts`](../../tests/event-log-036.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F17-8 | happy | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | History: versions, "Changed after sharing" line, result_* log rows | [`supabase/tests/26_event_log_036.sql`](../../supabase/tests/26_event_log_036.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F17-9 | misuse | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Only declarer, seated players, game admins see a result (RLS) | [`supabase/tests/03_results_privacy.sql`](../../supabase/tests/03_results_privacy.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F17-9 | misuse | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | Only declarer, seated players, game admins see a result (RLS) | [`tests/results-privacy.test.ts`](../../tests/results-privacy.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F17-10 | edge | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | A game in two live results stays Closed when one is deleted | [`supabase/tests/30_results_delete.sql`](../../supabase/tests/30_results_delete.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F17-11 | edge | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | 30 games × 20 players result page speed | [`supabase/tests/22_results_volume_032.sql`](../../supabase/tests/22_results_volume_032.sql) | pgTAP | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |
| F17-11 | edge | F17 | R26 R27 R43 R44 | S04 S21 W21 P51 P49 P50 S22 W22 W23 P53 S23 P54 W25 P55 P56 W26 P52 W24 E04 P57 | 30 games × 20 players result page speed | [`tests/volume-client.test.ts`](../../tests/volume-client.test.ts) | unit | [pass · run 6a262d2](https://github.com/sreeatcandorps/RummyHome/actions/runs/43751679374) |

## e. Every pop-up and warning: flow + trigger

| ID | Kind | Name | Host screens | Flows | Trigger | Tests |
| --- | --- | --- | --- | --- | --- | --- |
| P01 | dialog | Linked (link complete notice) | S04 | F04 | A link request you sent was accepted | 1 |
| P02 | dialog | One quick check (join / claim requests) | S04 | F04 | An open claim request names your email / Player ID | 2 |
| P03 | toast | Home toast (Asked · Game restored) | S04 | F13 | Ask to restore sent, or Restore tapped on a deleted game | 2 |
| P04 | dialog | Me notice (Couldn’t save · Couldn’t log out · Demo data · Account deleted) | S06 | F02 | Save / log out fails, demo data loaded or cleared, account deleted | 2 |
| P05 | dialog | Initials for {name} (shared editor) | S05 S06 S12 S13 S16 | F02 F04 | Edit initials tapped | 2 |
| P06 | dialog | Change passcode | S06 | F02 | Me → Change passcode | 3 |
| P07 | dialog | Delete your account? | S06 | F02 | Me → Account → Delete account | 1 |
| P08 | dialog | Remove {name} from My players? | S05 | F04 | ⋮ → Remove from My players | 1 |
| P09 | dialog | Invite {name} to register | S05 S16 | F12 | ⋮ → Invite to register | 2 |
| P10 | dialog | Link {name} to Player ID | S05 S16 | F04 F12 | ⋮ → Link to Player ID | 4 |
| P11 | dialog | Request sent (link request) | S05 S16 | F04 | Send request succeeded | 1 |
| P12 | dialog | Edit name | S05 S16 | F12 | ⋮ → Edit name (unregistered player) | 4 |
| P13 | dialog | Player detail (initials, Close / Remove) | S05 | F04 | Tap a My players row | 0 |
| P14 | menu | Player ⋮ menu (Invite · Link · Edit initials · Edit name · Admin · Remove) | S05 S16 | F12 | ⋮ on a player row | 5 |
| P15 | toast | Removed · UNDO (My players) | S05 | F04 | Remove from My players confirmed | 4 |
| P16 | dialog | Account created | S02 | F01 | Sign-up succeeded | 1 |
| P17 | menu | Country picker (phone code) | S02 | F01 | Country field tapped | 0 |
| P18 | menu | Scorecard ⋮ menu (Players · Admins, Seating, Edit round, Reopen, Log, Hide, Delete, Settings) | S14 | F05 F07 F08 F13 | ⋮ in the scorecard header | 15 |
| P19 | dialog | Edit which round? | S14 | F07 | ⋮ → Edit round | 6 |
| P20 | dialog | Remove the last round? (Undo) | S14 | F07 | Undo round tapped | 12 |
| P21 | dialog | Delete this game? | S14 | F13 | ⋮ → Delete game (creator / admin) | 4 |
| P22 | dialog | Reopen this game? | S14 | F10 | ⋮ → Reopen game (Completed, admin) | 1 |
| P23 | dialog | Something went wrong (scorecard action error) | S14 | F13 | Hide / delete / restore / undo / reopen failed | 7 |
| P24 | sheet | Share sheet (picture · PDF · link) | S14 S20 S23 | F10 F11 | Share icon tapped | 5 |
| P25 | sheet | Seating order sheet | S14 | F03 F05 | After Start (prompt) or ⋮ → Seating order | 5 |
| P26 | dialog | Game settings (Full count, multiplier, pool rules) | S14 S15 | F08 | ⋮ → Game settings | 9 |
| P27 | dialog | Change the multiplier? / Large multiplier | S14 S15 | F08 | Multiplier changed when rounds exist, or ≥ ×1,000 | 3 |
| P28 | sheet | Exact points (multiplier totals) | S14 | F08 | Multiplier chip → Exact points | 4 |
| P29 | toast | Link copied (scorecard) | S14 | F11 | Share → Copy link | 0 |
| P30 | dialog | Help | S04 S05 S06 S07 S08 S09 S10 S11 S12 S13 S14 S15 S16 S17 S19 S21 S22 S23 | F16 | ? in the header | 17 |
| P31 | dialog | Over the Full count / Are you sure? (pool) | S15 | F06 F09 | Typed value first passes the Full count (once per cell) | 4 |
| P32 | dialog | Round saved (pool: out · eligible · re-enter) | S15 | F09 | Pool round saved with a change in who is out | 4 |
| P33 | dialog | Rummy share is not a win | S15 | F06 | Save with a Rummy share ≤ 0 | 1 |
| P34 | dialog | Round notice (Round N already saved · scorecard refreshed · view only) | S15 | F06 F07 F14 | PT409 / 23505 conflict, dead game, no rights | 8 |
| P35 | menu | Enter Scores ⋮ menu (Game settings · Share live scorecard · Clear / Undo my changes · Help) | S15 | F11 | ⋮ in Enter Scores | 2 |
| P36 | dialog | Remove {name}? (seat) | S16 | F12 | ⋮ → Remove player, all scores 0 | 7 |
| P37 | dialog | Remove from game (blocked: player has a score) | S16 | F12 | ⋮ → Remove player with a non-zero score | 4 |
| P38 | dialog | Something went wrong (Players · Admins) | S16 | F12 | Admin toggle / name / remove failed | 9 |
| P39 | dialog | Add non-playing admin (by Player ID) | S16 | F12 | Add non-playing admin button | 4 |
| P40 | dialog | Complete this game? / Complete this pool? (Nov 18: one dialog; Fix round N first when a Points round is off) | S14 S15 | F09 F10 | Complete game on the scorecard, or Complete on the Round saved sheet | 8 |
| P41 | dialog | Could not complete | S14 S15 | F10 | complete RPC failed | 1 |
| P42 | dialog | Not all given out (save awards anyway?) | S19 | F10 | Save awards with pot left over | 2 |
| P43 | dialog | Not for this pool | S19 | F10 | Preset does not fit the number of players | 2 |
| P44 | dialog | Could not save awards | S19 | F10 | award RPC failed | 3 |
| P45 | dialog | Add a co-admin? | S09 | F03 | Start game with a registered seated player and no co-admin | 2 |
| P46 | dialog | Can’t remove this player (picker) | S10 | F04 | × on a saved seat with scores (add mode) | 0 |
| P47 | dialog | Large multiplier (Game type) | S09 | F03 | Start with multiplier ≥ ×1,000 | 1 |
| P48 | dialog | Unsaved letters | S12 | F04 | Back with letters typed and not saved | 1 |
| P49 | dialog | Deselect games? | S21 | F17 | Turning off a status chip that hides a ticked game | 1 |
| P50 | dialog | Give awards first | S21 | F10 F17 | Ticking a completed pool without awards | 3 |
| P51 | dialog | Not an admin (locked card) | S21 | F17 | Tapping a game you do not run | 5 |
| P52 | toast | Results toast (Result deleted · UNDO / restored) | S21 | F17 | Delete chip or Restore chip on Past results | 4 |
| P53 | dialog | Result saved (status changes) | S22 | F17 | Save result succeeded | 5 |
| P54 | menu | Result ⋮ menu (History · Copy link · Delete result) | S23 | F17 | ⋮ on a saved result | 5 |
| P55 | dialog | Delete a shared result? | S23 | F11 F17 | Delete when this phone shared the result | 2 |
| P56 | toast | Result deleted · UNDO (saved result) | S23 | F17 | Delete this result tapped | 4 |
| P57 | toast | Link copied (result) | S23 | F17 | ⋮ → Copy link | 0 |
| P58 | modal | Share results preview (picture) | S20 S23 | F11 | Share → Picture | 2 |
| P59 | toast | Hidden & deleted toast (restored · unhidden) | S08 | F13 | Restore / Unhide tapped | 6 |
| P60 | dialog | Initials clash sentence (stored form) | S12 | F04 | Typed initials are already someone else’s | 11 |
| W01 | error | Sign-in error (wrong passcode · cannot reach server · locked) | S01 | F01 | Sign in fails | 3 |
| W02 | error | An account with this email already exists | S02 | F01 | Sign-up with a known email | 2 |
| W03 | error | OTP / passcode validation (6 digits, mismatch) | S03 S06 | F01 F02 | OTP or passcode not 6 digits / mismatch | 1 |
| W04 | card | Deleted games card (read-only, hidden for good on …, Ask / Restore) | S04 | F13 | A game you scored in was deleted in the last 30 days | 6 |
| W05 | card | Link requests card (Yes / No) | S04 | F15 | Someone asked to link a seat to your Player ID | 4 |
| W06 | card | Claim requests card | S04 | F15 | Open claim requests for your account | 2 |
| W07 | empty | Empty states (no live games · no players · no results) | S04 S05 S21 | F04 | List has no rows | 1 |
| W08 | tag | Game status tag (Active · Completed · Closed · Deleted) | S14 | F10 | Always on the scorecard strip | 0 |
| W09 | banner | Deleted game banner (Deleted by …, Ask to restore / Restore) | S14 | F13 | Opening a deleted game from Deleted games | 3 |
| W10 | inline | Pool over hint (everyone out / limit reached) | S14 | F09 | Pool cannot continue | 1 |
| W11 | chip | Multiplier chip + entered-points banner | S14 | F08 | Game multiplier ≠ ×1 | 2 |
| W12 | inline | Count warning line (half / Full count) | S15 | F06 | Typed value ≥ half or ≥ Full count | 2 |
| W13 | pill | Balance pill (Save off until 0) | S15 | F06 | Round does not balance | 8 |
| W14 | inline | New game problem line (players, Full count, multiplier range) | S09 | F03 | Start pressed with an invalid rule | 3 |
| W15 | inline | Initials format line / Change the letters to save | S05 S06 S12 S13 S16 | F02 F04 | Initials invalid or unchanged | 3 |
| W16 | tag | Registration tags (Unregistered · Pending registration · Link pending) | S05 S10 S16 | F04 F12 | Player not registered / invite or link open | 15 |
| W17 | inline | Can’t link yet (conflict names each game) | S05 S16 | F04 | Target account already plays in a game with this seat | 3 |
| W18 | inline | Seating note / error (dealer, order unchanged) | S14 | F05 | Seating sheet open | 2 |
| W19 | inline | Game settings error / locked note | S14 S15 | F08 F09 | Invalid value or pool locked after round 1 | 3 |
| W20 | inline | Awards hints (given out · winner warning · blocked) | S19 | F10 | Awards sheet totals | 1 |
| W21 | inline | Results picker count + locked (non-admin) cards | S21 | F17 | Games ticked / game you do not run | 2 |
| W22 | banner | Not saved yet. This result may change. | S22 | F17 | Result shown before Save | 2 |
| W23 | inline | Result warnings (Active game · already in a previous result) | S22 S23 | F17 | Selected game Active or reused | 3 |
| W24 | inline | Changed after sharing · removed / deleted notes · History | S23 | F07 F13 F17 | A game in the result was edited / deleted after save | 2 |
| W25 | inline | Delete consequence line (games go back to Completed) | S23 | F17 | Saved result, manager | 2 |
| W26 | inline | Deleted results section (Restore, 30 days) | S21 | F17 | A result you could delete was deleted in the last 30 days | 4 |
| W27 | inline | My players search-full note + 1,000 limit | S05 | F04 | Search over the page cap / roster at 1,000 | 2 |
| W28 | error | Guardrail refusals (GRD01: 20 seats, 500 rounds, 10 live games, 50 games/day, 100 players/day, 20 pending links) | S09 S10 S15 S16 | F03 F04 F06 | A server guardrail refuses the write | 5 |
| W29 | inline | Offline / network copy (cannot reach server · saved on this phone) | S01 S04 S14 S15 | F14 | Request never reached the server | 6 |
| W30 | card | Support card (Can’t find a game? support@ezscore.app) | S08 | F13 | Always at the foot of Hidden & deleted | 3 |
| W31 | banner | Settings Saved banner | S07 | F02 | Save tapped | 10 |
| W32 | inline | Final scores note + multiplier line | S20 | F10 | Final scores screen | 2 |
| W33 | web | Web result banners (deleted · edited after it was saved · older versions) | S26 | F11 | Result deleted or has versions | 13 |
| W34 | web | Web scorecard Changes card | S25 | F11 | Important log rows exist | 13 |
| W35 | inline | Pool standings (OUT · re-entry eligible · re-entered · limit) | S14 | F09 | Pool game | 6 |
| W36 | card | Pool awards card (after complete) | S14 | F10 | Completed pool | 4 |
| W37 | inline | Toast errors (formatSupabaseError) on every write | S04 S05 S06 S14 S15 S16 S21 S23 | F14 | Any server write fails | 3 |
| W38 | inline | Rummy / positive pot colours (yellow selected, green win, red penalty) | S15 S14 | F06 | Typed or saved values | 7 |
| W39 | inline | Deleted game read-only (no Add round / Undo / Share) | S14 | F13 | Game deleted | 3 |
| W40 | tag | Role tags on Home cards (Creator · Admin · Player · View only) | S04 S21 | F12 | Always | 9 |
