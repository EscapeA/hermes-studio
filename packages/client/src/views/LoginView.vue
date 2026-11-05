<script setup lang="ts">
import { deploymentUrl } from '@/utils/deployment-url'
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { setApiKey, clearApiKey, hasApiKey } from "@/api/client";
import { fetchAuthStatus, loginWithPassword } from "@/api/studio/auth";
import {
  canAttemptWebAuthn,
  fetchWebAuthnStatus,
  loginWithPasskey,
} from "@/api/studio/webauthn";
import { desktopBridge, isDesktopShell } from "@/utils/desktop-bridge";
import { resolveLoginRedirect } from "@/utils/login-redirect";
import { useTheme } from "@/composables/useTheme";

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const { activateUserTheme } = useTheme();

const username = ref("");
const password = ref("");
const loading = ref(false);
const errorMsg = ref("");
const showLockResetHint = ref(false);
const desktopShell = isDesktopShell() && desktopBridge()?.remoteMode !== true;
// Passkeys are opt-in per instance (RP configured) and per instance-wide binding
// (someone has bound one). Hide the entry rather than showing a dead button.
const passkeyAvailable = ref(false);
const passkeyLoading = ref(false);

if (desktopShell) {
  // Desktop login is a recovery path. Drop stale JWTs before any background
  // request can reuse them and show an unrelated expiry notice.
  clearApiKey();
} else if (hasApiKey()) {
  router.replace(resolveLoginRedirect(route.query.redirect));
}

onMounted(async () => {
  try {
    await fetchAuthStatus();
  } catch {
    // Login remains available; the submit request will surface connection errors.
  }
  // A ceremony over plain http:// throws an unreadable SecurityError, so require a
  // secure context before offering the button at all.
  if (!canAttemptWebAuthn()) return;
  try {
    const status = await fetchWebAuthnStatus();
    passkeyAvailable.value = status.enabled && status.hasCredentials;
  } catch {
    passkeyAvailable.value = false;
  }
});

/** Shared error mapping for both password and passkey submissions. */
function applyLoginError(err: any) {
  const code = String(err?.message || "");
  if (err?.status === 429 || err?.status === 503) {
    errorMsg.value = t("login.tooManyAttempts");
    showLockResetHint.value = true;
    return;
  }
  if (code === "PASSKEY_CANCELLED") {
    errorMsg.value = t("login.passkeyCancelled");
    return;
  }
  if (code === "PASSKEY_UNSUPPORTED" || code === "PASSKEY_INSECURE_CONTEXT") {
    errorMsg.value = t("login.passkeyUnavailable");
    return;
  }
  if (code === "PASSKEY_RP_MISMATCH") {
    errorMsg.value = t("login.passkeyRpMismatch");
    return;
  }
  errorMsg.value = err?.message || t("login.invalidCredentials");
}

async function handlePasskeyLogin() {
  loading.value = false;
  passkeyLoading.value = true;
  errorMsg.value = "";
  showLockResetHint.value = false;
  try {
    const session = await loginWithPasskey();
    setApiKey(session.token);
    activateUserTheme(session.userId, session.theme);
    router.replace(resolveLoginRedirect(route.query.redirect));
  } catch (err: any) {
    applyLoginError(err);
  } finally {
    passkeyLoading.value = false;
  }
}

async function handleLogin() {
  await handlePasswordLogin();
}

