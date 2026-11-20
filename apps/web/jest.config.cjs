const nextJest = require("next/jest");

module.exports = nextJest({ dir: "./" })({
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/test/**/*.test.tsx"],
  setupFilesAfterEnv: ["@testing-library/jest-dom"],
});
