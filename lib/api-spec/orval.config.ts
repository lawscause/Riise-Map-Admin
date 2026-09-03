/**
 * @type {import('orval').Options}
 */
module.exports = {
  "api-client-react": {
    input: "./openapi.yaml",
    output: {
      baseUrl: "/api",
      target: "../api-client-react/src/generated/api.ts",
      client: "react-query",
      mode: "single",
      prettier: true,
      clean: true,
      override: {
        fetch: {
          // Keep fetchers returning the response body directly (e.g. `Learner[]`),
          // matching the shape every consumer destructures today.
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: "../api-client-react/src/custom-fetch.ts",
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    input: "./openapi.yaml",
    output: {
      target: "../api-zod/src/generated/zod.ts",
      client: "zod",
      mode: "single",
      prettier: true,
      clean: true,
    },
  },
};
