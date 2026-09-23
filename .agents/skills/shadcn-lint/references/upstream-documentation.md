# `@shadcn/lint` documentation notes

This is a project-oriented digest of the upstream README and documentation, not a replacement for the authoritative sources. Upstream links are listed at the end. The project currently pins `@shadcn/lint` `0.1.5`; verify that any newer documented API is supported before using it.

## What the linter does

`@shadcn/lint` is an opt-in, agent-oriented design-system linter for Tailwind projects. It analyzes static JSX class/style usage and supplies diagnostics intended to guide code toward existing component variants and theme tokens. It is not a runtime validator and it does not decide which design choices are correct; the project owns its rules and contracts.

It supports React, Vue, and Svelte, with ESLint or Oxlint. ESLint setup uses a flat config, `@shadcn/lint` plugin, and (for React TypeScript/JSX) `@typescript-eslint/parser`; preserve a framework's existing parser configuration. Upstream currently documents Node.js 20.19+ and ESLint 9.30+ for ESLint use, or Oxlint 1.80+ for Oxlint. Vue/Svelte template linting uses the matching ESLint parser; Oxlint reads their script blocks only. This project is React + ESLint, so do not introduce other framework adapters here.

The project currently runs the plugin from `apps/web/eslint.config.js` via its existing `pnpm lint` script. Run root `pnpm validate` for required validation; don't add a second lint command just for this plugin.

## Rules

Enable rules deliberately; no rule should be enabled merely because an upstream example includes it. The six upstream rules are:

| Rule                            | Checks                                                                                   | Notes                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `shadcn/no-restyle`             | Classes applied to recognized design-system components.                                  | Use component props/variants for appearance; an `allow` policy can permit selected categories/classes.              |
| `shadcn/no-arbitrary-values`    | Tailwind arbitrary values such as `p-[13px]`.                                            | A bare error rule also blocks arbitrary values in layout classes. An allowance here is independent of `no-restyle`. |
| `shadcn/no-raw-colors`          | Raw palette colors, undeclared theme colors, and literal color values on SVG attributes. | Theme discovery matters for recognizing declared tokens.                                                            |
| `shadcn/no-inline-styles`       | Inline styles and `<style>` elements.                                                    | Its `allow`/`deny` policy is about CSS property names; component recognition settings do not apply.                 |
| `shadcn/no-unknown-classes`     | Tailwind classes the project cannot generate.                                            | Needs the real Tailwind v4 theme for its complete check and spelling suggestions.                                   |
| `shadcn/require-static-classes` | Dynamic class values that the analyzer cannot statically understand.                     | Particularly useful on recognized components; it has no shared `allow`/`deny`/`contracts` policy.                   |

The project's active policy enables only `no-arbitrary-values` and `no-restyle`. Do not silently add other rules or modify their severities as unrelated cleanup.

### `no-restyle` categories

The common policy `allow: ['layout']` is intentionally narrower than “allow all layout-like-looking classes.” Typical examples from upstream:

| Category     | Examples                                                                         | Current result with layout allowed                 |
| ------------ | -------------------------------------------------------------------------------- | -------------------------------------------------- |
| layout       | `mt-4`, `w-full`, `hidden`, `absolute`, `flex-1`, `text-center`, `group`, `peer` | Allowed                                            |
| color        | `bg-primary`, `text-red-500`, `border-border`                                    | Reported                                           |
| typography   | `text-sm`, `font-bold`, `leading-none`, `truncate`                               | Reported                                           |
| spacing      | `p-4`, `gap-2`, `space-x-4`                                                      | Reported                                           |
| shape        | `rounded-lg`, `border`, `ring-2`, `outline-none`                                 | Reported                                           |
| effects      | `shadow-sm`, `opacity-50`, `blur`                                                | Reported                                           |
| motion       | `animate-pulse`, `transition`, `duration-200`                                    | Reported                                           |
| unclassified | custom/unknown-to-the-grammar class                                              | Reported unless explicitly allowed by name/pattern |

Category classification is based on class names, not equivalent computed CSS. A custom class defined in CSS is still unclassified because its effect may not be known. Unknown classes aren't automatically treated as layout.

### Other key rule behavior

- `no-arbitrary-values` flags bracket-value classes even when the class is also permitted by `no-restyle`; use a scale value or theme token when it fits.
- `no-raw-colors` relies on the readable theme to distinguish declared tokens from palette/literal colors. Do not replace a token with a raw color to work around a diagnostic.
- `no-inline-styles` can allow selected CSS properties, but property exceptions do not exempt `<style>` blocks or dynamic styles. Vue/Svelte style blocks are plain CSS and are outside these framework checks.
- `no-unknown-classes` can be allowed to accept class names from external CSS, but that only silences the linter; it does not create CSS. A failed theme load causes a weaker grammar fallback without spelling suggestions, so fix the theme warning before trusting a clean result.
- `require-static-classes` reports only when a component class value cannot be read statically. Prefer statically discoverable class values rather than hiding dynamic branches from Tailwind or the linter.

