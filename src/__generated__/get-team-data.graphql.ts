/* eslint-disable */
/**
 * This file is generated, don’t edit it manually. Run `bun generate` to re-generate.
 */

/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never
    }
import * as Types from '../base-graphql-types.js'

export type GetTeamDataQueryVariables = Exact<{
  orgLogin: string
  teamSlug: string
  cursor: string | null | undefined
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
