import path from 'node:path'

import type { CodegenConfig } from '@graphql-codegen/cli'
import { schema } from '@octokit/graphql-schema'

const config: CodegenConfig = {
  schema: schema.idl,
  documents: 'src/**/*.ts',
  importExtension: '.js',
  generates: {
    '/': {
      preset: 'near-operation-file',
      presetConfig: {
        baseTypesPath: path.join(process.cwd(), 'src', 'base-graphql-types.ts'),
        extension: '.graphql.ts',
        folder: '__generated__',
      },
      plugins: [
        {
          add: {
            content: `/* eslint-disable */
               /**
               * This file is generated, don’t edit it manually. Run \`bun generate\` to re-generate.
               */
             `,
          },
        },
        {
          'typescript-operations': {
            enumsAsTypes: true,
            immutableTypes: true,
            avoidOptionals: true,
            skipTypename: true,
            scalars: {
              DateTime: 'string',
              GitObjectID: 'string',
            },
          },
        },
      ],
      hooks: {
        afterOneFileWrite: 'oxfmt --write -c oxfmt.config.ts',
      },
    },
  },
}

export default config
