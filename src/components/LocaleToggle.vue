<script setup lang="ts">
import { localeSwitch, t, toggleLocale } from '../core/i18n'
</script>

<template>
  <button type="button" class="locale-btn mono" :title="t('切换语言')" @click="toggleLocale">
    {{ localeSwitch }}
  </button>
</template>

<style scoped>
.locale-btn {
  border: 2px solid var(--ink);
  border-radius: 7px;
  background: var(--panel);
  color: var(--text);
  font-size: 11px;
  font-weight: 900;
  padding: 3px 8px;
  box-shadow: 2px 2px 0 var(--ink);
}

.locale-btn:hover {
  background: var(--gold);
}
</style>
