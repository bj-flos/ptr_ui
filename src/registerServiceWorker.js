/* eslint-disable no-console */

import { register } from 'register-service-worker'
import { SnackbarProgrammatic as Snackbar } from 'buefy'

if (process.env.NODE_ENV === 'production') {
  register(`${process.env.BASE_URL}service-worker.js`, {
    ready () {
      console.log(
        'App is being served from cache by a service worker.\n' +
        'For more details, visit https://goo.gl/AFskqB'
      )
    },
    registered () {
      console.log('Service worker has been registered.')
    },
    cached () {
      console.log('Content has been cached for offline use.')
    },
    /* Nothing is shown here any more. This fires when the new worker starts
       downloading, which is not yet something the reader can act on, and the
       old message told them to shift-reload -- a thing most people do not know
       how to do, for a build that had not finished arriving. */
    updatefound () {
      console.log('New content is downloading.')
    },

    /* The new build is now installed and, because the worker takes over
       immediately (skipWaiting and clientsClaim), it is what the next full page
       load will serve. Until that load the reader is still looking at the old
       one -- which is why a stale navbar survives until something reloads the
       document, and logging out is the one ordinary action that does: logout
       ends in window.location.assign.

       So: drop the old precache, then offer the reload rather than taking it.
       Reloading unasked would throw away whatever they had typed, and the
       application form is a page and a half of it. */
    updated () {
      console.log('New content is available.')
      caches.keys()
        .then(names => Promise.all(names.map(name => caches.delete(name))))
        .catch(() => {}) // A cache we cannot clear is not worth stopping over.
        .then(() => {
          Snackbar.open({
            indefinite: true,
            message: 'A new version of Photon Ranch is ready.',
            actionText: 'Reload',
            onAction: () => window.location.reload(),
            type: 'is-success',
            position: 'is-bottom-right',
            queue: false
          })
        })
    },
    offline () {
      console.log('No internet connection found. App is running in offline mode.')
    },
    error (error) {
      console.error('Error during service worker registration:', error)
    }
  })
}
