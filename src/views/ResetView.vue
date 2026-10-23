<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../core/api'
import { t } from '../core/i18n'
import { usePapersStore } from '../stores/papers'

const route = useRoute()
const router = useRouter()
const store = usePapersStore()

const token = computed(() => String(route.query.token || ''))
const password = ref('')
const confirm = ref('')
const busy = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  if (password.value.length < 8) {
    error.value = t('至少 8 位')
    return
  }
  if (password.value !== confirm.value) {
    error.value = t('两次输入的新密码不一致')
    return
  }
  busy.value = true
  try {
    await api.resetPassword(token.value, password.value)
    store.notify(t('密码已重置，请重新登录'))
    void router.push('/')
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('重置失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="reset-page">
    <div class="card">
      <p class="kicker mono">RESET</p>
      <h1>{{ t('设置新密码') }}</h1>
      <p v-if="!token" class="error">{{ t('重置链接无效或已过期') }}</p>
      <template v-else>
        <label class="field">
          <span>{{ t('新密码') }}</span>
          <input v-model="password" class="input" type="password" autocomplete="new-password" />
        </label>
        <label class="field">
          <span>{{ t('确认新密码') }}</span>
          <input v-model="confirm" class="input" type="password" autocomplete="new-password" />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="btn" type="button" :disabled="busy" @click="submit">
          {{ busy ? t('保存中…') : t('重置密码') }}
        </button>
      </template>
      <RouterLink to="/" class="back">{{ t('返回登录') }}</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.reset-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.card {
  width: min(420px, 92vw);
  display: grid;
  gap: 12px;
  background: var(--panel);
  border: 3px solid var(--ink);
  border-radius: 14px;
  box-shadow: var(--shadow);
  padding: 26px;
}

.kicker {
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--dim);
}

h1 {
  font-size: 22px;
  font-weight: 900;
}

.field {
  display: grid;
  gap: 4px;
}

.field span {
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dim);
  font-weight: 800;
}

.error {
  color: var(--red);
  font-size: 12px;
  font-weight: 700;
}

.back {
  font-size: 12px;
  font-weight: 800;
  color: var(--blue);
  margin-top: 4px;
}
</style>
