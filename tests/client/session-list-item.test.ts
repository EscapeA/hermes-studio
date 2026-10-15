// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import SessionListItem from '@/components/hermes/chat/SessionListItem.vue'

vi.mock('@/stores/hermes/app', () => ({
  useAppStore: () => ({
    profileModelGroups: [],
  }),
}))

vi.mock('@/stores/hermes/profiles', () => ({
  useProfilesStore: () => ({ profiles: [] }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/shared/session-display', () => ({
  formatTimestampMs: () => 'now',
}))

vi.mock('naive-ui', () => ({
  NPopconfirm: defineComponent({
    name: 'NPopconfirm',
    emits: ['positive-click'],
    template: '<span><slot name="trigger" /><slot /></span>',
  }),
  NCheckbox: defineComponent({
    name: 'NCheckbox',
    props: ['checked'],
    emits: ['click'],
    template: '<input type="checkbox" :checked="checked" @click="$emit(\'click\')" />',
  }),
  NTooltip: defineComponent({
    name: 'NTooltip',
    template: '<span><slot name="trigger" /><slot /></span>',
  }),
}))

const session = {
  id: 's1',
  title: 'Session One',
  model: 'gpt-test',
  provider: 'openai',
  createdAt: Date.now(),
  profile: 'kira',
}

describe('SessionListItem', () => {

  it('renders normal mode as a link to the session route', () => {
    const wrapper = mount(SessionListItem, {
      props: {
        session,
        active: false,
        pinned: false,
        canDelete: true,
        to: '/session/s1',
      },
    })

    const link = wrapper.get('a.session-item')
    expect(link.attributes('href')).toBe('/session/s1')
    expect(wrapper.find('button.session-item').exists()).toBe(false)
  })

  it('renders selectable mode as a button and does not expose row href', () => {
    const wrapper = mount(SessionListItem, {
      props: {
        session,
        active: false,
        pinned: false,
        canDelete: true,
        selectable: true,
        selected: false,
        to: '/session/s1',
      },
    })

    expect(wrapper.find('button.session-item').exists()).toBe(true)
    expect(wrapper.find('a.session-item').exists()).toBe(false)
  })

  it('renders a plain text category tag only when a category label is provided', async () => {
    const wrapper = mount(SessionListItem, {
      props: {
        session,
        active: false,
        pinned: false,
        canDelete: true,
        categoryLabel: 'Work - Mobile',
      },
    })

    const tag = wrapper.get('.session-item-category-tag')
    expect(tag.text()).toBe('Work - Mobile')
    expect(tag.attributes('title')).toBe('Work - Mobile')
    expect(tag.element.tagName).toBe('SPAN')

    await wrapper.setProps({ categoryLabel: undefined })
    expect(wrapper.find('.session-item-category-tag').exists()).toBe(false)
  })

  it('does not select the row when clicking nested action controls', async () => {
    const wrapper = mount(SessionListItem, {
      props: {
        session,
        active: false,
        pinned: false,
        canDelete: true,
        to: '/session/s1',
      },
    })

    await wrapper.get('button.session-item-delete').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('does not hijack modified clicks on normal links', async () => {
    const wrapper = mount(SessionListItem, {
      props: {
        session,
        active: false,
        pinned: false,
        canDelete: true,
        to: '/session/s1',
      },
    })

    const link = wrapper.get('a.session-item')
    link.element.addEventListener('click', event => event.preventDefault())
    await link.trigger('click', { ctrlKey: true })
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.emitted('open-new')).toBeUndefined()
  })

  it('shows the live-status indicator when streaming', () => {
    const wrapper = mount(SessionListItem, {
      props: {
        session: { ...session, source: 'cli', agent: 'hermes' },
        active: false,
        pinned: false,
        canDelete: true,
        streaming: true,
      },
    })

    const dot = wrapper.get('.session-item-live-dot')
    expect(dot.attributes('title')).toBe('chat.sessionLive')
  })

  it('does not show the live-status indicator when not streaming', () => {
    const wrapper = mount(SessionListItem, {
      props: {
        session: { ...session, source: 'cli', agent: 'hermes' },
        active: false,
        pinned: false,
        canDelete: true,
        streaming: false,
      },
    })

    expect(wrapper.find('.session-item-live-dot').exists()).toBe(false)
  })

})
