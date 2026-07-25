const config = {
  '*.{js,ts,json,yml,md,mdx}': 'oxfmt --write -c oxfmt.config.ts',
  '*.{js,ts,json}': () => ['bun package', 'git add dist'],
}

export default config
