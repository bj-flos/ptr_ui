# How a site announces itself, and what a site code may be

## The announcement is the config PUT

There is no separate hello, heartbeat or registration message. An observatory and a WEMA each
publish their own config document once at startup, and that is what makes them exist as far as the
rest of the system is concerned.

| | Called from | Endpoint | Payload |
|---|---|---|---|
| OBS | `obs.py:646` → `update_config()` (`obs.py:885`) | `PUT {obs_id}/config/` | the observatory config |
| WEMA | `wema.py:642` → `update_config()` (`wema.py:1109`) | `PUT {wema_name}/config/` | the WEMA config |

Both run inside `__init__`, before the status loop starts, and both go through
`authenticated_request` — unlike status posts, this is an authenticated write. `/all/config` is
simply everything that has been PUT, which is how the UI discovers sites: one that never PUTs never
appears.

Two details worth knowing:

- **The OBS enriches its config on the way out** (`obs.py:892`): it injects the computed `events`
  block and each camera's real `camera_size_x` / `camera_size_y`, read off the hardware. The
  published config is therefore the file on disk *plus* what was discovered at startup — which is
  where the sensor dimensions behind `camera_size_degrees` come from.
- **`update_config` retries forever**, sleeping 5s between attempts. An observatory that cannot
  reach the API blocks there rather than starting up unannounced.

Each side then reads the other's announcement: the OBS fetches its WEMA's config
(`get_wema_config`, `obs.py:871`), and the WEMA fetches the config of every observatory it hosts
(`wema_events.py:77`, iterating `config['obsp_ids']`) to work out the night's earliest dark
exposure and evening flat offset.

## Site codes are not validated

`photonranch-api/api/site_configs.py` takes the code straight from the URL into a DynamoDB
partition key:

```python
# TODO: add config file key-values validation
def put_config(event, context):
    site = event['pathParameters']['site']
    config_table.put_item(Item={"site": site, "configuration": body})
```

No length check, no character check, nothing rejecting a malformed or duplicate code. The
observatory side does not check either: `obs.py` PUTs `config['obs_id']` verbatim and `wema.py`
PUTs `config['wema_name']`.

So the only limits are the ones the consumers impose, and they are not enforced anywhere:

| Consumer | Practical limit | What happens if exceeded |
|---|---|---|
| **Map marker** | ~4–5 chars | text overflows the pin and overlaps neighbours |
| Route `/site/:sitecode/…` | URL-safe chars | anything needing escaping breaks navigation |
| Popup, site menu, switcher | very long | the element just grows |
| DynamoDB partition key | 2048 bytes | unreachable in practice |

The marker is the binding one. `mapHelpers.js` draws the code as SVG text in a fixed 23x32 pin at
`font-size: 6` Verdana, centred, with **no truncation or wrapping**. It carries `lenghtAdjust1` and
`textLength1` — misspelled attributes the renderer ignores — so someone intended to clamp the width
and it silently does nothing. Markers are drawn per WEMA, so it is the **WEMA** code that must stay
short; `MRC-17` at six characters would already spill, which is why observatory codes never appear
there.

## Recommendation: validate in put_config

That `TODO` is the right place, since it is the single choke point every site passes through at
startup. Worth rejecting:

- **Length** — a cap around 8 characters, or 4 if the site is a WEMA, matching what the pin can draw.
- **Character set** — `[A-Za-z0-9-]` only, so the code stays safe in `/site/:sitecode/` without
  escaping. Hyphens are fine and already in use (`MRC-17`).
- **Case collisions** — `MRC` and `mrc` are currently distinct keys. `/mrc/enclosure` returns `{}`
  while `/MRC/enclosure` returns real data, which is a confusing failure to debug.
- **Empty or whitespace-only** codes.

Failing the PUT is better than accepting a code the UI cannot render: the observatory retries
forever on error, so a bad code would surface immediately at startup rather than as a broken pin
weeks later.

Note `photonranch-api` is LCO's repository. Any change follows the same route as the others here —
a local branch and a push to the `bj-flos` fork, never to `origin`.

## There is a required-field contract, and only the UI enforces it

`put_config` will store any JSON. The UI then quietly refuses to display a site that does not
carry what it needs — `all_sites` in `src/store/modules/site_config.js`:

```js
if (isNaN(latitude))    throw new Error('Latitude is missing or invalid.', site)
if (isNaN(longitude))   throw new Error('Longitude is missing or invalid.', site)
if (!TZ_database_name)  throw new Error('TZ_database_name is missing.', site)
...
sites = sites.filter(site => allSiteNames.has(site.wema_name))
```

So a site is only usable if it has **latitude**, **longitude**, **`TZ_database_name`**, and a
**`wema_name` that resolves to another registered site**. Every failure is swallowed by
`catch { console.error(...) }`, so a site that fails any of them does not appear anywhere in the
UI and says so only in the browser console.

That is the wrong end to discover it. The observatory retries `update_config` forever on a failed
PUT, so rejecting an incomplete config at the API would surface the problem at startup, in the
site's own logs, instead of as an absence someone eventually notices.

### A worked example: the Asterism sites

`WEMA` and `OBS-17` belong to no PTR container, env file or compose project. They are **Asterism
sites reporting into PTR** — a real external integration, not leftovers — which is what makes them
the best argument in this document.

