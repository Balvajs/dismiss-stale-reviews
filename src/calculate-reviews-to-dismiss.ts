import { debug } from '@actions/core'
import { groupReviewsByCommit } from './group-reviews-by-commit.ts'
import { getOctokit } from './get-octokit.ts'

export type Review = {
  author: {
    login: string
  } | null
  commit: {
    abbreviatedOid: string
  } | null
}

export const calculateReviewToDismiss = async <TReview extends Review>({
  latestReviews,
  headCommit,
  baseBranch,
  ignoreFiles,
  octokit,
}: {
  latestReviews: TReview[]
  headCommit: string
  baseBranch: string
  ignoreFiles?: string[]
  octokit: ReturnType<typeof getOctokit>
}) => {
  const { groupedReviewsByCommit, reviewsWithoutHistory } =
    await groupReviewsByCommit({
      latestReviews,
      headCommit,
      baseBranch,
      ignoreFiles,
    })

  const filesWithoutOwner = [
    ...new Set(
      Object.values(groupedReviewsByCommit)
        .map(({ filesChangedByHeadCommit }) =>
          filesChangedByHeadCommit
            .filter(({ owners }) => !owners.length)
            .map(({ filename }) => filename),
        )
        .flat(),
    ),
  ]

  // if there are some files without owner, we are not able to assign a review to those files
  // and because of that we need to dismiss all reviews
  if (filesWithoutOwner.length) {
    return {
      filesWithoutOwner,
    }
  }

  const reviewsToDismiss: typeof latestReviews = [...reviewsWithoutHistory]

  await Promise.all(
    Object.values(groupedReviewsByCommit).map(
      async ({ filesChangedByHeadCommit, reviews }) => {
        // list of unique file owners
        const changedFilesOwners = [
          ...new Set(
            filesChangedByHeadCommit.map(({ owners }) => owners).flat(),
          ),
        ]

        const changedFilesTeamOwners = changedFilesOwners.filter(owner =>
          owner.includes('/'),
        )

        await Promise.all(
          reviews.map(async review => {
            const { author } = review

            debug(`Check if ${author?.login} review should be dismissed`)

            if (
              !author ||
              // if review author is mentioned directly as an owner of changed files, dismiss their review
              (author.login && changedFilesOwners.includes(`@${author.login}`))
            ) {
              debug(
                `User ${author?.login} is owner of changed files and their review should be dismissed`,
              )
              reviewsToDismiss.push(review)

              return
            }

            // if the files are not owned by teams we can exit early, the user is already checked
            if (!changedFilesTeamOwners.length) {
              return
            }

            await Promise.all(
              changedFilesTeamOwners.map(async teamOwnership => {
                const teamHandle = teamOwnership.replace('@', '').split('/')

                // check if the user is member of the owner team
                try {
                  debug(
                    `Check membership of ${author.login} in ${teamOwnership} team`,
                  )

                  const {
                    data: { state },
                  } = await octokit.request(
                    'GET /orgs/{org}/teams/{team_slug}/memberships/{username}',
                    {
                      org: teamHandle[0],
                      team_slug: teamHandle[1],
                      username: author.login,
                      headers: {
                        'X-GitHub-Api-Version': '2022-11-28',
                      },
                    },
                  )

                  // if the user is active member of the owner team, dismiss user's review
                  if (state === 'active') {
                    debug(
                      `User ${author.login} is member of ${teamOwnership} team and their review will be dismissed`,
                    )
                    reviewsToDismiss.push(review)
                  }
                } catch (e) {
                  if (
                    e &&
                    typeof e === 'object' &&
                    'status' in e &&
                    e.status === 404
                  ) {
                    // do nothing, 404 means that the user is not a member
                    debug(
                      `User ${author.login} is not member of ${teamOwnership} team`,
                    )
                  } else {
                    throw e
                  }
                }
              }),
            )
          }),
        )
      },
    ),
  )

  return {
    reviewsToDismiss,
    reviewsWithoutHistory,
  }
}
