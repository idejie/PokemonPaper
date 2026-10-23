<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AvatarSvg from '../components/AvatarSvg.vue'
import { useAuthStore } from '../stores/auth'
import { t } from '../core/i18n'

const auth = useAuthStore()
const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const name = ref('')
const invite = ref('')

const title = computed(() =>
  mode.value === 'login' ? t('欢迎回来，训练家') : t('登记一位新训练家'),
)
const action = computed(() => (mode.value === 'login' ? t('登录') : t('注册并开始')))

function switchMode(next: 'login' | 'register') {
  mode.value = next
  auth.error = ''
}

onMounted(() => {
  void auth.fetchConfig()
})

async function submit() {
  if (!email.value.trim() || !password.value) {
    auth.error = t('邮箱和密码都要填')
    return
  }
  if (mode.value === 'login') {
    await auth.login(email.value.trim(), password.value)
  } else {
    await auth.register(email.value.trim(), password.value, name.value.trim(), invite.value.trim())
  }
}
</script>

<template>
  <div class="auth">
    <div class="card">
      <aside class="side">
        <div class="avatar-box">
          <AvatarSvg id="red-cap" />
        </div>
        <h1>PokemonPaper</h1>
        <p class="tagline">{{ t('每篇论文一只精灵，读完点亮。') }}</p>
        <ul class="points">
          <li>{{ t('arXiv 批量导入，自动抓标题作者摘要') }}</li>
          <li>{{ t('PDF 存本地，点开即读') }}</li>
          <li>{{ t('开源程度决定精灵等级') }}</li>
        </ul>
      </aside>

      <div class="panel">
        <div class="tabs">
          <button type="button" :class="{ on: mode === 'login' }" @click="switchMode('login')">
            {{ t('登录') }}
          </button>
          <button type="button" :class="{ on: mode === 'register' }" @click="switchMode('register')">
            {{ t('注册') }}
          </button>
        </div>

        <h2>{{ title }}</h2>

        <form class="form" @submit.prevent="submit">
          <label v-if="mode === 'register'" class="field">
            <span>{{ t('昵称') }}</span>
            <input
              v-model="name"
              class="input"
              :placeholder="t('怎么称呼你')"
              autocomplete="nickname"
            />
          </label>

          <label class="field">
            <span>{{ t('邮箱') }}</span>
            <input
              v-model="email"
              class="input"
              type="email"
              placeholder="you@example.com"
              autocomplete="email"
              required
            />
          </label>

          <label v-if="mode === 'register' && auth.config.registration === 'invite'" class="field">
            <span>{{ t('邀请码') }}</span>
            <input
              v-model="invite"
              class="input mono"
              :placeholder="t('向管理员要一个')"
              autocomplete="off"
            />
          </label>

          <label class="field">
            <span>{{ t('密码') }}</span>
            <input
              v-model="password"
              class="input"
              type="password"
              :placeholder="mode === 'register' ? t('至少 8 位') : t('输入密码')"
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
              required
            />
          </label>

          <p v-if="auth.error" class="error">{{ auth.error }}</p>

          <button class="btn submit" type="submit" :disabled="auth.busy">
            {{ auth.busy ? t('处理中…') : action }}
          </button>
        </form>

        <p class="hint">
          {{ mode === 'login' ? t('还没有账号？') : t('已经有账号了？') }}
          <button type="button" class="link" @click="switchMode(mode === 'login' ? 'register' : 'login')">
            {{ mode === 'login' ? t('注册一个') : t('去登录') }}
          </button>
        </p>

        <p v-if="auth.config.registration === 'invite'" class="foot">
          {{ t('本站目前是邀请制，注册需要管理员发的邀请码。') }}
        </p>
        <p class="foot">{{ t('数据存在这台机器的 SQLite，不会上传到任何地方。') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 28px;
}

.card {
  width: min(880px, 100%);
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: var(--panel);
  border: 4px solid var(--ink);
  border-radius: 18px;
  box-shadow: 10px 10px 0 var(--ink);
  overflow: hidden;
}

.side {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 10px;
  padding: 36px 28px;
  background: linear-gradient(160deg, var(--panel-2), var(--panel));
  border-right: 4px solid var(--ink);
  text-align: center;
}

.avatar-box {
  width: 128px;
  height: 128px;
  padding: 8px;
  background: #f7ecd2;
  border: 3px solid var(--ink);
  border-radius: 14px;
  box-shadow: 4px 4px 0 var(--ink);
}

.side h1 {
  font-size: 26px;
  font-weight: 900;
  letter-spacing: -0.02em;
  margin-top: 4px;
}

.tagline {
  font-size: 13px;
  color: var(--muted);
}

.points {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
  text-align: left;
}

.points li::before {
  content: '▸ ';
  color: var(--red);
}

.panel {
  padding: 32px 30px;
  display: grid;
  align-content: center;
  gap: 14px;
}

.tabs {
  display: inline-flex;
  border: 2.5px solid var(--ink);
  border-radius: 999px;
  overflow: hidden;
  width: fit-content;
  background: var(--paper);
}

.tabs button {
  border: none;
  background: transparent;
  padding: 5px 18px;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--muted);
}

.tabs button.on {
  background: var(--ink);
  color: var(--paper);
}

.panel h2 {
  font-size: 20px;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.form {
  display: grid;
  gap: 12px;
}

.submit {
  justify-content: center;
  padding: 10px;
  font-size: 14px;
  margin-top: 4px;
}

.error {
  font-size: 12.5px;
  color: var(--red);
  font-weight: 700;
}

.hint {
  font-size: 12.5px;
  color: var(--muted);
}

.link {
  border: none;
  background: none;
  color: var(--blue);
  font-weight: 800;
  font-size: 12.5px;
  padding: 0;
  text-decoration: underline;
}

.foot {
  font-size: 11px;
  color: var(--dim);
  border-top: 2px dashed var(--line);
  padding-top: 10px;
}

@media (max-width: 760px) {
  .card {
    grid-template-columns: 1fr;
  }

  .side {
    border-right: none;
    border-bottom: 4px solid var(--ink);
    padding: 24px 20px;
  }

  .avatar-box {
    width: 96px;
    height: 96px;
  }

  .points {
    display: none;
  }

  .panel {
    padding: 22px 20px;
  }
}
</style>
