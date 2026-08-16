import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'

describe('Pi chat identity', () => {
  it('uses profile avatar for regular sessions and Agent avatar for coding-agent sessions', () => {
    const source = readFileSync('packages/client/src/components/hermes/chat/MessageItem.vue', 'utf8')

    expect(source).toContain("v-if=\"message.role === 'assistant' && !isCodingAgentSession\"")
    // Regular Hermes sessions fall back to the profile avatar (uploaded/generated).
    expect(source).toContain('assistantProfileName')
    expect(source).toContain('assistantProfileAvatar')
    expect(source).toContain('!isCodingAgentSession')
    // Coding-agent sessions keep the runtime agent icon.
    expect(source).toContain(':src="assistantAgent.src"')
    expect(source).toContain(':alt="assistantAgent.label"')
    expect(source).toMatch(/\.msg-avatar\s*\{[^}]*object-fit: cover;/s)
    expect(source).toMatch(/\.msg-avatar\s*\{[^}]*border: 1px solid #fff;/s)
    expect(source).not.toMatch(/\.msg-avatar\s*\{[^}]*padding:/s)
    expect(source).not.toMatch(/\.msg-avatar\s*\{[^}]*background:/s)
  })

  it('uses the Pi logo in empty state and completion notifications', () => {
    const avatarHelper = readFileSync('packages/client/src/utils/chat-agent-avatar.ts', 'utf8')
    const chatStore = readFileSync('packages/client/src/stores/hermes/chat.ts', 'utf8')

    expect(avatarHelper).toContain("pi: { label: 'Pi', src: '/coding-agents/pi.svg' }")
    expect(chatStore).toContain("if (codingAgentId === 'pi')")
    expect(chatStore).toContain("return { icon: '/coding-agents/pi.svg' }")
  })
})
