# Build Guide — Obsidian Study Session Tracker

A step-by-step path from an empty folder to a plugin accepted in the Obsidian community store.
Written for someone who is comfortable programming but **not** a frontend developer.

Companion to [`PRD.md`](./PRD.md). Where this guide says "§N", it means that section of the PRD.

---

## 0. How to use this guide

- Work through the phases **in order**. Each phase ends with a **✅ Checkpoint** — don't move on
  until it passes. Small, verified steps beat big, broken ones.
- Each phase has three parts:
  - **Why** — the thinking behind it, so you can make your own calls later.
  - **Do** — concrete steps and commands.
  - **Checkpoint** — how you know it worked.
- Commit to git at every checkpoint. If something breaks later, you can always go back.
- When stuck, paste the error and the relevant file into Claude Code and ask. Suggested prompts are
  given at the end of each phase.

### Mental model for a non-frontend developer

You don't need React, CSS frameworks, or a web server. An Obsidian plugin is:

1. **One TypeScript file tree** that gets bundled into a single `main.js`.
2. A **`manifest.json`** that tells Obsidian the plugin's id, name, and version.
3. A class that extends `Plugin` with an `onload()` method. Obsidian calls `onload()` when the
   plugin is enabled. Inside it you **register** things: commands, event listeners, a settings tab.
4. Obsidian gives you an object, `this.app`, through which you reach everything:
   - `this.app.vault` — files (read, write, create, events when they change)
   - `this.app.workspace` — what's open on screen (events when the active note changes)
   - `this.app.metadataCache` — parsed info about notes (links, tags, headings)

Think of it as a backend service whose "API server" is Obsidian itself. Almost all of this plugin
is plain logic: listen to events, keep a record, write a text file. The only UI is a settings page,
two commands, and a status bar label — all built with Obsidian helpers, no HTML/CSS knowledge needed.

---

## Phase 1 — Set up your tools (≈ 30 min)

### Why
You need Node.js (to build TypeScript into JavaScript), a code editor, and a **separate test vault**
so a bug never touches your real notes.

### Do
1. **Install Node.js LTS** (v20 or newer). On macOS:
   ```bash
   brew install node
   node -v   # should print v20.x or higher
   npm -v
   ```
2. **Install Obsidian** desktop if you haven't.
3. **Create a test vault.** In Obsidian: *Open another vault → Create new vault* → name it
   `study-dev-vault`, put it somewhere like `~/dev/study-dev-vault`. Add 5–10 dummy notes with some
   `[[links]]` between them and a few `#tags`. This is your playground.
4. In the test vault, enable the **Daily notes** core plugin (*Settings → Core plugins → Daily notes*)
   and set a folder, e.g. `Daily`.
5. **Turn on community plugins** in the test vault: *Settings → Community plugins → Turn on*.
6. Install **Hot-Reload** (`pjeby/hot-reload` on GitHub) into the test vault. It reloads your plugin
   automatically every time you rebuild, so you don't restart Obsidian constantly. Install it by
   downloading its release into `study-dev-vault/.obsidian/plugins/hot-reload/` and enabling it.
7. Open the developer console in Obsidian: **`Cmd+Option+I`** (macOS). The *Console* tab is where your
   `console.log` output and errors appear. You will live in this window.

### ✅ Checkpoint
- `node -v` works.
- Test vault opens, has notes, Daily notes is enabled, dev console opens.

---

## Phase 2 — Scaffold the plugin from the official template (≈ 30 min)

### Why
Obsidian maintains a sample plugin with the build already configured (TypeScript + esbuild).
Starting from it avoids hours of build-tool yak-shaving.

### Do
1. Develop the plugin **inside** the test vault's plugins folder, so Obsidian sees it directly.
   This repo (`today-i-learnt-extension`) will be the plugin, so either:
   - **Option A (simplest):** symlink this repo into the vault:
     ```bash
     ln -s ~/dev/today-i-learnt-extension ~/dev/study-dev-vault/.obsidian/plugins/study-session-tracker
     ```
   - **Option B:** clone/develop directly inside `.obsidian/plugins/study-session-tracker/`.

   Option A keeps your git repo where it is. Use it.
