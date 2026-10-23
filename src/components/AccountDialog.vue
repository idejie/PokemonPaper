<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AvatarSvg from './AvatarSvg.vue'
import { AVATARS } from '../core/avatar'
import { api } from '../core/api'
import { useAuthStore } from '../stores/auth'
import { usePapersStore } from '../stores/papers'
import { useUiStore } from '../stores/ui'
import type { Invite } from '../core/types'
import { t } from '../core/i18n'

const auth = useAuthStore()
const store = usePapersStore()
const ui = useUiStore()
const router = useRouter()

const selected = ref(auth.user?.avatarId ?? AVATARS[0].id)
const name = ref(auth.user?.name ?? '')
const savingProfile = ref(false)

const pwCurrent = ref('')
const pwNew = ref('')
const pwConfirm = ref('')
const pwBusy = ref(false)
const pwMsg = ref('')

const adminMode = ref<'open' | 'invite'>(auth.config.registration)
const resetEmail = ref('')
const resetUrl = ref('')
const resetBusy = ref(false)

async function makeResetLink() {
  if (!resetEmail.value.trim()) {
    store.notify(t('先填邮箱'))
    return
  }
  resetBusy.value = true
  try {
    resetUrl.value = await api.adminResetLink(resetEmail.value.trim())
    await navigator.clipboard.writeText(resetUrl.value).catch(() => {})
    store.notify(t('重置链接已生成并复制'))
  } catch (err) {
    store.notify(err instanceof Error ? err.message : t('生成失败'))
  } finally {
    resetBusy.value = false
  }
}
const invites = ref<Invite[]>([])
const inviteBusy = ref(false)

const deletePassword = ref('')
const deleteBusy = ref(false)

async function saveProfile() {
  savingProfile.value = true
  const ok = await auth.updateProfile({ avatarId: selected.value, name: name.value.trim() })
  savingProfile.value = false
  store.notify(ok ? t('训练家资料已更新') : auth.error || t('保存失败'))
}

async function savePassword() {
  pwMsg.value = ''
  if (pwNew.value.length < 8) {
    pwMsg.value = t('新密码至少 8 位')
    return
  }
  if (pwNew.value !== pwConfirm.value) {
    pwMsg.value = t('两次输入的新密码不一致')
    return
  }
  pwBusy.value = true
  const error = await auth.changePassword(pwCurrent.value, pwNew.value)
  pwBusy.value = false
  if (error) {
    pwMsg.value = error
    return
  }
  pwCurrent.value = ''
  pwNew.value = ''
  pwConfirm.value = ''
  store.notify(t('密码已更新，其它设备已退出登录'))
}

async function loadInvites() {
  if (!auth.isAdmin) return
  invites.value = await api.adminListInvites().catch(() => [])
}

async function setMode(mode: 'open' | 'invite') {
  const previous = adminMode.value
  adminMode.value = mode
  try {
    await api.adminSetConfig(mode)
    await auth.fetchConfig()
    store.notify(mode === 'invite' ? t('已切换为邀请制') : t('已开放注册'))
  } catch {
    adminMode.value = previous
    store.notify(t('切换失败'))
  }
}

async function createInvite() {
  inviteBusy.value = true
  try {
    const code = await api.adminCreateInvite()
    invites.value = [{ code, createdAt: new Date().toISOString(), used: false, usedAt: null }, ...invites.value]
    await copy(code)
  } catch {
    store.notify(t('生成失败'))
  } finally {
    inviteBusy.value = false
  }
}

async function copy(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    store.notify(t('邀请码 {code} 已复制', { code }))
  } catch {
    store.notify(t('邀请码：{code}', { code }))
  }
}

async function revoke(code: string) {
  try {
    await api.adminRevokeInvite(code)
    invites.value = invites.value.filter((item) => item.code !== code)
    store.notify(t('已撤销'))
  } catch (err) {
    store.notify(err instanceof Error ? err.message : t('撤销失败'))
  }
}

