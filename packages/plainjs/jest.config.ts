import type { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: {
    '^.+\\.m?[t]sx?$': ['ts-jest', {
      isolatedModules: true,
      useESM: true
    }],
  },
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/test/*.ts', '<rootDir>/**/test/types/*.ts'],
  collectCoverageFrom: ['src/**'],
};

export = jestConfig;