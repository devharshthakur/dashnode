export default {
  '*.{js,mjs,cjs,json,jsonc,md,yml,yaml}': 'prettier --write --ignore-unknown',
  'packages/**/*.{js,mjs,cjs,json,md}': 'prettier --write --ignore-unknown',
}
