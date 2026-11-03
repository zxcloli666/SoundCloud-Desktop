import { Parser } from "acorn";

//#region src/utils/context.ts
function parse(code, opts = {}) {
	return Parser.parse(code, {
		sourceType: "module",
		ecmaVersion: "latest",
		locations: true,
		...opts
	});
}

//#endregion
export { parse };