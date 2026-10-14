// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import RunUsageCard from '@/components/hermes/chat/RunUsageCard.vue'
import { useSettingsStore } from '@/stores/hermes/settings'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('run usage visibility', () => {
  it('reacts to Show Cost changes without discarding the usage summary', async () => {
    setActivePinia(createPinia())
    const settings = useSettingsStore()
    const usage = { runId: 'run-1', inputTokens: 1200, outputTokens: 200, costUsd: 0.0123 }
    const wrapper = mount(RunUsageCard, { props: { usage } })

    // The fork trims the card to four metrics (see patches/29-usage-card-trim),
    // so the cost value never renders even while the Show Cost gate keeps the
    // card itself visible. The gate still hides the whole card when disabled.
    expect(wrapper.get('.run-usage-card').text()).not.toContain('$0.0123')
    expect(wrapper.get('.run-usage-card').text()).toContain('200')
    settings.updateLocal('display', { show_cost: false })
    await nextTick()
    expect(wrapper.find('.run-usage-card').exists()).toBe(false)
    expect(wrapper.props('usage')).toEqual(usage)

    settings.updateLocal('display', { show_cost: true })
    await nextTick()
    expect(wrapper.get('.run-usage-card').text()).toContain('200')
  })

  it('hides persisted summaries when the setting is disabled before mounting', () => {
    setActivePinia(createPinia())
    useSettingsStore().updateLocal('display', { show_cost: false })
    const wrapper = mount(RunUsageCard, { props: { usage: { runId: 'history-run', outputTokens: 354 } } })
    expect(wrapper.find('.run-usage-card').exists()).toBe(false)
  })
})
