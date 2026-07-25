import { debug } from './debug.ts'
import type { getOctokit } from './get-octokit.ts'
import { getTeamData } from './get-team-data.ts'
import { groupReviewsByCommit } from './group-reviews-by-commit.ts'

export interface Review {
  author: {
    login: string
  } | null
  commit: {
    oid: string
  } | null
}

/**
 * Find the first team owning changed files that the review author belongs to.
 * One owning team is enough — checking the rest would push the same review
 * again.
 */
const findAuthorsOwningTeam = (
  teams: string[],
  teamMembers: Record<string, string[]>,
  authorLogin: string,
) =>
  teams.find(team => {
    if (teamMembers[team]?.includes(authorLogin)) {
      return true
    }

    debug(`User ${authorLogin} is not member of ${team} team`)

    return false
  })

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
      Object.values(groupedReviewsByCommit).flatMap(
        ({ filesChangedByHeadCommit }) =>
          filesChangedByHeadCommit
            .filter(({ owners }) => owners.length === 0)
            .map(({ filename }) => filename),
      ),
    ),
  ]

  // if there are some files without owner, we are not able to assign a review to those files
  // and because of that we need to dismiss all reviews
  if (filesWithoutOwner.length > 0) {
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
      ...new Set(filesChangedByHeadCommit.flatMap(({ owners }) => owners)),
    ]

    const changedFilesTeamOwners = changedFilesOwners
      .filter(owner => owner.includes('/'))
      .map(teamOwnership => teamOwnership.replace('@', ''))

    // for loop is used to synchronously go through all commits and team data can be fetched first without overfetching
    await Promise.all(
      changedFilesTeamOwners
        // fetch team members only if they were not fetched yet
        .filter(team => !Object.keys(teamMembers).includes(team))
        .map(async team => {
          const teamHandle = team.split('/')
          const teamData = await getTeamData({
            octokit,
            organizationLogin: teamHandle[0],
            teamSlug: teamHandle[1],
          })
          teamMembers[team] = teamData.members
        }),
    )

    // loop is used to synchronously go through all commits and team data can be fetched first without overfetching
    for (const review of reviews) {
      const { author } = review
      let isDismissed = false

      console.log(
        `Considering review from ${author?.login} and file changes between ${review.commit?.oid} (reviewed commit) and ${headCommit} (head commit)`,
      )

      // in case there is no diff because head and review commit matches, skip that review
      if (review.commit?.oid === headCommit) {
        console.log(
          'The review commit sha is the same as head commit sha. That means that there were no changes since the review, or the base branch was merged/rebased cleanly.',
        )
      } else if (
        !author ||
        // if review author is mentioned directly as an owner of changed files, dismiss their review
        (author.login && changedFilesOwners.includes(`@${author.login}`))
      ) {
        const changedFilesOwnedByReviewAuthor = filesChangedByHeadCommit
          .filter(({ owners }) => owners.includes(`@${author?.login}`))
          .map(({ filename }) => filename)

        console.log(
          `Changed files owned by ${author?.login}:\n${changedFilesOwnedByReviewAuthor.join(
            '\n',
          )}`,
        )

        reviewsToDismiss.push(review)
        isDismissed = true
      } else {
        const owningTeam = findAuthorsOwningTeam(
          changedFilesTeamOwners,
          teamMembers,
          author.login,
        )

        if (owningTeam !== undefined) {
          const changedFilesOwnedByAuthorsTeam = filesChangedByHeadCommit
            .filter(({ owners }) => owners.includes(`@${owningTeam}`))
            .map(({ filename }) => filename)

          console.log(
            `Review author ${author.login} is member of ${owningTeam} team, which owns following changed files:\n${changedFilesOwnedByAuthorsTeam.join(
              '\n',
            )}`,
          )

          reviewsToDismiss.push(review)
          isDismissed = true
        }
      }

      if (isDismissed) {
        console.log(`The review from ${author?.login} will be dismissed.\n`)
      } else {
        console.log(
          `Review author ${author?.login} doesn't own any of changed files, nor is member of any team owning changed files.\nThe review from ${author?.login} won't be dismissed.\n`,
        )
      }
    }
  }

  return {
    reviewsToDismiss,
    reviewsWithoutHistory,
  }
}
