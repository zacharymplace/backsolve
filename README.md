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
npm run dev -- import-chat examples/harden-admin-auth/chat.md
npm run dev -- scan-diff
npm run dev -- add-test "npm run check"
npm run dev -- review
npm run dev -- whyfile
npm run dev -- cache export
```
