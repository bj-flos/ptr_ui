<template>
  <img
    v-if="showPicture"
    :src="profileUrl"
    :width="size"
    :height="size"
    :alt="label"
    :title="label"
    class="user-avatar"
    referrerpolicy="no-referrer"
    @error="pictureFailed = true"
  >
  <div
    v-else
    class="user-avatar user-avatar--initials"
    :style="initialsStyle"
    role="img"
    :aria-label="label"
    :title="label"
  >
    {{ displayInitials }}
  </div>
</template>

<script>
import { mapState } from 'vuex'

/* Enough hues to tell two people apart at a glance, all dark enough to carry
 * white text on the navbar. Order matters only in that it must not change --
 * a colour that moves between logins reads as a different person. */
const COLOURS = [
  '#2f6f4f', '#2c5d84', '#6b4a86', '#8a4b3c',
  '#3f6b6b', '#7a5a2f', '#54527a', '#8a4160'
]

/* "Ada Lovelace" in a single field still has two initials in it. Lifted out
 * of the computed so the override path can use it too.
 *
 * Taken as stored: upper-casing "BJ" is harmless but lower-casing it is not,
 * and reshaping names is how "McDonald" becomes "Mcdonald". */
function initialsFrom (value) {
  const single = String(value || '').trim()
  if (!single) { return '?' }
  const parts = single.split(/[\s._-]+/).filter(Boolean)
  if (parts.length > 1) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return single.slice(0, 2).toUpperCase()
}

export default {
  name: 'UserAvatar',

  props: {
    size: {
      type: Number,
      default: 25
    },

    /* Overrides, for a subject that is not the signed-in user -- today the
     * guest avatar, which has no account behind it to read. Both default to
     * null so every existing call site keeps reading the store. */
    name: {
      type: String,
      default: null
    },
    initials: {
      type: String,
      default: null
    }
  },

  data () {
    return {
      /* A picture URL that 404s fails exactly like an absent one, and the
       * provider's avatar is on someone else's host. */
      pictureFailed: false
    }
  },

  computed: {
    ...mapState('user_data', [
      'profileUrl',
      'userGivenName',
      'userFamilyName',
      'userName',
      'userNickname',
      'userEmail',
      'userId'
    ]),

    /* An overridden subject never borrows the signed-in user's picture: the
     * guest avatar must not come out wearing the last person's face. */
    showPicture () {
      return !this.name && !!this.profileUrl && !this.pictureFailed
    },

    label () {
      return this.name || this.userGivenName || this.userName ||
        this.userNickname || this.userEmail || 'Signed in'
    },

    /* Given plus family where both are known, because two initials identify a
     * person and one barely does. Falls back through the names that are
     * usually present, and finally to the email local part -- never to a
     * character from the domain, which would put "g" on every gmail user.
     *
     * An explicit `initials` wins outright, and `name` is treated as a single
     * field; the casing rules live with initialsFrom above. */
    displayInitials () {
      if (this.initials) { return this.initials }
      if (this.name) { return initialsFrom(this.name) }

      const first = (this.userGivenName || '').trim()
      const last = (this.userFamilyName || '').trim()
      if (first && last) {
        return (first[0] + last[0]).toUpperCase()
      }

      const single = first || (this.userName || '').trim() ||
        (this.userNickname || '').trim() ||
        (this.userEmail || '').split('@')[0]
      if (!single) { return '?' }
      return initialsFrom(single)
    },

    /* Stable per person: the same account gets the same colour on every
     * machine and every login, because it is derived rather than assigned. */
    colour () {
      const seed = this.name || this.userId || this.userEmail || this.label
      let hash = 0
      for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
      }
      return COLOURS[hash % COLOURS.length]
    },

    initialsStyle () {
      return {
        width: `${this.size}px`,
        height: `${this.size}px`,
        backgroundColor: this.colour,
        // Scales with the circle so the same component works in the 25px
        // navbar and at profile size without a second set of rules.
        fontSize: `${Math.round(this.size * 0.42)}px`,
        lineHeight: `${this.size}px`
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.user-avatar {
  border-radius: 50%;
  display: inline-block;
  vertical-align: middle;
  flex: none;
}

.user-avatar--initials {
  color: #fff;
  font-weight: 600;
  text-align: center;
  letter-spacing: 0.02em;
  user-select: none;
}
</style>
