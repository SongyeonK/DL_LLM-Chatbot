const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,

  pluginOptions: {
    vuetify: {
			// https://github.com/vuetifyjs/vuetify-loader/tree/next/packages/vuetify-loader
		}
  },
  devServer: {
    port: 8080,
    allowedHosts: "all",
    // before(app) {
    //   app.use((req, res, next) => {
    //     res.setHeader('Access-Control-Allow-Origin', '*');
    //     res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    //     res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    //     next();
    //   });
    // },
    proxy: {
      '/api': {
        target: 'http://152.70.252.108:3000/api',
        changeOrigin: true,
        pathRewrite: {
          '^/api': ''
        }
      },
      '/public': {
        target: 'http://152.70.252.108:3000',
        changeOrigin: true,
        pathRewrite: {
          '^/public': ''
        }
      },
    },
  },
})
