/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^koatty_cli/generation$': '<rootDir>/../koatty_cli/dist/api/generation.js',
    '^koatty_cli/project$': '<rootDir>/../koatty_cli/dist/api/project.js',
    '^koatty_cli$': '<rootDir>/../koatty_cli/dist/index.js',
    '^koatty_cli/(.*)$': '<rootDir>/../koatty_cli/dist/$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          target: 'ES2022',
          skipLibCheck: true,
          resolveJsonModule: true,
          baseUrl: '.',
          paths: {
            koatty_cli: ['../koatty_cli/dist/index.d.ts'],
            'koatty_cli/generation': ['../koatty_cli/dist/api/generation.d.ts'],
            'koatty_cli/project': ['../koatty_cli/dist/api/project.d.ts'],
            'koatty_cli/*': ['../koatty_cli/dist/*'],
          },
        },
      },
    ],
  },
  coverageDirectory: 'coverage',
};
