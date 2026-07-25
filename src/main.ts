import { readFileSync } from 'node:fs'
import { styleText } from 'node:util'

import { calculateReviewToDismiss } from './calculate-reviews-to-dismiss.ts'
import { debug } from './debug.ts'
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

interface PullRequestEventPayload {
  pull_request?: {
    node_id: string
    base: { ref: string }
  }
}

/**
 * The runner writes the whole webhook payload to a file and points
 * `GITHUB_EVENT_PATH` at it.
 *
 * @see https://docs.github.com/actions/reference/workflows-and-actions/variables#default-environment-variables
 */
const getPullRequestFromEvent = () => {
  const eventPath = process.env.GITHUB_EVENT_PATH ?? ''

  if (!eventPath) {
    throw new Error(
      'No GITHUB_EVENT_PATH found. The action must be run by the GitHub actions runner.',
    )
  }

  const { pull_request: pullRequest } = JSON.parse(
    readFileSync(eventPath, 'utf8'),
  ) as PullRequestEventPayload

  if (!pullRequest) {
    throw new Error(
      'No pull_request found in the event payload. The action must be triggered by pull_request event.',
    )
  }

  return pullRequest
}

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

  const pullRequest = getPullRequestFromEvent()

  const octokit = getOctokit({ ghToken })

  const {
    commits: [{ commit: head }],
    latestReviews,
  } = await getPrData({
    octokit,
    pullRequestId: pullRequest.node_id,
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
      baseBranch: pullRequest.base.ref,
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
