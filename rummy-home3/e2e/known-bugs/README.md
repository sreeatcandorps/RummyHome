# known-bugs

Quarantined flows: one per bug seen on a phone, named after the PR that fixes it
(`prN-<what>.yaml`, tagged `[known-bug, prN]`, comment ending "Expected RED until PR N lands").
The set runs with both suites but never fails the job. When the PR lands it moves the flow into
`smoke/` or `full/`, where it becomes blocking.

Empty right now: `pr6-initials-clash-suggests-number.yaml` became part of `smoke/09-new-game.yaml`
with PR 6, the last of the Nov 12 phone-test bugs.
