/**
 * The runner passes every input of `action.yml` as an `INPUT_<NAME>`
 * environment variable, uppercased and with spaces replaced by underscores.
 *
 * @see https://docs.github.com/actions/reference/workflows-and-actions/metadata-syntax#inputs
 */
const getInput = (name: string) =>
  (process.env[`INPUT_${name.replaceAll(' ', '_').toUpperCase()}`] ?? '').trim()

const getRequiredInput = (name: string) => {
  const value = getInput(name)

  if (!value) {
    throw new Error(`Input required and not supplied: ${name}`)
  }

  return value
}

function isValidDismissActionInput(
  dismissAction: string,
): dismissAction is 'dismiss-all' | 'dismiss-none' {
  return dismissAction === 'dismiss-all' || dismissAction === 'dismiss-none'
}

export const getInputs = () => {
  const ghToken = getRequiredInput('token')
  // the list of file patterns is new line separated
  const ignoreFiles = getInput('ignore-files')
    .split('\n')
    .map(pattern => pattern.trim())
    .filter(pattern => pattern !== '')
  const noOwnerAction = getRequiredInput('no-owner-action')
  const forcePushAction = getRequiredInput('force-push-action')

  if (!isValidDismissActionInput(noOwnerAction)) {
    throw new Error(
      `The no-owner-action input accepts only "dismiss-all" or "dismiss-none" enum. Got "${noOwnerAction}"`,
    )
  }

  if (!isValidDismissActionInput(forcePushAction)) {
    throw new Error(
      `The force-push-action input accepts only "dismiss-all" or "dismiss-none" enum. Got "${forcePushAction}"`,
    )
  }

  return {
    ghToken,
    ignoreFiles,
    noOwnerAction,
    forcePushAction,
  }
}
