---
name: pr-write-up
description: Use when opening or updating any EZ Score pull request. Writes the five-line For Sree block, the Status section and the Sree-said table of the PR template, so Sree and Build Bot know what to do from the first five lines.
---

# PR write-up

Sree reads the first five lines and nothing else (D82); Build Bot decides from them whether a merge needs him
(D80). Write them last, after everything below them is true.

1. **Start from the template** (`.github/PULL_REQUEST_TEMPLATE.md`); keep every heading.
2. **For Sree, five lines, plain sentences, no file paths:**
   - *Decide:* the one question, with your recommendation and the default if he does not answer; or
     "nothing, merge is pre-approved (D80)" when every D80 condition holds. Check them, don't assume: CI green ·
     no live migration · nothing under `rummy-home3/public/` · no `AGENTS.md` or `.cursor/rules/` change · docs /
     tests / CI only or an approved spec cited by D-id with its matrix.
   - *A user will notice:* one sentence, or "nothing".
   - *Try it:* a link that opens on his phone without a Cursor login (`show-then-build` skill, step 4).
   - *Risk:* what could break and how it would show.
   - *After merge:* what happens on its own and what still waits on Sree (an APK, a live setting, a migration).
3. **Status:** base commit, migration (written, never applied from a branch), unit + tsc counts from a run you
   did, device flows touched, bug fix proof (`bug-proof` skill), D-ids touched.
4. **Sree said → built as → where:** his words verbatim with the date, beside your reading of them, so a misread
   is visible. Every new or changed decision gets its D-line in `decisions.md` in the same PR.
5. **When a human edits the PR body**, read the new version before you update it and keep their edits.
6. **Open-PR limit:** at most three open PRs (D81, parked ones excepted). A fourth waits until one merges, or is
   folded into another.
