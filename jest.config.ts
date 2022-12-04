import { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
  preset: 'ts-jest/presets/default-esm', // or other ESM presets
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/test/**/*.ts'],
  collectCoverageFrom: ['src/**'],
  projects: ['<rootDir>/packages/plainjs', '<rootDir>/packages/whatwg'],
};

export default jestConfig;