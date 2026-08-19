# Quickstart: Validate Analyze Page Removal

Prerequisites: removal implemented per [plan.md](plan.md) Project Structure, dependencies installed (`frontend/`).

## 1. Build and repo-wide reference check (User Story 3 / FR-002, FR-005, SC-004)

```sh
cd frontend
npm run build
```

**Expected**: Build succeeds. Route list no longer includes `/analyze`.

```sh
grep -ril "analyze" --include="*.tsx" --include="*.ts" frontend/src/shared/components frontend/src/app README.md
```

**Expected**: No hits for the removed page/nav entry. (The backend API route table and the "Frontend concepts" capability bullet in README are expected, allowed mentions — see [research.md](research.md) §1 and §5. `RecentTargetsList.tsx` itself is expected to still exist untouched.)

## 2. Automated tests (User Story 3 / FR-004, SC-002)

```sh
cd frontend
npm run test
npx playwright test tests/e2e/golden-path.spec.ts
```

**Expected**: Vitest suite passes unchanged (nothing in it referenced `/analyze`). The two Playwright tests in `golden-path.spec.ts` pass, now driving the same journey through `/` instead of `/analyze`.

## 3. Manual UI walkthrough (User Story 1)

1. Run the dev server: `npm run dev`.
2. Load the home page. **Expected**: nav shows only "Projects" (plus the home logo link) — no "Analyze" entry.
3. Navigate directly to the former `/analyze` URL. **Expected**: renders the app's standard not-found page — identical to visiting `/automations` (already retired) or any other invalid route.

## 4. Core workflow regression check (User Story 2 / FR-003, SC-003)

1. From the home page, submit a valid URL. **Expected**: live progress renders inline, then the app navigates to `/runs/{id}` on completion — identical to the old `/analyze` behavior.
2. From the home page, submit an invalid URL (e.g., `not-a-url`). **Expected**: inline "enter a valid URL" error, page stays on `/`.
