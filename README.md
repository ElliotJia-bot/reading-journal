# Remarked

Functional hackathon MVP based on the supplied Stitch prototype. Expo/React Native client, Firebase Authentication and Firestore, Express backend, and Thinking Machines Tinker insights. The UI is English.

## Remarked 1.0

The 1.0 iteration lives on `release/1.0`. The installed app, browser title and social card use **Remarked**. In-app screens lead with their purpose rather than a product-name header. Existing Firebase IDs, application identifiers and device-storage keys are intentionally retained so existing journals and imported ebooks continue working.

1. **Record integrity.** Editing only a reflection preserves original seconds and start/end timestamps. Past logs have explicit starting/ending positions. Status transitions retain their history and drop reason. Recording a wishlist book moves it to Reading. Completion dates are recorded prospectively; unknown historical completion dates remain unknown.
2. **Home and Library.** Home shows current reading, streak/personal best, books completed this year, this week's minutes with a comparison to the same weekdays last week, and weekly page progress. Library has four shelves, progress, time and last-read information. The bookmark endpoint is a disconnected provider boundary, not simulated hardware.
3. **Three levels of Insights.** Overview → owned book → reading session. Time/Pages charts show all 7 or 30 calendar days, with empty days and clickable session segments. Book charts also support since-starting. Session detail includes exact recorded time, page progress, reflections, a qualified completion estimate, and available page visits. Tapping a measured ebook section opens the locally stored passage and an optional, explicitly consented Tinker analysis scoped to that session.
4. **Discovery and community.** For You provides up to five personal catalog matches, five exploration matches, and qualifying shared-reader matches. Language filters select matching catalog editions; owned work IDs and dismissed titles are excluded. Yes adds a wishlist entry; Maybe and Not interested sync through private Firestore feedback. Maybe has a saved list. Nonfiction is a preset circle; readers can create up to three custom circles and join/leave. Optional public profiles power Beginner/Experienced rankings and peer suggestions using actual opt-in data, excluding synthetic demo records.

### Insights presentation update

Session Insights uses tappable vertical time-per-page bars and compact stat tiles. Book Insights places “Where & why you slowed down” immediately after the calendar chart and replaces the session list with book-specific behavioral suggestions. Session history remains accessible through chart bars and dates. Reading coach evidence, full passages and detailed content dimensions expand on demand.

Longer dwell is highlighted at 1.5× or more than the median of at least three other comparable pages (10+ seconds, over 100 characters). The comparison normalizes by character count and averages repeated reading sessions; bar heights retain total foreground time. A highlighted page is not proof of difficulty. Local text clues and explicit reactions are shown first; a consented Tinker request can add possible explanations and a next step. Book-period analysis uses only saved sessions in the selected period. Manual logs and insufficient samples have explicit empty states.

### Metric and privacy boundaries

- A streak day has **more than 3 minutes** of saved reading. Home weeks start Monday in the profile timezone. Comparison uses the same elapsed weekdays in the preceding week; zero baseline displays no percentage.
- Page progress is `max(0, ending − starting)`. It is not unique pages or comprehension; rereads may count again. Percentage logs do not add pages. Ebook pages are stable text sections for an imported edition, so they are not interchangeable with printed pages.
- Finished-this-year requires a known completion timestamp. Rereading a previously completed book does not erase that completion. Estimates need at least three sessions over 3 minutes, at least ten forward pages, and a known book length.
- Session page charts show available events from the latest 1,000 synced visits per book. Timing is foreground dwell with background, pauses and 90-second inactivity excluded. A slower section does not establish confusion, attention level or a diagnosis. AI explanations are hypotheses tied to the supplied passage.
- Public profiles are **off by default**. Opt-in discloses only chosen name/group, aggregate totals, and catalog books/topics explicitly liked. Raw timestamps, private notes, location and email are not shared. Turning sharing off removes the public snapshot. Bilateral user blocks apply to discovery as well as conversations.
- Rankings are self-recorded, not verified achievements. They use up to 50 profiles updated within 24 hours. Books use the UTC calendar year; pages, longest sessions and growth use seven UTC calendar days. Peer suggestions need at least three other topic/language-matched readers, and two likes per recommended book. Sparse groups show an honest empty state.
- Full ebook files and margin notes still live on their importing device. Books, saved reading sessions, synced visits, preferences and recommendation feedback follow the account. Reimport the same unencrypted edition on another device to analyze its text there.
- Recommendation catalog descriptions/reviews come from Open Library, not fabricated model reviews. Catalog page counts are edition estimates; adding a recommendation leaves the user's edition length unconfirmed. Password recovery, account deletion, native iOS distribution, paid-book DRM import, physical bookmark and Chrome extension remain outside this iteration.

