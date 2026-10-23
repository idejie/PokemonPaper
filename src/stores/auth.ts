import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../core/api'
import type { AuthUser } from '../core/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const loading = ref(true)
  const busy = ref(false)
  const error = ref('')

  const loggedIn = computed(() => Boolean(user.value))

  async function fetchMe() {
    loading.value = true
    user.value = await api.me()
    loading.value = false
  }

  async function register(email: string, password: string, name: string) {
    busy.value = true
    error.value = ''
    try {
      user.value = await api.register({ email, password, name })
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '注册失败'
      return false
    } finally {
      busy.value = false
    }
  }

  async function login(email: string, password: string) {
    busy.value = true
    error.value = ''
    try {
      user.value = await api.login({ email, password })
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '登录失败'
      return false
    } finally {
      busy.value = false
    }
  }

  async function logout() {
    await api.logout().catch(() => undefined)
    user.value = null
  }

  async function updateProfile(patch: { name?: string; avatarId?: string }) {
    try {
      user.value = await api.updateMe(patch)
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '保存失败'
      return false
    }
  }

  return { user, loading, busy, error, loggedIn, fetchMe, register, login, logout, updateProfile }
})
