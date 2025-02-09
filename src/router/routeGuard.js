import { supabase } from '@/lib/supabaseClient'
import { ref, computed } from 'vue'

const user = ref(null)

const fetchUserDetails = async () => {
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (authUser) {
    const { data: userDetails, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()

    if (error) {
      console.error('Error fetching user details:', error)
    } else {
      if (userDetails.profile_picture) {
        try {
          const profilePictureData = JSON.parse(userDetails.profile_picture)
          userDetails.profile_picture = profilePictureData.data.publicUrl
        } catch (e) {
          console.error('Error parsing profile_picture:', e)
        }
      }

      // Fetch role name
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('name')
        .eq('id', userDetails.role_id)
        .single()

      if (roleError) {
        console.error('Error fetching role name:', roleError)
      } else {
        userDetails.role = roleData.name
      }

      user.value = userDetails
    }
  }
}

const subscribeToUserChanges = async () => {
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (authUser) {
    supabase.channel('custom-all-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${authUser.id}` },
        (payload) => {
          console.log('Change received!', payload)
          fetchUserDetails()
        }
      )
      .subscribe()
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

const getName = () => {
  if (user && user.value) {
    return `${user.value.first_name} ${user.value.last_name}`
  }
  return ''
}

const getUser = () => {
  return user.value
}

// Fetch user details and subscribe to changes when the module is loaded
fetchUserDetails()
subscribeToUserChanges()

export { getUser, user, getName, fetchUserDetails, subscribeToUserChanges, isFPUAdmin, isForestRanger, isFPCollector, isVSUAdmin }