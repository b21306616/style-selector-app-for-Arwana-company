module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testMatch: ['<rootDir>/tests/**/*.test.[jt]s?(x)'],
  clearMocks: true,
  collectCoverageFrom: ['src/domain/**/*.ts', 'src/storage/**/*.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/artifacts/'],
};
