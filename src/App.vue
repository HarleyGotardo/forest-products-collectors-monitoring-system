<!-- src/App.vue -->
<script setup>
import { onMounted } from 'vue'
import { subscribeToUserChanges, fetchUserDetails } from './router/routeGuard';

onMounted(() => {
  subscribeToUserChanges(fetchUserDetails);
});
</script>
<template>
  <router-view />
</template>

<script setup>
</script>

<style>
/* Import Inter font */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@100;200;300;400;500;600;700;800;900&display=swap');

/* Apply Inter font system-wide */
:root {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

/* Apply font to all elements */
* {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

/* Optional: Add font smoothing for better rendering */
html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Your existing styles */
</style>