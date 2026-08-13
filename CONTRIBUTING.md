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

The app is implemented in [TypeScript](https://www.typescriptlang.org/) using the [React](https://reactjs.org/) framework.
The [antd](https://ant.design/https://ant.design/) React UI component library is used with a [customized theme](https://ant.design/docs/react/customize-theme).

The app is built using [craco](https://github.com/gsoft-inc/craco) (with the [craco-less plugin](https://github.com/DocSpring/craco-less)), which serves as a configuration layer around [create-react-app](https://github.com/facebook/create-react-app/).

Tests are written and run using the [jest](https://jestjs.io/) framework.

The [pnpm](https://pnpm.io/) package manager is used to manage dependencies and run scripts specified in `package.json` (`build`, `lint`, `test`, etc.).

## Coding style

Source code is linted and formatted using [Biome](https://biomejs.dev/). TypeScript is used with [strict type checking compiler options](https://www.typescriptlang.org/tsconfig#Strict_Type_Checking_Options_6173) enabled. Semicolons are not used at the end of statements (Biome uses `asNeeded`).

Explanatory comments use JSDoc-style block comments (`/** … */`), not `//` line comments. Keep `//` only for tooling directives (`eslint-disable`, `@ts-expect-error`, `biome-ignore`), temporarily commented-out code, and shebang lines.

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
branch, the Firebase preview workflow can install that branch automatically:

1. **Explicit:** add a line near the top of the PR body (template field):

   ```text
   dmv-branch: feat/my-dmv-change
   ```

2. **Same name:** use the same branch name in both repos (for example both
   `feat/my-change`) and leave `dmv-branch` empty.

`dmv-branch` wins when set. If it points at a branch that does not exist on DMV,
the preview job fails. If neither option applies, the preview uses the npm pin
from `package.json`.
