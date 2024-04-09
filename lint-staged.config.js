export default {
  '*.{js,ts,json,yml,md,mdx}': filenames =>
    `prettier --write ${filenames.join(' ')}`,
  '*.{js,ts,json}': () => ['bun package', 'git add dist'],
}
