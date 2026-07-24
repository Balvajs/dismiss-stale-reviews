# E2E tests

The `e2e` job in [`test.yml`](../.github/workflows/test.yml) runs the built
action (`dist/main.cjs`) against real, ephemeral pull requests in the sandbox
repository [`balvajs-actions/dismiss-stale-reviews-e2e`](https://github.com/balvajs-actions/dismiss-stale-reviews-e2e)
and asserts the resulting review states (`DISMISSED` / still `APPROVED`)
through the GitHub API.

## How a scenario runs

For every scenario in [`e2e/scenarios.ts`](../e2e/scenarios.ts) the harness
([`e2e/run-e2e.ts`](../e2e/run-e2e.ts)):

1. Creates a base branch `e2e/<run_id>/<scenario>/base` in the fixture repo
   with a scenario-specific `.github/CODEOWNERS` and initial files.
2. Creates a head branch from it, commits the pull request change, and opens
   a PR (authored by the GitHub App).
3. Approves the PR as the configured reviewer(s).
4. Pushes a follow-up commit (or force-pushes, for the force-push scenario).
5. Clones the fixture repo with full history into a temp dir, checks out the
   head branch, writes a synthetic `event.json`, and spawns
   `node dist/main.cjs` with the same env-var contract the actions runner
   uses (`GITHUB_EVENT_PATH`, `INPUT_TOKEN`, `INPUT_IGNORE-FILES`,
   `INPUT_NO-OWNER-ACTION`, `INPUT_FORCE-PUSH-ACTION`).
6. Polls the review states via the API (bounded retries) and compares them
   with the expected per-reviewer state.
7. Cleans up: closes the PR and deletes both branches, even on failure. An
   `always()` workflow step additionally removes leftovers of cancelled runs.

Branch names include the workflow `run_id`, so concurrent CI runs never
interfere with each other. Fork PRs skip the job (no secrets access).

## Covered scenarios

| Scenario                           | Expectation                                                         |
| ---------------------------------- | ------------------------------------------------------------------- |
| direct-owner-dismissed             | approval from a direct codeowner is dismissed                       |
| team-owner-dismissed               | approval from a member of an owning org team is dismissed           |
| non-owner-kept                     | approval from a non-owner stays                                     |
| ignore-files-kept                  | changes matching `ignore-files` don't dismiss                       |
| force-push-dismissed               | approval on a force-pushed-away commit is dismissed                 |
| force-push-dismiss-none-kept       | same force push, `force-push-action: dismiss-none` keeps it         |
| no-owner-dismissed                 | a change to a file without owner dismisses all approvals            |
| no-owner-dismiss-none-kept         | same change, `no-owner-action: dismiss-none` keeps it               |
| multi-review-same-commit-dismissed | two approvals on one commit are both dismissed (ff232b2 regression) |

## Identities

| Identity                    | Role                                                   |
| --------------------------- | ------------------------------------------------------ |
| GitHub App `manage-reviews` | authors fixture PRs, runs the action, performs cleanup |
| Repo owner PAT              | reviewer #1, member of the `balvajs-actions/e2e` team  |
| Machine user PAT            | reviewer #2 for the multi-review scenario              |

The approver must differ from the PR author (GitHub rule), and the
team-ownership scenario needs a real user in an org team — that's why three
identities and the `balvajs-actions` org exist. Reviewer logins are
discovered at runtime from the PATs (`GET /user`), so they need no
configuration.

## One-time org setup

- Public fixture repo `balvajs-actions/dismiss-stale-reviews-e2e` (README-only `main`).
  Rulesets/branch protection must apply to the default branch only — a
  ruleset targeting all branches blocks the harness (it pushes and
  force-pushes `e2e/**` branches directly).
- Org team `e2e` with the owner account as member.
- Machine user account (reviewer #2); no org membership needed.
- GitHub App installed on the fixture repo with permissions: Repository
  Contents read **and write**, Pull requests read/write, Organization
  Members read. After changing app permissions, approve the update under the
  org's installation settings.
- Both reviewers: fine-grained PATs with **resource owner
  `balvajs-actions`**, scoped to the fixture repo, Pull requests read/write.
  The org must **approve the PAT request** (org settings → Personal access
  tokens) before the token works — an unapproved token fails with "Resource
  not accessible by personal access token".

### Action repo configuration

| Name                  | Kind     | Value                                             |
| --------------------- | -------- | ------------------------------------------------- |
| `E2E_APP_CLIENT_ID`   | variable | client ID of the GitHub App                       |
| `E2E_APP_PRIVATE_KEY` | secret   | private key of the GitHub App                     |
| `E2E_REVIEWER_PAT`    | secret   | owner fine-grained PAT (team member, reviewer #1) |
| `E2E_REVIEWER2_PAT`   | secret   | machine user fine-grained PAT (reviewer #2)       |

## Running locally

```sh
bun run package
E2E_APP_TOKEN=<app installation token> \
E2E_REVIEWER_PAT=<owner PAT> \
E2E_REVIEWER2_PAT=<machine user PAT> \
bun e2e/run-e2e.ts
```

Optional overrides: `E2E_FIXTURE_REPOSITORY` (default
`balvajs-actions/dismiss-stale-reviews-e2e`) and `E2E_TEAM_SLUG` (default
`e2e`). Without `GITHUB_RUN_ID` the fixtures are named `local-<timestamp>`.
