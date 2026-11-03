'use client';
/**
 * Copyright 2025 Aiden Bai, Million Software, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 * and associated documentation files (the “Software”), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
 * BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/cli.mts
var import_node_child_process = require("child_process");
var import_node_fs2 = require("fs");
var import_node_path2 = require("path");
var import_commander = require("commander");
var import_picocolors = __toESM(require("picocolors"), 1);
var import_prompts = __toESM(require("prompts"), 1);

// src/cli-utils.mts
var import_node_fs = require("fs");
var import_node_path = require("path");
var FRAMEWORK_NAMES = {
  next: "Next.js",
  vite: "Vite",
  tanstack: "TanStack Start",
  webpack: "Webpack",
  unknown: "Unknown"
};
var INSTALL_COMMANDS = {
  npm: "npm install -D",
  yarn: "yarn add -D",
  pnpm: "pnpm add -D",
  bun: "bun add -D"
};
var REACT_SCAN_SCRIPT_TAG = '<script src="https://unpkg.com/react-scan/dist/auto.global.js" crossorigin="anonymous"></script>';
var NEXT_APP_ROUTER_SCRIPT = `{process.env.NODE_ENV === "development" && (
          <script src="https://unpkg.com/react-scan/dist/auto.global.js" crossOrigin="anonymous" />
        )}`;
var NEXT_PAGES_ROUTER_SCRIPT = `{process.env.NODE_ENV === "development" && (
          <script src="https://unpkg.com/react-scan/dist/auto.global.js" crossOrigin="anonymous" />
        )}`;
var VITE_SCRIPT = `<script src="https://unpkg.com/react-scan/dist/auto.global.js" crossorigin="anonymous"></script>`;
var WEBPACK_IMPORT = `if (process.env.NODE_ENV === "development") {
  import("react-scan");
}`;
var detectPackageManager = (projectRoot) => {
  if ((0, import_node_fs.existsSync)((0, import_node_path.join)(projectRoot, "bun.lockb")) || (0, import_node_fs.existsSync)((0, import_node_path.join)(projectRoot, "bun.lock"))) return "bun";
  if ((0, import_node_fs.existsSync)((0, import_node_path.join)(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
  if ((0, import_node_fs.existsSync)((0, import_node_path.join)(projectRoot, "yarn.lock"))) return "yarn";
  return "npm";
};
var detectFramework = (projectRoot) => {
  const packageJsonPath = (0, import_node_path.join)(projectRoot, "package.json");
  if (!(0, import_node_fs.existsSync)(packageJsonPath)) return "unknown";
  try {
    const packageJson = JSON.parse((0, import_node_fs.readFileSync)(packageJsonPath, "utf-8"));
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
    if (allDeps["next"]) return "next";
    if (allDeps["@tanstack/react-start"]) return "tanstack";
    if (allDeps["vite"]) return "vite";
    if (allDeps["webpack"] || allDeps["react-scripts"]) return "webpack";
    return "unknown";
  } catch {
    return "unknown";
  }
};
var detectNextRouterType = (projectRoot) => {
  if ((0, import_node_fs.existsSync)((0, import_node_path.join)(projectRoot, "app")) || (0, import_node_fs.existsSync)((0, import_node_path.join)(projectRoot, "src", "app"))) return "app";
  if ((0, import_node_fs.existsSync)((0, import_node_path.join)(projectRoot, "pages")) || (0, import_node_fs.existsSync)((0, import_node_path.join)(projectRoot, "src", "pages"))) return "pages";
  return "unknown";
};
var detectProject = (cwd) => {
  const packageManager = detectPackageManager(cwd);
  const framework = detectFramework(cwd);
  const nextRouterType = framework === "next" ? detectNextRouterType(cwd) : "unknown";
  const packageJsonPath = (0, import_node_path.join)(cwd, "package.json");
  let hasReactScan = false;
  if ((0, import_node_fs.existsSync)(packageJsonPath)) {
    try {
      const packageJson = JSON.parse((0, import_node_fs.readFileSync)(packageJsonPath, "utf-8"));
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      hasReactScan = Boolean(allDeps["react-scan"]);
    } catch {
    }
  }
  return {
    packageManager,
    framework,
    nextRouterType,
    projectRoot: cwd,
    hasReactScan
  };
};
var findLayoutFile = (projectRoot, routerType) => {
  if (routerType === "app") {
    const candidates = [
      (0, import_node_path.join)(projectRoot, "app", "layout.tsx"),
      (0, import_node_path.join)(projectRoot, "app", "layout.jsx"),
      (0, import_node_path.join)(projectRoot, "app", "layout.js"),
      (0, import_node_path.join)(projectRoot, "src", "app", "layout.tsx"),
      (0, import_node_path.join)(projectRoot, "src", "app", "layout.jsx"),
      (0, import_node_path.join)(projectRoot, "src", "app", "layout.js")
    ];
    return candidates.find(import_node_fs.existsSync) ?? null;
  }
  if (routerType === "pages") {
    const candidates = [
      (0, import_node_path.join)(projectRoot, "pages", "_document.tsx"),
      (0, import_node_path.join)(projectRoot, "pages", "_document.jsx"),
      (0, import_node_path.join)(projectRoot, "pages", "_document.js"),
      (0, import_node_path.join)(projectRoot, "src", "pages", "_document.tsx"),
      (0, import_node_path.join)(projectRoot, "src", "pages", "_document.jsx"),
      (0, import_node_path.join)(projectRoot, "src", "pages", "_document.js")
    ];
    return candidates.find(import_node_fs.existsSync) ?? null;
  }
  return null;
};
var findIndexHtml = (projectRoot) => {
  const candidates = [
    (0, import_node_path.join)(projectRoot, "index.html"),
    (0, import_node_path.join)(projectRoot, "public", "index.html"),
    (0, import_node_path.join)(projectRoot, "src", "index.html")
  ];
  return candidates.find(import_node_fs.existsSync) ?? null;
};
var findEntryFile = (projectRoot) => {
  const candidates = [
    (0, import_node_path.join)(projectRoot, "src", "index.tsx"),
    (0, import_node_path.join)(projectRoot, "src", "index.ts"),
    (0, import_node_path.join)(projectRoot, "src", "index.jsx"),
    (0, import_node_path.join)(projectRoot, "src", "index.js"),
    (0, import_node_path.join)(projectRoot, "src", "main.tsx"),
    (0, import_node_path.join)(projectRoot, "src", "main.ts"),
    (0, import_node_path.join)(projectRoot, "src", "main.jsx"),
    (0, import_node_path.join)(projectRoot, "src", "main.js")
  ];
  return candidates.find(import_node_fs.existsSync) ?? null;
};
var hasReactScanCode = (content) => {
  return content.includes("react-scan") || content.includes("react_scan");
};
var transformNextAppRouter = (projectRoot, routerType) => {
  const layoutPath = findLayoutFile(projectRoot, routerType);
  if (!layoutPath) {
    return {
      success: false,
      filePath: "",
      message: "Could not find app/layout.tsx"
    };
  }
  const originalContent = (0, import_node_fs.readFileSync)(layoutPath, "utf-8");
  if (hasReactScanCode(originalContent)) {
    return {
      success: true,
      filePath: layoutPath,
      message: "React Scan is already installed.",
      noChanges: true
    };
  }
  let newContent = originalContent;
  const headOpenMatch = newContent.match(/<head[^>]*>/);
  if (headOpenMatch) {
    const injection = `
        ${NEXT_APP_ROUTER_SCRIPT}
`;
    newContent = newContent.replace(
      headOpenMatch[0],
      `${headOpenMatch[0]}${injection}`
    );
  } else {
    const bodyMatch = newContent.match(/<body[\s\S]*?>/);
    if (bodyMatch) {
      const injection = `
        ${NEXT_APP_ROUTER_SCRIPT}`;
      newContent = newContent.replace(
        bodyMatch[0],
        `${bodyMatch[0]}${injection}`
      );
    }
  }
  return {
    success: true,
    filePath: layoutPath,
    message: "Success",
    originalContent,
    newContent
  };
};
var transformNextPagesRouter = (projectRoot, routerType) => {
  const documentPath = findLayoutFile(projectRoot, routerType);
  if (!documentPath) {
    return {
      success: false,
      filePath: "",
      message: "Could not find pages/_document.tsx"
    };
  }
  const originalContent = (0, import_node_fs.readFileSync)(documentPath, "utf-8");
  if (hasReactScanCode(originalContent)) {
    return {
      success: true,
      filePath: documentPath,
      message: "React Scan is already installed.",
      noChanges: true
    };
  }
  let newContent = originalContent;
  const injection = `
        ${NEXT_PAGES_ROUTER_SCRIPT}`;
  const headMatch = newContent.match(/<Head>([\s\S]*?)<\/Head>/);
  if (headMatch) {
    newContent = newContent.replace("<Head>", `<Head>${injection}`);
  } else {
    const selfClosingHeadMatch = newContent.match(/<Head\s*\/>/);
    if (selfClosingHeadMatch) {
      newContent = newContent.replace(
        selfClosingHeadMatch[0],
        `<Head>${injection}
      </Head>`
      );
    }
  }
  if (newContent === originalContent) {
    return {
      success: false,
      filePath: documentPath,
      message: "Could not find <Head> component in _document file to inject React Scan script."
    };
  }
  return {
    success: true,
    filePath: documentPath,
    message: "Success",
    originalContent,
    newContent
  };
};
var transformVite = (projectRoot) => {
  const indexHtml = findIndexHtml(projectRoot);
  if (!indexHtml) {
    return {
      success: false,
      filePath: "",
      message: "Could not find index.html"
    };
  }
  const originalContent = (0, import_node_fs.readFileSync)(indexHtml, "utf-8");
  if (hasReactScanCode(originalContent)) {
    return {
      success: true,
      filePath: indexHtml,
      message: "React Scan is already installed.",
      noChanges: true
    };
  }
  const headOpenMatch = originalContent.match(/<head[^>]*>/);
  if (!headOpenMatch) {
    return {
      success: false,
      filePath: indexHtml,
      message: "Could not find <head> tag in index.html"
    };
  }
  const newContent = originalContent.replace(
    headOpenMatch[0],
    `${headOpenMatch[0]}
    ${VITE_SCRIPT}`
  );
  return {
    success: true,
    filePath: indexHtml,
    message: "Success",
    originalContent,
    newContent
  };
};
var transformWebpack = (projectRoot) => {
  const indexHtml = findIndexHtml(projectRoot);
  if (indexHtml) {
    const originalContent2 = (0, import_node_fs.readFileSync)(indexHtml, "utf-8");
    if (hasReactScanCode(originalContent2)) {
      return {
        success: true,
        filePath: indexHtml,
        message: "React Scan is already installed.",
        noChanges: true
      };
    }
    const headOpenMatch = originalContent2.match(/<head[^>]*>/);
    if (!headOpenMatch) {
      return {
        success: false,
        filePath: indexHtml,
        message: "Could not find <head> tag in index.html"
      };
    }
    const newContent2 = originalContent2.replace(
      headOpenMatch[0],
      `${headOpenMatch[0]}
    ${REACT_SCAN_SCRIPT_TAG}`
    );
    return {
      success: true,
      filePath: indexHtml,
      message: "Success",
      originalContent: originalContent2,
      newContent: newContent2
    };
  }
  const entryFile = findEntryFile(projectRoot);
  if (!entryFile) {
    return {
      success: false,
      filePath: "",
      message: "Could not find entry file or index.html"
    };
  }
  const originalContent = (0, import_node_fs.readFileSync)(entryFile, "utf-8");
  if (hasReactScanCode(originalContent)) {
    return {
      success: true,
      filePath: entryFile,
      message: "React Scan is already installed.",
      noChanges: true
    };
  }
  const newContent = `${WEBPACK_IMPORT}

${originalContent}`;
  return {
    success: true,
    filePath: entryFile,
    message: "Success",
    originalContent,
    newContent
  };
};
var previewTransform = (projectRoot, framework, nextRouterType) => {
  switch (framework) {
    case "next":
      return nextRouterType === "pages" ? transformNextPagesRouter(projectRoot, nextRouterType) : transformNextAppRouter(projectRoot, nextRouterType);
    case "vite":
      return transformVite(projectRoot);
    case "webpack":
      return transformWebpack(projectRoot);
    case "tanstack":
    case "unknown":
    default:
      return {
        success: false,
        filePath: "",
        message: `Framework "${framework}" is not yet supported by automatic setup. Visit https://github.com/aidenybai/react-scan#install for manual setup.`
      };
  }
};
var generateDiff = (original, updated) => {
  const originalLines = original.split("\n");
  const newLines = updated.split("\n");
  const diff = [];
  let originalIdx = 0;
  let newIdx = 0;
  while (originalIdx < originalLines.length || newIdx < newLines.length) {
    const originalLine = originalLines[originalIdx];
    const newLine = newLines[newIdx];
    if (originalLine === newLine) {
      diff.push({ type: "unchanged", content: originalLine });
      originalIdx++;
      newIdx++;
    } else if (originalLine === void 0) {
      diff.push({ type: "added", content: newLine });
      newIdx++;
    } else if (newLine === void 0) {
      diff.push({ type: "removed", content: originalLine });
      originalIdx++;
    } else {
      const originalInNew = newLines.indexOf(originalLine, newIdx);
      const newInOriginal = originalLines.indexOf(newLine, originalIdx);
      if (originalInNew !== -1 && (newInOriginal === -1 || originalInNew - newIdx < newInOriginal - originalIdx)) {
        while (newIdx < originalInNew) {
          diff.push({ type: "added", content: newLines[newIdx] });
          newIdx++;
        }
      } else if (newInOriginal !== -1) {
        while (originalIdx < newInOriginal) {
          diff.push({ type: "removed", content: originalLines[originalIdx] });
          originalIdx++;
        }
      } else {
        diff.push({ type: "removed", content: originalLine });
        diff.push({ type: "added", content: newLine });
        originalIdx++;
        newIdx++;
      }
    }
  }
  return diff;
};

// src/cli.mts
var VERSION = "0.5.1";
var printDiff = (filePath, original, updated) => {
  const diff = generateDiff(original, updated);
  const contextLines = 3;
  const changedIndices = diff.map((line, i) => line.type !== "unchanged" ? i : -1).filter((i) => i !== -1);
  if (changedIndices.length === 0) {
    console.log(import_picocolors.default.dim("  No changes"));
    return;
  }
  console.log(`
${import_picocolors.default.bold(`File: ${filePath}`)}`);
  console.log(import_picocolors.default.dim("\u2500".repeat(60)));
  let lastPrintedIdx = -1;
  for (const changedIdx of changedIndices) {
    const start = Math.max(0, changedIdx - contextLines);
    const end = Math.min(diff.length - 1, changedIdx + contextLines);
    if (start > lastPrintedIdx + 1 && lastPrintedIdx !== -1) {
      console.log(import_picocolors.default.dim("  ..."));
    }
    for (let i = Math.max(start, lastPrintedIdx + 1); i <= end; i++) {
      const line = diff[i];
      if (line.type === "added") {
        console.log(import_picocolors.default.green(`+ ${line.content}`));
      } else if (line.type === "removed") {
        console.log(import_picocolors.default.red(`- ${line.content}`));
      } else {
        console.log(import_picocolors.default.dim(`  ${line.content}`));
      }
      lastPrintedIdx = i;
    }
  }
  console.log(import_picocolors.default.dim("\u2500".repeat(60)));
};
var installPackages = (packages, packageManager, projectRoot) => {
  if (packages.length === 0) return;
  const command = `${INSTALL_COMMANDS[packageManager]} ${packages.join(" ")}`;
  console.log(import_picocolors.default.dim(`  Running: ${command}
`));
  (0, import_node_child_process.execSync)(command, {
    cwd: projectRoot,
    stdio: "inherit"
  });
};
var program = new import_commander.Command().name("react-scan").description("React Scan CLI").version(VERSION);
program.command("init").description("Set up React Scan in your project").option("-y, --yes", "skip confirmation prompts", false).option("-c, --cwd <cwd>", "working directory", process.cwd()).option("--skip-install", "skip package installation", false).action(async (opts) => {
  console.log(`
${import_picocolors.default.magenta("[\xB7]")} ${import_picocolors.default.bold("React Scan")} ${import_picocolors.default.dim(`v${VERSION}`)}
`);
  try {
    const cwd = (0, import_node_path2.resolve)(opts.cwd);
    if (!(0, import_node_fs2.existsSync)(cwd)) {
      console.error(import_picocolors.default.red(`Directory does not exist: ${cwd}`));
      process.exit(1);
    }
    if (!(0, import_node_fs2.existsSync)((0, import_node_path2.join)(cwd, "package.json"))) {
      console.error(import_picocolors.default.red("No package.json found. Run this command from a project root."));
      process.exit(1);
    }
    console.log(import_picocolors.default.dim("  Detecting project...\n"));
    const project = detectProject(cwd);
    if (project.framework === "unknown") {
      console.error(import_picocolors.default.red("  Could not detect a supported framework."));
      console.log(import_picocolors.default.dim("  React Scan supports Next.js, Vite, and Webpack projects."));
      console.log(import_picocolors.default.dim("  Visit https://github.com/aidenybai/react-scan#install for manual setup.\n"));
      process.exit(1);
    }
    console.log(`  Framework:       ${import_picocolors.default.cyan(FRAMEWORK_NAMES[project.framework])}`);
    if (project.framework === "next") {
      console.log(`  Router:          ${import_picocolors.default.cyan(project.nextRouterType === "app" ? "App Router" : "Pages Router")}`);
    }
    console.log(`  Package manager: ${import_picocolors.default.cyan(project.packageManager)}`);
    console.log();
    if (project.hasReactScan) {
      console.log(import_picocolors.default.green("  React Scan is already installed in package.json."));
      console.log(import_picocolors.default.dim("  Checking if code setup is needed...\n"));
    }
    const result = previewTransform(cwd, project.framework, project.nextRouterType);
    if (!result.success) {
      console.error(import_picocolors.default.red(`  ${result.message}
`));
      process.exit(1);
    }
    const hasCodeChanges = !result.noChanges && result.originalContent && result.newContent;
    if (hasCodeChanges) {
      printDiff(
        (0, import_node_path2.relative)(cwd, result.filePath),
        result.originalContent,
        result.newContent
      );
      console.log();
      console.log(import_picocolors.default.yellow("  Auto-detection may not be 100% accurate."));
      console.log(import_picocolors.default.yellow("  Please verify the changes before committing.\n"));
      if (!opts.yes) {
        const { proceed } = await (0, import_prompts.default)({
          type: "confirm",
          name: "proceed",
          message: "Apply these changes?",
          initial: true
        });
        if (!proceed) {
          console.log(import_picocolors.default.dim("\n  Changes cancelled.\n"));
          process.exit(0);
        }
      }
    }
    if (!opts.skipInstall && !project.hasReactScan) {
      console.log(import_picocolors.default.dim("\n  Installing react-scan...\n"));
      installPackages(["react-scan"], project.packageManager, cwd);
      console.log();
    }
    if (hasCodeChanges) {
      (0, import_node_fs2.writeFileSync)(result.filePath, result.newContent, "utf-8");
      console.log(import_picocolors.default.green(`  Updated ${(0, import_node_path2.relative)(cwd, result.filePath)}`));
    }
    if (!hasCodeChanges && project.hasReactScan) {
      console.log(import_picocolors.default.green("  React Scan is already set up in your project.\n"));
      process.exit(0);
    }
    console.log();
    console.log(`${import_picocolors.default.green("  Success!")} React Scan has been installed.`);
    console.log(import_picocolors.default.dim("  You may now start your development server.\n"));
  } catch (error) {
    console.error(import_picocolors.default.red(`
  Error: ${error instanceof Error ? error.message : String(error)}
`));
    process.exit(1);
  }
});
program.parse();