2. Copy the template files into this repo (keep your `docs/` folder):
   ```bash
   cd ~/dev/today-i-learnt-extension
   git clone https://github.com/obsidianmd/obsidian-sample-plugin.git /tmp/sample
   rsync -av --exclude .git /tmp/sample/ ./
   rm -rf /tmp/sample
   npm install
   ```
3. Edit **`manifest.json`**:
   ```json
   {
     "id": "study-session-tracker",
     "name": "Study Session Tracker",
     "version": "0.1.0",
     "minAppVersion": "1.5.0",
     "description": "Track focused study sessions and write a summary of what you learned into your daily note.",
     "author": "Your Name",
     "authorUrl": "https://github.com/sukritaz",
     "isDesktopOnly": false
   }
   ```
   Rules the store enforces: the `id` must **not** contain the word "obsidian", and the id must match
   the folder name in `.obsidian/plugins/`.
4. Edit `package.json` → set `"name": "study-session-tracker"`.
5. Start the watcher:
   ```bash
   npm run dev
   ```
   Leave this terminal running. Every save rebuilds `main.js`; Hot-Reload picks it up.
6. In Obsidian: *Settings → Community plugins* → enable **Study Session Tracker**.

### ✅ Checkpoint
- The sample plugin's ribbon icon / "Open sample modal" command appears.
- Change the text of the sample `Notice` in `main.ts`, save, and see the change without restarting
  Obsidian.
- Commit: `chore: scaffold from obsidian-sample-plugin`.

> **Ask Claude Code:** "Explain every file in this repo that came from the Obsidian sample plugin
> and what each one does."

---

## Phase 3 — Plan the folder structure around the PRD's seams (≈ 30 min, no code yet)

### Why
The PRD (§5) says the whole design hinges on three contracts: **events → store**,
**record → summarizer**, **summary → sink**. If each one lives in its own folder with a small
interface, then v1.2 (MCP server), v2 (Chrome extension) and v3 (publish) are *additions*, not
rewrites. Deciding this now is the most important architectural step.

A second rule: **keep pure logic separate from Obsidian.** Code that doesn't `import 'obsidian'`
can be unit-tested with plain `npm test`, no Obsidian running. Put as much as possible there.

### Do
Delete the sample code from `main.ts` and create this layout:

```
src/
  main.ts                    # Plugin class: wires everything together. Thin.
  settings.ts                # Settings type, defaults, settings tab UI
  types.ts                   # SessionRecord, SessionEvent, Summarizer, Sink interfaces

  core/                      # PURE — no 'obsidian' import
    session.ts               # SessionStore: start(), addEvent(), stop() → SessionRecord
    derive.ts                # events[] → derived { notesTouched, timePerNoteSec, ... }
    block.ts                 # render the %% %% block; find/replace it in a note's text

  sources/
    obsidianSource.ts        # listens to vault/workspace/metadataCache → emits events

  summarizers/
    template.ts              # PURE — deterministic summary
    claude.ts                # Claude API via requestUrl
    index.ts                 # pick backend + fallback logic

  sinks/
    dailyNote.ts             # finds/creates today's daily note, writes the block

  storage/
    recordStore.ts           # save/load session JSON files in the plugin folder

tests/
  derive.test.ts
  block.test.ts
  template.test.ts
```

The sample template already builds from `src/main.ts`, so no bundler changes are needed — just add
the new folders next to `src/main.ts` and `src/settings.ts`.

Write **`src/types.ts`** first — it is the contract everything else codes against. The full file is
in the repo; the key part is the event shape:

