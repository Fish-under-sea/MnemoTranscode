/** 与 backend POST /llm-probe/check 的 mode 一致；off=不拉表 */
export type LlmListProbe = 'off' | 'openai' | 'ollama' | 'google' | 'anthropic' | 'zhipu'
