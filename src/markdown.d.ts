// esbuild bundles .md files as plain strings (see the loader in esbuild.config.mjs).
declare module "*.md" {
	const content: string;
	export default content;
}
