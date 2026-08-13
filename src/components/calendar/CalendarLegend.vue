<template>
  <!-- Out of the sidebar and into a corner: the legend is reference material,
         consulted once and then in the way. Opens on hover, and on focus so it
         is reachable from the keyboard. -->
  <div class="legend-dock">
    <button
      type="button"
      class="button is-small legend-button"
      aria-haspopup="true"
    >
      <b-icon
        icon="information-outline"
        size="is-small"
      />
      <span>Legend</span>
    </button>

    <div class="legend-panel">
      <p class="menu-label">
        Calendar Legend
      </p>
      <div class="legend">
        <div class="legend-item">
          <div class="reservation-visual" />
          <div>
            <b>Weather Forecast</b>
            <p class="forecast forecast-1">
              Excellent
            </p>
            <p class="forecast forecast-2">
              Good
            </p>
            <p class="forecast forecast-3">
              Ok
            </p>
            <p class="forecast forecast-4">
              Poor
            </p>
            <p class="forecast forecast-5">
              Terrible
            </p>
          </div>
        </div>
        <div class="legend-item">
          <div class="reservation-visual realtime" />
          <div>
            <b>Realtime Session</b>
            <p>Blue events are used to reserve time for manual observing via the "Observe" tab.</p>
            <p>You can schedule time in a 30 or 45 minute block.</p>
          </div>
        </div>
        <div class="legend-item">
          <div class="reservation-visual project" />
          <div>
            <b>Project Session</b>
            <p>Purple events designate a project that has been created by the user.</p>
          </div>
        </div>
        <div class="legend-item">
          <div class="reservation-visual low-priority" />
          <div>
            <b>Low Priority Event</b>
            <p>Events with the green corner are ok to remove if you want to observe during this time</p>
          </div>
        </div>
        <div class="legend-item">
          <div class="reservation-visual time-critical" />
          <div>
            <b>Time Critical Observation</b>
            <p>Events with the red corner require precise time schedules. </p>
            <p>While they behave the same as standard events, they are shown here for informative purposes.</p>
          </div>
        </div>
        <div class="legend-item">
          <div class="reservation-visual self-owned" />
          <div>
            <b>Your Reservations</b>
            <p>Calendar events created by you will be outlined in gold.</p>
          </div>
        </div>
        <div class="legend-item">
          <div class="reservation-visual moon" />
          <div>
            <b>Moon</b>
            <p>The pale band runs from moonrise to moonset, and the brighter it is the more of the moon is lit.</p>
            <p>The vertical line inside it marks transit, when the moon is highest.</p>
            <p>Hover the band for the rise, transit and set times and the lit fraction.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * The calendar legend, as a corner button that opens on hover.
 *
 * Its own component so both calendars get it. It used to live in the site
 * page's sidebar, which meant the home page's booking modal -- which renders
 * TheCalendar directly -- never had one.
 */
export default {
  name: 'CalendarLegend'
}
</script>

<style lang="scss" scoped>
@import "@/style/_variables.scss";

.legend {
  display:flex;
  flex-direction: column;
  gap: 1em;
}

/* The legend as a corner button that opens on hover. It is reference material:
   wanted once while learning the calendar, and only in the way after that. */
.legend-dock {
  position: absolute;
  top: 0.5em;
  right: 0.75em;
  z-index: 20;
}

.legend-button {
  gap: 0.35em;
}

.legend-panel {
  display: none;
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.35em;
  width: 24em;
  max-height: 70vh;
  overflow-y: auto;
  padding: 1em;
  border-radius: 6px;
  border: 1px solid rgba(128, 128, 128, 0.5);
  background-color: $dark;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.6);
}

/* focus-within so it opens from the keyboard too, not hover alone. */
.legend-dock:hover .legend-panel,
.legend-dock:focus-within .legend-panel {
  display: block;
}

.legend-item {
  display: flex;
  gap: 1em;
}

.forecast {
  border-left: $forecast-width solid;
  margin-left: -20px;
  padding-left: 20px;

  &.forecast-1 {
    border-color: $ptr-calendar-forecast-1;
  }
  &.forecast-2 {
    border-color: $ptr-calendar-forecast-2;
  }
  &.forecast-3 {
    border-color: $ptr-calendar-forecast-3;
  }
  &.forecast-4 {
    border-color: $ptr-calendar-forecast-4;
  }
  &.forecast-5 {
    border-color: $ptr-calendar-forecast-5;
  }
}

.reservation-visual {
  width: 30px;
  height: 50px;
  border-radius: 3px;
  flex-shrink: 0;
  margin-top: 6px; // align top of the visual with description to the right
  &.realtime {
    background-color: $ptr-calendar-realtime-color;
  }
  &.project{
    background-color: $ptr-calendar-project-color;
  }
  /* The band as drawn on the grid, with the transit line down the middle. */
  &.moon {
    background-color: rgba(255, 255, 255, 0.4);
    position: relative;
  }
  &.moon::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 2px;
    background-color: rgba(255, 255, 255, 0.9);
  }
  &.low-priority {
    background-color: rgba(255, 255, 255, 0.25);
    position: relative;
  }
  &.low-priority::before {
    content: "";
    border-bottom-right-radius: 3px;
    position: absolute;
    bottom: 0;
    right: 0;
    width: 0;
    height: 0;
    border-left: 20px solid transparent;
    border-bottom: 20px solid $ptr-calendar-low-priority-color;
  }
  &.time-critical {
    background-color: rgba(255, 255, 255, 0.25);
    position: relative;
  }
  &.time-critical::before {
    content: "";
    border-bottom-right-radius: 3px;
    position: absolute;
    bottom: 0;
    right: 0;
    width: 0;
    height: 0;
    border-left: 20px solid transparent;
    border-bottom: 20px solid $ptr-calendar-time-critical-color;
  }
  &.self-owned {
    background-color: rgba(255, 255, 255, 0.25);
    border: 2px solid $ptr-calendar-user-border;
  }
}
</style>