For an isolated 1.0 integration check, build the backend, run it with `COMMUNITY_NAMESPACE=community_test_v1 PORT=8082 python3 scripts/run_backend.py`, then run `COMMUNITY_NAMESPACE=community_test_v1 python3 scripts/verify_v1.py`. The script creates and removes disposable accounts. `KEEP_QA=1` deliberately retains one account and its local credential file for browser checks; remove that fixture and its test documents afterward. Existing community regression checks also refuse to publish unless the server reports its test namespace.

## Current status

- Email/password and guest sign-in are enabled. Guests can link an email account in Settings without losing their journal.
- Search books via Open Library or enter them manually. Track pages or percentages, Reading / Want to Read / Finished / Dropped shelves, and topic labels.
- Start, pause, resume, and finish reading sessions; the timer survives app reloads. Manually log past sessions; edit/delete sessions and recalculate progress.
- Optional location, reaction, stop reason, topic tags, and private notes.
- Web ebook reader: import unencrypted EPUB or UTF-8 TXT, read without a dashboard, open a hidden bottom tool sheet, bookmark, change font/size/theme, record foreground dwell, write margin notes, and save a reading session to the journal.
- Optional current-page content analysis combines the excerpt with recorded dwell and reactions. Six dimensions cover vocabulary, sentences, abstraction, density, literary features, and pacing. Excerpts are sent to Tinker only after explicit consent.
- Deterministic 7-day, 30-day, and all-time statistics, grouped in the profile timezone. Topic time is divided equally across tags; it is not measured content-level attention.
- Tinker produces three evidence-linked cards: habit, interest, and suggestion. Reports and feedback persist in Firestore; unchanged evidence reuses a cached report.
- Real backend tests passed for authentication, save/retry deduplication, cross-user isolation, direct-write denial, statistics, model output, caching, feedback, and progress recalculation. Disposable test users are removed afterward.
- Community includes interest circles, membership, reading check-ins, questions, book recommendations, encouragement, comments, reporting, blocking/unblocking, and author-only post removal.
- Browser flow verified with disposable test journals and original test text. Thirty-seven automated tests pass. The web bundle exports successfully; this is **not** a signed or device-tested iOS binary. The ebook reader currently runs in the web/Safari version; native builds show a web-reader notice.

Cloud Run is **deployed and verified** in `us-central1` as of November 7, 2026. The app uses <https://reading-journal-api-au6vfycphq-uc.a.run.app>. The service allows the hosted frontend origins; the latest deployed revision is recorded locally after each deployment. Cloud checks cover reading records, Tinker, cross-user isolation, community membership, feeds, and ebook event deduplication/consent. The frontend is published on Firebase Hosting at <https://project-b00660ba-d6d4-4c9a-a05.web.app>.

## Try on iPhone and the web

Open the hosted URL on a computer or in iPhone Safari. In Safari choose **Share → Add to Home Screen → Open as Web App** (if shown) → **Add**. The installed icon opens the same web app in standalone mode. No Apple Developer account is required for this path; this is not an App Store or TestFlight binary. The Mac does not need to stay on.

Sign in with the same email on each device. To retain a guest journal from localhost, first use **Library → Settings → Create account and keep records** there, then sign in on the hosted site. Guest sessions from different origins/devices are not automatically merged. Saved books and sessions refresh on returning to the app or via **Refresh saved records**; the active timer stays on its originating device.

The in-app **Install & testing guide** is at `/install`. Test: add a book, start/pause/resume, reload to restore the timer, finish and enter an ending page, save, open Insights → Reading coach to generate habit suggestions, use For You to discover books, then visit Community. Sharing is opt-in. Internet is required for login, cloud saves, and analysis. No service worker or general offline write queue is installed. The ebook reader locally retains unsynced page events for retry, but the app is not a fully offline application.

