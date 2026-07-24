import { mapValues, tryit } from 'radashi'

import { getConfig } from './config.ts'
import {
  approvePullRequest,
  closePullRequest,
  createBranch,
  createCommit,
  deleteBranch,
  getBranchSha,
  openPullRequest,
  waitForApprovals,
  waitForHeadCommit,
} from './fixtures.ts'
import { runAction } from './run-action.ts'
import { assertReviewStates } from './assert-reviews.ts'
import { getScenarios } from './scenarios.ts'

import type { E2eConfig } from './config.ts'
import type { Scenario } from './scenarios.ts'

const runScenario = async (config: E2eConfig, scenario: Scenario) => {
  const { appOctokit: octokit, fixtureOwner: owner, fixtureRepo: repo } = config
  const target = { octokit, owner, repo }

  const baseBranch = `e2e/${config.runId}/${scenario.name}/base`
  const headBranch = `e2e/${config.runId}/${scenario.name}/head`

  // registered as each resource gets created, so a failure mid-setup still
  // cleans up everything created so far
  const cleanups: (() => Promise<void>)[] = []

  try {
    const mainSha = await getBranchSha({ ...target, branch: 'main' })
    await createBranch({ ...target, branch: baseBranch, fromSha: mainSha })
    cleanups.push(() => deleteBranch({ ...target, branch: baseBranch }))

    const initialFiles = mapValues(scenario.pullRequestFiles, () => 'initial\n')
    const baseSha = await createCommit({
      ...target,
      branch: baseBranch,
      files: { '.github/CODEOWNERS': scenario.codeowners, ...initialFiles },
      message: `e2e: ${scenario.name} base`,
    })

    await createBranch({ ...target, branch: headBranch, fromSha: baseSha })
    cleanups.push(() => deleteBranch({ ...target, branch: headBranch }))

    const reviewedSha = await createCommit({
      ...target,
      branch: headBranch,
      files: scenario.pullRequestFiles,
      message: `e2e: ${scenario.name} pull request change`,
    })

    const pullRequest = await openPullRequest({
      ...target,
      head: headBranch,
      base: baseBranch,
      title: `e2e: ${scenario.name} (run ${config.runId})`,
    })
    cleanups.push(() =>
      closePullRequest({ ...target, pullNumber: pullRequest.number }),
    )

    for (const reviewer of scenario.approvals) {
      await approvePullRequest({
        ...target,
        octokit: config[reviewer].octokit,
        pullNumber: pullRequest.number,
      })
    }

    await waitForApprovals({
      octokit,
      pullRequestNodeId: pullRequest.nodeId,
      expectedLogins: scenario.approvals.map(
        reviewer => config[reviewer].login,
      ),
      expectedCommitSha: reviewedSha,
    })

    const followUpSha = await createCommit({
      ...target,
      branch: headBranch,
      files: scenario.followUp.files,
      message: `e2e: ${scenario.name} follow-up`,
      ...(scenario.followUp.forcePush
        ? { parentSha: baseSha, force: true }
        : {}),
    })

    await waitForHeadCommit({
      octokit,
      pullRequestNodeId: pullRequest.nodeId,
      expectedSha: followUpSha,
    })

    await runAction({
      token: config.appToken,
      owner,
      repo,
      headBranch,
      pullRequestNodeId: pullRequest.nodeId,
      baseRef: pullRequest.baseRef,
      inputs: scenario.inputs,
    })

    await assertReviewStates({
      ...target,
      pullNumber: pullRequest.number,
      scenarioName: scenario.name,
      expected: scenario.expected.map(({ reviewer, state }) => ({
        login: config[reviewer].login,
        state,
      })),
    })
  } finally {
    // reverse order: close the pull request before deleting its branches
    for (const cleanup of cleanups.toReversed()) {
      const [error] = await tryit(cleanup)()
      if (error) {
        console.error(`Cleanup of ${scenario.name} failed:`, error)
      }
    }
  }
}

const run = async () => {
  const config = await getConfig()
  const scenarios = getScenarios({
    reviewer1Login: config.reviewer1.login,
    reviewer2Login: config.reviewer2.login,
    teamHandle: config.teamHandle,
  })

  const failures: string[] = []

  for (const scenario of scenarios) {
    console.log(`\n=== Scenario: ${scenario.name} ===`)

    try {
      await runScenario(config, scenario)
      console.log(`✔ ${scenario.name}`)
    } catch (error) {
      console.error(`✘ ${scenario.name}`)
      console.error(error)
      failures.push(scenario.name)
    }
  }

  if (failures.length) {
    console.error(`\nFailed scenarios: ${failures.join(', ')}`)
    process.exit(1)
  }

  console.log(`\nAll ${scenarios.length} scenarios passed`)
}

await run()
