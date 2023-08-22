import { context } from '@actions/github'
import { Chalk } from 'chalk'

import { calculateReviewToDismiss } from './calculate-reviews-to-dismiss.ts'
import { dismissReviews } from './dismiss-reviews.ts'
import { getGithubData } from './get-github-data.ts'
import { getOctokit } from './get-octokit.ts'
import { getInputs } from './get-inputs.ts'

const chalk = new Chalk({ level: 2 })

const run = async () => {
  const { ghToken, ignoreFiles } = getInputs()

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
  } = await getGithubData({
    octokit,
    pullRequestId,
  })

  const latestApprovedReviews = latestReviews.filter(
    ({ state, publishedAt, commit }) =>
      commit &&
      state === 'APPROVED' &&
      publishedAt &&
      publishedAt < head.committedDate,
  )

  if (!latestApprovedReviews.length) {
    console.log(chalk.green`No reviews to dismiss!`)

    return
  }

  console.log(
    `Approving reviews: ${latestApprovedReviews
      .map(({ author }) => author?.login || 'unknownLogin')
      .join(',')}`,
  )

  try {
    const reviewsToDismissContext = await calculateReviewToDismiss({
      octokit,
      headCommit: head.abbreviatedOid,
      latestReviews: latestApprovedReviews,
      baseBranch: context.payload.pull_request?.base.ref as string,
      ignoreFiles,
    })

    const reviewsToDismiss = reviewsToDismissContext.filesWithoutOwner
      ? latestApprovedReviews
      : reviewsToDismissContext.reviewsToDismiss

    if (!reviewsToDismiss.length) {
      console.log(chalk.green`No reviews to dismiss!`)

      return
    }

    console.log(
      chalk.green`Reviews to dismiss: ${reviewsToDismiss
        .map(({ author }) => author?.login || 'unknownLogin')
        .join(',')}`,
    )

    // if there are any files without owner, dismiss all reviews
    if (reviewsToDismissContext.filesWithoutOwner) {
      console.log(
        chalk.yellow(
          'Files without owner:\n',
          reviewsToDismissContext.filesWithoutOwner.join('/n'),
        ),
      )

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
              .replace(/_/g, '&#95;')}\`

            </p>
          </details>
        `.replace(/  +/g, ' '),
      })
      // if there are some files without history let the users know and dismiss reviews calculated for dismiss
    } else if (reviewsToDismissContext.reviewsWithoutHistory.length) {
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
        `.replace(/  +/g, ' '),
      })
    } else {
      await dismissReviews({
        octokit,
        reviewsToDismiss: reviewsToDismissContext.reviewsToDismiss,
        message: 'Stale reviews were dismissed based on ownership',
      })
    }
  } catch (e) {
    console.error(e)
    await dismissReviews({
      octokit,
      message:
        'Some error occurred in `dismiss-stale-reviews` action, all reviews are dismissed.',
      reviewsToDismiss: latestApprovedReviews,
    })
  }
}

run()