For ebooks choose **Add Book → Read inside your journal**, select a file or **Try a sample ebook**, to enter reading. The foreground timer starts automatically when the reader opens. Tap the bottom **Reading tools (☰)** button, then **Insights** to review recorded timing, optionally consent to passage analysis, and save the session with a location/reaction. Imported titles have a **Continue reading** button on their detail page. The included sample and `docs/reader-fixtures/` contain original demonstration text.

Browser QA covers 390×844 and 1280×900 layouts. A disposable registered account completed the timer and save flow; an independent sign-in read the exact book, page progress, duration, and location. A real Tinker call returned three cards. Community navigation was verified from Insights through the circle view. Testing on an actual physical iPhone remains for the user.

To publish an update:

```sh
# From mobile, with Node on PATH
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js src
node node_modules/expo/bin/cli export --platform web --output-dir dist-web
# From the project root
python3 scripts/deploy_web.py
```

`hosting.config.json` declares the existing site and SPA deep-link rewrite. The deployer validates the export, checks for private keys, verifies the trial billing account and authorized login domains, preserves the backend instance limits, uploads only static web assets, and records the release in `.local/hosting-release.json`. Service credentials, local test accounts, source code, and native bundles are excluded. `docs/iphone-qr.png` links to the hosted site.

## Source checkout

Use Node.js 24 and pnpm. From a fresh checkout:

```sh
cd backend
npm ci
npm run build
npm test
cd ../mobile
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Fill `mobile/.env.local` with the Firebase web-app configuration for the project and its backend URL. For the existing hosted backend, use `https://reading-journal-api-au6vfycphq-uc.a.run.app` as `EXPO_PUBLIC_API_URL`; all business requests still require Firebase sign-in. Start the browser preview with `pnpm web` from `mobile`.

This repository contains source, design references, original reader fixtures, and QA screenshots. Cloud user records, demo-account backups, API secrets, local credentials, installed dependencies, and generated builds are excluded. Tinker credentials belong only on the backend. The cloud administration scripts are configured for the existing hackathon project and original development Mac; they are not a generic one-command deployment to a new account.

## Run locally on this Mac

Open <http://localhost:8081> while the Expo preview is running. No local backend is required.

```sh
# From this project directory
export PATH=/Users/elliotjia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
cd mobile
node node_modules/expo/bin/cli start --web --port 8081
```

Dependencies are already installed. To reinstall, use pnpm with Node 24 on PATH in `backend` and `mobile`. Follow `mobile/AGENTS.md` when changing Expo dependencies. This machine has command-line Xcode tools, not the full Xcode simulator setup.

Local-only configuration lives in `.local/` and `mobile/.env.local`; do not share those folders. For optional local backend development, build with `cd backend && node node_modules/typescript/bin/tsc`, return to the project root and run `python3 scripts/run_backend.py`, then set `EXPO_PUBLIC_API_URL=http://localhost:8080` in `mobile/.env.local` and restart Expo. Google uses a standard local application credential with this project's quota. The local runner reads `.local/tinker.key`; the deployed backend reads Secret Manager. No model key is bundled into the app.

## Google Cloud configuration

- Project: `project-b00660ba-d6d4-4c9a-a05`.
- Billing remains `0165AD-23789C-03FBDF`, the authorized $300 trial account. The education account is not used.
- Firebase enabled; Firestore default database created in `us-central1`; guest and email/password authentication enabled.
- Firestore rules published: users can only read their own profile/books/sessions/insights. Client writes are denied. All writes pass through validated backend routes and the user ID comes from a verified Firebase token.
- A project-specific **monthly $10 budget alert** is configured at 50%, 80%, and 100%, calculated before credits. This is a notification, not a spending cap. The authorized $10 development budget still applies.
- Deployed Cloud Run service: 0 minimum / 1 maximum instance, 512 MiB, concurrency 10. All business routes require Firebase authentication; `/health` is public.
- Runtime identity: `reading-journal-api`, with Firestore read/write and Firebase user-read roles, plus access only to Secret Manager secret `reading-journal-tinker` (pinned to version 1). Build identity: `reading-journal-build`, with `roles/run.builder`. These identities and permissions were explicitly approved.
- AI generation limits: 10 new reports per user/day, 50 across the demo/day. Failed attempts also count. These limits are not a total Google Cloud cost cap.

