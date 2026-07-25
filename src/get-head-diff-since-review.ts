import { normalize } from 'node:path'

import { simpleGit } from 'simple-git'

/**
 * Calculate what files changed since the review was given
 */
export const getHeadDiffSinceReview = async ({
  headSha,
  reviewAssociatedSha,
  baseBranch,
}: {
  headSha: string
  reviewAssociatedSha: string
  baseBranch: string
}) => {
  const git = simpleGit()

  // this diff contains all changes between head and review associated commit, including changes in merge commits
  const headAndReviewSummary = await git.diffSummary([
    `${reviewAssociatedSha}..${headSha}`,
  ])
  const headAndReviewDiff = headAndReviewSummary.files.map(({ file }) => file)
  // this diff basically the same as the PR
  const mainAndSecondCommitSummary = await git.diffSummary([
    `origin/${baseBranch}...${headSha}`,
  ])
  const mainAndSecondCommitDiff = new Set(
    mainAndSecondCommitSummary.files.map(({ file }) => file),
  )

  const intersectionFiles = headAndReviewDiff.filter(file =>
    mainAndSecondCommitDiff.has(file),
  )

  const diffFiles: string[] = []

  // match file rename string e.g. `.github/workflows/{dismiss-reviews.yml => pull-request.yml}`
  const fileRenameRegex = /\{(?<from>.*) => (?<to>.*)\}/u

  // find if files from intersectionFiles changed between head and review associated commit relatively to base branch
  await Promise.all(
    intersectionFiles.map(async file => {
      const fileRenameMatch = fileRenameRegex.exec(file)

      if (fileRenameMatch?.groups) {
        const { from, to } = fileRenameMatch.groups
        const path1 = normalize(file.replace(fileRenameRegex, from))
        const path2 = normalize(file.replace(fileRenameRegex, to))
        // push the original and the new file name to diffFiles
        diffFiles.push(path1, path2)

        console.debug('Filename change:', path1, path2)

        // in case the file was renamed exit early
        return
      }

      const firstFileDiff = await git.diff([
        `origin/${baseBranch}...${reviewAssociatedSha}`,
        file,
      ])
      const secondFileDiff = await git.diff([
        `origin/${baseBranch}...${headSha}`,
        file,
      ])

      // if changed lines don't match, push the file to the diff
      if (
        firstFileDiff
          .split('\n')
          // filter only lines with change
          .filter(line => line.startsWith('+') || line.startsWith('-'))
          .join('\n') !==
        secondFileDiff
          .split('\n')
          .filter(line => line.startsWith('+') || line.startsWith('-'))
          .join('\n')
      ) {
        diffFiles.push(file)
      }
    }),
  )

  return diffFiles
}
