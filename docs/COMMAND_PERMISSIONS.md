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

`userIsAdmin` is derived in `src/store/modules/user_data.js` from the `user_metadata` claim,
`roles` containing `admin`. The claim is injected by an Auth0 Action on the tenant.

### The claim namespace is per tenant

Auth0 requires custom claims to be namespaced URLs, and the namespace belongs to whichever
tenant issues them. `src/auth/claims.js` is the single place that knows it:

| Source | Example |
|---|---|
| `VUE_APP_AUTH0_CLAIM_NAMESPACE` env var | `https://mytenant.example/` |
| `claimNamespace` in `auth_config.json` | `https://photonranch.org/` |
| built-in default | `https://photonranch.org/` |

First one set wins; a trailing slash is optional. Read claims through `userRoles(user)`,
`userHasRole(user, role)` or `userMetadata(user)` rather than indexing the claim directly.

The namespace used to be hardcoded in six places. On a tenant with a different namespace the
claim was simply not found, so **every user silently looked role-less** — no error, no admin
anywhere, and nothing to indicate the cause. Four of those six sites were also byte-identical
copies of the same try/catch.

Note this is a **build-time** value: `VUE_APP_*` is baked in by vue-cli, so changing it needs
a rebuild or a dev-server restart, not just a page reload.

### Where roles actually come from

Established 2026-08-11 on the dev tenant `dev-1p08tcynxqqoyvzj`, by reading the tenant config
rather than inferring from the claim's name:

- **One** post-login Action, "Add photonranch user_metadata claim"
  (`5a17b2a9-8575-460c-8447-92a4fa426d22`)
- **No** Rules — `/api/v2/rules` returns `[]`
- Hooks deprecated to read-only

That Action is the whole pipeline. It resolves roles from `app_metadata.roles` and writes them
into a claim *named* `https://photonranch.org/user_metadata`. **The name is historical: roles
are not read from `user_metadata`, which is empty for every user.**

Two consequences worth being clear about:

- The **user-editable-metadata escalation risk does not apply on this tenant.** Nothing reads
  `user_metadata.roles`, so there is no writable path to `admin` through it. Moving the claim
  to `app_metadata` is naming hygiene, not a security fix. (An earlier version of this document
  claimed otherwise, reasoning from the claim's name rather than from the Action.)
- The Action's fallback was `['admin']` — see `auth0-action-roles.js`. With every user's
  `app_metadata` empty, **every login was issued admin**, and the tenant could not represent a
  non-admin user at all. That is what made "a non-admin still sees the Admins Only link" look
  like a UI bug when the UI was correct.

`app_metadata` is still the right home: it is write-protected, only the Management API can
change it, and a claim called `user_metadata` that is not user metadata misleads every reader.

**Migration complete as of 2026-08-11.** The claim is emitted as `app_metadata` only:

| Piece | State |
|---|---|
| Auth0 Action | emits `<namespace>app_metadata`; legacy claim removed |
| `src/auth/claims.js` | reads `app_metadata` only; fallback removed |
| `photonranch-jobs` `getUserRoles()` | reads both — fail-soft, deployed to `ptr-jobs` |

`getUserRoles` deliberately still accepts either claim. It costs nothing and leaves that service
able to run against a tenant that has not migrated.

**`claims.js` no longer does.** Point this build at a tenant whose Action emits only the legacy
claim — production photonranch, unless its Action is updated too — and every user resolves as
role-less. Restore the fallback rather than repointing.

The backend reader was the dangerous one, and why the ordering mattered:

```python
def getUserRoles(userInfo):
    userRoles = userInfo['https://photonranch.org/user_metadata']['roles']
```

An unguarded double index, and `auth()` turns any exception into `raise Exception('Unauthorized')`.
Move the claim without patching this and **every command is denied for everyone, admins
included** — it fails closed, loudly, for the whole system.

The order this was done in, and the order to repeat it in on any other tenant:

1. Patch every reader to accept either claim, and **deploy** them.
2. Set `roles` in `app_metadata` for the accounts that should have them (Management API).
3. Switch the Action to emit `app_metadata`, keeping the legacy claim.
4. Verify against a real non-admin account.
5. Drop the legacy claim from the Action and the fallback from `claims.js`.

Step 1 is the one that must not be skipped: until the fail-soft `getUserRoles` is deployed,
step 5 denies every command for every user.

Step 2 is easy to get wrong in a way that hides until step 3 — a `PATCH` that 400s, or one aimed
at the wrong `user_id`, leaves the account with no roles, and the old `['admin']` fallback masks
it. Check the response body rather than assuming.

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
