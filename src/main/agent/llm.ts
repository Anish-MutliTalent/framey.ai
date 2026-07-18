// LLM client for Framey's brain.
//
// Fireworks AI exposes an OpenAI-compatible /v1/chat/completions endpoint, so
// we use the OpenAI SDK pointed at it and run a MiniMax model. Function-calling
// (tools/tool_choice) is supported, which is what the agent loop is built on.
//
// If there is no API key, createLLMClient returns null and the runtime reports
// a clear "no key" error when the user sends a prompt (there is no offline
// fallback — the app drives After Effects with a real MiniMax model on Fireworks).

import OpenAI from 'openai'
import type { FrameySettings } from '../../shared/protocol'

export interface ToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ToolCall {
  id: string
  function: { name: string; arguments: string }
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface LLMResponse {
  text: string
  toolCalls: ToolCall[]
  finishReason: string
}

export interface LLMClient {
  readonly provider: 'fireworks'
  chat(opts: {
    system: string
    messages: LLMMessage[]
    tools?: ToolDef[]
    model: string
  }): Promise<LLMResponse>
}

export class FireworksLLMClient implements LLMClient {
  readonly provider = 'fireworks' as const
  private client: OpenAI

  constructor(baseURL: string, apiKey: string) {
    this.client = new OpenAI({ baseURL, apiKey, timeout: 120_000 })
  }

  async chat(opts: {
    system: string
    messages: LLMMessage[]
    tools?: ToolDef[]
    model: string
  }): Promise<LLMResponse> {
    const messages = [{ role: 'system', content: opts.system }, ...opts.messages] as any
    const req: Record<string, unknown> = { model: opts.model, messages }
    if (opts.tools && opts.tools.length > 0) {
      req.tools = opts.tools
      req.tool_choice = 'auto'
    }
    const res = (await this.client.chat.completions.create(req as any)) as any
    const choice = res.choices?.[0]
    if (!choice) return { text: '', toolCalls: [], finishReason: 'stop' }
    const msg = choice.message
    return {
      text: msg.content ?? '',
      toolCalls: (msg.tool_calls ?? []).map((tc: any) => ({
        id: tc.id,
        function: { name: tc.function.name, arguments: tc.function.arguments }
      })),
      finishReason: choice.finish_reason ?? 'stop'
    }
  }
}

export function createLLMClient(settings: FrameySettings): LLMClient | null {
  if (!settings.apiKey) return null
  return new FireworksLLMClient(settings.baseURL, settings.apiKey)
}
