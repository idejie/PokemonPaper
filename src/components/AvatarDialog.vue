<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import AvatarSvg from './AvatarSvg.vue'
import { AVATARS } from '../core/avatar'
import { useAuthStore } from '../stores/auth'
import { usePapersStore } from '../stores/papers'
import { useUiStore } from '../stores/ui'

const auth = useAuthStore()
const store = usePapersStore()
const ui = useUiStore()

const selected = ref(auth.user?.avatarId ?? AVATARS[0].id)
const name = ref(auth.user?.name ?? '')
const saving = ref(false)

async function save() {
  saving.value = true
  const ok = await auth.updateProfile({ avatarId: selected.value, name: name.value.trim() })
  saving.value = false
  if (ok) {
    store.notify('训练家资料已更新')
    ui.closeAvatar()
  } else {
    store.notify(auth.error || '保存失败')
  }
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
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="overlay" @click.self="close">
    <section class="sheet" role="dialog" aria-modal="true" aria-label="选择头像">
      <header class="head">
        <h2>训练家资料</h2>
        <button class="close" type="button" aria-label="关闭" @click="close">×</button>
      </header>

      <div class="body">
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
            <span class="name">{{ item.name }}</span>
          </button>
        </div>

        <label class="field">
          <span>昵称</span>
          <input v-model="name" class="input" maxlength="40" placeholder="怎么称呼你" />
        </label>

        <div class="actions">
          <span class="hint">头像会出现在顶栏和登录页</span>
          <span class="spacer" />
          <button type="button" class="btn ghost" @click="close">取消</button>
          <button type="button" class="btn" :disabled="saving" @click="save">
            {{ saving ? '保存中…' : '保存' }}
          </button>
        </div>
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
  width: min(620px, 100%);
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
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--ink);
  color: var(--paper);
  border-bottom: 4px solid var(--ink);
}

.head h2 {
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 0.02em;
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
  gap: 14px;
  padding: 18px;
  overflow-y: auto;
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.option {
  display: grid;
  gap: 4px;
  padding: 8px 6px 6px;
  border: 3px solid var(--ink);
  border-radius: 10px;
  background: var(--paper);
  box-shadow: 3px 3px 0 var(--ink);
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.option:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--ink);
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
  border-radius: 8px;
  padding: 4px;
}

.name {
  font-size: 10.5px;
  font-weight: 800;
  color: var(--ink);
  text-align: center;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 2px dashed var(--line);
}

.hint {
  font-size: 11px;
  color: var(--dim);
}

.spacer {
  flex: 1;
}

@media (max-width: 560px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
