import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 120_000,
  roots: ['<rootDir>/tests'],
  maxWorkers: 4,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/app.ts',
    '!src/frameworks/http/swagger/**',
    '!src/frameworks/database/dynamoClient.ts',
    '!src/frameworks/tracing/start.ts',
  ],
  coverageReporters: ['text', 'lcov', 'clover'],
  coverageThreshold: {
    global: { lines: 80, branches: 80, functions: 80, statements: 80 },
  },
};

export default config;
