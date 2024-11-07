import tsEslint from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'
import js from '@eslint/js'

const recommendedConfig = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    ...tsEslint.configs.base,
    languageOptions: {
      ...tsEslint.configs.base.languageOptions,
      parserOptions: {
        projectService: true,
        sourceType: 'module',
      },
    },
  },
  // extract recommended config from typescript-eslint and enable it only for TS files
  ...[
    ...tsEslint.configs.recommended,
    ...tsEslint.configs.recommendedTypeChecked,
    ...tsEslint.configs.stylistic,
    ...tsEslint.configs.stylisticTypeChecked,
  ]
    .map(({ rules, files }) =>
      rules ? { rules, files: files ?? ['**/*.ts', '**/*.tsx'] } : undefined,
    )
    .filter(Boolean),
]

export default [
  { ignores: ['**/__generated__/**', 'node_modules/**', 'lib/**', 'dist/**'] },
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },
  ...recommendedConfig,
  stylistic.configs['recommended-flat'],
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      /**
       * SECTION START: Disabled rules colliding with Prettier
       */
      '@stylistic/no-tabs': 'off',
      '@stylistic/indent': 'off',
      '@stylistic/semi': 'off',
      '@stylistic/brace-style': 'off',
      '@stylistic/member-delimiter-style': 'off',
      '@stylistic/quotes': 'off',
      '@stylistic/indent-binary-ops': 'off',
      '@stylistic/operator-linebreak': 'off',
      '@stylistic/arrow-parens': 'off',
      '@stylistic/quote-props': 'off',
      '@stylistic/no-mixed-spaces-and-tabs': 'off',
      /**
       * SECTION END
       */
      'no-console': 'off',
      'no-restricted-syntax': 'off',
      'arrow-parens': 'off',
      'no-underscore-dangle': 'off',
      camelcase: 'off',
      semi: 'off',
      'implicit-arrow-linebreak': 'off',
      'no-undef': 'off',
    },
  },
]
