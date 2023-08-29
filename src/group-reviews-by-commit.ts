import { debug } from '@actions/core'
import { simpleGit } from 'simple-git'
import { Chalk } from 'chalk'
import Codeowners from 'codeowners'
import { minimatch } from 'minimatch'

import { getHeadDiffSinceReview } from './get-head-diff-since-review.ts'

const chalk = new Chalk({ level: 2 })

type Review = {
  author: {
    login: string
  } | null
  commit: {
    abbreviatedOid: string
  } | null
}

export const groupReviewsByCommit = async <TReview extends Review>({
  latestReviews,
  headCommit,
  baseBranch,
  ignoreFiles,
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
  await Promise.all(
    latestReviews.map(async review => {
      const reviewCommit = review.commit?.abbreviatedOid as string
      const basehead = `${reviewCommit}..${headCommit}`

      // if group exists, just push the review to the group
      if (groupedReviewsByCommit[basehead]) {
        groupedReviewsByCommit[basehead].reviews.push(review)

        return
      }

      try {
        // check if commit exists in history
        await git.catFile(['commit', reviewCommit])
      } catch {
        // if commit doesn't exist, make related approve ready for dismiss and continue
        console.log(
          '\n',
          chalk.yellow`Commit '${reviewCommit}' doesn't exist in the history. It may be because it was overwritten by force push or because it's outside of checkout depth.`,
          '\n',
          chalk.yellow`Approval by ${review.author?.login} will be removed.`,
          '\n',
        )
        reviewsWithoutHistory.push(review)

        return
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
              !ignoreFiles?.some(pattern =>
                minimatch(filename, pattern, { dot: true }),
              ),
          )
          .map(filename => ({
            owners: codeowners.getOwner(filename),
            filename,
          })),
      }
    }),
  )

  return { reviewsWithoutHistory, groupedReviewsByCommit }
}
