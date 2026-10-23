import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { t } from '../core/i18n'
import { api } from '../core/api'
import type { AuthUser } from '../core/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const config = ref<{ registration: 'open' | 'invite' }>({ registration: 'open' })
  const loading = ref(true)
  const busy = ref(false)
  const error = ref('')

  const loggedIn = computed(() => Boolean(user.value))
  const isAdmin = computed(() => Boolean(user.value?.isAdmin))

  async function fetchMe() {
    loading.value = true
    user.value = await api.me()
    loading.value = false
  }

  async function fetchConfig() {
    config.value = await api.getAuthConfig().catch(() => ({ registration: 'open' as const }))
  }

  async function register(email: string, password: string, name: string, invite = '') {
    busy.value = true
    error.value = ''
    try {
      user.value = await api.register({ email, password, name, invite })
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : t('注册失败')
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
      error.value = err instanceof Error ? err.message : t('登录失败')
      return false
    } finally {
      busy.value = false
    }
  }

  async function logout() {
    await api.logout().catch(() => undefined)
    user.value = null
  }

  async function changePassword(currentPassword: string, newPassword: string): Promise<string> {
    try {
      await api.changePassword(currentPassword, newPassword)
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : t('修改失败')
    }
  }

  async function deleteAccount(password: string): Promise<string> {
    try {
      await api.deleteAccount(password)
      user.value = null
      return ''
    } catch (err) {
      return err instanceof Error ? err.message : t('注销失败')
    }
  }

  async function updateProfile(patch: { name?: string; avatarId?: string }) {
    try {
      user.value = await api.updateMe(patch)
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : t('保存失败')
      return false
    }
  }

  return {
    user,
    config,
    loading,
    busy,
    error,
    loggedIn,
    isAdmin,
    fetchMe,
    fetchConfig,
    register,
    login,
    logout,
    updateProfile,
    changePassword,
    deleteAccount,
  }
})
