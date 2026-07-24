// some dependencies (@actions/*, @octokit/*, ...) are ESM-only and have no "require"
// entrypoint, so retry failed resolutions with the "import" condition
module.exports = (path, options) => {
  try {
    return options.defaultResolver(path, options)
  }
  catch {
    return options.defaultResolver(path, {
      ...options,
      conditions: ['import', 'node', 'default'],
    })
  }
}