```ts
export type SourceId = "obsidian" | "chrome" | "web-search";

interface BaseEvent {
  ts: string;          // ISO timestamp
  source: SourceId;    // who reported it — informational only
}

export type SessionEvent =
  | (BaseEvent & { type: "note.open";   path: string })
  | (BaseEvent & { type: "note.create"; path: string })
  | (BaseEvent & { type: "note.modify"; path: string; bytesDelta: number })
  | (BaseEvent & { type: "note.rename"; path: string; oldPath: string })
  | (BaseEvent & { type: "note.delete"; path: string })
  | (BaseEvent & { type: "link.follow"; from: string; to: string })
  | (BaseEvent & { type: "tag.touch";   path: string; tag: string });

export type SessionEventType = SessionEvent["type"];
```

Plus `DerivedStats`, `SessionSummary`, `SessionRecord` (with `sources: SourceId[]`), and the
`Summarizer` and `Sink` interfaces.

**Thought process — why generic event names?** Event types say *what happened* (`note.open`), not
*who reported it* (`obsidian.note.open`). Consumers like `derive` and the summarizers only care what
happened, so they never need `if (source === …)` branches. `source` is recorded on each event for
provenance only. A new source (Chrome) adds new types (`page.visit`) instead of renaming old ones.
Events hold only plain strings/numbers — never Obsidian objects like `TFile` — so any source can
emit them and the MCP server can read them from JSON. See PRD §6 "Event schema rules".

**What's a discriminated union?** Each line of `SessionEvent` is one event shape; `type` tells
TypeScript which one you have, so it checks fields for you:
```ts
if (e.type === "link.follow") {
  e.from;   // ✅ OK
  e.path;   // ❌ compile error — link.follow has no path
}
```

### ✅ Checkpoint
- Folder skeleton exists, `npm run dev` still builds (empty files with `export {}` are fine).
- `main.ts` is an empty plugin that just logs `"Today I Learnt loaded"` in `onload()`.
- Commit: `chore: project structure and core types`.

> **Ask Claude Code:** "Review src/types.ts against docs/PRD.md §6. Is anything missing that the MCP
> server or publish phase would need?"

---

## Phase 4 — Add unit testing for pure code (≈ 20 min)

### Why
Testing pure functions is fast and gives you confidence without clicking around Obsidian. You'll
write the trickiest logic (time-per-note math, block find/replace) as pure functions, so this pays
off immediately.

### Do
```bash
npm install -D vitest@3
npm pkg set scripts.test="vitest run" scripts.test:watch="vitest"
```
Pin `vitest@3`: Vitest 4 needs Node ≥ 20.19, and on older Node 20 npm crashes with
`Cannot read properties of null (reading 'edgesOut')`. (Upgrading to Node 22 LTS also works.)

Add `"tests/**/*.ts"` to `include` in `tsconfig.json`, otherwise `npm run lint` fails on test files.
Tests never end up in `main.js` — esbuild only bundles what `src/main.ts` imports.

Write a trivial test (`tests/sanity.test.ts`: `expect(1 + 1).toBe(2)`) and run `npm test`.

### ✅ Checkpoint
- `npm test` passes. Commit.

---

## Phase 5 — The Session Store and start/stop commands (≈ 1–2 h)

### Why
This is the smallest end-to-end slice: start, stop, see something. Build it before any capture so
you can see the loop working early.

Key decisions:
- **One active session at a time.** Starting while one is active → show a notice, do nothing.
- **Crash safety.** If Obsidian closes mid-session, you'd lose the session. Save the in-progress
  record to disk every ~30s and on every stop; on load, if an unfinished session file exists, offer
  to resume or stop it. (Nice-to-have for the first pass — add a `TODO` and come back to it.)
- **Visible state.** A status bar item ("📖 Studying · 12m") so the user always knows a session is
  running.

### Do
1. `core/session.ts`: a `SessionStore` class with
   - `start(now: Date): SessionRecord`
   - `addEvent(e: SessionEvent): void` (ignored if no active session)
   - `stop(now: Date): SessionRecord` (sets `end`, `durationSec`)
   - `get active(): SessionRecord | null`

   Pass `now` in as an argument instead of calling `new Date()` inside — that makes it testable.
