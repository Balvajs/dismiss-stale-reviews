import { describe, expect, test, vi } from 'vitest'

import { calculateReviewToDismiss } from './calculate-reviews-to-dismiss.ts'
import type { getOctokit } from './get-octokit.ts'

const review = { author: { login: 'johnDoe' }, commit: { oid: 'abcd1111' } }

vi.mock('./group-reviews-by-commit.ts', () => ({
  groupReviewsByCommit: () =>
    Promise.resolve({
      groupedReviewsByCommit: {
        'abcd1111..wxyz2222': {
          filesChangedByHeadCommit: [
            {
              filename: 'some-file.ts',
              owners: ['@org/team-a', '@org/team-b'],
            },
          ],
          reviews: [
            { author: { login: 'johnDoe' }, commit: { oid: 'abcd1111' } },
          ],
        },
      },
      reviewsWithoutHistory: [],
    }),
}))

// the review author is a member of both teams owning the changed file
vi.mock('./get-team-data.ts', () => ({
  getTeamData: () => Promise.resolve({ members: ['johnDoe'] }),
}))

describe('calculateReviewToDismiss', () => {
  test('dismisses a review once when its author owns the changes through several teams', async () => {
    const { reviewsToDismiss } = await calculateReviewToDismiss({
      latestReviews: [review],
      headCommit: 'wxyz2222',
      baseBranch: 'main',
      octokit: {} as ReturnType<typeof getOctokit>,
    })

    expect(reviewsToDismiss).toStrictEqual([review])
  })
})
