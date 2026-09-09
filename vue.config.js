
module.exports = {
  lintOnSave: false,
  // Served behind the nina-scheduler nginx under /ptr/, which forwards the
  // prefix intact (proxy_pass has no path component). Assets, the router base
  // and the HMR socket all hang off this, so they resolve under /ptr/ instead
  // of at the parent host's root — where they would hit the NINA GUI.
  // Override with PUBLIC_PATH=/ to serve at the root again.
  publicPath: process.env.PUBLIC_PATH || '/ptr/',

  pwa: {
    workboxOptions: {
      /* config.js carries this deployment's endpoints and tenant, and it is the
       * one file that must NOT be precached. Workbox picks up everything in
       * public/, so it was being frozen into the app shell along with the
       * bundle: a deploy changed the file on the server while every existing
       * browser went on reading the version its service worker had cached.
       * That surfaced as a login attempting a host from two deploys earlier,
       * with no clue in the network tab because the request never left.
       *
       * Excluded here so it is always fetched from the network, which is what
       * the no-store headers on it already assume. */
      exclude: [/config\.js$/, /\.map$/],
      /* Take over as soon as the new worker installs. Without these a fresh
       * deploy sits behind the old shell until every tab is closed, and
       * "shift-reload to update" is not a thing a user should have to know. */
      skipWaiting: true,
      clientsClaim: true
    }
  },
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
