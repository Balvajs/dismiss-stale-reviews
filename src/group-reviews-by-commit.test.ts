import { describe, expect, test, vi } from 'vitest'

import { groupReviewsByCommit } from './group-reviews-by-commit.ts'

// real ESM needs both a `default` key and an actual constructor, because
// `group-reviews-by-commit.ts` does `new Codeowners()`
vi.mock('codeowners', () => ({
  default: class {
    getOwner() {
      return ['@owner']
    }
  },
}))

vi.mock('simple-git', () => ({
  simpleGit: () => ({
    catFile: () => Promise.resolve(''),
  }),
}))

vi.mock('./get-head-diff-since-review.ts', () => ({
  getHeadDiffSinceReview: () => Promise.resolve(['some-file.ts']),
}))

describe('groupReviewsByCommit', () => {
  test('keeps all reviews sharing the same commit in one group', async () => {
    const { groupedReviewsByCommit, reviewsWithoutHistory } =
      await groupReviewsByCommit({
        latestReviews: [
          { author: { login: 'johnDoe' }, commit: { oid: 'abcd1111' } },
          { author: { login: 'janeDoe' }, commit: { oid: 'abcd1111' } },
        ],
        headCommit: 'wxyz2222',
        baseBranch: 'main',
      })

    expect(reviewsWithoutHistory).toStrictEqual([])
    expect(
      groupedReviewsByCommit['abcd1111..wxyz2222'].reviews.map(
        ({ author }) => author?.login,
      ),
    ).toStrictEqual(['johnDoe', 'janeDoe'])
  })
})
