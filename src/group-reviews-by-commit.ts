import { styleText } from 'node:util'

import Codeowners from 'codeowners'
import { minimatch } from 'minimatch'
import { simpleGit } from 'simple-git'

import { debug } from './debug.ts'
import { getHeadDiffSinceReview } from './get-head-diff-since-review.ts'

// the runner's stdout is not a TTY, `validateStream: false` emits ANSI anyway
const yellow = (text: string) =>
  styleText('yellow', text, { validateStream: false })

interface Review {
  author: {
    login: string
  } | null
  commit: {
    oid: string
  } | null
}

export const groupReviewsByCommit = async <TReview extends Review>({
  latestReviews,
  headCommit,
  baseBranch,
  ignoreFiles = [],
}: {
  latestReviews: TReview[]
  headCommit: string
  baseBranch: string
  ignoreFiles?: string[]
}) => {
  const codeowners = new Codeowners()
  const git = simpleGit()
  const reviewsWithoutHistory: typeof latestReviews = []
  const groupedReviewsByCommit: Record<
    string,
    {
      filesChangedByHeadCommit: { filename: string; owners: string[] }[]
      reviews: typeof latestReviews
    }
  > = {}
  // reviews must be processed sequentially — parallel processing raced on the
  // group existence check and dropped reviews sharing the same commit
  for (const review of latestReviews) {
    const reviewCommit = review.commit?.oid

    // without a commit there is no diff to resolve, treat it like a commit
    // missing from the history and let the caller dismiss the review
    if (reviewCommit === undefined) {
      reviewsWithoutHistory.push(review)

      continue
    }

    const basehead = `${reviewCommit}..${headCommit}`

    // if group exists, just push the review to the group
    if (basehead in groupedReviewsByCommit) {
      groupedReviewsByCommit[basehead].reviews.push(review)

      continue
    }

    try {
      // check if commit exists in history
      await git.catFile(['commit', reviewCommit])
    } catch {
      // if commit doesn't exist, make related approve ready for dismiss and continue
      console.log(
        '\n',
        yellow(
          `Commit '${reviewCommit}' doesn't exist in the history. It may be because it was overwritten by force push or because it's outside of checkout depth.`,
        ),
        '\n',
        yellow(`Approval by ${review.author?.login} will be removed.`),
        '\n',
      )
      reviewsWithoutHistory.push(review)

      continue
    }

    const filesChangedByHeadCommit = await getHeadDiffSinceReview({
      reviewAssociatedSha: reviewCommit,
      headSha: headCommit,
      baseBranch,
    })

    debug(`Changes in ${basehead}:\n${filesChangedByHeadCommit.join('\n')}`)

    groupedReviewsByCommit[basehead] = {
      reviews: [review],
      // filter out ignored files
      filesChangedByHeadCommit: filesChangedByHeadCommit
        .filter(
          filename =>
            !ignoreFiles.some(pattern =>
              minimatch(filename, pattern, { dot: true }),
            ),
        )
        .map(filename => ({
          owners: codeowners.getOwner(filename),
          filename,
        })),
    }
  }

  return { reviewsWithoutHistory, groupedReviewsByCommit }
}
