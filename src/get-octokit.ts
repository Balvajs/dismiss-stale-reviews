import { Octokit } from '@octokit/action'
import { paginateGraphQL } from '@octokit/plugin-paginate-graphql'

export const getOctokit = ({ ghToken }: { ghToken: string }) => {
  const OctokitWithPlugins = Octokit.plugin(paginateGraphQL)
  return new OctokitWithPlugins({ auth: ghToken })
}
