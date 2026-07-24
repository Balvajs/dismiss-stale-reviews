import type { ActionInputs } from './run-action.ts'
import type { FileMap } from './fixtures.ts'

type ReviewerRole = 'reviewer1' | 'reviewer2'

export interface Scenario {
  name: string
  codeowners: string
  /** Files committed to the head branch before any approval */
  pullRequestFiles: FileMap
  /** reviewer1 is a member of the e2e team, reviewer2 is not */
  approvals: ReviewerRole[]
  /** Commit pushed after the approvals; `forcePush` rewrites the head tip */
  followUp: { files: FileMap; forcePush?: boolean }
  inputs: ActionInputs
  expected: { reviewer: ReviewerRole; state: 'APPROVED' | 'DISMISSED' }[]
}

export const getScenarios = ({
  reviewer1Login,
  reviewer2Login,
  teamHandle,
}: {
  reviewer1Login: string
  reviewer2Login: string
  teamHandle: string
}): Scenario[] => [
  {
    name: 'direct-owner-dismissed',
    codeowners: `* @${reviewer1Login}\n`,
    pullRequestFiles: { 'owned.txt': 'update 1\n' },
    approvals: ['reviewer1'],
    followUp: { files: { 'owned.txt': 'update 2\n' } },
    inputs: {},
    expected: [{ reviewer: 'reviewer1', state: 'DISMISSED' }],
  },
  {
    name: 'team-owner-dismissed',
    codeowners: `* ${teamHandle}\n`,
    pullRequestFiles: { 'owned.txt': 'update 1\n' },
    approvals: ['reviewer1'],
    followUp: { files: { 'owned.txt': 'update 2\n' } },
    inputs: {},
    expected: [{ reviewer: 'reviewer1', state: 'DISMISSED' }],
  },
  {
    name: 'non-owner-kept',
    codeowners: `* @${reviewer2Login}\n`,
    pullRequestFiles: { 'owned.txt': 'update 1\n' },
    approvals: ['reviewer1'],
    followUp: { files: { 'owned.txt': 'update 2\n' } },
    inputs: {},
    expected: [{ reviewer: 'reviewer1', state: 'APPROVED' }],
  },
  {
    name: 'ignore-files-kept',
    codeowners: `* @${reviewer1Login}\n`,
    pullRequestFiles: { 'generated.txt': 'update 1\n' },
    approvals: ['reviewer1'],
    followUp: { files: { 'generated.txt': 'update 2\n' } },
    inputs: { ignoreFiles: ['generated.txt'] },
    expected: [{ reviewer: 'reviewer1', state: 'APPROVED' }],
  },
  {
    // owner is reviewer2 so the dismissal can only come from the force-push
    // handling, not from ownership
    name: 'force-push-dismissed',
    codeowners: `* @${reviewer2Login}\n`,
    pullRequestFiles: { 'owned.txt': 'update 1\n' },
    approvals: ['reviewer1'],
    followUp: { files: { 'owned.txt': 'rewritten\n' }, forcePush: true },
    inputs: {},
    expected: [{ reviewer: 'reviewer1', state: 'DISMISSED' }],
  },
  {
    // same setup as force-push-dismissed, with the opt-out input
    name: 'force-push-dismiss-none-kept',
    codeowners: `* @${reviewer2Login}\n`,
    pullRequestFiles: { 'owned.txt': 'update 1\n' },
    approvals: ['reviewer1'],
    followUp: { files: { 'owned.txt': 'rewritten\n' }, forcePush: true },
    inputs: { forcePushAction: 'dismiss-none' },
    expected: [{ reviewer: 'reviewer1', state: 'APPROVED' }],
  },
  {
    // approver doesn't own anything, only the no-owner handling can dismiss
    name: 'no-owner-dismissed',
    codeowners: `owned.txt @${reviewer2Login}\n`,
    pullRequestFiles: { 'owned.txt': 'update 1\n' },
    approvals: ['reviewer1'],
    followUp: { files: { 'unowned.txt': 'added\n' } },
    inputs: {},
    expected: [{ reviewer: 'reviewer1', state: 'DISMISSED' }],
  },
  {
    // same setup as no-owner-dismissed, with the opt-out input
    name: 'no-owner-dismiss-none-kept',
    codeowners: `owned.txt @${reviewer2Login}\n`,
    pullRequestFiles: { 'owned.txt': 'update 1\n' },
    approvals: ['reviewer1'],
    followUp: { files: { 'unowned.txt': 'added\n' } },
    inputs: { noOwnerAction: 'dismiss-none' },
    expected: [{ reviewer: 'reviewer1', state: 'APPROVED' }],
  },
  {
    // regression for ff232b2 — two approvals bound to the same commit must
    // both be evaluated
    name: 'multi-review-same-commit-dismissed',
    codeowners: `* @${reviewer1Login} @${reviewer2Login}\n`,
    pullRequestFiles: { 'shared.txt': 'update 1\n' },
    approvals: ['reviewer1', 'reviewer2'],
    followUp: { files: { 'shared.txt': 'update 2\n' } },
    inputs: {},
    expected: [
      { reviewer: 'reviewer1', state: 'DISMISSED' },
      { reviewer: 'reviewer2', state: 'DISMISSED' },
    ],
  },
]
