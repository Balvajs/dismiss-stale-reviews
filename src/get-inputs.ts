import { getInput, getMultilineInput } from '@actions/core'

function isValidDismissActionInput(
  dismissAction: string,
): dismissAction is 'dismissAction' | 'dismiss-none' {
  return dismissAction === 'dismiss-all' || dismissAction === 'dismiss-none'
}

export const getInputs = () => {
  const ghToken = getInput('token', { required: true })
  const ignoreFiles = getMultilineInput('ignore-files')
  const noOwnerAction = getInput('no-owner-action', { required: true })
  const forcePushAction = getInput('force-push-action', { required: true })

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
