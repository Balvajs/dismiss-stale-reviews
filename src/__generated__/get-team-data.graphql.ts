/* eslint-disable */
/**
 * This file is generated, don’t edit it manually. Run `bun generate` to re-generate.
 */

import * as Types from '../base-graphql-types.js'

export type GetTeamDataQueryVariables = Types.Exact<{
  orgLogin: Types.Scalars['String']['input']
  teamSlug: Types.Scalars['String']['input']
  cursor: Types.InputMaybe<Types.Scalars['String']['input']>
}>

export type GetTeamDataQuery = {
  readonly organization: {
    readonly team: {
      readonly members: {
        readonly nodes: ReadonlyArray<{ readonly login: string } | null> | null
        readonly pageInfo: {
          readonly hasNextPage: boolean
          readonly endCursor: string | null
        }
      }
    } | null
  } | null
}