async function exportData() {
  const data = await api.exportAll()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `pokemonpaper-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
  store.notify(t('已导出我的数据'))
}

async function deleteAccount() {
  if (!deletePassword.value) {
    store.notify(t('输入密码才能注销'))
    return
  }
  const ok = window.confirm(
    t('注销会删掉这个账号的所有论文、笔记和解读，且无法恢复。确定吗？'),
  )
  if (!ok) return
  deleteBusy.value = true
  const error = await auth.deleteAccount(deletePassword.value)
  deleteBusy.value = false
  if (error) {
    store.notify(error)
    return
  }
  ui.closeAvatar()
  void router.push('/')
}

function close() {
  ui.closeAvatar()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'
  void loadInvites()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="overlay" @click.self="close">
    <section class="sheet" role="dialog" aria-modal="true" :aria-label="t('账号设置')">
      <header class="head">
        <h2>{{ t('账号设置') }}</h2>
        <span class="who mono">{{ auth.user?.email }}</span>
        <button class="close" type="button" :aria-label="t('关闭')" @click="close">×</button>
      </header>

      <div class="body">
        <section class="block">
          <h3>{{ t('训练家资料') }}</h3>
          <div class="grid">
            <button
              v-for="item in AVATARS"
              :key="item.id"
              type="button"
              class="option"
              :class="{ on: selected === item.id }"
              @click="selected = item.id"
            >
              <span class="pic"><AvatarSvg :id="item.id" /></span>
              <span class="name">{{ t(item.name) }}</span>
            </button>
          </div>
          <div class="row">
            <label class="field grow">
              <span>{{ t('昵称') }}</span>
              <input v-model="name" class="input" maxlength="40" />
            </label>
            <button type="button" class="btn" :disabled="savingProfile" @click="saveProfile">
              {{ savingProfile ? t('保存中…') : t('保存资料') }}
            </button>
          </div>
        </section>

        <section class="block">
          <h3>{{ t('修改密码') }}</h3>
          <div class="row three">
            <label class="field">
              <span>{{ t('当前密码') }}</span>
              <input v-model="pwCurrent" class="input" type="password" autocomplete="current-password" />
            </label>
            <label class="field">
              <span>{{ t('新密码') }}</span>
              <input v-model="pwNew" class="input" type="password" autocomplete="new-password" />
            </label>
            <label class="field">
              <span>{{ t('确认新密码') }}</span>
              <input v-model="pwConfirm" class="input" type="password" autocomplete="new-password" />
            </label>
          </div>
          <div class="row">
            <p v-if="pwMsg" class="error">{{ pwMsg }}</p>
            <span class="spacer" />
            <button type="button" class="btn" :disabled="pwBusy" @click="savePassword">
              {{ pwBusy ? t('提交中…') : t('更新密码') }}
            </button>
          </div>
        </section>

        <section v-if="auth.isAdmin" class="block">
          <h3>{{ t('管理员') }}</h3>
          <div class="row">
            <label class="field grow">
              <span>{{ t('注册方式') }}</span>
              <select
                :value="adminMode"
                class="select"
                @change="setMode(($event.target as HTMLSelectElement).value as 'open' | 'invite')"
              >
                <option value="open">{{ t('开放注册') }}</option>
                <option value="invite">{{ t('邀请制') }}</option>
              </select>
            </label>
            <button type="button" class="btn" :disabled="inviteBusy" @click="createInvite">
              {{ inviteBusy ? t('生成中…') : t('生成邀请码') }}
            </button>
          </div>

          <ul v-if="invites.length" class="invites">
            <li v-for="item in invites" :key="item.code" :class="{ used: item.used }">
              <span class="code mono">{{ item.code }}</span>
              <span class="state">{{ item.used ? t('已使用') : t('未使用') }}</span>
              <button v-if="!item.used" type="button" class="mini" @click="copy(item.code)">
                {{ t('复制') }}
              </button>
              <button v-if="!item.used" type="button" class="mini danger" @click="revoke(item.code)">
                {{ t('撤销') }}
              </button>
            </li>
          </ul>

          <h3 class="block-title">{{ t('密码重置') }}</h3>
          <div class="invite-row">
            <input
              v-model="resetEmail"
              class="input"
              type="email"
              :placeholder="t('用户邮箱')"
            />
            <button type="button" class="btn" :disabled="resetBusy" @click="makeResetLink">
              {{ resetBusy ? t('生成中…') : t('生成重置链接') }}
            </button>
          </div>
          <p v-if="resetUrl" class="hint mono reset-url">{{ resetUrl }}</p>
          <p v-else class="hint">{{ t('还没有邀请码。切成邀请制后，生成一个发给同事。') }}</p>
        </section>

        <section class="block danger">
          <h3>{{ t('数据与账号') }}</h3>
          <div class="row">
            <div class="grow">
              <b class="label">{{ t('导出我的数据') }}</b>
              <p class="hint">{{ t('当前账号的全部论文、笔记、解读，JSON 格式。') }}</p>
            </div>
            <button type="button" class="btn ghost" @click="exportData">{{ t('导出') }}</button>
          </div>

          <div class="row">
            <label class="field grow">
              <span>{{ t('注销账号（不可恢复）') }}</span>
              <input
                v-model="deletePassword"
                class="input"
                type="password"
                :placeholder="t('输入密码确认')"
                autocomplete="current-password"
              />
            </label>
            <button type="button" class="btn danger" :disabled="deleteBusy" @click="deleteAccount">
              {{ deleteBusy ? t('注销中…') : t('注销账号') }}
            </button>
          </div>
        </section>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(34, 29, 26, 0.55);
  backdrop-filter: blur(3px);
  overflow-y: auto;
}

.sheet {
  width: min(680px, 100%);
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 4px solid var(--ink);
  border-radius: 16px;
  box-shadow: 9px 9px 0 var(--ink);
  overflow: hidden;
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--ink);
  color: var(--paper);
  border-bottom: 4px solid var(--ink);
}

.head h2 {
  font-size: 15px;
  font-weight: 900;
}

.head .who {
  font-size: 11px;
  opacity: 0.7;
  flex: 1;
}

.close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2.5px solid var(--ink);
  background: var(--gold);
  color: var(--ink);
  font-size: 17px;
  font-weight: 900;
  line-height: 1;
  display: grid;
  place-items: center;
}

.body {
  display: grid;
  gap: 18px;
  padding: 18px;
  overflow-y: auto;
}

.block {
  display: grid;
  gap: 10px;
  padding-bottom: 16px;
  border-bottom: 2px dashed var(--line);
}

.block:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.block h3 {
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.04em;
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.option {
  display: grid;
  gap: 3px;
  padding: 6px 5px 5px;
  border: 3px solid var(--ink);
  border-radius: 10px;
  background: var(--paper);
  box-shadow: 2px 2px 0 var(--ink);
}

.option.on {
  background: var(--gold);
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 var(--ink);
}

.pic {
  display: block;
  aspect-ratio: 1;
  background: #f7ecd2;
  border: 2px solid var(--ink);
  border-radius: 7px;
  padding: 3px;
}

.name {
  font-size: 10px;
  font-weight: 800;
  text-align: center;
  color: var(--ink);
}

.row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.row.three {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.grow {
  flex: 1;
}

.spacer {
  flex: 1;
}

.error {
  font-size: 12px;
  color: var(--red);
  font-weight: 700;
}

.hint {
  font-size: 11.5px;
  color: var(--dim);
}

.label {
  font-size: 12.5px;
}

.reset-url {
  word-break: break-all;
  font-size: 10px;
}

.invites {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
  max-height: 150px;
  overflow-y: auto;
}

.invites li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border: 2px solid var(--line);
  border-radius: 7px;
  background: var(--paper);
}

.invites li.used {
  opacity: 0.55;
}

.code {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  flex: 1;
}

.state {
  font-size: 10.5px;
  color: var(--dim);
  font-weight: 700;
}

.mini {
  border: 2px solid var(--ink);
  border-radius: 5px;
  background: var(--gold);
  font-size: 10.5px;
  font-weight: 800;
  padding: 1px 7px;
}

.mini.danger {
  background: var(--bad-bg);
  color: var(--red);
}

.danger h3 {
  color: var(--red);
}

@media (max-width: 560px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .row,
  .row.three {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
</style>
