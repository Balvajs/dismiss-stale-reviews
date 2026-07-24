import { groupReviewsByCommit } from './group-reviews-by-commit.ts'

jest.mock('codeowners', () =>
  jest.fn().mockImplementation(() => ({
    getOwner: () => ['@owner'],
  })),
)

jest.mock('simple-git', () => ({
  simpleGit: () => ({
    catFile: () => Promise.resolve(''),
  }),
}))

jest.mock('./get-head-diff-since-review.ts', () => ({
  getHeadDiffSinceReview: () => Promise.resolve(['some-file.ts']),
}))

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

  expect(reviewsWithoutHistory).toEqual([])
  expect(
    groupedReviewsByCommit['abcd1111..wxyz2222'].reviews.map(
      ({ author }) => author?.login,
    ),
  ).toEqual(['johnDoe', 'janeDoe'])
})
