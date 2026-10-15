<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import thinkingImage from '@/assets/thinking.gif'
import type { ChatAgentLabel } from '@/utils/chat-agent-label'

const AGENT_LOGOS: Record<string, string> = {
  Hermes: '/coding-agents/hermes.png',
  Ekko: '/coding-agents/ekko-agent.png',
  Claude: '/coding-agents/claude-code.svg',
  Codex: '/coding-agents/codex-openai.png',
  Pi: '/coding-agents/pi.svg',
  Grok: '/coding-agents/grok.svg',
  OpenCode: '/coding-agents/opencode.png',
  'DeepSeek Harness': '/coding-agents/deepseek.svg',
}
const MarkdownRenderer = defineAsyncComponent(async () => (await import('./MarkdownRenderer.vue')).default)

const props = withDefaults(defineProps<{
  reasoning?: string | null
  reasoningId?: string | number | null
  elapsed: string
  agent?: ChatAgentLabel
  deploymentSessionId?: string
  /** Decode speed of the run's latest finished call, e.g. `当前速度：94 tok/s`; hidden when null. */
  speed?: string | null
  /** Run-wide average decode speed, e.g. `平均：88 tok/s`; hidden when null. */
  averageSpeed?: string | null
}>(), {
  agent: () => ({ label: 'Hermes' }),
})
const agentLogoSrc = computed(() => AGENT_LOGOS[props.agent?.label || 'Hermes'] || '/coding-agents/hermes.png')
const isEkko = computed(() => props.agent?.label === 'Ekko')

const { t } = useI18n()

const reasoningBodyRef = ref<HTMLElement | null>(null)

// 流式思考内容更新时自动滚动到底部，始终展示最新输出的部分
watch(
  () => props.reasoning,
  () => {
    nextTick(() => {
      requestAnimationFrame(() => {
        const el = reasoningBodyRef.value
        if (el) el.scrollTop = el.scrollHeight
      })
    })
  },
)
</script>

<template>
  <div class="live-reasoning-status">
    <div class="thinking-status">
      <img
        :key="isEkko ? thinkingImage : agentLogoSrc"
        :src="isEkko ? thinkingImage : agentLogoSrc"
        data-agent-deployment-image="pending"
        @load="($event.target as HTMLImageElement).dataset.agentDeploymentImage = 'ready'"
        @error="($event.target as HTMLImageElement).dataset.agentDeploymentImage = 'error'"
        alt=""
        aria-hidden="true"
        class="thinking-avatar"
        :data-agent-deployment-target="deploymentSessionId || ''"
        :class="isEkko ? 'thinking-avatar--animated' : 'thinking-avatar--logo'"
      >
      <div class="thinking-status-copy">
        <span class="thinking-status-label">{{ t('chat.thinkingInProgress') }}</span>
        <span class="thinking-status-time">{{ elapsed }}</span>
        <span v-if="speed" class="thinking-status-speed thinking-status-speed--current">{{ speed }}</span>
        <span v-if="averageSpeed" class="thinking-status-speed thinking-status-speed--average">{{ averageSpeed }}</span>
      </div>
    </div>
    <div
      v-if="reasoning"
      :key="reasoningId ?? 'live-reasoning'"
      class="live-reasoning-detail"
      :data-reasoning-id="reasoningId"
    >
      <div class="live-reasoning-label">
        <span aria-hidden="true">💭</span>
        <span>{{ t('chat.thinkingLabel') }}</span>
      </div>
      <div ref="reasoningBodyRef" class="live-reasoning-body">
        <MarkdownRenderer :content="reasoning" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.live-reasoning-status {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.thinking-status {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  min-height: 32px;
}

.thinking-avatar {
  width: 40px;
  height: 40px;
  border-radius: $radius-md;
  object-fit: cover;
  flex-shrink: 0;

  &--animated {
    .dark & {
      filter: brightness(1.18) contrast(1.08) saturate(1.08);
    }
  }
}

.thinking-avatar--logo {
  box-sizing: border-box;
  padding: 5px;
  object-fit: contain;
  background: #fff;
}

.thinking-status-copy {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  column-gap: 8px;
  row-gap: 2px;
  min-width: 0;
  min-height: 20px;
  // The copy row is the query container for the reading layout below: whether
  // both readings fit depends on the space left after the avatar, not on the
  // viewport width.
  container-type: inline-size;
  flex: 1 1 auto;
}

.thinking-status-label {
  display: inline-flex;
  align-items: center;
  color: transparent;
  background: linear-gradient(105deg, $text-secondary 0%, $text-secondary 39%, #ffffff 48%, #ffffff 52%, $text-secondary 61%, $text-secondary 100%);
  background-size: 300% 100%;
  background-position: 0% 0;
  -webkit-background-clip: text;
  background-clip: text;
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
  animation: thinking-label-shimmer 2.2s linear infinite;
  backface-visibility: hidden;
  contain: paint;
  transform: translateZ(0);
  will-change: background-position;

  .dark & {
    background: linear-gradient(105deg, #f0f0f0 0%, #f0f0f0 37%, #2f3540 47%, #2f3540 53%, #f0f0f0 63%, #f0f0f0 100%);
    background-size: 300% 100%;
    background-position: 0% 0;
    -webkit-background-clip: text;
    background-clip: text;
    filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.16));
  }
}

.thinking-status-time {
  display: inline-flex;
  align-items: center;
  margin-top: 2px;
  color: $text-muted;
  font-family: $font-code;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 20px;
  min-width: 44px;
}

.thinking-status-speed {
  display: inline-flex;
  align-items: center;
  margin-top: 2px;
  color: $text-muted;
  font-family: $font-code;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 20px;
}

// Narrow screens do not have room for the whole status row on one line. The run
// average already lands on the message's usage card once the turn settles, so
// below the width that fits all four readings the live row keeps only the current
// reading instead of stranding the average on a line of its own.
// 440px is measured against the widest realistic four-chip row across all 11
// locales (longest timer plus 4-digit readings): Russian needs 430px, French 408,
// English 386, Chinese 381. Keeping the threshold above that maximum makes the
// invariant hold for every locale — the row is either complete on one line or the
// average is dropped; it can never break with a single orphaned chip.
@container (max-width: 440px) {
  .thinking-status-speed--average {
    display: none;
  }
}

// Below ~340px even the three remaining chips cannot share one line with the
// 40px avatar; the current reading then takes its own row. A container query
// cannot reach the avatar or the copy row's own spacing (it cannot style its own
// query container), so no rule here can win that space back without shrinking
// the agent logo, which is out of scope.

.live-reasoning-detail {
  width: 520px;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 7px 10px;
  border-radius: $radius-sm;
  background: rgba(0, 0, 0, 0.025);
  color: $text-secondary;

  .dark & {
    background: rgba(255, 255, 255, 0.045);
  }
}

.live-reasoning-label {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 4px;
  color: $text-muted;
  font-size: 11px;
  font-weight: 500;
}

.live-reasoning-body {
  max-height: 220px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.55;
  opacity: 0.9;

  :deep(.markdown-body > :first-child) {
    margin-top: 0;
  }

  :deep(.markdown-body > :last-child) {
    margin-bottom: 0;
  }
}

@keyframes thinking-label-shimmer {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: 0% 0;
  }
}
</style>