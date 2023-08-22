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
  const { organization } = await octokit.graphql.paginate<GetTeamDataQuery>(
    getPullRequestQuery,
    {
      orgLogin: organizationLogin,
      teamSlug,
    } as GetTeamDataQueryVariables,
  )

  if (!organization) {
    throw new Error(`Organization ${organization} could not be found!`)
  }

  if (!organization.team) {
    throw new Error(
      `Team ${organization.team} could not be found in ${organization} organization!`,
    )
  }

  if (!organization.team.members.nodes) {
    throw new Error(
      `Cannot read members of ${organization.team} team in ${organization} organization!`,
    )
  }

  return {
    members: organization.team.members.nodes
      .filter(isPresent)
      .map(({ login }) => login),
  }
}
