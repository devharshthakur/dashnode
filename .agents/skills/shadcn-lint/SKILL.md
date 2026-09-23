---
name: shadcn-lint
description: Configures, interprets, and troubleshoots @shadcn/lint in this repository. Use when changing its ESLint rules, investigating diagnostics, defining component contracts, or fixing component and Tailwind class discovery.
---

# @shadcn/lint for this project

Use this skill when work concerns the `@shadcn/lint` package or its `shadcn/*` ESLint rules. For adding or editing shadcn/ui components without changing lint policy, use the general `shadcn` skill instead.

## Project setup (source of truth)

Check these files before changing anything; local configuration wins over examples from upstream:

- `apps/web/eslint.config.js` — ESLint flat config and the current rules.
- `apps/web/components.json` — UI aliases and Tailwind stylesheet path.
- `apps/web/src/styles.css` — Tailwind v4 theme and tokens.
- `apps/web/package.json` and `pnpm-lock.yaml` — pinned tool versions.

Current state:

- React + TypeScript + Tailwind CSS v4; `apps/web` is a workspace package using ESLint flat config.
- `@shadcn/lint` is pinned to `0.1.5`, `@typescript-eslint/parser` to `8.70.0`, and ESLint to `10.11.0`.
- The shadcn plugin is registered for JS/JSX/TS/TSX after the TanStack config, which supplies the existing parser setup.
- `shadcn/no-arbitrary-values` is an error. `shadcn/no-restyle` is an error with `allow: ['layout']`.
- `components.json` resolves UI components under `#/components/ui` and the theme from `src/styles.css`. Avoid adding manual discovery settings unless you prove automatic discovery is failing.
- `src/components/ui/**` is globally ignored by the existing ESLint config. The linter does not report on those implementation files in normal app lint runs; do not remove or broaden this ignore as a side effect of a rule fix.
- Lint currently warns that app `cn@0.3.0` is below the grammar version expected by the linter (`0.3.2`), and uses its bundled grammar instead. Treat this as a known, non-blocking warning; do not change `cn` or the linter version unless that dependency change is requested.

Upstream's `main` branch may document options newer than the installed `0.1.5`. Before relying on a new option or behavior, check this project's pinned version and its changelog/API. Do not upgrade or relax the pinned dependency as an incidental fix.

## Workflow

1. Read the active ESLint config and the relevant source component/theme. Confirm that a diagnostic is from a `shadcn/*` rule, that the file is linted, and that the JSX element is a component the plugin recognizes.
2. Read [the rule reference](references/upstream-documentation.md) for rule semantics and caveats. Follow its upstream links when exact current syntax or an unrecorded feature matters.
3. Fix a finding in this order: use an existing component prop/variant; use permitted layout classes or place spacing on a wrapper/parent; use a valid theme token or Tailwind scale value; add a component variant/contract only when the requested design needs that API/policy.
4. Keep exceptions narrow and intentional. Don't disable the rule, add a broad `allow`, or introduce an ESLint suppression just to silence a finding. If an exception is genuinely needed, preserve nearby policy and explain the specific approved reason.
5. When changing rules, use ESLint flat-config ordering and keep the plugin rule block scoped to the intended files. Remember an `allow` in one rule does not exempt a finding from another rule.
6. Run `pnpm validate` from the repository root after edits. This repository requires it as the standard validation command.

## Current policy: interpret findings correctly

`no-restyle` checks classes on components recognized as part of the design system; it is not a ban on styling ordinary HTML elements. With `allow: ['layout']`, placement classes such as `mt-4`, `w-full`, `hidden`, and `flex-1` are permitted on recognized components. Color, typography, spacing, shape, effects, motion, and unclassified classes remain restricted by the current policy. In particular, padding and gaps are **spacing**, not layout.

`no-arbitrary-values` is a separate rule and still rejects bracket values such as `p-[13px]`, including arbitrary layout values. Passing `no-restyle` does not imply passing other enabled rules.

When a class is disallowed, prefer a component `size` or `variant` if one expresses the design. If callers need a new reusable treatment, make it an explicit component variant and, separately, decide whether a `no-restyle` contract should allow it. Do not assume a contract changes runtime styling.

## Detailed reference

Open [`references/upstream-documentation.md`](references/upstream-documentation.md) for the six rules, policy matching, component/theme discovery, adoption guidance, limits, troubleshooting, and links to the source documentation in `shadcn-ui/lint`.
