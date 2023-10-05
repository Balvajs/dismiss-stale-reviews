import { debug } from '@actions/core'
import { groupReviewsByCommit } from './group-reviews-by-commit.ts'
import { getOctokit } from './get-octokit.ts'
import { getTeamData } from './get-team-data.ts'

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

  const teamMembers: Record<string, string[]> = {}

  for (const { filesChangedByHeadCommit, reviews } of Object.values(
    groupedReviewsByCommit,
  )) {
    // list of unique file owners
    const changedFilesOwners = [
      ...new Set(filesChangedByHeadCommit.map(({ owners }) => owners).flat()),
    ]

    const changedFilesTeamOwners = changedFilesOwners
      .filter(owner => owner.includes('/'))
      .map(teamOwnership => teamOwnership.replace('@', ''))

    // for loop is used to synchronously go through all commits and team data can be fetched first without overfetching
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      changedFilesTeamOwners
        // fetch team members only if they were not fetched yet
        .filter(team => !Object.keys(teamMembers).includes(team))
        .map(async team => {
          const teamHandle = team.split('/')
          teamMembers[team] = (
            await getTeamData({
              octokit,
              organizationLogin: teamHandle[0],
              teamSlug: teamHandle[1],
            })
          ).members
        }),
    )

    // for loop is used to synchronously go through all commits and team data can be fetched first without overfetching
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      reviews.map(async review => {
        const { author } = review
        let isDismissed = false

        console.log(
          `Considering review from ${author?.login} and file changes between ${review.commit?.abbreviatedOid} (reviewed commit) and ${headCommit} (head commit)`,
        )

        if (
          !author ||
          // if review author is mentioned directly as an owner of changed files, dismiss their review
          (author.login && changedFilesOwners.includes(`@${author.login}`))
        ) {
          const changedFilesOwnedByReviewAuthor = filesChangedByHeadCommit
            .filter(
              ({ owners }) =>
                !!owners.find(owner => owner === `@${author?.login}`),
            )
            .map(({ filename }) => filename)

          console.log(
            `Changed files owned by ${author?.login}:\n`,
            changedFilesOwnedByReviewAuthor.join(', '),
          )

          reviewsToDismiss.push(review)
          isDismissed = true

          return
        }

        // if the files are not owned by teams we can exit early, the user is already checked
        if (!changedFilesTeamOwners.length) {
          console.log(
            `Review author ${author?.login} doesn't own any of changed files, nor is member of any team owning changed files.\n`,
            `The review from ${author?.login} won't be dismissed.\n`,
          )

          return
        }

        for (const teamOwnership of changedFilesTeamOwners) {
          if (teamMembers[teamOwnership]?.includes(author.login)) {
            const changedFilesOwnedByAuthorsTeam = filesChangedByHeadCommit
              .filter(
                ({ owners }) =>
                  !!owners.find(owner => owner === `@${teamOwnership}`),
              )
              .map(({ filename }) => filename)

            console.log(
              `Review author ${author?.login} is member of ${teamOwnership} team, which owns following changed files:\n`,
              changedFilesOwnedByAuthorsTeam.join(', '),
            )

            reviewsToDismiss.push(review)
            isDismissed = true
          } else {
            debug(`User ${author.login} is not member of ${teamOwnership} team`)
          }
        }

        if (isDismissed) {
          console.log(`The review from ${author?.login} will be dismissed.\n`)
        } else {
          console.log(
            `Review author ${author?.login} doesn't own any of changed files, nor is member of any team owning changed files.\n`,
            `The review from ${author?.login} won't be dismissed.\n`,
          )
        }
      }),
    )
  }

  return {
    reviewsToDismiss,
    reviewsWithoutHistory,
  }
}