2. In `main.ts`, register two commands:
   ```ts
   this.addCommand({
     id: "start-study-session",
     name: "Start study session",
     callback: () => this.startSession(),
   });
   this.addCommand({
     id: "stop-study-session",
     name: "Stop study session",
     callback: () => this.stopSession(),
   });
   ```
   Store guidelines: **don't set default hotkeys**, and use sentence case for names.
3. Add a status bar item with `this.addStatusBarItem()` and update its text every 30s using
   `this.registerInterval(window.setInterval(...))`. (`registerInterval` auto-cleans on unload.)
4. For now, `stopSession()` just does `console.log(record)` and shows `new Notice("Session stopped")`.

### ✅ Checkpoint
- Command palette (`Cmd+P`) → "Start study session" → status bar shows it's running.
- "Stop study session" → console shows a record with correct start/end/duration.
- Unit test for `SessionStore` passes.
- Commit: `feat: session start/stop commands`.

---

## Phase 6 — Capture vault activity (the Obsidian signal source) (≈ 3–4 h)

### Why
This is PRD §7. The source's only job is to **translate Obsidian events into `SessionEvent`s** and
hand them to the store. It must not know about summaries or daily notes. That isolation is what
lets a Chrome extension become "just another source" later.

Always register listeners with `this.registerEvent(...)` — Obsidian then removes them automatically
when the plugin unloads (a store-review requirement, and it prevents memory leaks).

### Do — event by event

| PRD signal | Obsidian API | Notes |
|---|---|---|
| `note.open` | `workspace.on("file-open", file => …)` | `file` can be `null` (empty tab) — skip it. |
| `note.create` | `vault.on("create", file => …)` | **Also fires for every file at vault startup.** Only register it inside `workspace.onLayoutReady(...)`, and only record while a session is active anyway. |
| `note.modify` | `vault.on("modify", file => …)` | Fires *a lot* (every autosave, ~every 2s). Debounce/merge consecutive modifies of the same file into one event. `bytesDelta` = new `file.stat.size` minus last known size. |
| `note.rename` | `vault.on("rename", (file, oldPath) => …)` | Update paths you've already recorded so time-per-note stays correct. |
| `note.delete` | `vault.on("delete", file => …)` | |
| `tag.touch` | `metadataCache.on("changed", (file, data, cache) => …)` | Compare the file's tags before vs. after (`getAllTags(cache)` from `obsidian`). Emit only *new* tags. |
| `link.follow` | *No direct event.* | Infer it: on `file-open`, check whether the **previous** file's links (`metadataCache.getFileCache(prev).links`) resolve to the newly opened file (`metadataCache.getFirstLinkpathDest(link.link, prev.path)`). If yes → `link.follow {from, to}`. |
| time per note | `workspace.on("active-leaf-change", …)` | Don't compute time here — just emit `note.open` with a timestamp. Time is **derived** later from the gaps between opens (next phase). |

Filters to apply in the source:
- Only `TFile`s with extension `md` (check `file instanceof TFile && file.extension === "md"`).
- **Ignore the plugin's own write to the daily note** at stop time, otherwise the summary write
  shows up as user activity. Simplest: stop the session (freeze events) *before* writing.

### ✅ Checkpoint
- Start session, open 3 notes, follow a link, edit one, add a tag, create a note, stop.
- The console-logged record contains exactly the events you expect — no flood of `modify`s, no
  startup `create`s.
- Commit: `feat: capture obsidian vault activity`.

> **Ask Claude Code:** "Write src/sources/obsidianSource.ts per docs/BUILD_GUIDE.md Phase 6. It should
> take a callback `(e: SessionEvent) => void` and register all listeners through plugin.registerEvent."

---

## Phase 7 — Derive stats (pure, tested) (≈ 1–2 h)

### Why
Raw events are noisy; summaries need clean numbers. `derive(events, start, end)` → `DerivedStats`.
Pure function, so test it heavily — this is where off-by-one bugs live.

### Do
- **Time per note:** walk `note.open` events in order; each note "owns" the time until the next
  `note.open` (or session end). Cap any single gap at e.g. 20 minutes, so leaving your laptop open
  doesn't count as an hour of study (state this assumption in the README).
