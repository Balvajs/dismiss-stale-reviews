import { retry } from 'radashi'

import type { Octokit } from '@octokit/core'

export type FileMap = Record<string, string>

interface RepositoryTarget {
  octokit: Octokit
  owner: string
  repo: string
}

export const getBranchSha = async ({
  octokit,
  owner,
  repo,
  branch,
}: RepositoryTarget & { branch: string }) => {
  const { data } = await octokit.request(
    'GET /repos/{owner}/{repo}/git/ref/{ref}',
    { owner, repo, ref: `heads/${branch}` },
  )

  return data.object.sha
}

export const createBranch = async ({
  octokit,
  owner,
  repo,
  branch,
  fromSha,
}: RepositoryTarget & { branch: string; fromSha: string }) => {
  await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha: fromSha,
  })
}

/**
 * Create a commit with the given files on top of `parentSha` (defaults to the
 * branch tip) and point the branch to it. With `force` the branch is
 * force-updated, which makes the previous tip unreachable — used to simulate
 * a force push.
 */
export const createCommit = async ({
  octokit,
  owner,
  repo,
  branch,
  files,
  message,
  parentSha,
  force = false,
}: RepositoryTarget & {
  branch: string
  files: FileMap
  message: string
  parentSha?: string
  force?: boolean
}) => {
  const resolvedParentSha =
    parentSha ?? (await getBranchSha({ octokit, owner, repo, branch }))

  const { data: parentCommit } = await octokit.request(
    'GET /repos/{owner}/{repo}/git/commits/{commit_sha}',
    { owner, repo, commit_sha: resolvedParentSha },
  )

  const { data: tree } = await octokit.request(
    'POST /repos/{owner}/{repo}/git/trees',
    {
      owner,
      repo,
      base_tree: parentCommit.tree.sha,
      tree: Object.entries(files).map(([path, content]) => ({
        path,
        mode: '100644' as const,
        type: 'blob' as const,
        content,
      })),
    },
  )

  const { data: commit } = await octokit.request(
    'POST /repos/{owner}/{repo}/git/commits',
    { owner, repo, message, tree: tree.sha, parents: [resolvedParentSha] },
  )

  await octokit.request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.sha,
    force,
  })

  return commit.sha
}

export const openPullRequest = async ({
  octokit,
  owner,
  repo,
  head,
  base,
  title,
}: RepositoryTarget & { head: string; base: string; title: string }) => {
  const { data } = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
    owner,
    repo,
    head,
    base,
    title,
  })

  return { number: data.number, nodeId: data.node_id, baseRef: data.base.ref }
}

export const approvePullRequest = async ({
  octokit,
  owner,
  repo,
  pullNumber,
  commitId,
}: RepositoryTarget & { pullNumber: number; commitId?: string }) => {
  await octokit.request(
    'POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
    {
      owner,
      repo,
      pull_number: pullNumber,
      event: 'APPROVE',
      ...(commitId ? { commit_id: commitId } : {}),
    },
  )
}

/**
 * Wait until the pull request's last commit — read through the same GraphQL
 * field the action uses — matches the pushed sha. The commits connection
 * lags behind ref updates, and running the action before it catches up makes
 * it evaluate the pre-push head.
 */
export const waitForHeadCommit = async ({
  octokit,
  pullRequestNodeId,
  expectedSha,
  attempts = 10,
  delayMs = 2000,
}: {
  octokit: Octokit
  pullRequestNodeId: string
  expectedSha: string
  attempts?: number
  delayMs?: number
}) => {
  await retry({ times: attempts, delay: delayMs }, async () => {
    const { node } = await octokit.graphql<{
      node: { commits: { nodes: { commit: { oid: string } }[] } }
    }>(
      /* GraphQL */ `
        query headCommit($nodeId: ID!) {
          node(id: $nodeId) {
            ... on PullRequest {
              commits(last: 1) {
                nodes {
                  commit {
                    oid
                  }
                }
              }
            }
          }
        }
      `,
      { nodeId: pullRequestNodeId },
    )

    if (node.commits.nodes[0]?.commit.oid !== expectedSha) {
      throw new Error(
        `Pull request head didn't reach ${expectedSha} within the retry budget`,
      )
    }
  })
}

/**
 * Wait until all expected approvals are visible — bound to `expectedCommitSha`
 * — in the same GraphQL field the action reads. REST-created reviews can lag
 * behind in the GraphQL view, and running the action before they land makes it
 * see no or partial approvals. The `commit` field lags separately, and the
 * action skips reviews without it (`commit && state === 'APPROVED'`), so
 * waiting on the state alone isn't enough.
 */
export const waitForApprovals = async ({
  octokit,
  pullRequestNodeId,
  expectedLogins,
  expectedCommitSha,
  attempts = 10,
  delayMs = 2000,
}: {
  octokit: Octokit
  pullRequestNodeId: string
  expectedLogins: string[]
  expectedCommitSha: string
  attempts?: number
  delayMs?: number
}) => {
  await retry({ times: attempts, delay: delayMs }, async () => {
    const { node } = await octokit.graphql<{
      node: {
        latestOpinionatedReviews: {
          nodes: {
            state: string
            commit: { oid: string } | null
            author: { login: string } | null
          }[]
        }
      }
    }>(
      /* GraphQL */ `
        query approvals($nodeId: ID!) {
          node(id: $nodeId) {
            ... on PullRequest {
              latestOpinionatedReviews(first: 100) {
                nodes {
                  state
                  commit {
                    oid
                  }
                  author {
                    login
                  }
                }
              }
            }
          }
        }
      `,
      { nodeId: pullRequestNodeId },
    )

    const approvedLogins = new Set(
      node.latestOpinionatedReviews.nodes
        .filter(
          ({ state, commit }) =>
            state === 'APPROVED' && commit?.oid === expectedCommitSha,
        )
        .map(({ author }) => author?.login),
    )

    const missingLogins = expectedLogins.filter(
      login => !approvedLogins.has(login),
    )

    if (missingLogins.length) {
      throw new Error(
        `Approvals from ${missingLogins.join(', ')} at ${expectedCommitSha} didn't reach the GraphQL view within the retry budget`,
      )
    }
  })
}

export const closePullRequest = async ({
  octokit,
  owner,
  repo,
  pullNumber,
}: RepositoryTarget & { pullNumber: number }) => {
  await octokit.request('PATCH /repos/{owner}/{repo}/pulls/{pull_number}', {
    owner,
    repo,
    pull_number: pullNumber,
    state: 'closed',
  })
}

export const deleteBranch = async ({
  octokit,
  owner,
  repo,
  branch,
}: RepositoryTarget & { branch: string }) => {
  await octokit.request('DELETE /repos/{owner}/{repo}/git/refs/{ref}', {
    owner,
    repo,
    ref: `heads/${branch}`,
  })
}
