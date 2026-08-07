
module.exports = {
  lintOnSave: false,
  css: {
    loaderOptions: {
      sass: {
        // This produced 6mb(!!) of css!
        // data: `@import "@/style/buefy-styles.scss";`
      }
    }
  },
  devServer: {
    host: process.env.DEV_HOST || 'localhost',
    // Pinned so the origin always matches the URLs registered in Auth0.
    // vue-cli falls back to the next free port if this one is taken — check the
    // port it prints before logging in, or the callback will mismatch.
    port: Number(process.env.PORT) || 8080,
    // When the app is reached through a proxy (Tailscale, ngrok), the browser
    // sends that hostname in the Host header and webpack-dev-server rejects it
    // as an "Invalid Host header" unless it is allowed here. `public` also
    // points the HMR websocket at the external origin instead of localhost.
    ...(process.env.DEV_PUBLIC_HOST
      ? {
          public: process.env.DEV_PUBLIC_HOST,
          allowedHosts: [process.env.DEV_PUBLIC_HOST.replace(/:\d+$/, '')]
        }
      : {})
  },

  configureWebpack: {
    module: {
      rules: [
        {
          test: /\.(png|jpe?g|gif)$/i,
          use: [
            {
              loader: 'file-loader'
            }
          ]
        }
      ]
    }
  },

  chainWebpack: config => {
    config.module
      .rule('vue')
      .use('vue-loader')
      .tap(options => {
        options.compiler = require('vue-template-babel-compiler')
        return options
      })
  }
}