**They now register correctly and display.** Both carry coordinates, `America/Chicago`, and
`wema_name: "WEMA"`; `WEMA` draws on the map and both appear in the site list. What follows is the
state they were in earlier on 2026-08-11, kept because the failure is the point.

| | `WEMA` then | `OBS-17` then | both now |
|---|---|---|---|
| latitude / longitude | 45.07 / -93.11 | **null** | 45.07 / -93.11 |
| `TZ_database_name` | **null** | **null** | `America/Chicago` |
| `wema_name` | `WEMA` | **null** | `WEMA` |
| in `/allopenstatus` | yes | no | `WEMA` only |
| shown in the UI | **no** | **no** | yes |

`WEMA` had coordinates but no timezone, so it threw and was dropped — despite actively publishing
status. `OBS-17` was dropped twice over: it failed the coordinate and timezone checks, and its
`wema_name` was null, so it could not be linked to `WEMA` even if the rest were supplied.

So a partner system was registering successfully and, in `WEMA`'s case, posting status
successfully — and none of it reached the UI. The integration looked healthy from the Asterism end
and did not exist from this one, with the only diagnostic a `console.error` in a browser nobody had
open. It was corrected at the source, which is the right place; nothing in PTR reported it, which is
the problem.

This is the strongest case for validating at `put_config`. It is not about rejecting junk: it is
that **an external integrator has no way to learn what PTR requires**. A PUT that returned 400
naming the missing fields would have told them at first contact, and `update_config`-style retry
loops would keep surfacing it until fixed. Instead the write succeeds, the site is stored, and
nothing works.

Do not "fix" these two by patching the stored documents. The configs come from Asterism, so a
patch here is overwritten on its next PUT; the fields have to be corrected at the source, or PTR
has to accept a site described the way Asterism describes it.

## Registration is not just unvalidated, it is unauthenticated

Worse than the missing format check: **`putConfig` and `deleteConfig` have no authorizer at all.**
From `photonranch-api/serverless.yml`:

```yaml
  putConfig:
    handler: api/site_configs.put_config
    events:
      - http:
          path: /{site}/config
          method: put
          cors: true          # <- no authorizer
```

The service *has* an `authorizerFunc` and uses it — on `dummy-requires-auth`, `createNightLogNote`
and `deleteNightLogNote` — so this is an omission on the config routes, not an absent capability.
The observatory calls `authenticated_request` when it PUTs, but nothing on the server side requires
that token.

Consequences today: anyone who can reach the endpoint can **create a site under any code**,
**overwrite an existing site's config**, or **delete one**. A site config carries device
definitions, coordinates and camera parameters, so overwriting one is enough to disrupt a real
observatory.

So "sites are whatever has PUT a config" is not merely untidy — there is no approval step at all,
and any code that shows up becomes a site the UI lists.

## Proposed: formal registration, licensed at the WEMA

Registration should be an explicit, approved act rather than a side effect of a process booting.
The shape to aim for:

**The WEMA holds the licence.** A WEMA is the natural unit: it owns the roof, the weather and the
physical site, and it already fetches the config of every observatory it hosts
(`config['obsp_ids']`). An observatory should not carry its own licence — it should be admitted by
the WEMA that vouches for it. That also matches how the map already thinks: one marker per WEMA,
observatories inheriting its roof.

**Two licence durations**, following the model in the scheduler's
`docs/DISTRIBUTION_TECHNICAL.md`:

| | Purpose | Shape |
|---|---|---|
| Temporary | trial, commissioning, a site being brought up | short expiry, renewed on request |
| Long duration | a licensed, approved site | long expiry, still finite |

That existing model is worth reusing rather than reinventing: licence keys signed with RSA-256,
validated locally against the signature and `expires_at`, with an online revalidation required
periodically so a revoked licence stops working without waiting for expiry. It also binds to a
hardware fingerprint, which is worth considering for a WEMA since it is tied to a physical site.

**What this changes at the API.** `put_config` becomes the enforcement point:

1. Require the authorizer on `putConfig` and `deleteConfig` — the single biggest gap, and worth
   doing on its own even before licensing exists.
2. Reject a config missing the fields the UI requires — `latitude`, `longitude`,
   `TZ_database_name`, and a `wema_name` resolving to a registered site — with a 400 that names
   what is missing, so an incomplete site fails loudly at first contact instead of vanishing from
   the UI. See the required-field contract above; the Asterism sites are what happens without it.
   This matters most for external integrators, who have no other way to discover the contract.
3. Reject a config whose site code is not registered, rather than creating it implicitly.
4. For a WEMA, require a valid, unexpired licence.
5. For an observatory, require that its `wema_name` resolves to a licensed WEMA and that the
   WEMA lists it in `obsp_ids` — so an observatory cannot attach itself to a site that has not
   claimed it.
6. Keep the format checks above, since a registered code still has to be renderable and URL-safe.

Because `update_config` retries forever on failure, a site failing any of these surfaces
immediately at startup rather than silently appearing in the UI — which is the behaviour you want
from a registration check.

**Open question.** This section is written against the licence model in the scheduler repo's
`DISTRIBUTION_TECHNICAL.md`, which is the closest precedent found in these repositories. No
"Asterism License API" exists under that name anywhere I can see — not in `nina-scheduler-server`,
not in `~/PhotonRanch`, where the only matches are GPL metadata. If that API lives elsewhere, its
actual endpoints and token shape should replace the sketch above rather than this being treated as
a design.
