module.exports = {
  apps: [
    {
      name: "ai-teams-api",
      script: "dist/index.js",
      cwd: "./backend-node",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
        PORT: 17070,
      },
    },
    {
      name: "ai-teams-web",
      script: "node_modules/.bin/next",
      args: "dev --port 3340",
      cwd: "./frontend",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "development",
        PORT: 3340,
      },
    },
  ],
};
