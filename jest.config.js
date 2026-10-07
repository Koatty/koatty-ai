/** Tests resolve the installed public API, just like the published consumer. */
module.exports = {
  preset: 'ts-jest', testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/test'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'commonjs', moduleResolution: 'node', target: 'ES2022', esModuleInterop: true, skipLibCheck: true } }] },
  coverageDirectory: 'coverage',
};
