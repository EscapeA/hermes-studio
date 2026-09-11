// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}))

vi.mock('naive-ui', () => ({
  NButton: { template: '<button><slot /></button>' },
  NDrawer: { template: '<div><slot /></div>' },
  NDrawerContent: { template: '<div><slot /></div>' },
  NSpin: { template: '<div />' },
  useMessage: () => ({
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}))

import MessageItem from '@/components/hermes/chat/MessageItem.vue'
import type { Message } from '@/stores/hermes/chat'

function assistantMessage(runSpeed?: Message['runSpeed']): Message {
  return {
    id: 'm1',
    role: 'assistant',
    content: 'done',
    timestamp: Date.now(),
    runSpeed,
  }
}

describe('MessageItem turn decode speed', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the turn speed under the assistant message', () => {
    const wrapper = mount(MessageItem, {
      props: { message: assistantMessage({ tokens: 630, elapsedMs: 4_033 }), profile: 'default' },
    })

    const line = wrapper.find('.assistant-run-speed')
    expect(line.exists()).toBe(true)
    // 630 tokens over 4033ms -> 156.2 tok/s, rounded to a whole number from ten
    // up; the i18n mock renders `key:params`, so both are asserted here.
    expect(line.text()).toContain('chat.turnAverageSpeed')
    expect(line.text()).toContain('"tps":"156"')
  })

  it('renders nothing when the server measured no call', () => {
    const wrapper = mount(MessageItem, {
      props: { message: assistantMessage(), profile: 'default' },
    })

    expect(wrapper.find('.assistant-run-speed').exists()).toBe(false)
  })

  it('renders nothing for a user message', () => {
    const message: Message = {
      id: 'm2',
      role: 'user',
      content: 'hi',
      timestamp: Date.now(),
      runSpeed: { tokens: 630, elapsedMs: 4_033 },
    }
    const wrapper = mount(MessageItem, { props: { message, profile: 'default' } })

    expect(wrapper.find('.assistant-run-speed').exists()).toBe(false)
  })
})
