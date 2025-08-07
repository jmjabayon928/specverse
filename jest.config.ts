// jest.config.ts
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    // ✅ Handle TypeScript path aliases (e.g., "@/components/Button")
    "^@/(.*)$": "<rootDir>/src/$1",

    // ✅ Mock static assets
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "\\.(svg|png|jpg|jpeg|gif|webp|avif)$": "<rootDir>/__mocks__/fileMock.ts"
  },
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest"
  },
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/dist/"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json"
    }
  }
};

export default config;