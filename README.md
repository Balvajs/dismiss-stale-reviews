## dismiss-stale-reviews

Description

## Usage

```yaml
name: 'dismiss-stale-reviews'
on:
  schedule:
    - cron: '0 0 * * 1'

jobs:
  dismiss-stale-reviews:
    runs-on: ubuntu-latest
    steps:
      - uses: balvajs/dismiss-stale-reviews@v1
```

## Inputs

| INPUT | TYPE | DEFAULT | DESCRIPTION |
| ----- | ---- | ------- | ----------- |
|       |      |         |             |

\* required
