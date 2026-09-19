export default {
  '**/*.{js,mjs,cjs,ts,tsx}': [
    'eslint --fix',
    'prettier --write --ignore-unknown',
  ],
  '**/*.{json,jsonc,md,yml,yaml}': 'prettier --write --ignore-unknown',
}
