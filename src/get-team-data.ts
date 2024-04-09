import { isPresent } from './type-guards.ts'
import { getOctokit } from './get-octokit.ts'

import type {
  GetTeamDataQuery,
  GetTeamDataQueryVariables,
} from './__generated__/get-team-data.graphql.ts'

const getPullRequestQuery = /* GraphQL */ `
  query getTeamData($orgLogin: String!, $teamSlug: String!, $cursor: String) {
    organization(login: $orgLogin) {
      team(slug: $teamSlug) {
        members(first: 100, after: $cursor) {
          nodes {
            login
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`

export const getTeamData = async ({
  octokit,
  organizationLogin,
  teamSlug,
}: {
  octokit: ReturnType<typeof getOctokit>
  organizationLogin: string
  teamSlug: string
}) => {
  const { organization } = await octokit.graphql
    .paginate<GetTeamDataQuery>(getPullRequestQuery, {
      orgLogin: organizationLogin,
      teamSlug,
    } as GetTeamDataQueryVariables)
    .catch(e => {
      console.error(
        'Something went wrong during fetching team members data. Make sure that the github token has read access to organization members.',
      )
      throw e
    })

  if (!organization) {
    throw new Error(`Organization ${organization} could not be found!`)
  }

  if (!organization.team) {
    throw new Error(
      `Team ${teamSlug} could not be found in ${organizationLogin} organization!`,
    )
  }

  if (!organization.team.members.nodes) {
    throw new Error(
      `Cannot read members of ${teamSlug} team in ${organizationLogin} organization!`,
    )
  }

  return {
    members: organization.team.members.nodes
      .filter(isPresent)
      .map(({ login }) => login),
  }
}
