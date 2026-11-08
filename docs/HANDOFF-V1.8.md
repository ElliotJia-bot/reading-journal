# Remarked — V1.8 developer handoff

Working language: **English** for discussion, implementation notes and handoff documentation. The product UI is already English.

## Start here

- Live app: https://project-b00660ba-d6d4-4c9a-a05.web.app
- Private repository: https://github.com/ElliotJia-bot/reading-journal
- Starting branch: `release/1.8`; release tag: `v1.8.0`.
- Hosted version identifier: `/release.json`.
- Backend: https://reading-journal-api-au6vfycphq-uc.a.run.app
- Original checkout: `/Users/elliotjia/Documents/ChatGPT/ERG512 Product Management/reading-journal`.

V1.8 packages the current V1.7 experience for handoff. It updates the app/package version to `1.8.0`, gives Hosting releases the correct version label, and adds this guide. There are no new product features or layout changes. `release/1.7` remains the preceding release branch.

## What works

| Area | Current behavior |
| --- | --- |
| Home and Library | Current book, reading progress, streaks and weekly totals; Reading / Want to Read / Finished / Dropped shelves. |
| Reading records | Manual start/pause/finish logging, page progress, place and reaction. Own profile and Settings both offer Log out. |
| Ebook reader | Unencrypted EPUB/TXT import; eligible licensed cloud editions open from Library and cache locally. Minimal reader, font controls, bookmarks, notes and selected-text reflections. Sessions with more than 3 active minutes can go to Finish & log. |
| Insights | Overall, book and session views; calendar bars, top-three summaries, reading clock, quicker/longer stretches, and recent-30-day coaching. |
| For You | Three shelves of up to six real catalog books. AI ranking/reasons use validated reading evidence. Like adds Want to Read, Maybe remains eligible, Not for me removes a recommendation. |
| Community | Circles, posts/comments, encouragement, tiered leaderboards and reader profiles with opt-in sharing. |
| Sharing | A published reflection can produce an image with the thought and book details; the existing share/download flow is retained. |

This is a hosted web app that can be added to an iPhone home screen through Safari. It is not an App Store/TestFlight release. The reader uses web-specific implementations; native parity has not been established.

## Design constraints to preserve

The latest approved change was **colors only**. Keep the existing layout, text, fonts, sizes, weights, spacing, component dimensions, radii, border widths, shadows and interactions unless a new task explicitly changes them.

The four anchors are forest `#003422`, coral `#EE9C91`, stone `#D9CFC3`, and espresso `#4B3C35`. Warm-white surfaces, pale coral and gray-green cards provide separation. Main text and normal auxiliary text have at least 4.5:1 contrast on the theme's light surfaces. Current control state colors preserve the existing outline sizes and opacity effects.

- Main tokens: `mobile/src/lib/theme.ts`.
- Shared controls/cards: `mobile/src/components/ui.tsx`.
- Existing decorative fades: `mobile/src/components/surface-fade.tsx`.
- Web state rules: `mobile/public/index.html`; reader-specific rules are in `ebook-reader.web.tsx`.
- Full Remarked wordmark appears only on Home, before the greeting on the same row. The R. mark remains the app icon.

## Run the frontend

On this original Mac, dependencies and ignored local configuration already exist. With Node 24 on PATH:

```sh
cd mobile
node node_modules/expo/bin/cli start --web --port 8081
```

For a fresh checkout, get access to the private repository first, then:

```sh
git clone --branch release/1.8 https://github.com/ElliotJia-bot/reading-journal.git
cd reading-journal/mobile
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Fill the `EXPO_PUBLIC_FIREBASE_*` values from the existing Firebase web-app configuration. For the deployed backend, set `EXPO_PUBLIC_API_URL=https://reading-journal-api-au6vfycphq-uc.a.run.app`; the example defaults to a local server. Run `pnpm web --port 8081`. Read `mobile/AGENTS.md` before editing Expo/React Native code or dependencies.

A local frontend connected to this backend still reads and writes the live database. Use the designated test account for development. On the original Mac, its login instructions are in the ignored `.local/account-copy-v16/test-login.html`; obtain credentials privately from the project owner on another machine. Never commit `.local/`, `.env.local`, credentials or exported user records.

GitHub access, Google Cloud access and local credentials are separate. The release does not automatically invite a collaborator or transfer administrative access.

## Code map

| Location | Responsibility |
| --- | --- |
| `mobile/src/app/(tabs)/` | Home, Library, Insights, For You, Community and tab navigation. |
| `mobile/src/app/finish.tsx`, `session.tsx` | Manual and reader-session finish/log flows. |
| `mobile/src/components/ebook-reader.web.tsx` | Immersive reader, foreground timing and reader controls. |
| `mobile/src/lib/journal.tsx` | Auth-aware application state, books, sessions and local timer. |
| `mobile/src/lib/ebook.web.ts`, `shared-ebook.web.ts` | Parsing/local ebook storage and authenticated cloud edition loading. |
| `shared/` | Domain types, progress/time calculations, reading patterns and recommendation evidence. |
| `backend/src/server.ts`, `store.ts` | API routing, Firebase token validation and Firestore access. |
| `backend/src/recommendations.ts`, `recommendation-ranking.ts`, `recommendation-explanation.ts` | Candidate filtering, AI ranking, explanation validation and feedback. |
| `backend/src/tinker.ts`, `reader-model.ts` | Real Thinking Machines calls for habit/recommendation and passage analysis. |
| `backend/src/community.ts`, `leaderboard.ts`, `reader-profiles.ts` | Circles, rankings and public profile boundaries. |
| `backend/src/cloud-ebooks.ts` | Authenticated access to approved cloud editions. |
| `backend/test/` | Existing automated domain/API tests. |

