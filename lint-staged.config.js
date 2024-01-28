export default {
  '*.{js,ts,json,yml,md,mdx}': filenames =>
    `prettier --write ${filenames.join(' ')}`,
  '*.{js,ts,json}': () => 'pnpm run package',
}
