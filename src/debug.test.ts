import { describe, expect, test, vi } from 'vitest'

import { debug } from './debug.ts'

describe('debug', () => {
  test('escapes the characters that would terminate the workflow command', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    debug('100% done:\r\nfirst\nsecond')

    expect(log).toHaveBeenCalledWith(
      '::debug::100%25 done:%0D%0Afirst%0Asecond',
    )

    log.mockRestore()
  })
})
