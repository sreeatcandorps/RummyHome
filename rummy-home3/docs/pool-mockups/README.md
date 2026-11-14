# Pool game — design mockups P01–P30 (PR 13, approved set)

Flat copy of the mockup set, embedded in [`../pool-design.md`](../pool-design.md) section 3. Regenerated Nov 14 after
Sree's screen-by-screen review (his 14 decisions are in the spec, section 0). The earlier set (Nov 13) is replaced;
the folder names below are the generator's grouping, here every file sits at the top level under its P-number.

31 PNGs, 390 dp (landscape 844 dp), light theme, same style as the results brainstorm. Each PNG has a caption strip
naming the screen.

```
01-new-game/            P01 players (Next) · P02 game type: Pool · P03 game type: Points · P03b custom limit
02-profile-defaults/    P04 Settings: Points and Pool defaults
03-scorecard/           P05 portrait · P06 header states + formulas · P07 landscape
04-add-round/           P08 add round · P09 two winners + over Full count · P10 after save: out + re-entry eligible · P11 re-entry sheet
05-complete-and-award/  P12 last player standing · P13 complete early (split) · P14 awards pending · P15 winner takes all ·
                        P16 by points left · P17 50/50 + entry per drop left · P18 custom, save anyway · P19 awarded · P30 awards locked when Closed
06-home-and-results/    P20 game cards (all yellow) · P21 results picker mixed · P22 results table with yellow game headers
07-share-and-web/       P23 share live · P24 share final (awards) · P25 live link
08-settings-help-wording/ P26 settings locked mid-game · P27 help text · P28 store-safe wording · P29 log entries
```

Sample game in every mockup: **P12 · 201 pool · Drop 25 · Middle 50 · Full 130**, 7 players; Anil out in round 4
(230), re-entered before round 5 at 109 (the highest score still in); Meena out in round 5 at exactly 201.

The generator (`gen.py`, `pool_scenes_v2.py`) lives outside the repo.
