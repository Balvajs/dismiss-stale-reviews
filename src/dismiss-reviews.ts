import type { getOctokit } from './get-octokit.ts'

import type {
  DismissReviewMutation,
  DismissReviewMutationVariables,
} from './__generated__/dismiss-reviews.graphql.ts'

const requestReviewsMutation = /* GraphQL */ `
  mutation dismissReview($message: String!, $pullRequestReviewId: ID!) {
    dismissPullRequestReview(
      input: { message: $message, pullRequestReviewId: $pullRequestReviewId }
    ) {
      clientMutationId
    }
  }
`

export const dismissReviews = async ({
  octokit,
  message,
  reviewsToDismiss,
}: {
  octokit: ReturnType<typeof getOctokit>
  message: string
  reviewsToDismiss: { id: string; author: { login: string } | null }[]
}) =>
  Promise.all(
    reviewsToDismiss.map(async ({ id: pullRequestReviewId, author }) => {
      try {
        octokit.graphql<DismissReviewMutation>(requestReviewsMutation, {
          message,
          pullRequestReviewId,
        } as DismissReviewMutationVariables)
      } catch {
        console.error(`Failed to dismiss review from ${author?.login}.`)
      }
    }),
  )
