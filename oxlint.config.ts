import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: [
    'typescript',
    'unicorn',
    'oxc',
    'import',
    'promise',
    'node',
    'vitest',
  ],
  categories: {
    correctness: 'error',
    suspicious: 'error',
    pedantic: 'error',
    perf: 'error',
  },
  rules: {
    // pedantic/perf opt-outs
    // would require Readonly<> on every parameter of every function
    'typescript/prefer-readonly-parameter-types': 'off',
    // non-obvious decisions are documented with trailing comments deliberately
    'no-inline-comments': 'off',
    // git operations share one working directory and must run sequentially
    'no-await-in-loop': 'off',
    'max-lines-per-function': 'off',
    // action output is printed with colored console.log on purpose
    'no-console': 'off',
    // `run()` is invoked with `.catch()` so a failure sets process.exitCode
    // instead of producing an unhandled rejection
    'unicorn/prefer-top-level-await': 'off',

    // style picks — the category as a whole is unusable because it contains
    // mutually exclusive rules (import/prefer-default-export vs
    // import/no-default-export vs import/no-named-export) and rules that
    // duplicate oxfmt (sort-keys, sort-imports, capitalized-comments)
    'typescript/consistent-type-imports': 'error',
    'unicorn/catch-error-name': 'error',
    'unicorn/no-await-expression-member': 'error',
    'unicorn/require-array-join-separator': 'error',
    'no-implicit-coercion': 'error',
    'no-duplicate-imports': 'error',
    'prefer-named-capture-group': 'error',
    'import/no-anonymous-default-export': 'error',
    'vitest/prefer-strict-equal': 'error',
    'vitest/require-top-level-describe': 'error',

    // restriction picks — the category as a whole targets old runtimes
    // (oxc/no-async-await, oxc/no-optional-chaining,
    // oxc/no-rest-spread-properties), which this action does not
    'unicorn/prefer-node-protocol': 'error',
    'typescript/no-non-null-assertion': 'error',
    'no-void': 'error',
    'node/no-process-env': 'error',

    // evaluated and rejected, each one conflicts with intentional code here:
    // - no-eq-null / eqeqeq null option: `isPresent` compares against both
    //   null and undefined on purpose
    // - promise/avoid-new: the e2e harness must bridge `spawn`'s callbacks
    // - typescript/promise-function-async: fights require-await, return-await
    //   and the mock signatures in the test files
    // - vitest/prefer-import-in-mock: the typed form rejects partial mocks of
    //   simple-git and codeowners
    // - vitest/no-importing-vitest-globals: globals are not enabled, tests
    //   import describe/test/expect explicitly

    'no-underscore-dangle': 'off',
    'typescript/no-unsafe-type-assertion': 'off',
  },
  overrides: [
    {
      files: ['e2e/**'],
      rules: {
        // the e2e harness reads its configuration straight from the environment
        'node/no-process-env': 'off',
      },
    },
  ],
  env: {
    builtin: true,
  },
  options: {
    // oxlint reports several rules at warning severity and exits 0 when only
    // warnings are present — without this a real finding keeps CI green
    denyWarnings: true,
    reportUnusedDisableDirectives: 'error',
    typeAware: true,
  },
  ignorePatterns: [
    '**/__generated__/**',
    'node_modules/**',
    'lib/**',
    'dist/**',
  ],
})
