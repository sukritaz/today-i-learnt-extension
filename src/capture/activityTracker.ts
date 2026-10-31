import { CachedMetadata, getAllTags, getLinkpath, Plugin, TAbstractFile, TFile } from 'obsidian';
import type { SessionEvent } from '../types';

type Emit = (event: SessionEvent) => void;

/** Autosave fires every ~2s while typing; a burst of edits ends after this much quiet. */
const MODIFY_IDLE_MS = 10 * 1000;

interface PendingModify {
	path: string;
	ts: string;
	startSize: number;
	endSize: number;
}

/**
 * Translates vault and workspace activity into SessionEvents.
 * Knows nothing about sessions, summaries or daily notes: it only emits.
 * The store decides whether to keep an event (it drops them when idle).
 */
export class ActivityTracker {
	private plugin: Plugin;
	private emit: Emit;

	private lastOpenPath: string | null = null;
	private knownSizes = new Map<string, number>();
	private knownTags = new Map<string, Set<string>>();
	private pendingModify: PendingModify | null = null;
	private modifyTimer: number | null = null;

	constructor(plugin: Plugin, emit: Emit) {
		this.plugin = plugin;
		this.emit = emit;
	}

	/** Hooks into Obsidian. Every listener is registered so it is removed on unload. */
	register(): void {
		const { workspace, vault, metadataCache } = this.plugin.app;

		this.plugin.registerEvent(workspace.on('file-open', (file) => this.onOpen(file)));
		this.plugin.registerEvent(vault.on('modify', (file) => this.onModify(file)));
		this.plugin.registerEvent(vault.on('delete', (file) => this.onDelete(file)));
		this.plugin.registerEvent(
			vault.on('rename', (file, oldPath) => this.onRename(file, oldPath)),
		);
		this.plugin.registerEvent(
			metadataCache.on('changed', (file, _data, cache) => this.onMetadataChanged(file, cache)),
		);
		// 'create' also fires once for every existing file while the vault loads.
		workspace.onLayoutReady(() => {
			this.plugin.registerEvent(vault.on('create', (file) => this.onCreate(file)));
		});

		this.plugin.register(() => this.clearModifyTimer());
	}

	/**
	 * Call right after a session starts. Drops edits made before the session and
	 * records the note that is already open, since no 'file-open' fires for it.
	 */
	startSession(): void {
		if (this.pendingModify) {
			this.knownSizes.set(this.pendingModify.path, this.pendingModify.endSize);
			this.pendingModify = null;
		}
		this.clearModifyTimer();
		this.lastOpenPath = null;
		this.onOpen(this.plugin.app.workspace.getActiveFile());
	}

	/** Call right before a session stops, so a pending burst of edits is recorded. */
	flush(): void {
		this.flushModify();
	}

	private onOpen(file: TFile | null): void {
		// Switching back to the same tab is not a new open.
		if (!isNote(file) || file.path === this.lastOpenPath) return;

		const ts = timestamp();
		const prevPath = this.lastOpenPath;
		this.lastOpenPath = file.path;

		this.send({ ts, type: 'note.open', path: file.path });
		// Obsidian has no "link clicked" event: infer it when the previous note links here.
		if (prevPath && this.linksTo(prevPath, file)) {
			this.send({ ts, type: 'link.follow', from: prevPath, to: file.path });
		}

		this.knownSizes.set(file.path, file.stat.size);
		this.knownTags.set(file.path, tagsOf(this.plugin.app.metadataCache.getFileCache(file)));
	}

	private onModify(file: TAbstractFile): void {
		if (!isNote(file)) return;
		const size = file.stat.size;

		if (this.pendingModify?.path === file.path) {
			this.pendingModify.endSize = size;
		} else {
			this.flushModify();
			this.pendingModify = {
				path: file.path,
				ts: timestamp(),
				startSize: this.knownSizes.get(file.path) ?? size,
				endSize: size,
			};
		}

		this.clearModifyTimer();
		this.modifyTimer = window.setTimeout(() => this.flushModify(), MODIFY_IDLE_MS);
	}

	private onCreate(file: TAbstractFile): void {
		if (!isNote(file)) return;
		this.knownSizes.set(file.path, file.stat.size);
		this.knownTags.set(file.path, new Set());
		this.send({ ts: timestamp(), type: 'note.create', path: file.path });
	}

	private onDelete(file: TAbstractFile): void {
		if (!isNote(file)) return;
		this.flushModify();
		this.knownSizes.delete(file.path);
		this.knownTags.delete(file.path);
		if (this.lastOpenPath === file.path) this.lastOpenPath = null;
		this.send({ ts: timestamp(), type: 'note.delete', path: file.path });
	}

	private onRename(file: TAbstractFile, oldPath: string): void {
		if (!isNote(file)) return;
		this.flushModify();
		moveKey(this.knownSizes, oldPath, file.path);
		moveKey(this.knownTags, oldPath, file.path);
		if (this.lastOpenPath === oldPath) this.lastOpenPath = file.path;
		this.send({ ts: timestamp(), type: 'note.rename', path: file.path, oldPath });
	}

	private onMetadataChanged(file: TFile, cache: CachedMetadata): void {
		if (!isNote(file)) return;
		const now = tagsOf(cache);
		const before = this.knownTags.get(file.path);
		this.knownTags.set(file.path, now);
		// First time we see this note: record a baseline, don't report existing tags as new.
		if (!before) return;

		const ts = timestamp();
		for (const tag of now) {
			if (!before.has(tag)) {
				this.send({ ts, type: 'tag.touch', path: file.path, tag });
			}
		}
	}

	/** Emits an event, first flushing any pending edit so events stay in time order. */
	private send(event: SessionEvent): void {
		this.flushModify();
		this.emit(event);
	}

	private flushModify(): void {
		const pending = this.pendingModify;
		if (!pending) return;
		this.pendingModify = null;
		this.clearModifyTimer();
		this.knownSizes.set(pending.path, pending.endSize);
		this.emit({
			ts: pending.ts,
			type: 'note.modify',
			path: pending.path,
			bytesDelta: pending.endSize - pending.startSize,
		});
	}

	private clearModifyTimer(): void {
		if (this.modifyTimer !== null) {
			window.clearTimeout(this.modifyTimer);
			this.modifyTimer = null;
		}
	}

	private linksTo(fromPath: string, target: TFile): boolean {
		const { metadataCache } = this.plugin.app;
		const links = metadataCache.getCache(fromPath)?.links ?? [];
		return links.some(
			(link) =>
				metadataCache.getFirstLinkpathDest(getLinkpath(link.link), fromPath)?.path ===
				target.path,
		);
	}
}

function isNote(file: TAbstractFile | null): file is TFile {
	return file instanceof TFile && file.extension === 'md';
}

function tagsOf(cache: CachedMetadata | null): Set<string> {
	return new Set(cache ? (getAllTags(cache) ?? []) : []);
}

function moveKey<V>(map: Map<string, V>, from: string, to: string): void {
	const value = map.get(from);
	if (value === undefined) return;
	map.delete(from);
	map.set(to, value);
}

function timestamp(): string {
	return new Date().toISOString();
}
