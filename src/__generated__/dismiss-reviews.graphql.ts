/* eslint-disable */
/**
 * This file is generated, don’t edit it manually. Run `yarn generate` to re-generate.
 */

import * as Types from '../base-graphql-types.js'

export type DismissReviewMutationVariables = Types.Exact<{
  message: Types.Scalars['String']['input']
  pullRequestReviewId: Types.Scalars['ID']['input']
}>

export type DismissReviewMutation = {
  readonly dismissPullRequestReview: {
    readonly clientMutationId: string | null
  } | null
}