## Rule options and policies

All rules accept `message`. Every rule except `require-static-classes` also accepts `allow`, `deny`, and `contracts`.

- `allow` defines the allowed exceptions for the rule. For `no-restyle`, it is the styling a component caller may customize; for token checks it creates exceptions to the check.
- `deny` removes matches from the allowances. With `deny` and no `allow`, the default is to allow everything except denied entries, so adding `deny` alone can loosen a rule substantially.
- `allow: []` means no exceptions; omitting `allow` is not equivalent if `deny` is present.
- Entries can be categories (`layout`, `spacing`), class groups (`p`, `bg-color`, `rounded`), exact classes (`p-4`), or wildcard patterns (`md:p-*`). Groups are distinct: `p` does not imply `px`/`py`; `rounded` does not imply `rounded-t-*`.
- Patterns without a variant separator match the base class across variants/important markers/negative prefixes/opacity modifiers; entries containing `:` match the full class. These are class-name rules, not checks for equivalent CSS.
- A policy exception in one rule does not bypass any other enabled rule. For example, allowing `p-*` with `no-restyle` does not allow `p-[13px]` through `no-arbitrary-values`.

### Component contracts

Use `contracts` when callers of specific components should be allowed different styling. Each `pattern` is a regular expression against the resolved component name; anchor it for an exact match (`^Button$`, not `Button`, which can also match `IconButton`).

- A contract replaces the top-level policy keys it specifies and inherits unspecified top-level keys. If multiple contracts match, only the last matching contract applies; contracts do not merge with one another.
- Include `layout` in a contract's `allow` if that component still accepts placement styles; writing a contract `allow` replaces rather than extends the top-level `allow`.
- A contract changes lint policy only; it does not add styles or variants to a component. Implement a variant in the component when the design needs reusable appearance.
- Contracts and allowances never bypass other rules, such as `no-arbitrary-values`.

### Custom messages and shared settings

- `message` may be a string or, for `no-restyle`, category-specific object. Supported interpolations depend on the rule/finding; common ones include `{{component}}`, `{{className}}`, `{{suggestions}}`, and `{{file}}`. `no-restyle` additionally documents `{{category}}`, `{{variants}}`, `{{sizes}}`, `{{around}}`, and `{{entries}}`. Verify placeholders against the installed version; unknown placeholders can remain literal.
- `settings.shadcn.note` appends shared guidance to findings. Use only when there is stable project documentation to point to.
- Shared recognition options include `ui`, `componentImports`, `ignoreImports`, `mergeFunctions`, and `variantFunctions`. `ui` is an import prefix; `ignoreImports` takes precedence over recognition. Extra function names extend built-ins (`cn`, `cx`, `clsx`, `cva`, `tv`, `twMerge`, `twJoin`, `classNames`).
- Rule-level recognition settings override the matching shared setting. Don't duplicate auto-detected project aliases/settings without evidence.

## Recognition and static analysis

With a `components.json`, the plugin can discover the UI directory and theme file from its aliases and Tailwind CSS path. It can resolve component imports through project aliases, TypeScript paths, package exports, and re-exports. In the web app, `components.json` maps `ui` to `#/components/ui`, which maps into `src/components/ui`, and its Tailwind stylesheet is `src/styles.css`.

The analyzer understands common JSX `className`/class-like props, styles, SVG color attributes, class merge/variant functions, `cva`/`tv`, same-file variables (one hop), readable object spreads, typed string-literal variants, and many wrappers that forward classes. It does not provide full program execution or CSS equivalence analysis. Notable limits:

- It does not follow imported class values or opaque spreads/props reliably.
- It does not infer parent-selector effects on child components.
- Stylesheet declarations and `@apply` are not linted as JSX class usage.
- Dynamic classes may be unverifiable by design; `require-static-classes` is a policy for making that visible.
- `no-restyle` does not apply to ordinary HTML elements, and recognition must succeed for it to report on a design-system component.

For this app, verify the alias and file inclusion before changing a rule if an expected component is not reported. The existing global ESLint ignore for `src/components/ui/**` excludes those files from lint diagnostics even though the plugin can still inspect component source for component metadata/variant guidance.

## Adoption and safe configuration changes

