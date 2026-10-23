export interface Provider {
  id: string
  name: string
  baseUrl: string
  models: string[]
  keyUrl: string
  note: string
}

/**
 * OpenAI 兼容的预设。模型名会随厂商更新，这里只是候选，
 * 输入框允许自由填写（datalist）。
 */
export const PROVIDERS: Provider[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyUrl: 'https://platform.deepseek.com/api_keys',
    note: '便宜、中文好，适合批量生成解读',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o'],
    keyUrl: 'https://platform.openai.com/api-keys',
    note: '稳定，需要海外网络环境',
  },
  {
    id: 'moonshot',
    name: 'Moonshot / Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k'],
    keyUrl: 'https://platform.moonshot.cn/console/api-keys',
    note: '长上下文，适合长摘要',
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-flash', 'glm-4-plus'],
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    note: 'glm-4-flash 有免费额度',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['deepseek/deepseek-chat', 'qwen/qwen-2.5-72b-instruct'],
    keyUrl: 'https://openrouter.ai/keys',
    note: '一个 key 调多家模型',
  },
  {
    id: 'custom',
    name: '自定义',
    baseUrl: '',
    models: [],
    keyUrl: '',
    note: '任何 OpenAI 兼容的 /chat/completions 端点',
  },
]

export function providerById(id: string): Provider {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0]
}
