# Contributing to SliM

Thank you for your interest in this application.
This document provides further technical information about the app and guidelines on how to contribute to its development.

## User interface design and logic

The UI is designed for an image-centric digital pathology workflow based on the DICOM standard.

### Core UI components

1. `Worklist`: lists cases (DICOM studies) at `/`
2. `CaseViewer`: lists digital slides of a selected case (DICOM series of a selected DICOM study) at `/studies/:StudyInstanceUID`
3. `SlideViewer`: facilitates interactive visualization of a multi-resolution pyramid of a whole slide image (DICOM image instances of a selected DICOM series) at `/studies/:StudyInstanceUID/series/:SeriesInstanceUID`

### User flow

The `Worklist` queries the origin server for available imaging studies and renders query results as a table, where rows are individual studies and columns are study-level image attributes.
Upon selection of a study by the user, the app routes the user to the `CaseViewer`, which queries the origin server for available series for the selected study.
The `CaseViewer` displays selected patient- and study-level attributes that are shared amongst image instances in the selected study across the different series and lists individual series, showing the container identifier and OVERVIEW image (if available) for each item.
Upon selection of an individual series, the app routes the user to the `SlideViewer`, which displays the VOLUME images and the LABEL image (if available) of the selected series along with specimen-related attributes that are shared amongst the image instances in the selected series.
The app automatically selects the first series of the study, but the user can select other series from the list displayed in the `CaseViewer`.
The `SlideViewer` further provides annotation tools, which enable the user to draw, modify, select, remove, or save region of interest (ROI) annotations.

## Implementation details

