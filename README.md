# Today I Learnt

Track focused study sessions in Obsidian and get a summary of what you learned written into your
daily note — automatically.

Start a session, study in your vault as usual, stop the session. Today I Learnt records which notes
you worked on and for how long, then writes a short summary into that day's daily note.

> **Status:** early development (pre-release). Features below describe the v1 target and are being
> built now. Not yet available in the community plugin store.

---

## Features

- **Explicit start / stop** — two commands: *Start study session* and *Stop study session*.
  A status bar indicator shows when a session is running.
- **Automatic capture** of vault activity during a session:
  - notes opened, created, modified, renamed, deleted
  - time spent per note
  - links followed between notes
  - tags added
- **Smart summaries** using the Claude API (bring your own key) — concise notes on the concepts you
  worked through, not just a list of files.
- **Works offline** — with no API key, or if the API call fails, you still get a template summary
  (time, notes touched, topics, links followed). Nothing leaves your device.
- **Daily-note integration** — summaries go into your daily note, respecting your Daily Notes /
  Periodic Notes folder and date format. The note is created if it doesn't exist yet.
- **Safe editing** — the plugin only ever writes inside its own marked block. The rest of your daily
  note is never touched. Re-writing the same session updates its block in place.

## What it looks like

After stopping a session, your daily note gets a block like this:

```markdown
%% study-session:start id=2026-10-20T09:03 %%
> [!study] Study session · 09:03–09:51 · 48m
> **Topics:** Transformers, Attention
> **Notes:** 6 touched, 2 created
>
> - Worked through how self-attention computes weighted sums over tokens in [[Transformers]]
> - Connected multi-head attention to the earlier notes on [[Attention]]
> - Started a scratch note comparing positional encoding schemes
%% study-session:end %%
```

The `%% … %%` lines are Obsidian comments — hidden in reading view. They let the plugin find and
update its own block without disturbing anything else. The `[!study]` callout is what you see.

Multiple sessions in one day appear as separate blocks, one per session.

## Usage

1. Open the command palette (`Cmd/Ctrl + P`).
2. Run **Start study session**.
3. Study as usual — open notes, follow links, write, tag.
4. Run **Stop study session**.
5. Open today's daily note to see the summary.

No hotkeys are assigned by default. Add your own under *Settings → Hotkeys* if you like.

## Settings

| Setting | Description |
|---|---|
| Claude API key | Optional. Enables AI summaries. Get one at [console.anthropic.com](https://console.anthropic.com). |
| Model | Which Claude model to use for summaries. |
| Send note content | When on, short excerpts of the notes you worked on are sent for better summaries. When off, only metadata (note titles, tags, time) is sent. |
| Summary length | Short / medium / long. |
| Include structured capture | Show counts and topics alongside the prose summary. |
| Daily note location | Auto-detect from Daily Notes / Periodic Notes, or a custom path. |

## Privacy & network use

**Please read this before adding an API key.**

- **Without an API key:** the plugin makes no network requests. Everything stays on your device.
- **With an API key:** when a session stops, the plugin sends session data to **Anthropic's Claude
  API** to generate the summary. This includes note titles, tags, time spent, and — if *Send note
  content* is on — excerpts of the notes you worked on during the session. See
  [Anthropic's privacy policy](https://www.anthropic.com/legal/privacy).
- **Your API key is stored in plain text** in `.obsidian/plugins/today-i-learnt/data.json`. If you
  sync your vault (Obsidian Sync, iCloud, git, etc.), the key syncs with it. Don't commit this file
  to a public repository.
- API usage is billed to your own Anthropic account.

## What is and isn't captured

**Captured (inside your vault only):** notes opened, created, modified, renamed, deleted; time per
note; links followed; tags added.

**Not captured:** anything outside Obsidian — browser activity, web searches, other apps — and
reading position inside PDFs.

Time per note counts the time a note was the active one. Long idle gaps are capped so leaving
Obsidian open doesn't inflate your study time.

## Where data is stored

- **Summaries:** in your daily notes, inside the study block.
- **Session records:** one JSON file per session in
  `.obsidian/plugins/today-i-learnt/sessions/`. These hold the raw activity and summary, and are
  kept out of your visible notes.

## Installation

### From the community store
Coming soon — not yet submitted.

### Manual install
1. Download `main.js`, `manifest.json` and `styles.css` from the
   [latest release](https://github.com/sukritaz/today-i-learnt-extension/releases).
2. Create the folder `<your vault>/.obsidian/plugins/today-i-learnt/` and put the three files in it.
3. In Obsidian: *Settings → Community plugins* → reload the list → enable **Today I Learnt**.

### Via BRAT (beta testing)
Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin, then add
`sukritaz/today-i-learnt-extension` as a beta plugin.

## Roadmap

| Version | Planned |
|---|---|
| **v1.0** | Start/stop sessions, vault activity capture, daily-note study block, Claude summaries with offline template fallback |
| **v1.2** | Local MCP server so Claude Code can read your study sessions and write summaries |
| **v2** | More context sources: a Chrome extension and web-search activity |
| **v3** | Share or publish what you learned — summaries or source notes |

See [`docs/PRD.md`](docs/PRD.md) for the full product spec.

## Development

Requires Node.js 20+.

```bash
npm install
npm run dev     # rebuild on every change
npm run build   # production build
npm run lint    # lint with Obsidian's rules
```

For local testing, link this folder into a **test vault** (not your real one):

```bash
ln -s "$(pwd)" /path/to/test-vault/.obsidian/plugins/today-i-learnt
```

Install [Hot-Reload](https://github.com/pjeby/hot-reload) in the test vault to reload the plugin
automatically after each build.

A step-by-step build guide is in [`docs/BUILD_GUIDE.md`](docs/BUILD_GUIDE.md).

## License

[MIT](LICENSE)
