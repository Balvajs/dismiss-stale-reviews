import { getInput, getMultilineInput } from '@actions/core'

export const getInputs = () => {
  const ghToken = getInput('token', { required: true })
  const ignoreFiles = getMultilineInput('ignore-files')

  return {
    ghToken,
    ignoreFiles,
  }
}
