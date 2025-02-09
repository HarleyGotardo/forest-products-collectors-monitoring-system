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

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Product+Sans&display=swap');
body {
  font-family: 'Product Sans', sans-serif;
}
</style>