# iPhone: the next steps now that Apple said yes (Nov 25)

Sree, Nov 25: "did this. its done with apple." Apple accepted the Candor PS enrolment on Nov 24 (12:09 PM PT), so
step 1 of the iPhone plan (PR #112, `docs/ios/README.md`) is done. The app already runs on iOS from the same code.
What is left is two short sign-ins, one build, one fix pass and the store paperwork. **Nothing below starts until
Sree OKs this page (Q41).**

| # | Step | Who | What | Needs |
| --- | --- | --- | --- | --- |
| A | App Store Connect record | **Sree**, about 15 min | [appstoreconnect.apple.com](https://appstoreconnect.apple.com): accept the Free Apps agreement; New app → iOS, name **EZ Score: Rummy**, bundle id `com.mindweavetech.rummyhome`, SKU `ezscore-rummy`, English (US); privacy policy = the Play one. | — |
| B | Link EAS to Apple | Sree + Build Bot, minutes | `eas credentials -p ios`, signed in with the Candor PS Apple ID (a two-factor prompt on his phone). EAS keeps the certificate and profile; no password is stored. | A |
| C | Un-park and merge #112 | Build Bot, on Sree's yes | `app.json` iOS block only: build number, the name under the icon **EZ Score**, the no-encryption flag. Android builds do not change. Rebased on `main` first. | Q41 |
| D | First iPhone build + TestFlight | Build Bot, on Sree's yes | `eas build -p ios --profile production`, then `eas submit -p ios --latest`. Internal TestFlight: Sree installs it on his iPad within minutes, no Apple review. | B, C, his yes to the build |
| E | iOS fix pass | **Fable** helper (D92: changes across many screens) | From Sree's iPad screenshots: safe areas (notch, home bar), keyboard over fields, the iOS share sheet (picture, PDF), dark mode, big text, the iPad layout. One PR with an iOS column in the screenshot matrix. | D |
| F | Nightly iPhone test run | **Sonnet 5.5** helper (D92: tests) | The smoke flows on an iPhone simulator, GitHub's macOS runner, **nightly only** (macOS minutes cost 10× Linux). | Q41 (it costs runner minutes) |
| G | Submit for App Review | Sree says go; Build Bot uploads | Screenshots 6.7", 6.5" and 13" iPad; privacy labels (the same facts as Play's Data safety); age 4+; a test login for the reviewer. Review takes 1–3 days. | E, his go |

Google's Play review does not block any of this; the two stores move on their own.

## Questions

| # | Question | Default |
| --- | --- | --- |
| Q41 | OK this plan: A and B are yours, then C, D and F on your yes. | not started until yes |
| Q42 | Keep iPad support (iPad screenshots and review; you test on your iPad), or iPhone only for v1? | keep iPad |
| Q43 | TestFlight for you only until App Review passes, or a public test link for friends now (Apple reviews that link first, about a day)? | you only |
