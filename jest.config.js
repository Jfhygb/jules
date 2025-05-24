/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', // For backend testing
  // If testing React components (which we are not heavily focusing on here, but good to have):
  // testEnvironment: 'jest-environment-jsdom', 
  moduleNameMapper: {
    // Handle module aliases (if you have them in tsconfig.json)
    // Example: '^@/components/(.*)$': '<rootDir>/components/$1',
    // Next.js specific mock for `next/router` or other Next.js features if needed for frontend tests
    // '^next/router$': '<rootDir>/__mocks__/next/router.js', 
  },
  setupFilesAfterEnv: [
    // '<rootDir>/setupTests.ts' // If using @testing-library/jest-dom extensions
  ],
  transform: {
    // Use ts-jest for .ts and .tsx files
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json', // Or your specific tsconfig file for tests
    }],
  },
  // Optionally, specify test file patterns
  // testMatch: [
  //   '**/__tests__/**/*.+(ts|tsx|js)',
  //   '**/?(*.)+(spec|test).+(ts|tsx|js)'
  // ],
  // Coverage reporting (optional)
  // collectCoverage: true,
  // coverageDirectory: 'coverage',
  // coverageReporters: ['json', 'lcov', 'text', 'clover'],
};
