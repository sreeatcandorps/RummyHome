# EZ Score — business analysis (first pass, Nov 24 2026)

Sree, Nov 24: "Rummy variants market research: can you actually show me that? … I want to see the business analysis and
see what's the next thing we should solve. We might have to do a lot more deep research into all kinds of rummy
variants and see which ones we should tackle first. That's probably after the WhatsApp, making sure it works for India."

This is the one-page version: the Play Store sweep (#40), variants (#37), money (#41) and the India picture together.
The only earlier research was Sree's Nov 21 review of six apps (`design-review-2.md` §7); nothing on variants or money
existed. Market numbers below come from industry articles, not audited data — read them as size, not precision.

## 0. The short version

1. **India changed in our favour.** Online cash rummy was banned by the Online Gaming Act (passed Aug 2025; rules in
   force 1 May 2026; the Supreme Court upheld the core ban in May 2026). RummyCircle and A23 switched to free play.
   Tens of millions of people who played rummy on their phones still play — at home, with friends and family, which is
   exactly the table EZ Score keeps score for.
2. **The competition is thin, and it wins on one thing: no sign-up.** The Indian-rummy scorekeepers on Play are small
   (the biggest has 50K+ downloads) and do less than we do — but every one of them starts without an account.
   Sign-up friction is our biggest weakness, which is why the linking workflow and WhatsApp sign-in come first.
3. **Next variant: Deals Rummy** (India), then **Gin** (US). Both reuse what Points and Pool already have.
4. **Money: stay free with no ads through v1 and WhatsApp.** Later, a one-time *Pro* for extras (stats, export,
   themes). **Never anything that handles stakes or settles money** — it breaks Google Play policy and, in India, the
   law. The hidden *Settle* feature in the code should be deleted, not revived.
5. **What to solve next, in order:** v1 approved and solid (batch 2, small phones) → sign-up without friction (linking
   doc, then WhatsApp for India) → Deals Rummy → stats people can share.

## 1. The market

| | What we know | Source |
| --- | --- | --- |
| People who play rummy in India | ~100 million play offline regularly; 70 million+ played online before the ban | RummyTipsCentral (Sep 2026), industry surveys |
| Online rummy before the ban | ~₹16,000 crore gross gaming revenue in 2024; rummy was ~60% of India's real-money gaming players | Northlines (Feb 2025), Republic World (Jan 2024) |
| The ban | Online money games prohibited regardless of skill; free "social games" allowed without registration | PIB press release (22 Apr 2026), Mint (22 Apr 2026) |
| After the ban | RummyCircle and A23 stopped cash games and kept free play; A23 (80M registered players) lost its court challenge on the core point | Inc42 (Aug 2025), therummyrules.com (Sep 2026) |
| Who plays | 45% of real-money players liked playing with friends; popularity skews to South India | CMR / Unomer study (Nov 2024), Republic World |

What it means: the online platforms taught a generation the Indian rules (13 cards, Points / Pool 101 / Pool 201 /
Deals, drops of 20 / 40 / 80). With cash gone online, the home game is where that habit lives now. Those players
already know our vocabulary.

In the US and Europe, rummy is a family game (Gin, Rummy 500, Kalooki, Canasta-style). The market is smaller and older,
and generic scorekeepers serve it well enough.

## 2. Play Store sweep (#40)

| App | Size | What it does | What reviewers ask for | Money |
| --- | --- | --- | --- | --- |
| **Rummy Score Board** (com.gck.rummy) | 50K+, 4.0 ★ (1.4K reviews) | Indian points with drops, re-entry, edit last round, add a player mid-game, share the board. **No sign-up.** | Edit players' names, show who shuffled, edit old games, a Pro version without ads | Ads + in-app purchases |
| **Offline Rummy Score Card 360** | not shown | Points, Pool 101 / 201 with re-entry, **Deals Rummy** (2 / 3 / 4 / 6 deals, chips), Target, Match; quick-score buttons (0 / 10 / 20 / 40 / 60 / 80); stats and head-to-head; CSV export. Offline, **no sign-up.** | — | Ads |
| **Rummy Scorekeeper** (Screw It Apps) | 5K+, unrated | Classic, Rummy 500, Gin; saved games and history | "It only totals the numbers you enter" | Ads |
| **Score Counter** (generic) | 500K+, 4.8 ★ (5.1K reviews) | Any game: templates incl. Rummy, history, charts, stats | Flexible entry order | Ads + one-time Premium (also monthly) |

Plus the six apps Sree reviewed on Nov 21 (§7 of design review 2): "there is literally no competition."

**Where EZ Score is ahead**: a live link anyone can open; several phones on one game; My players with history across
tables; seating, dealer and the deal order; pool re-entries and awards; results people can share.

**Where they are ahead**: start in seconds with no account; fully offline; Deals Rummy; one-tap drop scores; stats
pages. Only the first one is serious — the rest are features we can add when users ask.

## 3. Variants (#37)

| Variant | Who plays it | We have it? | Effort | Order |
| --- | --- | --- | --- | --- |
| Indian Points | India (most common, fastest) | Yes | — | — |
| Pool 101 / 201 | India | Yes, with re-entry and awards | — | — |
| **Deals Rummy** (2, 3 or 6 deals; chips carried forward) | India — the third of the big three online formats | No | Medium: Points rounds + a fixed deal count + chip totals | **1st** |
| **Gin Rummy** | US / UK, 2 players | No | Small–medium: knock / gin / undercut bonuses | **2nd** |
| Rummy 500 | US families | No | Medium: meld points scored per hand | 3rd |
| Kalooki / Contract | UK, Caribbean | No | Larger: a different contract each round | later |

Deals first because the people we are building for already play it, and its scoring is Points plus a counter. The deep
research Sree mentioned (every variant, regional rules, which to build) fits after WhatsApp sign-in, as he said.

## 4. Money (#41)

| Option | Fits a score-keeping app at a card table? | Rough return |
| --- | --- | --- |
| **Free, no ads** (today; the Play listing says so) | Yes — trust and word of mouth are the growth engine | Nothing |
| Ads | Poorly: a banner on the scorecard is in everyone's face at the table, and India ad rates are low (modelled ~$0.006 per daily user per day for Tier-3 audiences) | Very small |
| **One-time Pro** for extras (stats, PDF / CSV export, themes, more live games) | Yes — the pattern Score Counter and Leaderboard use ($9.99–$19.99 lifetime in the US; ₹199–₹499 is the usual India range) | Small but real, from the keenest players |
| Subscription | No — people score a few games a week; a subscription feels like rent | — |
| Tip jar | Friendly but tiny | Very small |
| **Anything with stakes, points-to-rupees or settling up** | **No, never** | Google Play forbids "companion functionality" that manages participation funds or payouts for real-money games, and India bans online money games outright |

Recommendation: free with no ads until v1 and WhatsApp are out and real use tells us what people value; then a
one-time Pro for extras only, never for scoring itself. The code still holds a hidden *Settle / prize sessions*
feature (`constants/features.ts`, off by default); deleting it removes a Play-policy and legal risk for nothing lost.

## 5. What to solve next

| # | Problem | Why now | Where it lives |
| --- | --- | --- | --- |
| 1 | v1 approved and solid on every phone | Google and Apple are reviewing; small phones still fail tests | batch 2 (#131), the nightly reds |
| 2 | **Sign-up friction** | The one thing every competitor beats us on | `player-linking-workflow.md` (Q29–Q33), then WhatsApp sign-in (#124, #36) |
| 3 | Bigger, calmer scorecard | Sree: "it looked too small" | design review 2 §8.8 / §8.9 (waiting for his yes) |
| 4 | Deals Rummy | The missing Indian format | a spec with mockups, after WhatsApp |
| 5 | Stats worth sharing | Competitors have them; they bring people back | after Deals |

## 6. Decisions for Sree

| Q | Question | Default if no answer |
| --- | --- | --- |
| **Q34** | Stay free with no ads through v1 and WhatsApp; a one-time Pro for extras later? | **Yes.** |
| **Q35** | Delete the hidden Settle / prize-sessions feature from the code? | **Yes**, in its own PR. |
| **Q36** | Deals Rummy is the next variant, Gin after it, both after WhatsApp sign-in? | **Yes.** |