- `notesTouched` = unique paths across open/modify/create.
- `created` = paths from `note.create` that weren't deleted.
- `tagsTouched` = unique tags; `linksFollowed` = count of `link.follow`.
- Apply renames so a note isn't counted twice under old and new names.

### ✅ Checkpoint
- `tests/derive.test.ts` covers: single note, several notes, rename mid-session, idle cap, empty
  session. All pass.
- Commit: `feat: derive session stats`.

---

## Phase 8 — Persist session records (≈ 1 h)

### Why
PRD §6: records live as JSON in the plugin's own folder (not in the vault's visible notes), one file
per session. The MCP server in v1.2 will read these from disk, so a predictable path and format
matters.

### Do
- Plugin folder path: `this.manifest.dir` (e.g. `.obsidian/plugins/study-session-tracker`). Don't
  hard-code `.obsidian` — users can rename the config folder.
- Files under that folder aren't normal vault notes, so use the lower-level adapter:
  ```ts
  const dir = `${this.manifest.dir}/sessions`;
  const adapter = this.app.vault.adapter;
  if (!(await adapter.exists(dir))) await adapter.mkdir(dir);
  await adapter.write(`${dir}/${safeId}.json`, JSON.stringify(record, null, 2));
  ```
- Make the id file-safe (replace `:` with `-`; colons break on Windows).

### ✅ Checkpoint
- Stop a session → JSON file appears in `.obsidian/plugins/study-session-tracker/sessions/` and
  matches the PRD §6 shape.
- Commit: `feat: persist session records`.

---

## Phase 9 — Template summarizer (pure, tested) (≈ 1 h)

### Why
Build the offline fallback **before** the Claude backend. It guarantees the whole loop works with
zero network, and it's what you'll fall back to on any API error (PRD §9).

