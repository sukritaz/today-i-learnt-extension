# Today I Learnt

Track focused study sessions in Obsidian and see what you studied in your daily note, with
optional recall questions to test what stuck.

Start a session, study in your vault as usual, stop the session. Today I Learnt records which notes
you worked on, for how long and how you moved between them, then writes it into that day's daily
note. Turn on **Grill me** to also get questions on what you studied.

---

## Features

- **Explicit start / stop** — two commands, *Start study session* and *Stop study session*, or
  click the ribbon icon or status bar. The status bar shows how long the session has run.
- **Automatic capture** of vault activity during a session:
  - notes opened, created, modified, renamed, deleted
  - time spent per note
  - links followed between notes
  - tags added
- **Your path through the notes** — a clickable diagram and a linked chain showing the order you
  visited notes and whether you got there by following a link.
- **Grill me (optional)** — recall questions on what you studied, written by Claude (bring your
  own API key). Questions are grounded in your own notes and link back to them.
- **Works offline** — with Grill me off, nothing leaves your device. With Grill me on but no key,
  or if the API call fails, you get simple offline questions built from your session.
- **Daily-note integration** — respects your Daily Notes / Periodic Notes folder, date format and
  template. The note is created if it doesn't exist yet.
- **Safe editing** — the plugin only ever writes inside its own marked block. The rest of your
  daily note is never touched.
- **Crash-safe** — a running session is saved every 30 seconds and picked up again after a reload.

## What it looks like

After stopping a session, your daily note gets a block like this:

````markdown
%% study-session:start id=2026-10-20T09-03-12-000Z-session %%
> [!study] Study session · 09:03–09:51 · 48m
> **Notes:** 3 touched, 1 created
>
> **Path**
> ```mermaid
> flowchart LR
>     n0["Kafka"]
>     n1["Partitioning"]
>     n2["Consumer Groups"]
>     n0 --> n1
>     n1 -.-> n2
>     class n0,n1,n2 internal-link;
> ```
> [[Kafka]] → [[Partitioning]] → [[Consumer Groups]]
>
> **Grill me**
> *How Kafka scales reads without giving up ordering.*
> 1. Why does [[Partitioning]] only guarantee order within a partition, not across a topic?
> 2. What happens in [[Consumer Groups]] when a consumer joins mid-stream?
%% study-session:end %%
````

In the diagram, solid arrows mean you followed a link; dotted arrows mean you got there another way
(search, file explorer, quick switcher). Click a node to open the note.

The `%% … %%` lines are Obsidian comments, hidden in reading view. They let the plugin find its own
block. Each session gets its own block, so several sessions in a day stack up.

## Usage

1. Open the command palette (`Cmd/Ctrl + P`).
2. Run **Start study session**.
3. Study as usual — open notes, follow links, write, tag.
4. Run **Stop study session**.
5. Open today's daily note to see the session.

No hotkeys are assigned by default. Add your own under *Settings → Hotkeys* if you like.

## Settings

**Daily note**

| Setting | Description |
|---|---|
| Show note counts | Show how many notes were touched and created. |
| Find daily note | *Automatic* follows your Daily Notes / Periodic Notes settings. *Use path below* always uses the path. |
| Daily note path | Used when chosen above, or when no daily notes plugin is on. `{{date}}` becomes `2026-10-31`; `{{date:DD-MM-YYYY}}` picks a format. |

**Grill me** (off by default; the options below appear when it's on)

| Setting | Description |
|---|---|
| Claude API key | Enables Claude-written questions. Get one at [console.anthropic.com](https://console.anthropic.com). Without a key, offline questions are used. |
| Model | Haiku (fast, cheapest) or Sonnet (sharper questions). |
| Number of questions | 3, 5 or 8. |
| Send note content | On: short excerpts of the notes you worked on are sent, for better questions. Off: only note titles, tags and times are sent. |

## Privacy & network use

**Please read this before turning on Grill me with an API key.**

- **Grill me off, or no API key:** the plugin makes no network requests. Everything stays on your
  device.
- **Grill me on with an API key:** when a session stops, the plugin sends session data to
  **Anthropic's Claude API** (`api.anthropic.com`) to write the questions. This includes note
  titles, tags, time spent, the order you visited notes, and — if *Send note content* is on —
  excerpts of up to 10 notes you worked on (at most 1,500 characters each). See
  [Anthropic's privacy policy](https://www.anthropic.com/legal/privacy).
- **Your API key is stored in plain text** in `.obsidian/plugins/today-i-learnt/data.json`. If you
  sync your vault (Obsidian Sync, iCloud, git, etc.), the key syncs with it. Don't commit this file
  to a public repository.
- API usage is billed to your own Anthropic account.
- The plugin has no telemetry and never reads files outside your vault.

## What is and isn't captured

**Captured (inside your vault only):** Markdown notes opened, created, modified, renamed, deleted;
time per note; links followed; tags added.

**Not captured:** anything outside Obsidian — browser activity, web searches, other apps — and
reading position inside PDFs.

Time per note counts the time a note was the active one. Long idle gaps are capped at 20 minutes so
leaving Obsidian open doesn't inflate your study time.

## Where data is stored

- **Session blocks:** in your daily notes.
- **Session records:** one JSON file per session in `.obsidian/plugins/today-i-learnt/sessions/`,
  holding the raw activity and questions. They are kept out of your visible notes.

## Installation

### From the community directory
Search for **Today I Learnt** in *Settings → Community plugins → Browse* (once published).

### Via BRAT (beta testing)
Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin, then add
`sukritaz/today-i-learnt-extension` as a beta plugin.

### Manual install
1. Download `main.js`, `manifest.json` and `styles.css` from the
   [latest release](https://github.com/sukritaz/today-i-learnt-extension/releases).
2. Create the folder `<your vault>/.obsidian/plugins/today-i-learnt/` and put the three files in it.
3. In Obsidian: *Settings → Community plugins* → reload the list → enable **Today I Learnt**.

## Development

Requires Node.js 20+.

```bash
npm install
npm run dev     # rebuild on every change
npm run build   # production build
npm run lint    # lint with Obsidian's rules
npm test        # unit tests
```

For local testing, link this folder into a **test vault** (not your real one):

```bash
ln -s "$(pwd)" /path/to/test-vault/.obsidian/plugins/today-i-learnt
```

Install [Hot-Reload](https://github.com/pjeby/hot-reload) in the test vault to reload the plugin
automatically after each build.

The product spec, including the code layout, is in [`docs/PRD.md`](docs/PRD.md).

## License

[MIT](LICENSE)
