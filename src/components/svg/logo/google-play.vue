<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="svg-google-play"
  >
    <path
      d="M3.609 1.814C3.23 2.22 3 2.83 3 3.633v16.734c0 .803.23 1.413.61 1.819l.061.056 9.605-9.605v-.226L3.67 2.808l-.061.006z"
      fill="#2196F3"
    />
    <path
      d="M16.482 15.688l-3.206-3.206v-.227l3.206-3.206.072.041 3.799 2.158c1.085.617 1.085 1.624 0 2.24l-3.799 2.158-.072.042z"
      fill="#FFC107"
    />
    <path
      d="M13.276 12.255L3.609 21.922c.358.38.956.425 1.637.039l11.308-6.425-3.278-3.281z"
      fill="#4CAF50"
    />
    <path
      d="M13.276 12.255l3.278-3.281L5.246 2.549c-.681-.387-1.279-.341-1.637.039l9.667 9.667z"
      fill="#F44336"
    />
  </svg>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'GooglePlayIcon',
  props: {
    size: {
      type: [Number, String],
      default: 24
    }
  }
});
</script>

<style scoped>
.svg-google-play {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
