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
      - uses: balvajs/dismiss-stale-reviews@v1
```

## Inputs

| INPUT        | TYPE     | DEFAULT                 | DESCRIPTION                                                                                                                              |
| ------------ | -------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| token        | string   | `"${{ github.token }}"` | GitHub token with permissions to read organization. Default is github.token                                                              |
| ignore-files | string[] | `[]`                    | List of file patterns that should be ignored -> no review will be dismissed based on these files changes. The list is new line separated |

\* required
