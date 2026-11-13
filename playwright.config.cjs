const { defineConfig } = require("@playwright/test");
module.exports = defineConfig({
  testDir: "./e2e",
  testMatch: "*.spec.cjs",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 20000 },
  use: { baseURL: "http://127.0.0.1:4179", acceptDownloads: true,
    screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --port 4179",
    url: "http://127.0.0.1:4179/",
    reuseExistingServer: false,
    timeout: 90000,
  },
});