async function handlePasswordLogin() {
  if (!username.value.trim() || !password.value) {
    errorMsg.value = t("login.credentialsRequired");
    return;
  }

  loading.value = true;
  errorMsg.value = "";
  showLockResetHint.value = false;

  try {
    const session = await loginWithPassword(username.value.trim(), password.value);
    setApiKey(session.token);
    activateUserTheme(session.userId, session.theme);
    router.replace(resolveLoginRedirect(route.query.redirect));
  } catch (err: any) {
    applyLoginError(err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-view">
    <div class="login-card">
      <div class="login-logo">
        <img :src="deploymentUrl('/logo.png')" alt="Hermes Studio" width="80" height="80" />
      </div>
      <h1 class="login-title">{{ t("login.title") }}</h1>
      <p class="login-desc">{{ t("login.description") }}</p>
      <p class="login-default-hint">{{ t("login.defaultCredentialsHint") }}</p>

      <form class="login-form" @submit.prevent="handleLogin">
        <input
          v-model="username"
          type="text"
          class="login-input"
          :placeholder="t('login.usernamePlaceholder')"
          autofocus
        />
        <input
          v-model="password"
          type="password"
          class="login-input"
          :placeholder="t('login.passwordPlaceholder')"
          @keyup.enter="handleLogin"
        />

        <div v-if="errorMsg" class="login-error">{{ errorMsg }}</div>
        <div v-if="showLockResetHint" class="login-lock-hint">
          <template v-if="desktopShell">
            <span>{{ t("login.desktopLockResetHint") }}</span>
          </template>
          <template v-else>
            <span>{{ t("login.lockResetHint") }}</span>
            <code>hermes-web-ui clear-login-locks --restart</code>
            <span>{{ t("login.defaultLoginResetHint") }}</span>
            <code>hermes-web-ui reset-default-login</code>
          </template>
        </div>
        <button type="submit" class="login-btn" :disabled="loading || passkeyLoading">
          {{ loading ? "..." : t("login.submit") }}
        </button>
      </form>

      <template v-if="passkeyAvailable">
        <div class="login-divider"><span>{{ t("login.passkeyOr") }}</span></div>
        <button
          type="button"
          class="login-btn login-btn-passkey"
          :disabled="passkeyLoading || loading"
          @click="handlePasskeyLogin"
        >
          <svg class="login-passkey-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6" />
            <path d="M3.4 20c0-3.4 2.5-5.6 5.6-5.6 1.4 0 2.6.4 3.5 1.2" fill="none"
              stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            <circle cx="17" cy="13" r="2.4" fill="none" stroke="currentColor" stroke-width="1.6" />
            <path d="M17 15.4V21M17 18.4h2.2" fill="none" stroke="currentColor" stroke-width="1.6"
              stroke-linecap="round" />
          </svg>
          <span>{{ passkeyLoading ? "..." : t("login.passkeySubmit") }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.login-view {
  height: calc(100 * var(--vh));
  display: flex;
  align-items: center;
  justify-content: center;
  background: $bg-primary;
}

.login-card {
  width: 480px;
  max-width: calc(100vw - 32px);
  padding: 56px;
  border: var(--border-width, 1px) solid $border-color;
  border-radius: $radius-lg;
  background: var(--theme-card-bg, $bg-card);
  text-align: center;

  @media (max-width: $breakpoint-mobile) {
    padding: calc(32px * var(--spacing-scale, 1)) calc(24px * var(--spacing-scale, 1));
  }
}

.login-logo {
  margin-bottom: 24px;

  img {
    border-radius: 25%;
  }
}

.login-title {
  font-size: calc(var(--font-size-base, 14px) * 26 / 14);
  font-weight: 600;
  color: $text-primary;
  margin: 0 0 10px;
}

.login-desc {
  font-size: calc(var(--font-size-base, 14px) * 14 / 14);
  color: $text-muted;
  margin: 0 0 12px;
  line-height: var(--line-height, 1.6);
}

.login-default-hint {
  margin: 0 0 28px;
  font-family: var(--font-code, $font-code);
  font-size: calc(var(--font-size-base, 14px) * 13 / 14);
  color: $text-secondary;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: calc(14px * var(--spacing-scale, 1));
}

.login-input {
  width: 100%;
  padding: calc(14px * var(--spacing-scale, 1)) calc(16px * var(--spacing-scale, 1));
  border: var(--border-width, 1px) solid $border-color;
  border-radius: $radius-sm;
  font-size: calc(var(--font-size-base, 14px) * 15 / 14);
  color: $text-primary;
  background: var(--theme-input-bg, $bg-input);
  outline: none;
  transition: border-color $transition-fast;
  box-sizing: border-box;
  font-family: var(--font-code, $font-code);

  &::placeholder {
    color: $text-muted;
  }

  &:focus {
    border-color: $accent-primary;
  }
}

.login-error {
  font-size: calc(var(--font-size-base, 14px) * 13 / 14);
  color: $error;
  text-align: start;
}

.login-lock-hint {
  padding: calc(10px * var(--spacing-scale, 1)) calc(12px * var(--spacing-scale, 1));
  border: var(--border-width, 1px) solid rgba(var(--warning-rgb), 0.35);
  border-radius: $radius-sm;
  background: rgba(var(--warning-rgb), 0.08);
  color: $text-secondary;
  font-size: calc(var(--font-size-base, 14px) * 12 / 14);
  line-height: var(--line-height, 1.5);
  text-align: start;

  code {
    display: block;
    margin-top: 4px;
    color: $text-primary;
    font-family: var(--font-code, $font-code);
    word-break: break-all;
  }
}

.login-btn {
  width: 100%;
  padding: calc(14px * var(--spacing-scale, 1));
  border: none;
  border-radius: $radius-sm;
  background: $text-primary;
  color: var(--text-on-accent);
  font-size: calc(var(--font-size-base, 14px) * 15 / 14);
  font-weight: 500;
  cursor: pointer;
  transition: opacity $transition-fast;

  &:hover {
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// Passkey entry sits below the password form as a secondary path: outlined
// instead of filled so the primary action stays the password submit.
.login-divider {
  display: flex;
  align-items: center;
  gap: calc(10px * var(--spacing-scale, 1));
  margin: calc(18px * var(--spacing-scale, 1)) 0;
  color: $text-muted;
  font-size: calc(var(--font-size-base, 14px) * 12 / 14);

  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: $border-color;
  }
}

.login-btn-passkey {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: calc(8px * var(--spacing-scale, 1));
  background: transparent;
  border: var(--border-width, 1px) solid $border-color;
  color: $text-primary;

  &:hover {
    opacity: 1;
    border-color: $accent-primary;
  }
}

.login-passkey-icon {
  flex: 0 0 auto;
}
</style>
