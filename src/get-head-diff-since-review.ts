import { normalize } from 'path'
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
  const headAndReviewDiff = (
    await git.diffSummary([`${reviewAssociatedSha}..${headSha}`])
  ).files.map(({ file }) => file)
  // this diff basically the same as the PR
  const mainAndSecondCommitDiff = (
    await git.diffSummary([`origin/${baseBranch}...${headSha}`])
  ).files.map(({ file }) => file)

  const intersectionFiles = headAndReviewDiff.filter(file =>
    mainAndSecondCommitDiff.includes(file),
  )

  const diffFiles: string[] = []

  // match file rename string e.g. `.github/workflows/{dismiss-reviews.yml => pull-request.yml}`
  const fileRenameRegex = /{(.*) => (.*)}/

  // find if files from intersectionFiles changed between head and review associated commit relatively to base branch
  await Promise.all(
    intersectionFiles.map(async file => {
      const fileRenameMatch = file.match(fileRenameRegex)

      if (fileRenameMatch) {
        const path1 = normalize(
          file.replace(fileRenameRegex, fileRenameMatch[1]),
        )
        const path2 = normalize(
          file.replace(fileRenameRegex, fileRenameMatch[2]),
        )
        // push original file name to diffFiles
        diffFiles.push(path1)
        // push new file name to diffFiles
        diffFiles.push(path2)

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
