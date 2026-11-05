<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NInput, NPopconfirm, useMessage } from 'naive-ui'
import {
  canAttemptWebAuthn,
  deletePasskey,
  fetchWebAuthnConfig,
  listPasskeys,
  registerPasskey,
  updateWebAuthnConfig,
  type WebAuthnCredentialView,
  type WebAuthnRpConfig,
} from '@/api/studio/webauthn'
import { isStoredSuperAdmin } from '@/api/client'

const { t } = useI18n()
const message = useMessage()

const supported = ref(true)
const credentials = ref<WebAuthnCredentialView[]>([])
const loadingCredentials = ref(false)
const registering = ref(false)
const credentialName = ref('')

const isSuperAdmin = computed(() => isStoredSuperAdmin())
const rpConfig = ref<WebAuthnRpConfig | null>(null)
const rpForm = ref({ rpID: '', rpName: '', origins: '' })
const savingRp = ref(false)

/**
 * Translate the sentinel error codes raised by the API layer. Anything else is
 * already a human-readable server message, so it passes through unchanged.
 */
function describeError(error: unknown): string {
  const code = String((error as Error)?.message || error || '')
  switch (code) {
    case 'PASSKEY_UNSUPPORTED': return t('settings.passkey.errors.unsupported')
    case 'PASSKEY_INSECURE_CONTEXT': return t('settings.passkey.errors.insecure')
    case 'PASSKEY_RP_MISMATCH': return t('settings.passkey.errors.rpMismatch')
    case 'PASSKEY_ALREADY_REGISTERED': return t('settings.passkey.errors.alreadyRegistered')
    case 'PASSKEY_CANCELLED': return t('settings.passkey.errors.cancelled')
    default: return code || t('settings.passkey.errors.failed')
  }
}

function formatTime(at: number | null): string {
  if (!at) return t('settings.passkey.neverUsed')
  return new Date(at).toLocaleString()
}

async function loadCredentials() {
  loadingCredentials.value = true
  try {
    credentials.value = await listPasskeys()
  } catch (error) {
    // A disabled passkey backend must not make the whole settings page fail.
    credentials.value = []
  } finally {
    loadingCredentials.value = false
  }
}

async function loadRpConfig() {
  if (!isSuperAdmin.value) return
  try {
    const config = await fetchWebAuthnConfig()
    rpConfig.value = config
    rpForm.value = {
      rpID: config.rpID,
      rpName: config.rpName,
      origins: config.origins.join(', '),
    }
  } catch {
    rpConfig.value = null
  }
}

/**
 * Suggest the current address as the RP configuration. WebAuthn requires the RP
 * ID to be the page's domain or a parent of it, and the origin to match exactly,
 * so deriving both from window.location removes the most common setup mistake.
 */
function useCurrentAddress() {
  if (typeof window === 'undefined') return
  rpForm.value.rpID = window.location.hostname
  rpForm.value.origins = window.location.origin
}

async function saveRpConfig() {
  savingRp.value = true
  try {
    const origins = rpForm.value.origins
      .split(/[\s,]+/)
      .map(value => value.trim())
      .filter(Boolean)
    const config = await updateWebAuthnConfig({
      rpID: rpForm.value.rpID.trim(),
      rpName: rpForm.value.rpName.trim(),
      origins,
    })
    rpConfig.value = { ...config, configured: true, credentialsBound: config.credentialsBound }
    message.success(t('settings.passkey.rpSaved'))
  } catch (error) {
    message.error(describeError(error))
  } finally {
    savingRp.value = false
  }
}

async function handleRegister() {
  registering.value = true
  try {
    await registerPasskey(credentialName.value.trim(), rpConfig.value?.rpID || undefined)
    credentialName.value = ''
    await loadCredentials()
    message.success(t('settings.passkey.added'))
  } catch (error) {
    message.error(describeError(error))
  } finally {
    registering.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await deletePasskey(id)
    await loadCredentials()
    message.success(t('settings.passkey.removed'))
  } catch (error) {
    message.error(describeError(error))
  }
}

onMounted(async () => {
  supported.value = canAttemptWebAuthn()
  await Promise.all([loadCredentials(), loadRpConfig()])
})
</script>

