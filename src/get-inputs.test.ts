import { describe, expect, test, vi } from 'vitest'

import { getInputs } from './get-inputs.ts'

const stubRequiredInputs = () => {
  vi.stubEnv('INPUT_TOKEN', 'gh-token')
  vi.stubEnv('INPUT_NO-OWNER-ACTION', 'dismiss-all')
  vi.stubEnv('INPUT_FORCE-PUSH-ACTION', 'dismiss-none')
}

describe('getInputs', () => {
  test('reads the inputs from the INPUT_ environment variables', () => {
    stubRequiredInputs()
    vi.stubEnv('INPUT_IGNORE-FILES', '')

    expect(getInputs()).toStrictEqual({
      ghToken: 'gh-token',
      ignoreFiles: [],
      noOwnerAction: 'dismiss-all',
      forcePushAction: 'dismiss-none',
    })
  })

  test('splits the ignore-files list on new lines, ignoring blank ones', () => {
    stubRequiredInputs()
    vi.stubEnv('INPUT_IGNORE-FILES', '  *.md\n\ndocs/**  \n')

    expect(getInputs().ignoreFiles).toStrictEqual(['*.md', 'docs/**'])
  })

  test('throws when a required input is missing', () => {
    vi.stubEnv('INPUT_TOKEN', '')

    expect(() => getInputs()).toThrow('Input required and not supplied: token')
  })

  test('throws when a dismiss action input is not a known value', () => {
    stubRequiredInputs()
    vi.stubEnv('INPUT_NO-OWNER-ACTION', 'dismiss-some')

    expect(() => getInputs()).toThrow(
      'The no-owner-action input accepts only "dismiss-all" or "dismiss-none" enum. Got "dismiss-some"',
    )
  })
})