The app is implemented in [TypeScript](https://www.typescriptlang.org/) 7 using [React](https://react.dev/) 19 with the [React Compiler](https://react.dev/learn/react-compiler) enabled, so components and hooks are memoized automatically and new code rarely needs `useMemo`, `useCallback` or `React.memo`.
The UI is styled with [Tailwind CSS](https://tailwindcss.com/) 4 on top of [Radix UI](https://www.radix-ui.com/) primitives (`src/components/ui`).
Icons are [lucide](https://lucide.dev/) SVGs rendered through `Icon` (`src/components/ui/icon.tsx`); add new glyphs to its `ICONS` map so `IconName` stays a closed union.

Tailwind is configured in CSS, without a `tailwind.config.js` or PostCSS config, and compiled by the `@tailwindcss/vite` plugin. `src/styles/globals.css` is the entry point:

- Light and dark color tokens are RGB-triplet CSS variables on `:root` and `.dark` (the theme toggle sets the `dark` class on `<html>`). The `@theme` block maps them to utilities (`--color-panel: rgb(var(--panel))` gives `bg-panel`, `text-panel`, `border-panel`, …), so opacity modifiers such as `bg-primary/10` keep working.
- The same `@theme` block holds the custom font sizes (`--text-11_5` gives `text-11.5`; `_` stands for the dot), radii (`rounded-card`, `rounded-tile`), shadows (`shadow-menu`, …), the `control` spacing step (`h-control`, `size-control`) and the layout sizes (`w-sidebar`, `h-header`, …).
- `dark:` utilities use `@custom-variant dark (&:where(.dark, .dark *))`.
- Radix enter/exit animations (`data-[state=open]:animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-top-2`, …) come from [tw-animate-css](https://github.com/Wombosvideo/tw-animate-css).

Register every new custom font-size, radius, shadow, spacing or size key in `src/lib/utils.ts` as well, so `cn()` merges it correctly. Otherwise tailwind-merge treats an unknown `text-*` or `shadow-*` as a color.

Components render props and call callbacks; DICOM parsing, formatting, filtering and other rules live in pure functions under `src/utils` and `src/features/*/utils`, with unit tests in sibling `__tests__` folders.
Shared sidebar layer controls (visibility toggle, settings popover, opacity row, style hooks) live in `src/components/panel`.
Transient notifications go through `publishToast` (`src/features/viewer/services/toast.ts`) and are rendered by `ToastHost`, which applies `config.messages`.

The app is built and served with [Vite](https://vite.dev/) (`vite.config.ts`). The compiler runs through Babel (`@rolldown/plugin-babel` with `reactCompilerPreset`) in dev, build and tests. Only `VITE_*` and `REACT_APP_*` variables reach the client, as `import.meta.env.*`.

Tests are written and run with [Vitest](https://vitest.dev/) in a jsdom environment, using [Testing Library](https://testing-library.com/). Mocks are reset before each test (`mockReset: true`); for Vitest, that means a `vi.fn(impl)` goes back to `impl`, not to returning `undefined`.

`pnpm run check:compiler` fails when the React Compiler bails out of a component or hook, and lists each file, line and reason. It runs in the pre-commit hook and in CI. Fix the code rather than opting out. Add `'use no memo'` only for a known compiler limitation (for example a library the compiler marks incompatible, such as TanStack Table's `useReactTable`), and explain why in a `/** */` comment next to the directive.

The [pnpm](https://pnpm.io/) package manager is used to manage dependencies and run scripts specified in `package.json` (`build`, `lint`, `test`, etc.).

## Coding style

Source code is linted and formatted using [Biome](https://biomejs.dev/), the only linter in the project (typescript-eslint does not support TypeScript 7). TypeScript is used with [strict type checking compiler options](https://www.typescriptlang.org/tsconfig#Strict_Type_Checking_Options_6173) enabled. Semicolons are not used at the end of statements (Biome uses `asNeeded`).

Explanatory comments use JSDoc-style block comments (`/** … */`), not `//` line comments. Keep `//` only for tooling directives (`biome-ignore`, `@ts-expect-error`, triple-slash references), temporarily commented-out code, and shebang lines.

Use the following commands to check and fix style:

    $ pnpm run lint        # check for issues
    $ pnpm run lint:fix    # auto-fix issues
    $ pnpm run fmt         # format code


### Documentation

Every function and method (with the exception of standard `React.Component` methods such as `render()` and `componentDidMount()`) shall have a docstring in [JSDoc](https://jsdoc.app/) format:

```js
/**
 * Check values.
 *
 * @param options - Options
 * @param options.foo - One option
 * @param options.bar - Another option
 *
 * @returns The return value
 */
const checkValues = ({ foo, bar }: { foo: string, bar: number }): boolean => {}
```

The types of parameters and return values are omitted in docstring comments, given that type annotations are already available in TypeScript.

## Pull requests

Use the repository pull request template. Include a clear summary, testing notes, and a semantic-release style title (for example `feat(Worklist): …`, `fix(SlideViewer): …`).

### Pairing a Firebase preview with dicom-microscopy-viewer

If your Slim change depends on an unreleased
[dicom-microscopy-viewer](https://github.com/ImagingDataCommons/dicom-microscopy-viewer)
branch, the Firebase preview workflow can install that branch automatically.

There are **two ways** to link a DMV branch (both require an open PR in DMV):

1. **Explicit `dmv-branch:`** — add a line near the top of the PR body:

   ```text
   dmv-branch: feat/my-dmv-change
   ```

2. **Matching branch name** — use the same branch name in both repos (for example
   `feat/my-change` in both Slim and DMV). No configuration needed — the workflow
   detects matching branches automatically.

If both methods apply, `dmv-branch:` takes priority. If neither applies, the
preview uses the published npm version from `package.json`.

#### PR comments

The workflow automatically posts a comment on your PR indicating which DMV
version the Firebase preview is using:

- **Linked to DMV Branch** — shows the branch name, commit SHA, and source
  (explicit `dmv-branch:` or matching branch name)
- **Using Published DMV** — shows the version from `package.json`

#### Retriggering the preview

Editing the PR description to add or change `dmv-branch:` retriggers the Firebase
preview workflow (body edits only; title-only edits are ignored).
