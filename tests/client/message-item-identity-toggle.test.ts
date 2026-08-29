// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { DisplayConfig } from '@/api/hermes/config'

const settingsDisplay: DisplayConfig = {}

vi.mock('@/stores/hermes/settings', () => ({
  useSettingsStore: () => ({ display: settingsDisplay }),
}))

vi.mock('@/stores/hermes/profiles', () => ({
  useProfilesStore: () => ({ profiles: [], activeProfileName: 'default' }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('naive-ui', () => ({
  useMessage: () => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}))

import MessageItem from '@/components/hermes/chat/MessageItem.vue'
import type { Message } from '@/stores/hermes/chat'

function mountMessage(role: 'user' | 'assistant') {
  return mount(MessageItem, {
    props: {
      message: {
        id: `identity-${role}`,
        role,
        content: 'Hello',
        timestamp: Date.now(),
      } satisfies Message,
      assistantAgent: { label: 'Ekko', src: '/coding-agents/ekko-agent.png' },
      userProfileName: 'Researcher',
    },
    global: { stubs: { MarkdownRenderer: true } },
  })
}

describe('MessageItem chat identity toggle', () => {
  it('hides author rows and message avatars when show_session_identity is false', () => {
    settingsDisplay.show_session_identity = false
    setActivePinia(createPinia())

    const user = mountMessage('user')
    expect(user.find('.user-message-author').exists()).toBe(false)
    expect(user.find('.user-profile-avatar').exists()).toBe(false)

    const assistant = mountMessage('assistant')
    expect(assistant.find('.assistant-message-author').exists()).toBe(false)
    expect(assistant.find('.msg-avatar').exists()).toBe(false)
  })

  it('shows author rows and message avatars by default', () => {
    settingsDisplay.show_session_identity = undefined
    setActivePinia(createPinia())

    const user = mountMessage('user')
    expect(user.find('.user-message-author').exists()).toBe(true)

    const assistant = mountMessage('assistant')
    expect(assistant.find('.assistant-message-author').exists()).toBe(true)
    expect(assistant.find('.msg-avatar').exists()).toBe(true)
  })
})