To redeploy backend changes, run `python3 scripts/deploy.py`. It checks the billing account and the exact upload allowlist, pins the secret version, and updates the app API URL. Restart Expo afterward. Run `python3 scripts/smoke.py` against the deployed URL. The client CORS allowlist permits the two local preview origins and this project's `.web.app` and `.firebaseapp.com` origins. Native installation/signing and physical-device testing remain pending.

## Verification

```sh
# From backend (Node on PATH)
node node_modules/typescript/bin/tsc
node --import tsx --test test/*.test.ts

# From mobile
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js .
node node_modules/expo/bin/cli export --platform ios
node node_modules/expo/bin/cli export --platform web

# From project root; uses temporary guest users and a real Tinker call
python3 scripts/smoke.py
# Optional local backend target:
# BACKEND_URL=http://localhost:8080 python3 scripts/smoke.py
```

## Data flow and limitations

`App → Firebase sign-in → authenticated backend → users/{uid}/… in Firestore`. Registered users share records across devices by signing into the same account and refreshing. The active timer is local to one device. Cached data and timers survive connection failures, but saving requires a connection; a full offline write queue is not implemented.

The backend computes counts, durations, time groups, places, topic shares, and author statistics in `shared/domain.ts`. General habit cards send Tinker aggregates, topic labels, and the reading goal, not email addresses, private notes, or GPS coordinates. The separate ebook passage analysis sends the current excerpt and page evidence only after consent. The model may still make mistakes; cards are observations and experiments, not diagnoses or proven causes. Structured output and evidence IDs are validated.

Kindle/Apple Books integration, external page detection, camera/ISBN scanning, full-book analysis, and the Chrome extension are future work. Book search returns catalog works; readers confirm their edition's page count. There is no App Store/TestFlight release, signed build, password reset flow, or account deletion UI yet. Public launch also needs abuse protection, privacy/deletion controls, and device testing.

## Ebook reader scope and data

- Import is text-only: unencrypted EPUB (up to 20 MB) or UTF-8 TXT (up to 2 MB). EPUB extraction has file-count and decompression limits. Scripts and embedded media are discarded, external resources are not loaded, and encrypted EPUBs are rejected. PDFs, image-heavy/fixed-layout books, and protected Kindle/Apple Books purchases are not supported.
- A page is a stable text segment of at most 1,000 UTF-16 characters, identified by file content hash, chapter, offsets, and text hash. Font size does not change these page IDs. These are **not** print-edition or Apple Books page numbers; the same file must be reimported to preserve the edition mapping.
- Book text stays in this browser's IndexedDB, scoped to the signed-in user. Font, type size, theme, bookmarks, margin notes/drafts, and the active reading position/timer remain on this device. Metadata, saved progress/sessions, and synced page events are private cloud records; another device needs the same ebook imported locally. Clearing browser storage removes the local ebook and unsynced events.
- Timing measures foreground dwell, not gaze, comprehension, or confirmed reading. The reader pauses when hidden/unfocused, when selecting text or using any tool sheet, after a sleep gap, or after 90 seconds without interaction. Closing a tool sheet resumes reading; a paused reader exposes a small resume control. It records revisits; existing explicit page reactions remain in history. The streamlined reader collects an overall reaction when saving the session. Save the session to update journal duration, location, reaction, and book progress.
- Page analysis is limited to the current excerpt. It reports simple text proxies and tentative model interpretations, with exact quoted evidence. A relative pace baseline requires at least three other sufficiently observed pages. Word-length metrics are English-oriented and unreliable for CJK; timing alone cannot establish why someone slowed down or what they liked. Full-book symbolism, narrative structure, and reading comprehension are not measured.
- Explicit analysis consent sends at most 1,200 excerpt characters plus page metrics/reactions to Thinking Machines. The backend stores the resulting report and short evidence quotes, not the full ebook. Page-analysis and habit-card generation share the existing daily model quotas and cache policy.
- Reading events and reports are served only through authenticated `/v1/reader` endpoints, scoped to the caller. Client Firestore access is denied. Immutable event IDs make retry safe; excerpt hashes must match a recorded page. Read history currently includes at most the latest 1,000 events per book.
- Page events/reports are independent records: editing or deleting a journal session does not delete its underlying page events or cached analysis. There is not yet an in-app control to delete ebooks, page history, or reports; operator-assisted deletion is required. Account and data deletion controls are a prerequisite for public launch.
- No dyslexia, ADHD, disability screening, diagnosis, or reading-ability score is implemented. The product describes reading patterns and offers voluntary reading strategies.

