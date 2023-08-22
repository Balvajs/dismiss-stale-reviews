import { isPresent } from './type-guards.ts'
import { getOctokit } from './get-octokit.ts'

import type {
  GetGithubDataQuery,
  GetGithubDataQueryVariables,
} from './__generated__/get-github-data.graphql.ts'

const getPullRequestQuery = /* GraphQL */ `
  query getGithubData($nodeId: ID!) {
    node(id: $nodeId) {
      __typename
      ... on PullRequest {
        commits(last: 1) {
          nodes {
            commit {
              oid
              abbreviatedOid
              committedDate
            }
          }
        }
        latestOpinionatedReviews(first: 100) {
          nodes {
            id
            state
            commit {
              abbreviatedOid
            }
            author {
              __typename
              login
              ... on User {
                id
              }
            }
            publishedAt
          }
        }
      }
    }
  }
`

export const getGithubData = async ({
  octokit,
  pullRequestId,
}: {
  octokit: ReturnType<typeof getOctokit>
  pullRequestId: string
}) => {
  const { node: pullRequest } = await octokit.graphql<GetGithubDataQuery>(
    getPullRequestQuery,
    {
      nodeId: pullRequestId,
    } as GetGithubDataQueryVariables,
  )

  if (!pullRequest || pullRequest.__typename !== 'PullRequest') {
    throw new Error('The pull request could not be found!')
  }

  if (!pullRequest.commits.nodes) {
    throw new Error('Pull request commits are missing!')
  }

  return {
    commits: pullRequest.commits.nodes.filter(isPresent),
    latestReviews:
      pullRequest.latestOpinionatedReviews?.nodes?.filter(isPresent) || [],
  }
}
