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

## First run: generate a small Whyfile

Requires Git, **Node.js 22 or newer**, and npm. This is a local v0.1 prototype;
there is no hosted service, AI provider requirement, or published CLI install
step. Run the example in this clone so generated records stay separate from
another project's evidence.

```bash
git clone https://github.com/zacharymplace/backsolve.git
cd backsolve
npm ci
npm run build
node dist/cli.js init
node dist/cli.js capture "Try the README example"
node dist/cli.js add-decision --decision "Keep this trial local" --rationale "Inspect the artifact before sharing" --confidence confirmed --status accepted
node dist/cli.js set-outcome "Generated a local example; no application behavior was validated"
node dist/cli.js whyfile
node dist/cli.js cache export
```

Expected final output (the session ID is a timestamp and varies):

```text
Whyfile written: .backsolve/whyfiles/<session-id>.why.md
Evidence-completeness score: 0.4
Evidence-completeness heuristic (0–1), not a probability of truth, runtime readiness, or approval. Inferred rationale and missing historical telemetry can still score 1.0.
Cache exported: .backsolve/caches/<session-id>.bscache
```

Open the `.why.md` file to inspect the captured objective, outcome, decision, and
rationale. This example deliberately has no chat, diff, or test evidence, which
reduces the heuristic confidence score. The score is not a probability of
correctness or independent verification.

Generated records live in `.backsolve/` under the current working directory.
Archives can contain imported chats, diffs, and command output; inspect them
before sharing. `add-test` actually executes the supplied shell command; use
only a command you intend to run. `npm run demo` only creates a session and is
not a complete reconstruction demonstration.

## Capture evidence for your own work

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

## Optional provenance sidecar (prototype)

Whyfile schema 0.1 is unchanged. To attach provenance, create a JSON manifest
with `provenance_version: "0.1"`, the active `session_id`,
`reconstruction_mode` (`retrospective` or `contemporaneous`),
`reconstructed_at` (ISO timestamp), `subject.repository`, and an `evidence`
array. Each evidence entry has a stable `id`, relative `path`, SHA256 `sha256`,
`kind` (`artifact`, `command_output`, `operator_report`, or `screenshot`), and
`collected_at`. Optional `observed_at` stays absent when unknown; collection
and reconstruction time must not substitute for historical observation time.
Subject may also record `base_revision`, `release_revision`, and `tag`.

Optional `claims` contain `id`, `claim`, `evidence_refs`, and `limitation`.
Optional `validations` contain `command`, `exit_code`, `captured_at`,
`evidence_ref`, and optional `tested_revision`. All references must resolve.
Paths resolve relative to the manifest; traversal and escaping symlinks are rejected.

```bash
node dist/cli.js attach-provenance path/to/manifest.json
node dist/cli.js review
node dist/cli.js cache export
node dist/cli.js cache verify .backsolve/caches/SESSION_ID.bscache
```

Attachment checks hashes and snapshots evidence bytes locally. Export writes a
self-contained `SESSION_ID.provenance.json` beside the Whyfile and includes the
same sidecar and evidence bytes in the cache. Exported sidecars can be attached
again to the same session. Cache verification checks schema, evidence references,
hashes, the bound Whyfile, and agreement between captured tests and provenance. It does not authenticate authorship or prove an
operator's historical assertions. There is no general cache-to-session importer.
Old caches remain readable without provenance; absence is reported explicitly.
Exports include full captured test output with exit codes and timestamps. New
command captures retain stdout and stderr (concatenated in that order; stream
interleaving is not preserved). Existing captures cannot recover discarded output.
`add-test '<command>' --revision <revision>` records a caller-supplied tested
revision; omit it when unknown. Backsolve does not verify that assertion or
infer it from the subject's release revision. These local bundles are not
signed and have no size limit; inspect sources before attaching sensitive logs.

### What the confidence score means

`reconstruction_confidence` is a deterministic **evidence-completeness
heuristic**, not a probability of truth, runtime readiness, or approval.
It starts at 1.0 and deducts for missing tests (0.30), failing tests (0.20
instead), missing chat (0.15), missing diff (0.15), and any unsupported,
contradicted, or needs-review decision (0.20). Inferred decisions do not reduce
it. A retrospective account with inferred rationale and missing historical
telemetry can therefore score 1.0. Read the evidence and per-claim limitations;
never use the score to authorize a release or declare product readiness.

### Local build receipt

`npm run build` cleans `dist/`, compiles TypeScript, and writes `dist/build-receipt.json` only after success. It records the Git revision and dirty state, source/configuration/package/build-script hashes, emitted JavaScript hashes, and Node/TypeScript versions. A failed build removes the prior receipt. The receipt is a trusted local observation, not independent reproducibility, authentication of installed dependencies, or an attestation of executed bytes. A dirty build is associated with its input hashes, not solely with the named commit.