Reader verification covers stable pagination, background/idle timing, event validation, consent, output/quote validation, retry deduplication, and cross-user isolation. Browser QA imports an original EPUB, changes typography/theme, records two pages, requests a real Tinker analysis, restores the reading position after reload, and saves the session with 2/3 progress and the selected location/reaction. Reader screenshots at 390×844 are in `docs/ebook-reader-mobile.png` and `docs/ebook-analysis-mobile.png`. The hosted entry and reader bundle match the tested export. `scripts/verify_reader.py` operates only on the disposable `reader-qa-…@example.invalid` account created for that workflow; `--cleanup` removes that account and its nested private records.

References: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Open Library search](https://openlibrary.org/dev/docs/api/search), [Tinker model catalog](https://tinker-docs.thinkingmachines.ai/tinker/serverless.json).

## Community MVP

The second Stitch export is preserved in `design/community-v2/`. The app adds a fourth Community tab and the five supplied flows. It uses real membership and activity counts; the prototype's fictional people and large member counts are not seeded into live circles.

- Circles: Quiet Fiction Club, The 10-Minute Reading Habit, and Philosophy & Ideas. Recommendations explain exact matches to the user's explicitly selected topics.
- Reading sessions remain private until the reader selects **Share with a circle**, chooses what to include, reviews the preview, and confirms publication. Only book title/author/cover, the optional duration/progress, an explicitly entered reflection, and a chosen display name are published. Private notes, location, reading timestamps, source session IDs, and email are omitted. Published posts have their own publication timestamp.
- Anyone signed in can view circle posts. Joining is required for posting, replying, and encouraging. Share text says that content is visible to signed-in readers.
- Sharing copies a snapshot of selected fields; later edits to the private session do not change the public post. Removing the public post hides it, redacts its content, and removes its comments and encouragements, while retaining an empty ownership tombstone against replay. The private reading session remains intact.
- Drafts are saved locally per signed-in user. Failed publishing retains the draft. Stable IDs make retries idempotent for posts, replies, and membership; encouragement uses explicit on/off state.
- Blocking works in both directions for post visibility and interactions. Blocked readers can be unblocked from Community. Reports are stored privately for operator review; there is no moderation dashboard or automated moderation service yet.
- Feeds show the latest 50 post records; conversations allow up to 100 replies. Posting limits are 20 posts and 80 replies per user per UTC day. Infinite scrolling, post editing, comment deletion, direct messaging, local events, notifications, and leaderboards are not implemented.
- Community data is served through authenticated `/v1/community` routes. Existing Firestore rules deny direct client access to these collections; the backend checks membership, authorship, and blocks. Private journal endpoints remain isolated by user.

### Community testing

`scripts/test_community.py` refuses to publish unless the backend reports its isolated test mode. It creates disposable guest accounts, exercises all three post types, retries, private-field omission, cross-user reading, reporting, blocks, removal, and direct Firestore denial, then cleans up its own accounts and posts.

```sh
# From the project root, after building backend
COMMUNITY_NAMESPACE=community_test_hackathon PORT=8082 python3 scripts/run_backend.py
# In another terminal
python3 scripts/test_community.py
```

The namespace is an operator-side environment setting, never a client-selected collection path. Live Cloud Run uses the default `community` namespace. Browser QA uses clearly labelled isolated test conversations; these are not published into live circles.


## Immersive reading and margin notes

The reading surface shows only text, a subdued running header and page navigation. The bottom menu opens a modal tool sheet for appearance, notes, contents/bookmarks, insights and finishing a session. Native text selection is retained: long-press and adjust the handles on a phone, or drag over a sentence on desktop, then choose **Write a note**. The selected excerpt is limited to 600 characters; the reflection to 1,200 characters. Saved notes highlight the matching text and link back to the reading page.

Private notes and unfinished drafts stay in local browser storage, scoped to user/book. They survive refresh but do not sync across devices and are lost if browser data is cleared. Note editing/deletion and full-library export are not yet implemented. Published reflections can be exported as PNG cards. Publishing is a separate opt-in flow: **Save private note → Share to a Circle → choose/join circle → Publish to Circle → Published + share card**. The backend verifies membership and ownership of the ebook, bounds the page, and publishes only the selected excerpt, reflection, book title/author/cover, reading-page number and public display name. It does not upload the full ebook or authenticate a quote against a publisher's edition. Private note IDs, source book IDs, other notes, timing and location are not in the public post.

The new **Margin note** post type uses existing community reporting, blocking, encouragement, replies and author-only removal. Deleting the public post redacts the excerpt too; it does not delete the private note. Stable locally persisted delivery IDs prevent duplicate posts on retry. Test publishing uses only `community_test_immersive`, not live circles.

Validation: 16 automated tests, client lint/typecheck, isolated live backend tests for excerpt ownership/page bounds/privacy/retries/removal, and browser checks at 390×844 for sentence selection, private note persistence, direct circle publishing, font/theme restoration and session saving. Physical iPhone long-press/keyboard behavior still needs device testing. Screenshots: `docs/immersive-reading-mobile.png`, `docs/immersive-tools-mobile.png`, `docs/immersive-note-mobile.png`, `docs/immersive-circle-mobile.png`.


### Social image cards

The reader no longer has a separate **Preview sharing** step. Its destination form states the audience and the next action is **Publish to Circle**. Success displays **Published ✓** and generates a 1080×1350 PNG card locally: charcoal background, cream text, initial avatar, public display name, publication date, full reflection, book title/author and a small Reading Journal signature. No QR code, email, location, timing or private note IDs are included. The card intentionally features the reader's reflection rather than reproducing the selected book excerpt.

**Share image** invokes the browser's native file-sharing menu from the user's click, using already generated files to preserve user activation. The user chooses the destination; the app does not post directly to Instagram or guarantee that any particular installed app appears. **Save image** downloads each PNG, with long-press saving also available in supporting browsers. Unsupported/failed sharing offers a save-and-upload fallback; cancelling the native menu does not display a false success or error. There is no claim that a successful handoff means a social post was published.

Long reflections are reflowed and split into numbered cards without dropping text. Extremely newline-heavy text is reflowed with condensed whitespace to avoid generating dozens of mostly empty cards. English, CJK and composed emoji layout have automated coverage. Image creation errors do not undo Circle publication and have a separate retry. Published notes can reopen their image card through **Share image**, fetching the existing post without republishing it.

Browser QA verified a single-click Circle publish in `community_test_cards`, the success page, Chinese card rendering and an actual downloaded 1080×1350 PNG. The system file-share request was invoked; the native destination chooser and an actual Instagram upload were not verified on a physical iPhone. Screenshots/artifacts: `docs/share-card-success-mobile.png`, `docs/share-card-example.png`. All test accounts/posts are disposable and cleaned after testing.


### Automatic reader completion

Opening an ebook starts its foreground dwell timer. Finishing via the top back arrow, the tool sheet's **Finish & log** / **Back to Library**, the end-of-book button, or an in-app back navigation hands off to **Finish and log** only when accumulated effective time is **strictly greater than 180,000 ms**. Reaching three minutes does not interrupt the text. Shorter visits remain local drafts that can be continued; they do not create completed journal sessions. The clock excludes hidden/blurred time, tool sheets, note writing, long scheduling gaps and inactivity after 90 seconds. Turning a page resumes an idle-paused reader. This is foreground dwell, not proof of attention or comprehension.

The confirmation form receives the original session ID, exact whole-second active duration and reading-page progress. Location and reflection are optional user input. **Save Session** uploads remaining immutable page events, then saves a `reader` session to update journal statistics. The paused pending log is persisted before navigation and can be reopened from the Library; refreshing the confirmation does not turn it into a manual session. Successful saves reset the local reader draft; reloading an old saved confirmation cannot create another session. Network errors retain the pending log for retry. Page counts refer to this reader's stable text sections, not printed pages.

Closing or terminating a browser cannot reliably navigate to another screen. Local reader drafts survive when browser storage is retained; returning to that ebook resumes the draft. Browser unload may display a native unsaved-reading prompt for a qualifying visit. Pending completion logs and draft text remain device-local until saved; clearing browser storage loses unsaved drafts.

Completion validation: 18 automated tests pass, including the strict three-minute boundary, excluded background/paused intervals, stable handoff IDs and reset behavior. Client typecheck/lint pass. Browser QA at 390×844 verified a short draft without a completed session, an actual 263-second/four-page reading session, browser-back handoff, reload restoration, Library recovery, connection failure plus retry, successful habit statistics, and a fresh 12-second draft after saving. `scripts/verify_reader_completion.py` confirms the reader source, exact page-event duration, location/reaction, book progress and retry deduplication on only the disposable QA account. Screenshots: `docs/reader-finish-mobile.png` and `docs/reader-finish-insights-mobile.png`. Physical iPhone verification remains separate from browser viewport testing.

### Insights and book discovery

**Insights** now has **Overview** and **Reading coach**. The existing Thinking Machines generation and feedback flow lives in Reading coach, with the selected 7-day, 30-day or all-time period. Reports for a different period are not presented as the current period's advice. Overview contains a fixed rolling seven-calendar-day chart (including today), with local-timezone dates, weekday/date labels, minute labels, a vertical minute scale and a distinct today color. Every date keeps its column; zero-reading dates have zero bar height. An entirely empty week still shows all seven dates. The separate period selector below the chart filters the other habit totals, places, topics and authors; it does not change the explicitly labelled seven-day chart.

**For You** is book discovery. Choose an existing book (books with explicitly liked sessions are offered first) or a topic. On request, Open Library supplies real catalog records. Matching uses up to three shared catalog subjects/user book tags and author overlap, with a stated reason per result. The matching edition title is preferred when supplied. It does not infer plot similarity or enjoyment from reading time, fabricate books, or claim full-text semantic analysis. Unknown titles without author/topic evidence ask the reader to choose a topic instead. Existing shelf entries, duplicate results and locally hidden suggestions are excluded. **Add to Want to Read** saves through the authenticated existing books API, using a stable catalog-based ID for retry safety. Page count stays unknown until the user supplies their edition; adding a title does not import its ebook.

Catalog lookups are user-triggered, bounded (five seed matches plus up to 40 candidates), queued at no more than one request per second per app instance, and cached in memory for 30 minutes (up to 30 queries). Only the selected title/author/topic goes to Open Library; reading timestamps, notes and locations are excluded. **Not for me** persists up to 200 hidden work IDs locally per signed-in user and offers a reset; this preference does not yet sync across devices. Catalog availability and metadata quality bound recommendation quality. There is no new model service or extra cloud permission for book discovery.

Discovery validation: 22 automated tests pass, covering seven-day gaps, empty weeks, DST/year boundaries, real metadata matching, preferred-edition identity, and exclusion of owned/hidden/duplicate works; client typecheck and lint pass. Browser QA at 390×844 used explicitly synthetic records (79 minutes over four of seven days), verified the chart's three empty dates, generated a real three-card Tinker report inside Insights, retrieved live Open Library recommendations from The Hobbit, saved The Silmarillion to Want to Read, hid another suggestion and confirmed both exclusions after reload. The saved wishlist record and unchanged reading totals were verified through the authenticated API. Test account/data were cleaned. Screenshots: `docs/insights-seven-days-mobile.png`, `docs/for-you-books-mobile.png`.


### Library naming

The collection is consistently named **Library** throughout current app UI, including the My Library heading, bottom navigation, Add to Library, Go to Library, Back to Library, recommendation source/saved states, reading flows, community return actions, the installation guide and backend not-found messages. Source-wide and production-bundle copy checks pass; the bundled third-party icon map still contains its unused icon identifier. Typecheck/lint and all 22 existing tests pass. Browser QA verified adding a sample book and finishing/saving a session back to My Library. The live backend not-found response and published page hashes were verified. QA account/data were cleaned. Screenshot: `docs/library-ui.png`.
