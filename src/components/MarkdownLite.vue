<script setup lang="ts">
import { computed } from 'vue'

interface Block {
  type: 'h' | 'p' | 'ul' | 'code'
  text?: string
  items?: string[]
}

const props = defineProps<{ source: string }>()

const blocks = computed<Block[]>(() => {
  const out: Block[] = []
  let paragraph: string[] = []
  let list: string[] = []
  let code: string[] = []
  let inCode = false

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push({ type: 'p', text: paragraph.join(' ') })
      paragraph = []
    }
  }
  const flushList = () => {
    if (list.length) {
      out.push({ type: 'ul', items: list })
      list = []
    }
  }

  for (const raw of props.source.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.startsWith('```')) {
      if (inCode) {
        out.push({ type: 'code', text: code.join('\n') })
        code = []
        inCode = false
      } else {
        flushParagraph()
        flushList()
        inCode = true
      }
      continue
    }
    if (inCode) {
      code.push(raw)
      continue
    }
    if (!line) {
      flushParagraph()
      flushList()
      continue
    }
    if (line.startsWith('#')) {
      flushParagraph()
      flushList()
      out.push({ type: 'h', text: line.replace(/^#+\s*/, '') })
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph()
      list.push(line.replace(/^[-*]\s+/, ''))
      continue
    }
    if (list.length) flushList()
    paragraph.push(line)
  }
  if (inCode && code.length) out.push({ type: 'code', text: code.join('\n') })
  flushParagraph()
  flushList()
  return out
})
</script>

<template>
  <div class="md">
    <template v-for="(block, index) in blocks" :key="index">
      <h4 v-if="block.type === 'h'">{{ block.text }}</h4>
      <ul v-else-if="block.type === 'ul'">
        <li v-for="(item, i) in block.items" :key="i">{{ item }}</li>
      </ul>
      <pre v-else-if="block.type === 'code'"><code>{{ block.text }}</code></pre>
      <p v-else>{{ block.text }}</p>
    </template>
  </div>
</template>

<style scoped>
.md {
  display: grid;
  gap: 10px;
  font-size: 15px;
  line-height: 1.85;
}

.md h4 {
  margin: 8px 0 0;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.06em;
  color: var(--red);
  border-left: 3px solid var(--red);
  padding-left: 8px;
}

.md p {
  margin: 0;
  color: var(--text);
}

.md ul {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 4px;
}

.md li {
  color: var(--text);
}

.md pre {
  margin: 0;
  padding: 12px 14px;
  border-radius: 9px;
  background: var(--ink);
  color: #f7f1df;
  overflow-x: auto;
  font-size: 11px;
  line-height: 1.7;
}

.md pre code {
  font-family: var(--mono, ui-monospace, monospace);
}
</style>
