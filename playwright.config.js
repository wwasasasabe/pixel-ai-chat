export default {
  testDir: "./tests",
  use: {
    baseURL: "http://localhost:8788"
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8788",
    reuseExistingServer: false,
    timeout: 60000
  }
};

