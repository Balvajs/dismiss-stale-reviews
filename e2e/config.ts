import { Octokit } from '@octokit/core'

const requireEnv = (name: string) => {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable ${name}`)
  }

  return value
}

export interface Reviewer {
  octokit: Octokit
  login: string
}

const createReviewer = async (token: string): Promise<Reviewer> => {
  const octokit = new Octokit({ auth: token })
  const { data } = await octokit.request('GET /user')

  return { octokit, login: data.login }
}

export const getConfig = async () => {
  const appToken = requireEnv('E2E_APP_TOKEN')
  const [fixtureOwner, fixtureRepo] = (
    process.env.E2E_FIXTURE_REPOSITORY ??
    'balvajs-actions/dismiss-stale-reviews-e2e'
  ).split('/')
  const teamSlug = process.env.E2E_TEAM_SLUG ?? 'e2e'
  const baseRunId = process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`
  // include the attempt so reruns don't collide with leftovers of a
  // previous attempt of the same run
  const runId = `${baseRunId}-${process.env.GITHUB_RUN_ATTEMPT ?? '1'}`

  const [reviewer1, reviewer2] = await Promise.all([
    // reviewer1 must be a member of the e2e team, reviewer2 must not
    createReviewer(requireEnv('E2E_REVIEWER_PAT')),
    createReviewer(requireEnv('E2E_REVIEWER2_PAT')),
  ])

  return {
    appToken,
    appOctokit: new Octokit({ auth: appToken }),
    reviewer1,
    reviewer2,
    fixtureOwner,
    fixtureRepo,
    teamHandle: `@${fixtureOwner}/${teamSlug}`,
    runId,
    // covers every attempt of the run — cleanup must sweep leftovers of
    // previous attempts, not just the current one
    cleanupBranchPrefix: `e2e/${baseRunId}-`,
  }
}

export type E2eConfig = Awaited<ReturnType<typeof getConfig>>
