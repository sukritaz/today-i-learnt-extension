/** 2880 → "48m", 4320 → "1h 12m". */
export function formatDuration(totalSec: number): string {
	const minutes = Math.floor(totalSec / 60);
	if (minutes < 60) return `${minutes}m`;
	return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** "Folder/Attention Is All You Need.md" → "Attention Is All You Need". */
export function noteTitle(path: string): string {
	const name = path.substring(path.lastIndexOf("/") + 1);
	return name.endsWith(".md") ? name.slice(0, -".md".length) : name;
}

/** ISO timestamp → local "09:03". */
export function formatClock(iso: string): string {
	const date = new Date(iso);
	const hh = String(date.getHours()).padStart(2, "0");
	const mm = String(date.getMinutes()).padStart(2, "0");
	return `${hh}:${mm}`;
}

/** "ML/Attention.md" → "[[ML/Attention|Attention]]"; "Attention.md" → "[[Attention]]". */
export function wikilink(path: string): string {
	const target = path.endsWith(".md") ? path.slice(0, -".md".length) : path;
	const title = noteTitle(path);
	return target === title ? `[[${title}]]` : `[[${target}|${title}]]`;
}
