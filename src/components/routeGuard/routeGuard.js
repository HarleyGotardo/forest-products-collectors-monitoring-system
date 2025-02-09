import { supabase } from '@/lib/supabaseClient'
import { ref, computed, onMounted } from 'vue'

const user = ref(null)

const fetchUserDetails = async () => {
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (authUser) {
    const { data: userDetails, error } = await supabase
      .from('profiles')
      .select('id, role_id')
      .eq('id', authUser.id)
      .single()

    if (error) {
      console.error('Error fetching user details:', error)
    } else {
      user.value = userDetails
    }
  }
}

const isFPUAdmin = computed(() => {
  return user.value && user.value.role_id === 4
})

const isForestRanger = computed(() => {
  return user.value && user.value.role_id === 1
})

const isFPCollector = computed(() => {
  return user.value && user.value.role_id === 2
})

const isVSUAdmin = computed(() => {
  return user.value && user.value.role_id === 3
})

onMounted(() => {
  fetchUserDetails()
})

export { fetchUserDetails, isFPUAdmin, isForestRanger, isFPCollector, isVSUAdmin }