import { retry } from 'radashi'

import type { Octokit } from '@octokit/core'

export interface ExpectedReview {
  login: string
  state: 'APPROVED' | 'DISMISSED'
}

/**
 * Poll the latest review state per reviewer until it matches the expectation
 * or the retry budget runs out — review state reads can lag behind the
 * dismiss mutation.
 */
export const assertReviewStates = async ({
  octokit,
  owner,
  repo,
  pullNumber,
  scenarioName,
  expected,
  attempts = 5,
  delayMs = 3000,
}: {
  octokit: Octokit
  owner: string
  repo: string
  pullNumber: number
  scenarioName: string
  expected: ExpectedReview[]
  attempts?: number
  delayMs?: number
}) => {
  await retry({ times: attempts, delay: delayMs }, async () => {
    const { data: reviews } = await octokit.request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
      { owner, repo, pull_number: pullNumber, per_page: 100 },
    )

    // the action's catch-all fallback dismisses every approval and exits 0,
    // so a DISMISSED state alone can't prove the intended code path ran —
    // every expected dismissal must have a timeline event whose message
    // isn't the fallback's. Fetched inside the retry because the events can
    // lag behind the review state.
    const { data: timelineEvents } = await octokit.request(
      'GET /repos/{owner}/{repo}/issues/{issue_number}/timeline',
      { owner, repo, issue_number: pullNumber, per_page: 100 },
    )

    const dismissalEvents = timelineEvents.flatMap(event =>
      'dismissed_review' in event ? [event.dismissed_review] : [],
    )

    const mismatches = expected.flatMap(({ login, state }) => {
      // reviews are chronological, the last one per author is the latest
      const latestReview = reviews.findLast(
        review => review.user?.login === login,
      )

      if (latestReview?.state !== state) {
        return [
          `expected review from ${login} to be ${state}, observed ${latestReview?.state ?? 'no review'}`,
        ]
      }

      if (state !== 'DISMISSED') {
        return []
      }

      const dismissalEvent = dismissalEvents.find(
        ({ review_id: reviewId }) => reviewId === latestReview.id,
      )

      if (!dismissalEvent) {
        return [`dismissal event for ${login} is not visible yet`]
      }

      return dismissalEvent.dismissal_message?.includes('Some error occurred')
        ? [
            `review from ${login} was dismissed by the action's error fallback, not by the expected code path`,
          ]
        : []
    })

    if (mismatches.length) {
      throw new Error(
        `Scenario "${scenarioName}" failed:\n${mismatches.join('\n')}`,
      )
    }
  })
}
