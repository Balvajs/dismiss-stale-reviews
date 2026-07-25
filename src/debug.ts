/**
 * Log a message the runner only shows when the `ACTIONS_STEP_DEBUG` secret is
 * set. The workflow command syntax requires the payload to be escaped, or a
 * multiline message would terminate the command on its first newline.
 *
 * @see https://docs.github.com/actions/reference/workflow-commands-for-github-actions#setting-a-debug-message
 */
export const debug = (message: string) => {
  console.log(
    `::debug::${message
      .replaceAll('%', '%25')
      .replaceAll('\r', '%0D')
      .replaceAll('\n', '%0A')}`,
  )
}
