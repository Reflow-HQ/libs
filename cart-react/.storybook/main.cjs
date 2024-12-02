const { dirname, join } = require("path");

module.exports = {
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.@(js|jsx|ts|tsx)"],

  addons: [
    getAbsolutePath("@storybook/addon-links"),
    getAbsolutePath("@storybook/addon-essentials"),
    getAbsolutePath("@storybook/addon-interactions"),
    getAbsolutePath("@storybook/addon-webpack5-compiler-babel"),
    getAbsolutePath("@chromatic-com/storybook"),
  ],

  framework: {
    name: getAbsolutePath("@storybook/nextjs"),
    options: {}
  },

  core: {
    disableTelemetry: true,
  },

  docs: {},

  typescript: {
    reactDocgen: "react-docgen-typescript"
  }
};

function getAbsolutePath(value) {
  return dirname(require.resolve(join(value, "package.json")));
}
