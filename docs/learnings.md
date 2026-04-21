# Learnings

Durable rules worth keeping across sessions.

## Process

- Re-read files after edits, subagent work, or context compaction. The file on disk is the source of truth.
- For behavior changes, get a real red test before implementation.
- Don’t bundle unrelated fixes in the same branch or conversation.
- After a squash merge, preserve or recreate a remote branch/ref before deleting it if the original commit history still matters; the content may be in `main` while the branch ancestry is gone.

## Firestore

- In admin transactions, all reads must happen before the first write.
- When optional data controls writes, fetch it up front instead of reading later in the transaction.
- Prefer stable Firestore error codes over matching error messages.

## Security

- If missing auth or scope should deny access, fail explicitly; don’t use permissive fallbacks.
- When normalizing fields, update both read and write paths.
- In Firestore Rules, verify function signatures match call sites; unused parameters are a smell.

## Testing

- `vi.hoisted()` mocks must be created inside the hoisted callback.
- `requestAnimationFrame` in Vitest is safer with an explicit captured callback than with timer assumptions.
- Firebase integration tests often need module-level mocks for Firestore/Auth setup.
- A passing test is not enough; confirm it actually exercises the changed path.

## React

- Render-body ref assignment can trigger loops; move ref syncing into `useEffect` when needed.
- `useRef(initial)` does not track later state changes; sync refs explicitly if they must stay current.
- Critical external data should be fetched internally or required as a prop, not left optional.

## TypeScript

- Use `catch (err: unknown)` and narrow explicitly.
- Avoid `any`; prefer real types or `unknown`.

## Misc

- `navigator.clipboard` in happy-dom often needs to be defined as an own property before spying.
- Risky backend changes need emulator verification first and should not go to prod in the same session.