### Do
- `summarizers/template.ts`: `class TemplateSummarizer implements Summarizer`.
- Output like: *"48m across 6 notes (2 created). Focus: Transformers, Attention. Followed 3 links."*
- "Topics" heuristic: the top 2–3 notes by time (use the note's basename), plus top tags.
- Format durations nicely: `48m`, `1h 12m`.

### ✅ Checkpoint
- Tests for normal, empty, and very long sessions pass.
- Commit: `feat: template summarizer`.

---

## Phase 10 — Write the block into the daily note (≈ 3–4 h) — *the core user-visible feature*

### Why
PRD §8. This is the riskiest part for users: you're editing **their** notes. Two principles:
1. **Never clobber.** Only ever touch the text between your own `%% study-session:start … %%` and
   `%% study-session:end %%` markers.
2. **Idempotent.** Writing the same session twice must update its block in place, not duplicate it.

### Do
1. **Pure string functions in `core/block.ts`** (test these thoroughly):
   - `renderBlock(record, summaryMd, opts) → string` — produces exactly the PRD §8 format.
   - `upsertBlock(noteText, id, blockText) → string` — if a block with `id=` exists, replace it;
     otherwise append at the end (with a blank line before it).
   - Use a regex anchored on the start marker *with that id*, matched lazily to the end marker.
2. **Find today's daily note** in `sinks/dailyNote.ts`. Use the community library
   `obsidian-daily-notes-interface` (`npm i obsidian-daily-notes-interface`), which already understands
   the core Daily notes and Periodic Notes settings:
   ```ts
   import { getAllDailyNotes, getDailyNote, createDailyNote, appHasDailyNotesPluginLoaded } from "obsidian-daily-notes-interface";
   import { moment } from "obsidian";

   const date = moment(record.start);         // day the session *started*
   let file = getDailyNote(date, getAllDailyNotes());
   if (!file) file = await createDailyNote(date);
   ```
   If `appHasDailyNotesPluginLoaded()` is false, fall back to the path from settings.
3. **Edit atomically** with `app.vault.process(file, text => upsertBlock(text, id, block))`. It reads
   and writes in one step, so it won't race with the user typing.
4. **Make the callout look nice.** `[!study]` is a custom callout type; without styling it renders
   like a plain note callout. Add to `styles.css`:
   ```css
   .callout[data-callout="study"] {
     --callout-color: 94, 129, 172;
     --callout-icon: lucide-graduation-cap;
   }
   ```

### Decisions on the PRD's open questions (§14) — recommended defaults
- **Multiple sessions per day →** stacked blocks, one per session id. Simple, idempotent, each block
  maps to one record.
- **Same id already present →** replace that block in place (that's what `upsertBlock` does).
- **Review before writing? →** write immediately on stop (matches the user story); add a
  "Regenerate summary for last session" command later instead of a review modal.
- **Session crossing midnight →** goes to the daily note of the start date.

### ✅ Checkpoint
- Start → work → stop → today's daily note contains a correctly formatted block using the template
  summary.
- Run two sessions → two stacked blocks.
- Delete the daily note → stop a session → note is created in the right folder with the right name.
- Your own text above and below the block is untouched.
- Commit: `feat: daily-note study block`. **🎉 This is a working, offline v1.**

---

## Phase 11 — Settings tab (≈ 1–2 h)

### Why
PRD §11. You need settings before the Claude backend (for the key). Obsidian provides a builder,
`Setting`, so you never write HTML.

### Do
In `settings.ts`:
```ts
export interface StudySettings {
  apiKey: string;
  model: string;
  verbosity: "short" | "medium" | "long";
  includeStructured: boolean;
  dailyNoteMode: "auto" | "path";
  fallbackPath: string;          // e.g. "Daily/{{date}}.md"
  sendNoteContent: boolean;      // privacy: send excerpts, or metadata only
}
```
- Load with `Object.assign({}, DEFAULTS, await this.loadData())`, save with `this.saveData(...)`.
- Build the tab with `new Setting(containerEl).setName(...).setDesc(...).addText(...)`.
- For the key, call `text.inputEl.type = "password"` so it isn't shown on screen.
- Show the **warnings** from PRD §12 directly under the key field:
  > Your API key is stored in plain text in this plugin's data.json and will sync with your vault.
  > When a key is set, session note content is sent to Anthropic to generate summaries.

### ✅ Checkpoint
- Settings persist after restarting Obsidian. Toggling "include structured capture" changes the block.
- Commit: `feat: settings tab`.

---

## Phase 12 — Claude API summarizer with fallback (≈ 3–4 h)

### Why
PRD §9. The "smart" part. The design rule: **the caller never branches on backend** — it asks a
selector for a summary and always gets markdown back, from Claude or from the template.

### Do
1. **Get an API key** at console.anthropic.com and put it in the test vault's settings.
2. **Call the Messages API with `requestUrl`** (Obsidian's HTTP helper; plain `fetch` hits CORS
   errors in Obsidian):
   ```ts
   import { requestUrl } from "obsidian";

   const res = await requestUrl({
     url: "https://api.anthropic.com/v1/messages",
     method: "POST",
     throw: false,                       // so we can inspect status codes ourselves
     headers: {
       "x-api-key": settings.apiKey,
       "anthropic-version": "2023-06-01",
       "content-type": "application/json",
     },
     body: JSON.stringify({
       model: settings.model,            // e.g. "claude-haiku-5-5" (cheap/fast) or "claude-sonnet-5-5"
       max_tokens: 600,
       system: SYSTEM_PROMPT,
       messages: [{ role: "user", content: buildUserPrompt(record, excerpts) }],
     }),
   });
   if (res.status !== 200) throw new Error(`Claude API ${res.status}`);
   const text = res.json.content?.find((c: any) => c.type === "text")?.text;
   if (!text) throw new Error("Malformed response");
   ```
3. **Build the prompt.** Send the derived stats plus **excerpts** of the notes touched, not whole
   files. Budget: e.g. the top 10 notes by time, first ~1,500 characters of each, total capped at
   ~30k characters. Read content with `app.vault.cachedRead(file)`. If `sendNoteContent` is off,
   send only metadata (titles, tags, times).

   Suggested system prompt starting point:
   > You summarize a study session from an Obsidian vault. Write 3–6 concise bullet points about what
   > the person learned or worked on — concepts, not file operations. Use the note titles as
   > `[[wikilinks]]`. Output markdown only, no headings, no preamble.
4. **Selector with fallback** in `summarizers/index.ts`:
   ```ts
   async function summarize(record, settings): Promise<SessionSummary> {
     if (settings.apiKey) {
       try {
         return { backend: "claude-api", markdown: await claude.summarize(record), generatedAt: now() };
       } catch (e) {
         console.warn("Claude summary failed, using template", e);
         return { backend: "template", markdown: await template.summarize(record),
                  generatedAt: now(), fallbackReason: String(e) };
       }
     }
     return { backend: "template", markdown: await template.summarize(record), generatedAt: now() };
   }
   ```
   When `fallbackReason` is set, add a small line in the block: `_(AI summary unavailable — template used)_`.
5. **Retry once** on HTTP 429/529 (rate limit / overloaded) after a short wait; otherwise fall back.
6. **Callout-safe output.** Every line inside a callout must start with `> `. Prefix each line of
   Claude's output before inserting it — otherwise the callout breaks.
7. **Never log the API key**, and never put it in the session record.

### ✅ Checkpoint
- With a key: block contains useful prose.
- With a wrong key: block still appears, with template text and the fallback note.
- With Wi-Fi off: same as above.
- Commit: `feat: claude api summarizer with template fallback`.

> **Ask Claude Code:** "Iterate on the system prompt in src/summarizers/claude.ts. Here are three real
> session records from my sessions folder — make the summaries more about concepts learned."

---

## Phase 13 — Wire it all together and polish (≈ 2 h)

### Why
`main.ts` should read like the PRD's architecture diagram. If it does, you've kept the seams clean.

### Do
`stopSession()` should be roughly:
```ts
const record = this.store.stop(new Date());                    // freeze events first
record.derived = derive(record.events, record.start, record.end!);
record.summary = await summarize(record, this.settings);        // never throws
await this.records.save(record);                                // storage
for (const sink of this.sinks) await sink.write(record);        // v1: [dailyNoteSink]
new Notice("Study session saved to today's note");
```
Polish list:
- Very short sessions (< 1 min) → ask/skip instead of writing a block.
- `onunload()` with an active session → save it so it can be resumed.
- Optional ribbon icon to toggle start/stop.
- Remove all sample-plugin leftovers (store reviewers check for this).

### ✅ Checkpoint
- Use the plugin for a real study session in your test vault, then for a few days in your real vault
  (back it up first). Note every annoyance and fix the top ones.
- Commit and tag `0.1.0` locally.

---

## Phase 14 — Prepare for the community store (≈ 2–3 h)

### Why
PRD success criterion: accepted into the store. Reviewers check code and README against Obsidian's
plugin guidelines. Network use that sends vault content to a third party is allowed but must be
**disclosed clearly**.

### Do
1. **README.md** with: what it does, screenshot/GIF of the block, how to use the commands, settings,
   and a **"Privacy & network use"** section:
   - Without a key: nothing leaves your device.
   - With a key: session metadata and note excerpts are sent to Anthropic's API.
   - The key is stored in plain text in `data.json` and syncs with your vault.
2. **LICENSE** (MIT is common).
3. **Self-review against the guidelines** (Obsidian docs: *Plugin guidelines* and *Submission
   requirements*). Common rejection reasons:
   - leftover sample code or sample class names (`MyPlugin`, `SampleSettingTab`)
   - default hotkeys set on commands
   - using `innerHTML` / `outerHTML`
   - listeners not registered via `registerEvent` / `registerInterval`
   - unnecessary `console.log` noise in production
   - "Obsidian" in the plugin id, or the description doesn't match the manifest
   - not using `normalizePath()` on user-supplied paths
4. **Test on mobile** if you keep `isDesktopOnly: false` (Obsidian mobile app, open the test vault
   via sync). Don't use Node APIs (`fs`, `path`) — they don't exist on mobile. The Vault/adapter API
   used above is fine.
5. **Release on GitHub:**
   - Bump version with `npm version 0.1.0` (the template's `version-bump.mjs` updates `manifest.json`
     and `versions.json`).
   - Run `npm run build`.
   - Create a GitHub release whose **tag is exactly the version** (`0.1.0`, no `v` prefix) and attach
     `main.js`, `manifest.json`, `styles.css` as individual files.
6. **Submit:** open a PR to `obsidianmd/obsidian-releases` adding your entry to
   `community-plugins.json`, following the PR template. Expect review feedback; fix and push new
   releases as asked.

### ✅ Checkpoint
- A friend can install from your GitHub release (or via the BRAT plugin) and it works.
- Submission PR is open.

---

## Phase 15+ — Future phases (how the seams pay off)

Don't build these until v1 is in the store. Just confirm v1 doesn't block them.

- **v1.2 MCP server** — a separate small Node/TypeScript program (not inside the plugin) using the
  MCP TypeScript SDK. It reads JSON files from `sessions/` (`list_sessions`, `get_session`) and for
  `write_summary` it reuses `core/block.ts`'s `upsertBlock` to rewrite only the demarcated block.
  This is why `core/` must stay free of `obsidian` imports — the MCP server can import it directly.
- **v2 Chrome extension / web search** — new **sources** that emit the same `SessionEvent` shape
  (with new `type`s like `web.visit`). The store, derive, summarizers and sinks don't change.
- **v3 Share/publish** — new **sinks** implementing `Sink.write(record)`. Everything they need
  (paths + summary) is already in the record.

---

## Appendix A — Daily workflow cheat sheet

```bash
cd ~/dev/today-i-learnt-extension
npm run dev          # terminal 1: rebuild on save (Hot-Reload reloads plugin)
npm run test:watch   # terminal 2: re-run unit tests on save
```
- Obsidian dev console: `Cmd+Option+I`.
- Force-reload the plugin: toggle it off/on in *Settings → Community plugins*, or `Cmd+R` reloads
  the whole app.

## Appendix B — Debugging tips

| Symptom | Likely cause |
|---|---|
| Plugin doesn't appear in the list | `manifest.json` id ≠ folder name, or `main.js` missing (is `npm run dev` running?) |
| Changes don't show up | Hot-Reload not enabled, or build error in the `npm run dev` terminal |
| `Cannot read properties of null` on file-open | `file-open` passes `null` for empty tabs — guard it |
| Hundreds of `note.create` events at launch | Listener registered before `onLayoutReady` |
| CORS / network error calling Claude | Using `fetch` instead of `requestUrl` |
| Callout renders broken after summary | Some summary lines missing the `> ` prefix |
| `npm error Cannot read properties of null (reading 'edgesOut')` | npm resolver bug with a package whose peers need a newer Node. Pin an older major (e.g. `vitest@3`) or upgrade Node |
| Block duplicated instead of updated | `upsertBlock` regex not matching the id (escape special chars) |

## Appendix C — Suggested estimate

| Phases | What you have at the end | Rough effort |
|---|---|---|
| 1–5 | Plugin loads, start/stop works | 1 day |
| 6–10 | Full offline v1 writing to daily note | 2–3 days |
| 11–13 | Claude summaries, settings, polish | 2 days |
| 14 | Store submission | 1 day + review wait |

## Appendix D — Reference links

- Obsidian developer docs: https://docs.obsidian.md (Plugins → Getting started, Plugin guidelines,
  Submission requirements)
- Sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API type definitions: `node_modules/obsidian/obsidian.d.ts` — the most reliable reference; every
  method has a doc comment. Hover in VS Code.
- Hot-Reload: https://github.com/pjeby/hot-reload
- Daily notes helper: https://github.com/liamcain/obsidian-daily-notes-interface
- Claude Messages API: https://docs.anthropic.com/en/api/messages
- Community plugin list (submission target): https://github.com/obsidianmd/obsidian-releases
