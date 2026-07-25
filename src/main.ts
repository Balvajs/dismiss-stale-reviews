import { styleText } from 'node:util'

import { debug } from '@actions/core'
import { context } from '@actions/github'

import { calculateReviewToDismiss } from './calculate-reviews-to-dismiss.ts'
import { dismissReviews } from './dismiss-reviews.ts'
import { getInputs } from './get-inputs.ts'
import { getOctokit } from './get-octokit.ts'
import { getPrData } from './get-pr-data.ts'
import { isPresent } from './type-guards.ts'

// the runner's stdout is not a TTY, `validateStream: false` emits ANSI anyway
const green = (text: string) =>
  styleText('green', text, { validateStream: false })
const yellow = (text: string) =>
  styleText('yellow', text, { validateStream: false })

const logReviewsToDismiss = (
  reviewsToDismiss: { author?: { login: string } | null }[],
) => {
  debug(`Reviews to dismiss: ${JSON.stringify(reviewsToDismiss, null, 2)}`)

  console.log(
    green(
      `Reviews to dismiss: ${reviewsToDismiss
        .map(({ author }) => author?.login ?? 'unknownLogin')
        .join(',')}`,
    ),
  )
}

const run = async () => {
  const { ghToken, ignoreFiles, noOwnerAction, forcePushAction } = getInputs()

  const pullRequestContext = context.payload.pull_request
  if (!pullRequestContext) {
    throw new Error(
      'No pull_request context found. The action must be triggered by pull_request event.',
    )
  }

  const pullRequestId = pullRequestContext.node_id as string

  const octokit = getOctokit({ ghToken })

  const {
    commits: [{ commit: head }],
    latestReviews,
  } = await getPrData({
    octokit,
    pullRequestId,
  })

  const latestApprovedReviews = latestReviews.filter(
    ({ state, commit }) => isPresent(commit) && state === 'APPROVED',
  )

  debug(`Approving reviews: ${JSON.stringify(latestApprovedReviews, null, 2)}`)

  if (latestApprovedReviews.length === 0) {
    console.log(green('No reviews to dismiss!'))

    return
  }

  try {
    const reviewsToDismissContext = await calculateReviewToDismiss({
      octokit,
      headCommit: head.oid,
      latestReviews: latestApprovedReviews,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      baseBranch: context.payload.pull_request?.base.ref as string,
      ignoreFiles,
    })

    // if there are some files without history let the users know and dismiss reviews calculated for dismiss
    if (
      reviewsToDismissContext.reviewsWithoutHistory !== undefined &&
      reviewsToDismissContext.reviewsWithoutHistory.length > 0
    ) {
      logReviewsToDismiss(reviewsToDismissContext.reviewsToDismiss)

      console.log(
        yellow(
          `Files diff can't be resolved for following reviews due to force push:\n${reviewsToDismissContext.reviewsWithoutHistory
            .map(({ author }) => author?.login)
            .join('\n')}\n`,
        ),
      )

      if (forcePushAction === 'dismiss-none') {
        console.log(
          yellow(
            '"force-push-action" is set to "dismiss-none", so no reviews are dismissed.',
          ),
        )

        return
      }

      await dismissReviews({
        octokit,
        reviewsToDismiss: reviewsToDismissContext.reviewsToDismiss,
        message: `
        <details>
          <summary>Following reviews were removed because related commit was overwritten by force push.</summary>
          <p>
  
          - \`${reviewsToDismissContext.reviewsWithoutHistory
            .map(({ author }) => author?.login)
            .join('`\n- `')}\`
  
          </p>
        </details>
      `.replaceAll(/  +/gu, ' '),
      })
    }
    // if there are any files without owner, dismiss all reviews
    else if (reviewsToDismissContext.filesWithoutOwner) {
      logReviewsToDismiss(latestApprovedReviews)

      console.log(
        yellow(
          `Files without owner:\n${reviewsToDismissContext.filesWithoutOwner.join('\n')}`,
        ),
      )

      if (noOwnerAction === 'dismiss-none') {
        console.log(
          yellow(
            '"no-owner-action" is set to "dismiss-none", so no reviews are dismissed.',
          ),
        )

        return
      }

      await dismissReviews({
        octokit,
        reviewsToDismiss: latestApprovedReviews,
        message: `
          <details>
            <summary>Because some files don’t have owner, all reviews are dismissed.</summary>
            <p>

            If you know who should own following files, consider adding the owner to \`.github/CODEOWNERS\` file.

            - \`${reviewsToDismissContext.filesWithoutOwner
              .join('`\n- `')
              .replaceAll('_', '&#95;')}\`

            </p>
          </details>
        `.replaceAll(/  +/gu, ' '),
      })
    } else if (reviewsToDismissContext.reviewsToDismiss.length > 0) {
      logReviewsToDismiss(reviewsToDismissContext.reviewsToDismiss)

      await dismissReviews({
        octokit,
        reviewsToDismiss: reviewsToDismissContext.reviewsToDismiss,
        message: 'Stale reviews were dismissed based on ownership',
      })
    } else {
      console.log(green('No reviews to dismiss!'))
    }
  } catch (error) {
    console.error(error)
    await dismissReviews({
      octokit,
      message:
        'Some error occurred in `dismiss-stale-reviews` action, all reviews are dismissed.',
      reviewsToDismiss: latestApprovedReviews,
    })
  }
}

run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
