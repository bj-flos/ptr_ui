# Observatory safety settings, manual mode, and "Sim. Open"

What the per-observatory settings shown in the UI actually do, where each is enforced, and why
a site can report a roof state that contradicts its own WEMA.

These are **runtime overrides held in the observatory process**, not configuration. They are
commanded from the UI, published back in the `obs_settings` status, and reset every night — see
"How long they last" below. File references are `ptr-observatory` unless stated.

## The settings

| Shown as | Status key | Command | Enforced in |
|---|---|---|---|
| Telescope Manual Mode | `scope_in_manual_mode` | `configure_telescope_mode` | `camera.py`, `sequencer.py` |
| Simulating Open Roof | `simulating_open_roof` | `start_simulating_open_roof` / `stop_…` | `obs.py`, `camera.py`, `sequencer.py` |
| Sun Safety Mode | `sun_safety_mode` | `configure_sun_safety` | `mount.py:2074` |
| Moon Safety Mode | `moon_safety_mode` | `configure_moon_safety` | `mount.py:2083` |
| Altitude Safety Mode | `altitude_safety_mode` | `configure_altitude_safety` | `mount.py:2096` |
| Daytime Exposure Safety | `daytime_exposure_safety_mode` | `configure_daytime_exposure_safety` | `camera.py:3155` |
| Admin/Owner Commands Only | `admin_owner_commands_only` | `configure_who_can_send_commands` | command dispatch |

The UI reads these in `src/store/modules/sitestatus/getters/obs_settings_getters.js` and sends the
commands from `src/mixins/commands_mixin.js`.

### The three pointing checks

Sun, moon and altitude are all refusals at slew time, in `mount.py`. Each sends the user a message
and returns `'refused'`:

- **Sun** — refuses if closer to the sun than `closest_distance_to_the_sun`, and only outside civil
  twilight. Additionally gated on `open_and_enabled_to_observe`.
- **Moon** — refuses if closer than `closest_distance_to_the_moon`, unless the target *is* the moon,
  which it detects by name.
- **Altitude** — refuses below `lowest_requestable_altitude`.

Switching one off removes that refusal entirely; it does not soften it.

### Daytime exposure safety

`camera.py:3155`. When on, and the sun is above −5°, an exposure longer than
`max_daytime_exposure` is **silently shortened** to that maximum, with a message to the user. It
does not refuse the exposure. Calibration frames and sequencer flats skip the check.

### Manual mode is the big one

`scope_in_manual_mode` disables the "is the observatory allowed to observe" gate. From
`camera.py:3120`:

```python
if not g_dev['obs'].assume_roof_open and not skip_open_check and not g_dev['obs'].scope_in_manual_mode:
    if g_dev['obs'].open_and_enabled_to_observe == False:
        send_to_user("Refusing exposure request as the observatory is not enabled to observe.")
        return
```

So **in manual mode an exposure proceeds with the roof shut and the weather bad.** The same
pattern guards the sequencer at `sequencer.py:6233`, `6491`, `7122` and `7231`. Manual mode also
suppresses automatic evening/morning bias-dark runs and the close-and-park behaviour
(`sequencer.py:763`, `782`, `789`).

Note `skip_open_check` is set for bias and dark frames, which legitimately need a closed roof.
That is why the UI does **not** disable the Expose button when the roof is shut: doing so would
block exactly the calibration frames you take while closed.

`wx_ok` and WX HOLD are not consulted here at all. They drive the WEMA's decision about whether to
*open the roof*; the camera only ever asks `open_and_enabled_to_observe`.

## "Sim. Open"

`simulating_open_roof` sets `assume_roof_open`, which makes the observatory **ignore its WEMA's
roof entirely and report a fabricated one**. From `obs.py:4586`:

```python
if self.assume_roof_open:
    status = {"shutter_status": "Sim. Open",
              "enclosure_mode": "Simulated"}
```

It *replaces* the status rather than adjusting it, which is why `Sim. Open` and `Simulated` always
appear together. The log line is explicit: *"Roof is now assumed to be open. WEMA shutter status is
ignored."* `obs.py:4527` applies the same substitution on the other status path.

Consequences worth knowing:

- The observatory will observe with the real roof shut, since `assume_roof_open` short-circuits the
  same guard manual mode does.
- **The observatory's reported roof will contradict its WEMA's.** A WEMA hosts the roof for its
  observatories, so only the WEMA reading is real.
- Flat timing changes: `sequencer.py:824` and `929` treat the roof as having been open long enough.

Because of the contradiction, the site colour in the UI takes an observatory's roof from its
**WEMA**, not from the observatory's own record — otherwise the sites pulldown and the world map
marker disagree about one physical roof. See `all_sites_status_color` in
`src/store/modules/sitestatus/index.js`.

## How long they last

`simulate_open_roof` can be seeded from site config (`obs.py:453`), but all of these are then
runtime state. `nightly_reset_script` (`sequencer.py:2555`) restores them each night:

```python
# set safety defaults at startup
g_dev['obs'].scope_in_manual_mode = config['scope_in_manual_mode']
g_dev['obs'].sun_checks_on = config['sun_checks_on']
g_dev['obs'].moon_checks_on = config['moon_checks_on']
g_dev['obs'].altitude_checks_on = config['altitude_checks_on']
g_dev['obs'].daytime_exposure_time_safety_on = config['daytime_exposure_time_safety_on']
g_dev['obs'].admin_owner_commands_only = False
g_dev['obs'].assume_roof_open = False
```

So a setting changed by command survives until the nightly reset or a process restart, and is not
persisted anywhere. Note the two that do **not** come back from config: `admin_owner_commands_only`
and `assume_roof_open` are forced off regardless of what config says, so "simulating open roof"
cannot survive a night even if `simulate_open_roof` is set in the site config that seeded it at
`obs.py:453`.

One other way manual mode turns itself on: an observatory with no mount configured enters
**mountless operation** and sets `scope_in_manual_mode = True` at startup (`obs.py:516`), logging
"Engaging mountless operations. Telescope set in manual mode". Worth checking before assuming
someone commanded it.

## Dev stack state, 2026-08-11

| Site | Manual mode | Simulating open roof |
|---|---|---|
| DPO-17 | **True** | False |
| MRC-17 | **True** | False |
| ARO-17 | **True** | False |
| ECO-17 | **True** | **True** |

All four are in manual mode, so none of them will refuse an exposure on roof or weather grounds.
ECO-17 additionally reports `Sim. Open` / `Simulated` while its WEMA `ECO` reports the real roof
`Closed` — which is why its dot was green in the sites pulldown while the ECO marker was yellow,
before the colouring was changed to inherit the WEMA.

## What the UI cannot currently know

`open_and_enabled_to_observe` — the flag the exposure guard actually tests — **is not published in
any status payload**. Checked `obs_settings`, `device` and `enclosure`. The UI can see
`scope_in_manual_mode` and the enclosure state, but cannot reproduce the observatory's decision, so
it cannot reliably disable a control the observatory would have honoured. Publishing that flag in
`obs_settings` would be the prerequisite for pre-empting a refusal in the UI rather than reporting
it afterwards.
