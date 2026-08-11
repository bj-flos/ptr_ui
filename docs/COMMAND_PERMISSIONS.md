# Who may command an observatory

Operational notes on the reservation and admin rules that gate real-time telescope and camera
commands, where each is enforced, and why the dev stack does not exercise any of it.

## The rule

**A reservation reserves the observatory against other people. It is not a ticket you must
hold in order to touch anything.**

| Situation | May command? |
|---|---|
| User has the `admin` role | yes, always |
| Calendar has no active reservation | **yes** |
| User created an active reservation | yes |
| Someone else holds an active reservation | no |

This is what the backend has always enforced. `photonranch-jobs/src/authorizer.py`:

> If there are no reservations at the current time on the calendar, any user can send
> commands. If one or more reservations exist, the user must be the creator of one of them
> in order to send commands.

## Where it is enforced

**Backend — the real gate.** `photonranch-jobs/src/handler.py` checks
`calendar_blocks_user_commands(user_id, site) and not user_is_admin` on `newJob`, returning
`401` with "Someone else has a reservation right now." Admin comes from
`event["requestContext"]["authorizer"]["userRoles"]`, populated by the API Gateway custom
authorizer.

Note that in `serverless.yml` only `newjob` has the authorizer attached; `updatejobstatus`,
`getnewjobs` and `getrecentjobs` have theirs commented out. Commands are the protected path.

**Frontend — a courtesy, not a control.** `userCanSendCommand()` in
`src/mixins/commands_mixin.js` mirrors the same rule, and every send path checks it:
`send_site_command`, the form-post sibling beside it, and `CommandButton.handleClick`. All
real-time controls, the slew buttons included, are `<command-button>`, so they all route
through that one check.

`commandBlockReason()` returns the reason rather than a bool, so `CommandButton` can disable
itself and explain via tooltip instead of failing on click. The button re-enables on its own
when the blocking reservation ends, since the reason is a computed over calendar state.

The click-time check stays regardless: a `disabled` attribute is a hint to the user, not a
guarantee, and the backend is what actually protects the hardware.

### A mismatch that used to exist

The UI previously required admin **or** an active reservation of your own — strictly narrower
than the backend. On a clear calendar the server would have accepted the command, but the UI
refused it and told the user to book time they did not need. The buttons also stayed fully
enabled, so the only way to discover this was to click and read a red toast. Both are fixed:
the rule now matches `authorizer.py`, and a blocked button is visibly disabled.

## Admin

`userIsAdmin` is derived in `src/store/modules/user_data.js` from the Auth0 claim
`https://photonranch.org/user_metadata`, `roles` containing `admin`. The claim is injected by
an Auth0 Action on the photonranch tenant — **other tenants will not have it**, so on a
different tenant every user is a non-admin with no roles.

Admin affects three separate things, which is worth keeping straight:

- **Commanding** — bypasses the reservation check entirely, front and back.
- **Admin-only buttons** — `CommandButton` with the `admin` prop renders only for admins
  (`isVisible`), and `CommandTabsWide` hides whole admin instrument tabs.
- **The `/adminonly` route** — guarded by `authGuard` with `meta: { requiresRole: 'admin' }`,
  which reads the roles claim directly rather than the store. The navbar link is hidden from
  non-admins; the guard is the thing that actually enforces it.

## Why the dev stack shows none of this

Do not read local behaviour as evidence about production. On the dev box:

- **The calendar is a stub.** `ptr-api-stub` serves calendar endpoints and returns no events,
  documented in `observatory-routes.js` as "deliberately inert: no jobs, no calendar entries".
  With zero active reservations, the rule above permits everyone, so nothing is ever blocked.
- **The jobs API is a local shim.** `VUE_APP_JOBS_API` points at a `tailscale serve` port
  proxying `local_service.py` wrapping `photonranch-jobs`. That is not API Gateway, so the
  custom authorizer never runs and `requestContext.authorizer.userRoles` is not populated the
  way deployed code expects.

To exercise the rule locally, set the state directly in the browser console rather than
waiting for a reservation to appear:

```js
const store = document.querySelector('#app').__vue__.$store
store.commit('user_data/userIsAdmin', false)
store.state.calendar.active_reservations = [{ creator_id: 'someone-else', end: '...' }]
```

Then confirm the command buttons are disabled and carry a tooltip. To check that nothing
escapes to the network, instrument the request before clicking:

```js
window.__spy = []
const open = XMLHttpRequest.prototype.open
XMLHttpRequest.prototype.open = function (m, u) { window.__spy.push(m + ' ' + u); return open.apply(this, arguments) }
```

A blocked click should leave `window.__spy` empty and log `Permission denied` from
`CommandButton`.

## If you change this

The two rules must move together. The UI being *stricter* than the backend produces silent
refusals of legitimate commands; the UI being *looser* produces buttons that fail with a
`401` after the user has already committed to the action. `authorizer.py` is the authority —
change it first, then bring `commandBlockReason()` into line.
