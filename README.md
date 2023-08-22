## dismiss-stale-reviews

Description

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

| INPUT        | TYPE     | DEFAULT                 | DESCRIPTION                                                                                                                              |
| ------------ | -------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| token        | string   | `"${{ github.token }}"` | GitHub token with permissions to read organization. Default is github.token                                                              |
| ignore-files | string[] | `[]`                    | List of file patterns that should be ignored -> no review will be dismissed based on these files changes. The list is new line separated |

\* required
