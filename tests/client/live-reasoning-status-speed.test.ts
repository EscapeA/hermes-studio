// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}))

import LiveReasoningStatus from '@/components/hermes/chat/LiveReasoningStatus.vue'

describe('LiveReasoningStatus decode speed', () => {
  it('shows the current reading beside the run-wide average', () => {
    const wrapper = mount(LiveReasoningStatus, {
      props: {
        elapsed: '12s',
        speed: '当前：94 tok/s',
        averageSpeed: '平均：88 tok/s',
      },
    })

    expect(wrapper.findAll('.thinking-status-speed').map(node => node.text())).toEqual([
      '当前：94 tok/s',
      '平均：88 tok/s',
    ])
  })

  it('shows whichever reading the server has measured so far', () => {
    const averageOnly = mount(LiveReasoningStatus, {
      props: { elapsed: '12s', averageSpeed: '平均：88 tok/s' },
    })
    expect(averageOnly.findAll('.thinking-status-speed').map(node => node.text())).toEqual(['平均：88 tok/s'])

    // First call of the run still streaming: no reading to show yet.
    const none = mount(LiveReasoningStatus, { props: { elapsed: '2s' } })
    expect(none.findAll('.thinking-status-speed')).toHaveLength(0)
  })
})