## Data and AI boundaries

Firebase Authentication identifies each reader; authenticated API routes scope private Firestore data to that UID. The backend calculates statistics. Tinker selects from real catalog candidates and explains supplied evidence; it does not invent the underlying measurements. A catalog fallback is possible when model results or evidence are unavailable. Model calls have caches and quotas.

The owner's demo history, the cloned test account, and community demo personas contain intentionally fictional data. Some literary feature values are fixtures, not measurements from book text. Preserve synthetic provenance in stored data and distinguish demo evidence from real measurements when developing or evaluating the model. The current demo presentation intentionally suppresses some provenance labels. Do not reseed, delete or copy user histories as part of ordinary frontend work.

Saved sessions, book progress and synced page visits are cloud records. Active timers, personal imports, reader preferences and private margin notes are device-local. Licensed cloud ebooks download to the user's local cache; there is no separate Shared Library tab.

An ebook page is a stable text section, not a print page. Timing records foreground dwell, not gaze or comprehension. There is no ADHD/dyslexia diagnosis. Kindle/Apple Books external tracking, DRM imports, a Chrome extension, standalone wireless hardware, full offline syncing, password recovery and account deletion UI remain outside the current MVP.

## Cloud and publishing

Project: `project-b00660ba-d6d4-4c9a-a05`, region `us-central1`. Firebase Hosting serves the client; Cloud Run serves the backend; Firestore stores private records; private Cloud Storage holds approved ebooks. Tinker credentials remain server-side in Secret Manager (`reading-journal-tinker`).

Keep the original $300 trial billing account (`0165AD-23789C-03FBDF`) and the previously approved $10 development budget. Budget alerts are not a hard cap. Cloud Run currently uses 0 minimum / 1 maximum instance. Changing billing, identities, roles or secret destinations is outside this handoff.

Frontend check and release, on the configured original Mac:

```sh
cd mobile
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src
node node_modules/expo/bin/cli export --platform web --output-dir dist-web
cd ..
python3 scripts/deploy_web.py
```

Keep `mobile/app.json`, `mobile/package.json` and `mobile/public/release.json` versions aligned before exporting. The deployer checks their agreement, validates the asset allowlist and secret scan, verifies the existing trial account, and writes `.local/hosting-release.json`. Confirm the live `/release.json` after publication.

For backend changes, use `npm ci`, `npm run build` and `npm test` in `backend`, then review `scripts/deploy.py`. The cloud scripts and local backend runner currently use machine-specific paths in `scripts/cloud.py` and `scripts/run_backend.py`. They are not portable one-command setup scripts. On a new machine, configure an authorized identity and review those paths before deployment; do not copy the original Mac's credential stores.

To return to an earlier release, rebuild and deploy the corresponding release branch through its own deployment script. Do not reset the shared repository or alter the database to roll back a frontend release.

## Verification baseline

V1.7 passed TypeScript, ESLint, web export and live browser checks. Its before/after comparison covered 14 views, including 320/390/1280-pixel Home layouts: 2,661 visible elements retained identical geometry, typography, border widths, radii, shadows and opacity. Reader tools, share-card export and profile logout were checked. Physical-iPhone and native-binary testing remain distinct from browser testing.

For the next change, verify its affected flow and the shared controls it touches. Use the test account; avoid publishing posts, altering recommendations or saving reading sessions to the owner's account during UI checks. The README contains historical feature notes and additional test/deployment commands.

V1.8 release checks passed: TypeScript, ESLint, web export, matching release metadata, deployment-script syntax, and live browser sign-in, all five tabs, profile logout and backend health. The hosted identifier reports `1.8.0`.

## Post-release USB bookmark integration

The `release/1.8` branch adds a Pico W V2 USB bridge after the immutable `v1.8.0` tag. See [hardware/README.md](../hardware/README.md) for setup, pairing, durable queues, timing semantics and limits. The existing manual reading screen retains its timer and gains six hardware statistics. Triple-click hands off to Finish & log. Saved bookmark sessions use device-confirmed time; session insights retain individual visits and rereads. The firmware runs unchanged in RAM with `--run-v2`, without overwriting Pico files. No additional cloud service or IAM role is required.

## Post-release guest-demo onboarding

The root navigator now protects every business screen, including direct `/finish` links. Guest entry prepares an isolated copy of the test journal using the private `guestTemplates` snapshot before displaying Home. Setup is retryable and create-only; existing guest and registered journals are not overwritten. See the README guest section and `scripts/publish_guest_template.mjs`. The snapshot excludes credentials, live device connections and community identities. Newly added private routes must be included in the root `Stack.Protected` group.