Upstream's adoption guide recommends introducing rules incrementally: begin at warning level for an existing codebase, address repeated patterns, optionally cap warning counts in CI, then promote clean rules to errors. Apply strict policy to new areas before older areas when useful. This project already has two rules at error severity; preserve that unless the task explicitly asks for a policy change.

When adding an extra rule at the user's request:

1. Explain the policy effect and inspect likely findings before making a broad rule strict.
2. Add it at warning level first if legacy findings are expected, unless the user explicitly asked for strict enforcement.
3. Exempt only the component implementation directory where necessary. Upstream suggests turning off `no-restyle`, `no-arbitrary-values`, and `require-static-classes` in that directory while retaining `no-raw-colors` and `no-inline-styles`. In this project that directory is already globally ESLint-ignored, which is broader; don't change the ignore shape casually.
4. Add `no-unknown-classes` at warning severity first because external stylesheet classes may need explicit allowances.
5. Review each token, variant, contract, allowance, and suppression as a design-system decision. Put a reason on intentional ESLint suppressions and keep them narrow.

Do not copy `--max-warnings` values from examples; any warning budget must come from a measured baseline. Do not add a shared lint JSON or migrate from ESLint to Oxlint unless asked.

## Troubleshooting

### A component is not reported

Check `components.json` aliases, the import path used at the call site, whether the target file matches ESLint's file globs, whether the directory is ignored, and whether a later flat-config object disabled the rule. If a component has a custom import location, consider a narrow `settings.shadcn.ui` or `componentImports` only after validating discovery.

### Theme or Tailwind classes cannot be loaded

Check `components.json`'s Tailwind CSS path, CSS imports, and referenced `@plugin`/`@config` modules. For Tailwind v4, `no-unknown-classes` needs the actual project theme; its fallback is less complete and loses spelling suggestions. Resolve the warning before treating a clean run as proof.

### Diagnostics seem stale

Run without ESLint `--cache` after changing components, variants, theme, or dependencies; cached lint may miss files that depend on unchanged source. Restart long-running editor lint processes if required. Upstream notes that imported JavaScript inside a Tailwind plugin/config may not be tracked; restart the linter or touch the plugin/config entrypoint after changing those modules.

### Project `cn` grammar warning

The app currently has `cn@0.3.0`; `@shadcn/lint` reports it needs `cn@0.3.2` or later and falls back to a bundled `cn@0.3.2` grammar. This is known. Don't silently upgrade or replace `cn` as part of an unrelated styling fix; if the warning becomes a task, check dependency and package compatibility first.

## Upstream documentation map

Use these source pages when exact, current package behavior matters. The pinned package version takes precedence over docs for a newer release.

- [README / setup / rules / settings / monorepos](https://github.com/shadcn-ui/lint/blob/main/README.md)
- [React ESLint setup and analysis coverage](https://github.com/shadcn-ui/lint/blob/main/docs/react.md)
- [Rules index, policy options, contracts, messages, recognition](https://github.com/shadcn-ui/lint/blob/main/docs/rules.md)
- [Rule details: `no-restyle`](https://github.com/shadcn-ui/lint/blob/main/docs/rules/no-restyle.md)
- [Rule details: `no-arbitrary-values`](https://github.com/shadcn-ui/lint/blob/main/docs/rules/no-arbitrary-values.md)
- [Rule details: `no-raw-colors`](https://github.com/shadcn-ui/lint/blob/main/docs/rules/no-raw-colors.md)
- [Rule details: `no-inline-styles`](https://github.com/shadcn-ui/lint/blob/main/docs/rules/no-inline-styles.md)
- [Rule details: `no-unknown-classes`](https://github.com/shadcn-ui/lint/blob/main/docs/rules/no-unknown-classes.md)
- [Rule details: `require-static-classes`](https://github.com/shadcn-ui/lint/blob/main/docs/rules/require-static-classes.md)
- [Design systems, variants, contracts, shared policies](https://github.com/shadcn-ui/lint/blob/main/docs/design-systems.md)
- [Adoption and incremental rollout](https://github.com/shadcn-ui/lint/blob/main/docs/adoption.md)
- [Static analysis, component discovery, and theme loading](https://github.com/shadcn-ui/lint/blob/main/docs/how-it-works.md)
- [Troubleshooting](https://github.com/shadcn-ui/lint/blob/main/docs/troubleshooting.md)
- [Package API](https://github.com/shadcn-ui/lint/blob/main/docs/api.md)
- [Vue setup](https://github.com/shadcn-ui/lint/blob/main/docs/vue.md) and [Svelte setup](https://github.com/shadcn-ui/lint/blob/main/docs/svelte.md) (not currently used here)
- [Package changelog](https://github.com/shadcn-ui/lint/blob/main/packages/lint/CHANGELOG.md)
