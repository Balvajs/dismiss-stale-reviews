import { getConfig } from './config.ts'
import { closePullRequest, deleteBranch } from './fixtures.ts'

// Safety net for cancelled runs — the scenario executor cleans up after
// itself, but a cancelled job never reaches its `finally` blocks.
const run = async () => {
  const {
    appOctokit: octokit,
    fixtureOwner: owner,
    fixtureRepo: repo,
    cleanupBranchPrefix: branchPrefix,
  } = await getConfig()
  const target = { octokit, owner, repo }

  const { data: openPullRequests } = await octokit.request(
    'GET /repos/{owner}/{repo}/pulls',
    { owner, repo, state: 'open', per_page: 100 },
  )

  for (const pullRequest of openPullRequests) {
    if (pullRequest.head.ref.startsWith(branchPrefix)) {
      console.log(`Closing leftover pull request #${pullRequest.number}`)
      await closePullRequest({ ...target, pullNumber: pullRequest.number })
    }
  }

  const { data: refs } = await octokit.request(
    'GET /repos/{owner}/{repo}/git/matching-refs/{ref}',
    { owner, repo, ref: `heads/${branchPrefix}` },
  )

  for (const ref of refs) {
    const branch = ref.ref.replace('refs/heads/', '')
    console.log(`Deleting leftover branch ${branch}`)
    await deleteBranch({ ...target, branch })
  }
}

await run()
