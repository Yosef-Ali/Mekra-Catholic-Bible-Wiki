# Handoff prompt for Claude Code CLI (run on the Mac)

Paste the block below into `claude` in the repo root. It covers the work that
can only run on your machine (Neon DB, git push) plus the pre-existing
typecheck debt that was surfaced during the UI/UX cleanup.

---

You are working in the Mekra-Catholic-Bible-Wiki monorepo (wiki vault + `web/` Vite/Express + `mobile/` Expo). Read `CLAUDE.md` first. There is uncommitted work in progress (Amharic-first UI flip, comparative banners, and a dead-code cleanup). Do the following, in order, and stop to show me a diff before committing.

**1. Set the production API URL (mobile shipping blocker)**
In `mobile/src/services/api.ts` line ~32, replace the placeholder:
```ts
: 'https://mekra.app/api'; // TODO: set production URL
```
Ask me for the real deployed backend URL if you don't already know it. Do NOT guess a domain. Until I give you one, leave the TODO but flag it.

**2. Fix the pre-existing web typecheck errors (92 total, all pre-date the cleanup)**
Run `cd web && npx tsc --noEmit` to see them. Breakdown:
- **73 errors in `web/constants.ts`** — every entry in the hardcoded `BibleBook[]` list is missing the required `id` field. Either add a correct `id` to each entry (matching the Neon `books` table ids) or, if this constant is no longer consumed at runtime, confirm it's dead and remove it. Check usage first: `grep -rn "from './constants'\|from \"../constants\"" web/ --include=*.ts --include=*.tsx`.
- **`web/App.tsx`** — `<DesktopHome>` is rendered without the required `openWikiPage` prop. Wire the real handler (DesktopHome expects `(slug, type) => void`).
- **`server/routes/chapters.ts`, `server/routes/users.ts`, `server/api/chapters.ts`** — `req.query`/`req.params` values typed `string | string[]`; narrow with `String(...)` or `Array.isArray` guards before use.
- **Remaining script errors** (`scripts/*.ts`: verify-remote-data, verify-each-book, test-api, seed_amharic_bible_draft, list-models, find_book_pages_simple, extract-missing-pages, cleanup-duplicates) — these are one-off maintenance scripts. Triage: fix trivially-typed ones, and for anything genuinely retired, propose deletion rather than patching. Show me the list before deleting.

Goal: `cd web && npx tsc --noEmit` exits clean. Confirm `cd mobile && npx tsc --noEmit` still exits clean (it does today).

**3. Sync wiki → DB and verify**
Run `node scripts/sync_to_db.mjs` (needs DATABASE_URL from `web/.env`; the Neon DB is unreachable from the sandbox so this step was deferred). Report the touched-row count.

**4. Review, then commit & push**
Show me `git status` and a full diff first. The uncommitted changes include: mobile Amharic-first flip (index.tsx, bible.tsx, article/[slug].tsx, Primitives.tsx, api.ts), comparative banners + Comparisons section (web DesktopHome/DesktopArticle + mobile), AI-generated provenance markers on `wiki/comparative/*.md`, removal of the mobile debug banner, and deletion of three confirmed orphans (`web/components/ui/SegmentedTabs.tsx`, `web/contexts/AuthContext.tsx`, `web/types/formatting.ts`). After I approve, commit with a clear message and `git push origin main`.

Constraints (from CLAUDE.md): never modify `raw/`; never invent citations; DB is read-only from the wiki; don't hardcode/guess DB credentials; preserve archaic Amharic forms; don't commit until I approve.
