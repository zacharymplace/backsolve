# Backsolve

Backsolve reconstructs AI-assisted work into **Whyfiles** and portable `.bscache` archives.

## Core promise

Make AI-assisted work explain itself.

## v0.1 scope

- CLI-first
- local-first
- repo-native
- manual chat import
- git diff scan
- test command capture
- human review
- Whyfile generation
- `.bscache` export

## Quickstart

```bash
npm install
npm run build

npm run dev -- init
npm run dev -- capture "Harden admin auth"
npm run dev -- import-chat <path/to/chat.md>
npm run dev -- scan-diff
npm run dev -- add-test "npm run check"
npm run dev -- add-decision --decision "..." --rationale "..." --confidence confirmed --status accepted
npm run dev -- add-risk --risk "..." --severity medium --status open
npm run dev -- set-outcome "What actually happened"
npm run dev -- add-question "..."       # optional
npm run dev -- add-next-action "..."    # optional
npm run dev -- review
npm run dev -- whyfile
npm run dev -- cache export
```

`whyfile` requires `set-outcome` to have been run first. Decisions and risks are
captured as you work, not inferred from the imported chat or scanned diff -- those
two are preserved as supporting evidence (`context_used` / `files_changed`), not
parsed for rationale. There is no LLM/AI step in Whyfile generation; it is a
deterministic assembly of what was explicitly captured.
