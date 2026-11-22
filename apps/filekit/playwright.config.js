import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests-browser",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [{
    name: "chromium",
    use: { ...devices["Desktop Chrome"] },
  }],
  webServer: {
    // CI builds dist/ before this test starts. Validate the artifact that
    // users receive, not Vite's development module/worker pipeline.
    command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
