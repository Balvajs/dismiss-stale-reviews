import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { omit } from 'radashi'

const distPath = fileURLToPath(new URL('../dist/main.cjs', import.meta.url))

export interface ActionInputs {
  ignoreFiles?: string[]
  noOwnerAction?: 'dismiss-all' | 'dismiss-none'
  forcePushAction?: 'dismiss-all' | 'dismiss-none'
}

const execute = (
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
) =>
  new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', exitCode => resolve(exitCode ?? 1))
  })

/**
 * Run the built action the same way the actions runner does: `node
 * dist/main.cjs` with the input/event contract passed via environment
 * variables, with cwd set to a fresh full clone of the fixture repository.
 */
export const runAction = async ({
  token,
  owner,
  repo,
  headBranch,
  pullRequestNodeId,
  baseRef,
  inputs,
}: {
  token: string
  owner: string
  repo: string
  headBranch: string
  pullRequestNodeId: string
  baseRef: string
  inputs: ActionInputs
}) => {
  const workdir = await mkdtemp(join(tmpdir(), 'dismiss-stale-reviews-e2e-'))
  const cloneDir = join(workdir, 'fixture')
  const eventPath = join(workdir, 'event.json')

  try {
    const cloneUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`
    const cloneExitCode = await execute('git', [
      'clone',
      '--quiet',
      cloneUrl,
      cloneDir,
    ])
    if (cloneExitCode !== 0) {
      throw new Error(
        `Cloning the fixture repository failed (${cloneExitCode})`,
      )
    }

    const checkoutExitCode = await execute(
      'git',
      ['checkout', '--quiet', headBranch],
      { cwd: cloneDir },
    )
    if (checkoutExitCode !== 0) {
      throw new Error(`Checkout of ${headBranch} failed (${checkoutExitCode})`)
    }

    await writeFile(
      eventPath,
      JSON.stringify({
        pull_request: { node_id: pullRequestNodeId, base: { ref: baseRef } },
      }),
    )

    const env = {
      // createActionAuth in the action prefers GITHUB_TOKEN over INPUT_TOKEN
      ...omit(process.env, ['GITHUB_TOKEN']),
      GITHUB_ACTION: 'dismiss-stale-reviews-e2e',
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: eventPath,
      INPUT_TOKEN: token,
      // action.yml defaults don't apply when invoking directly, set every input
      'INPUT_IGNORE-FILES': inputs.ignoreFiles?.join('\n') ?? '',
      'INPUT_NO-OWNER-ACTION': inputs.noOwnerAction ?? 'dismiss-all',
      'INPUT_FORCE-PUSH-ACTION': inputs.forcePushAction ?? 'dismiss-all',
    }

    const exitCode = await execute('node', [distPath], { cwd: cloneDir, env })

    if (exitCode !== 0) {
      throw new Error(`The action exited with code ${exitCode}`)
    }
  } finally {
    // the clone stores the installation token in .git/config, don't leave it
    // on disk
    await rm(workdir, { recursive: true, force: true })
  }
}
