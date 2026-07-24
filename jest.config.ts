import type { Config } from 'jest'

const config: Config = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.(t|j)s$': '@swc/jest',
  },
  // many dependencies (@actions/*, @octokit/*, chalk, ...) are ESM-only, transform everything
  transformIgnorePatterns: [],
  resolver: '<rootDir>/jest.resolver.cjs',
  verbose: true,
  testEnvironment: 'node',
}

export default config
