import { isAbsolute, normalize } from "node:path";

//#region src/utils/webpack-like.ts
function transformUse(data, plugin, transformLoader) {
	if (data.resource == null) return [];
	const id = normalizeAbsolutePath(data.resource + (data.resourceQuery || ""));
	if (!plugin.transformInclude || plugin.transformInclude(id)) return [{
		loader: transformLoader,
		options: { plugin },
		ident: plugin.name
	}];
	return [];
}
function normalizeAbsolutePath(path) {
	if (isAbsolute(path)) return normalize(path);
else return path;
}

//#endregion
export { normalizeAbsolutePath, transformUse };