<template>
  <div class="passkey-section">
    <h3 class="section-title">{{ t('settings.passkey.title') }}</h3>
    <p class="passkey-desc">{{ t('settings.passkey.description') }}</p>

    <!-- The password form remains the primary path; this is purely additive. -->
    <div class="passkey-add-row">
      <NInput
        v-model:value="credentialName"
        :placeholder="t('settings.passkey.namePlaceholder')"
        :disabled="registering || !supported"
        @keyup.enter="handleRegister"
      />
      <NButton
        type="primary"
        :loading="registering"
        :disabled="!supported"
        @click="handleRegister"
      >
        {{ t('settings.passkey.add') }}
      </NButton>
    </div>
    <p v-if="!supported" class="passkey-warning">{{ t('settings.passkey.errors.insecure') }}</p>

    <div v-if="credentials.length > 0" class="passkey-list">
      <div v-for="item in credentials" :key="item.id" class="passkey-item">
        <div class="passkey-item-info">
          <span class="passkey-item-name">{{ item.name || t('settings.passkey.unnamed') }}</span>
          <span class="passkey-item-meta">
            {{ t('settings.passkey.addedAt', { time: new Date(item.created_at).toLocaleString() }) }}
            · {{ t('settings.passkey.lastUsed', { time: formatTime(item.last_used_at) }) }}
          </span>
        </div>
        <NPopconfirm @positive-click="handleDelete(item.id)">
          <template #trigger>
            <NButton size="tiny" type="error" ghost>{{ t('settings.passkey.remove') }}</NButton>
          </template>
          {{ t('settings.passkey.removeConfirm') }}
        </NPopconfirm>
      </div>
    </div>
    <p v-else-if="!loadingCredentials" class="passkey-empty">{{ t('settings.passkey.empty') }}</p>

    <!-- Instance-wide RP configuration. Only super administrators may see it, and
         the server enforces the same rule on the endpoint. -->
    <div v-if="isSuperAdmin" class="passkey-rp">
      <h4 class="passkey-rp-title">{{ t('settings.passkey.rpTitle') }}</h4>
      <p class="passkey-rp-desc">{{ t('settings.passkey.rpDescription') }}</p>
      <div class="passkey-rp-field">
        <span class="passkey-rp-label">{{ t('settings.passkey.rpId') }}</span>
        <NInput v-model:value="rpForm.rpID" placeholder="example.com" />
      </div>
      <div class="passkey-rp-field">
        <span class="passkey-rp-label">{{ t('settings.passkey.rpName') }}</span>
        <NInput v-model:value="rpForm.rpName" placeholder="Ekko Studio" />
      </div>
      <div class="passkey-rp-field">
        <span class="passkey-rp-label">{{ t('settings.passkey.origins') }}</span>
        <NInput
          v-model:value="rpForm.origins"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          placeholder="https://example.com"
        />
      </div>
      <div class="passkey-rp-actions">
        <NButton size="small" @click="useCurrentAddress">{{ t('settings.passkey.useCurrentAddress') }}</NButton>
        <NButton size="small" type="primary" :loading="savingRp" @click="saveRpConfig">
          {{ t('settings.passkey.saveRp') }}
        </NButton>
      </div>
      <p v-if="rpConfig?.error" class="passkey-warning">{{ rpConfig.error }}</p>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.passkey-section {
  margin-top: 8px;
}

.passkey-desc {
  margin: 0 0 12px;
  color: $text-muted;
  font-size: calc(var(--font-size-base, 14px) * 13 / 14);
  line-height: var(--line-height, 1.6);
}

.passkey-add-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.passkey-warning {
  margin: 8px 0 0;
  color: $error;
  font-size: calc(var(--font-size-base, 14px) * 12 / 14);
}

.passkey-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.passkey-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: var(--border-width, 1px) solid $border-color;
  border-radius: $radius-sm;
}

.passkey-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.passkey-item-name {
  color: $text-primary;
  font-size: calc(var(--font-size-base, 14px) * 14 / 14);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.passkey-item-meta {
  color: $text-muted;
  font-size: calc(var(--font-size-base, 14px) * 12 / 14);
}

.passkey-empty {
  margin: 12px 0 0;
  color: $text-muted;
  font-size: calc(var(--font-size-base, 14px) * 13 / 14);
}

.passkey-rp {
  margin-top: 24px;
  padding-top: 16px;
  border-top: var(--border-width, 1px) solid $border-color;
}

.passkey-rp-title {
  margin: 0 0 6px;
  color: $text-primary;
  font-size: calc(var(--font-size-base, 14px) * 14 / 14);
  font-weight: 600;
}

.passkey-rp-desc {
  margin: 0 0 12px;
  color: $text-muted;
  font-size: calc(var(--font-size-base, 14px) * 12 / 14);
  line-height: var(--line-height, 1.6);
}

.passkey-rp-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.passkey-rp-label {
  color: $text-secondary;
  font-size: calc(var(--font-size-base, 14px) * 12 / 14);
}

.passkey-rp-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
