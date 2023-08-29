## dismiss-stale-reviews

Action for dismissing stale code reviews based on CODEOWNERS.

GitHub has a branch protection rule that enables `dismissing all reviews when new commits are pushed`:
![GitHub branch protection rule for dismissing all reviews when new commits are pushed](/docs/github-default-dismiss-approvals.png)

However, in most cases, we want to treat reviews as stale only if the approver is the codeowner of files changed in the new commits.

This action checks all approvals upon every commit push and removes reviews only from codeowners of changed files.
![Stale reviews dismissed based on ownership](/docs/dismiss-reviews-based-on-ownership.png)

## Edge cases

There are some situations when it can’t be decided what should be dismissed. In those situations, the action defaults to GitHub’s default behavior - dismissing all reviews.

##### 1. Some of the changed files don’t have an owner

The behavior in this case can be changed by input `no-owner-action`, which accepts either `dismiss-all` or `dismiss-none`. The default is `dismiss-all`.

##### 2. The action isn’t able to find changes in the last commit because of a force push

The action is not able to work with force pushes. The behavior in this case can be changed by input `force-push-action`, which accepts either `dismiss-all` or `dismiss-none`. The default is `dismiss-all`.

## Usage

```yaml
name: 'dismiss-stale-reviews'
on:
  pull_request:

jobs:
  dismiss-stale-reviews:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          # the git history must be fetched until merge-base commit of pull-request
          fetch-depth: 0

      # in case you use team handles in your CODEOWNERS file, you need to get a GitHub App token with advanced permissions:
      # repository contents: read
      # repository pull requests: write
      # organization members: read
      #
      # for more info on how to create GitHub App check tibdex/github-app-token action
      - uses: tibdex/github-app-token@v1
        id: get-token
        with:
          app_id: ${{ secrets.MANAGE_REVIEWS_BOT_ID }}
          private_key: ${{ secrets.MANAGE_REVIEWS_BOT_PEM }}

      - uses: balvajs/dismiss-stale-reviews@v1
        with:
          token: ${{ steps.get-token.outputs.token }}
```

## Inputs

| INPUT             | TYPE     | DEFAULT                 | DESCRIPTION                                                                                                                              |
| ----------------- | -------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| token             | string   | `"${{ github.token }}"` | GitHub token with permissions to read organization. Default is github.token                                                              |
| ignore-files      | string[] | `[]`                    | List of file patterns that should be ignored -> no review will be dismissed based on these files changes. The list is new line separated |
| no-owner-action   | enum     | `"dismiss-all"`         | What should happen if some file doesn't have owner. Valid options are `"dismiss-all"` and `"dismiss-none"`.                              |
| force-push-action | enum     | `"dismiss-all"`         | What should happen if the git diff couldn't be resolved due to force push. Valid options are `"dismiss-all"` and `"dismiss-none"`.       |

\* required
