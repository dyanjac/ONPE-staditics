# AGENTS.md

## Overview

This file is intended for the **agentic coding agents** that will work on this repository. It contains:

1. **Command templates** for building, linting, testing, and debugging the codebase.
2. **Code‑style guidelines** covering imports, formatting, type safety, naming conventions, error handling, and more.
3. A quick reference for any repository‑specific linting rules (none exist yet) and Copilot instructions (none exist yet).

The guidelines are intentionally concise yet thorough, aiming for ~150 lines of documentation.

---

## 1. Build / Lint / Test Commands

| Purpose | Suggested command | Notes |
|---|---|---|
| **Start the development server** | `npm run dev` or `npm start` | Starts the Express‑style `server.js`. The `dev` script is an alias to `start` and runs the same code.
| **Build a production bundle** | `npm run build` (add if you introduce a bundler) | Not yet defined – add a script if you add Webpack/ESBuild.
| **Lint the source code** | `npx eslint src/` | Requires installing ESLint locally: `npm i --save-dev eslint`. You may use a `.eslintrc.json` at the repo root. For a quick start:

```
{
  "env": {"node": true, "es2021": true},
  "extends": "eslint:recommended",
  "parserOptions": {"ecmaVersion": 12, "sourceType": "module"},
  "rules": {"no-console": ["warn", {"allow": ["log", "error"]}]}
}
```

| **Run unit tests** | `npm test` | The repo currently has no tests. Add a test framework such as Mocha, Jest or Ava, install the package (`npm i --save-dev mocha chai`), then create a `tests/` directory and add scripts:

```
"scripts": {
  "test": "mocha 'tests/**/*.js'"
}
```

| **Run a single test file** | `npx mocha tests/<file>.js` | Use the Mocha CLI. If you use Jest, it would be `npx jest tests/<file>.js`.
| **Run tests in watch mode** | `npx mocha -w tests/**/*.js` | Keeps the test runner alive for quick iteration.
| **Lint a single file** | `npx eslint src/<path>.js` | Useful during pair‑programming or when a pull request touches only one file.

> **Tip**: Keep the `scripts` section minimal and use the `npx` wrapper to avoid global installs. Add the desired tooling to `devDependencies`.

---

## 2. Code‑Style Guidelines

These rules apply to all JavaScript/HTML/CSS files in the repository. They are intentionally lightweight to keep the project approachable while still ensuring maintainability.

### 2.1 Import & Export Conventions

| Rule | Description |
|---|---|
| **Use ES‑Modules** | Prefer `import`/`export` over `require`. The project is already set up to run via Node‑18+ which supports ESM.
| **File‑per‑Module** | Each logical unit (e.g., a component, a helper) should live in its own file.
| **Relative Imports** | Use relative paths (`./utils`, `../helpers`) instead of absolute aliases. Keep the path depth to a maximum of 3 levels.
| **Named Exports for Reusables** | Export functions or constants that have public intent; default exports are discouraged.

### 2.2 Formatting & Indentation

| Rule | Value |
|---|---|
| **Indentation** | 2 spaces (no tabs). |
| **Line length** | 80 characters maximum; longer lines can be broken using implicit line continuations. |
| **Trailing commas** | Include trailing commas in multi‑line objects/arrays (`object,`). |
| **Semicolons** | Mandatory at the end of every statement. |
| **Blank lines** | Use a single blank line to separate logical blocks (e.g., imports, constants, main body). |

> **Linting**: Configure ESLint with the `airbnb-base` or `eslint-config-standard` preset for consistent formatting.

### 2.3 Naming Conventions

| Scope | Convention |
|---|---|
| **Variables / Constants** | `camelCase` for local variables; `UPPER_SNAKE_CASE` for exported constants (e.g., `MAX_RETRIES`). |
| **Functions** | `camelCase`, verb‑oriented (e.g., `fetchUserData`). |
| **Classes / Constructors** | `PascalCase`. |
| **Files** | `kebab-case.js`. |
| **React Components** | `PascalCase` (if you add React in the future). |
| **Events / Callbacks** | Prefix with `on` for handlers (e.g., `onClick`). |

### 2.4 Type Safety & Documentation

> The codebase is JavaScript only. Nevertheless, use **JSDoc** for public APIs to aid future TypeScript migration.

| Topic | Recommendation |
|---|---|
| **JSDoc** | Include `/** ... */` comments above functions, especially exported helpers. |
| **Type Hints** | Use `@param {Type} name`, `@returns {Type}`. |
| **`use strict`** | Add at the top of each module (`"use strict";`). |

### 2.5 Error Handling

| Principle | Implementation |
|---|---|
| **Guard Clauses** | Check arguments and exit early (`if (!arg) throw new Error(...)`). |
| **Try/Catch** | Wrap I/O or async operations; log the error and re‑throw if not recoverable. |
| **Logging** | Use `console.error` for serious problems; `console.warn` for non‑critical. |
| **Error Propagation** | Prefer propagating `Error` objects rather than returning error codes. |
| **Async Functions** | Always `await` promises; use `async/await` consistently. |

### 2.6 Security & Edge Cases

| Concern | Mitigation |
|---|---|
| **User Input** | Sanitize/escape any data rendered in the DOM. |
| **File Paths** | Validate paths before reading or writing files. |
| **CORS** | Set appropriate headers in `server.js` if the front‑end is served from another origin. |
| **Large Inputs** | Throttle or size‑limit uploads; reject requests exceeding a reasonable payload size. |

### 2.7 Testing & Debugging

| Tool | Usage |
|---|---|
| **Debugging** | Use `node --inspect` or Chrome DevTools; insert `debugger;` statements. |
| **Unit Tests** | Prefer Mocha + Chai or Jest for test‑driven development. |
| **Coverage** | Use Istanbul (`nyc`) to ensure 80 %+ coverage for critical paths. |
| **CI** | Configure GitHub Actions to run linting and tests on every push. |

---

## 3. Repository‑Specific Rules

* There are currently **no custom Cursor rules** (no `.cursor/rules/` directory). If you create Cursor rules, place them under `.cursor/rules/` and reference them in the README.

* There are also **no Copilot instructions**. If you want to provide Copilot hints, create a file at `.github/copilot-instructions.md` and describe any preferred patterns or “magic” code snippets.

---

## 4. Quick‑Start Checklist for Agents

1. **Clone the repo** and `npm i` to install the minimal dependencies.
2. **Run the dev server**: `npm run dev`.
3. **Add a test** (e.g., `tests/example.test.js`) and run it with `npm test`.
4. **Lint**: `npx eslint src/`.
5. **Commit** your changes following conventional commit style (`feat`, `fix`, `docs`, etc.).
6. **Push** to a feature branch and open a PR.

---

> **Author**: AGENT
> **Version**: 1.0.0
> **Date**: `YYYY-MM-DD`

---

*End of AGENTS.md*