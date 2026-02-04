import type { Config } from 'jest'

const commonConfig: Config = {
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(svg|png|jpg|jpeg|gif|webp|avif)$': '<rootDir>/tests/__mocks__/fileMock.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/dist/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
}

const tsJestTransform: NonNullable<Config['transform']> = {
  '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
}

// Frontend needs jsx transform; tsconfig.test.json has "jsx": "react-jsx"
const tsJestTransformFrontend: NonNullable<Config['transform']> = {
  '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
}

const config: Config = {
  projects: [
    {
      displayName: 'backend',
      testEnvironment: 'node',
      testEnvironmentOptions: {
        customExportConditions: ['node', 'node-addons', 'default'],
      },
      testMatch: [
        '<rootDir>/tests/api/**/*.test.ts',
        '<rootDir>/tests/domain/**/*.test.ts',
        '<rootDir>/tests/middleware/**/*.test.ts',
        '<rootDir>/tests/schemas/**/*.test.ts',
        '<rootDir>/tests/services/**/*.test.ts',
        '<rootDir>/tests/utils/**/*.test.ts',
        '<rootDir>/tests/backend/**/*.test.ts',
        '<rootDir>/src/types/__tests__/**/*.test.ts',
      ],
      ...commonConfig,
      setupFiles: ['<rootDir>/tests/setup-env.ts'],
      moduleNameMapper: {
        '^@/backend/config/db$': '<rootDir>/tests/__mocks__/backend-db.ts',
        '^\\./config/db$': '<rootDir>/tests/__mocks__/backend-db.ts',
        '^(\\.\\./)+config/db$': '<rootDir>/tests/__mocks__/backend-db.ts',
        '^(\\.\\./)+src/backend/config/db$': '<rootDir>/tests/__mocks__/backend-db.ts',
        ...commonConfig.moduleNameMapper,
      },
      preset: 'ts-jest',
      transform: tsJestTransform,
    },
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: [
        '<rootDir>/tests/ui/**/*.test.tsx',
        '<rootDir>/tests/components/**/*.test.ts?(x)',
        '<rootDir>/tests/hooks/**/*.test.ts',
      ],
      ...commonConfig,
      moduleNameMapper: {
        '^react-hot-toast$': '<rootDir>/tests/__mocks__/react-hot-toast.ts',
        '^@/backend/config/db$': '<rootDir>/tests/__mocks__/backend-db.ts',
        ...commonConfig.moduleNameMapper,
      },
      preset: 'ts-jest',
      transform: tsJestTransformFrontend,
    },
  ],
}

export default config
