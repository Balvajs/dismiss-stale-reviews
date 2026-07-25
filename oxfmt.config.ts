import { defineConfig } from 'oxfmt'

export default defineConfig({
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  arrowParens: 'avoid',
  sortPackageJson: true,
  sortImports: {},
  ignorePatterns: ['dist/', 'lib/', 'node_modules/', '.cache'],
})
