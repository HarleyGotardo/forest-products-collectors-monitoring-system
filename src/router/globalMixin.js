import { onMounted } from 'vue'
import { subscribeToUserChanges, fetchUserDetails } from './routeGuard'

export default {
  setup() {
    onMounted(() => {
      subscribeToUserChanges(fetchUserDetails)
    })
  }
}