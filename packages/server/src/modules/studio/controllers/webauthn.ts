import type { Context } from 'koa'
import {
  beginLogin,
  beginRegistration,
  countUserCredentials,
  deleteCredentialView,
  describeRpConfig,
  finishLogin,
  finishRegistration,
  hasAnyCredential,
  listCredentialViews,
  publicStatus,
  WebAuthnConfigError,
  WebAuthnConflictError,
  WebAuthnSessionError,
  WebAuthnVerificationError,
  writeRpConfig,
} from '../public/webauthn'
import { checkPassword, extractIp } from '../services/auth/login-limiter'
import { getUserTheme, toUserThemePayload } from '../services/theme/user-theme'
import { issueUserJwt } from '../public/auth'
import { listUserProfiles, touchUserLogin, type UserRecord } from '../public/users'
import { listProfileNamesFromDisk } from '../public/profile-config'

/**
 * Map service-level failures onto HTTP statuses.
 *
 * 400 = the caller's configuration or session is wrong (retryable by fixing input
 * or starting over). 409 = this authenticator is already bound. Anything else is
 * an authentication rejection.
 */
function sendWebAuthnError(ctx: Context, error: unknown): void {
  const message = String((error as Error)?.message || error || 'Passkey authentication failed')
  if (error instanceof WebAuthnConfigError) {
    ctx.status = 400
    ctx.body = { error: message, code: 'webauthn_not_configured' }
    return
  }
  if (error instanceof WebAuthnSessionError) {
    ctx.status = 400
    ctx.body = { error: message, code: 'webauthn_session_expired' }
    return
  }
  if (error instanceof WebAuthnConflictError) {
    ctx.status = 409
    ctx.body = { error: message, code: 'webauthn_credential_exists' }
    return
  }
  if (error instanceof WebAuthnVerificationError) {
    ctx.status = 401
    ctx.body = { error: message, code: 'webauthn_rejected' }
    return
  }
  ctx.status = 500
  ctx.body = { error: message }
}

function accessibleProfileNames(user: UserRecord): string[] {
  if (user.role === 'super_admin') return listProfileNamesFromDisk()
  return listUserProfiles(user.id).map(profile => profile.profile_name)
}

/**
 * GET /api/auth/webauthn/status
 * Public capability probe used by the login page to decide whether to offer the
 * passkey button at all. Reveals no per-user information.
 */
export async function webauthnStatus(ctx: Context) {
  ctx.body = publicStatus()
}

/**
 * POST /api/auth/webauthn/login/begin
 * Public. Rate limited. Returns the assertion options plus a single-use session token.
 */
export async function webauthnLoginBegin(ctx: Context) {
  const ip = extractIp(ctx)
  const limit = checkPassword(ip)
  if (!limit.allowed) {
    ctx.status = limit.status
    ctx.body = { error: 'Too many login attempts, please try again later' }
    return
  }
  try {
    const result = await beginLogin()
    ctx.body = { sessionToken: result.sessionToken, options: result.options }
  } catch (error) {
    sendWebAuthnError(ctx, error)
  }
}

/**
 * POST /api/auth/webauthn/login/finish
 * Public. Rate limited. Returns the SAME payload shape as password login so the
 * client can share one session-bootstrap path.
 */
export async function webauthnLoginFinish(ctx: Context) {
  const body = ctx.request.body as { sessionToken?: unknown; response?: unknown } | undefined
  const sessionToken = typeof body?.sessionToken === 'string' ? body.sessionToken : ''
  if (!sessionToken || !body?.response || typeof body.response !== 'object') {
    ctx.status = 400
    ctx.body = { error: 'sessionToken and response are required' }
    return
  }
  const ip = extractIp(ctx)
  const limit = checkPassword(ip)
  if (!limit.allowed) {
    ctx.status = limit.status
    ctx.body = { error: 'Too many login attempts, please try again later' }
    return
  }

  try {
    const user = await finishLogin({
      sessionToken,
      response: body.response as never,
    })
    touchUserLogin(user.id)
    ctx.body = {
      token: await issueUserJwt(user),
      userId: user.id,
      profiles: accessibleProfileNames(user),
      theme: toUserThemePayload(getUserTheme(user.id)),
    }
  } catch (error) {
    sendWebAuthnError(ctx, error)
  }
}

/**
 * POST /api/auth/webauthn/register/begin
 * Authenticated. Starts binding a new authenticator to the current account.
 */
export async function webauthnRegisterBegin(ctx: Context) {
  const userId = ctx.state.user?.id
  if (!userId) {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
    return
  }
  try {
    const result = await beginRegistration(userId)
    ctx.body = { sessionToken: result.sessionToken, options: result.options }
  } catch (error) {
    sendWebAuthnError(ctx, error)
  }
}

/**
 * POST /api/auth/webauthn/register/finish
 * Authenticated. Verifies the attestation and stores the credential.
 */
export async function webauthnRegisterFinish(ctx: Context) {
  const userId = ctx.state.user?.id
  if (!userId) {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
    return
  }
  const body = ctx.request.body as { sessionToken?: unknown; response?: unknown; name?: unknown } | undefined
  const sessionToken = typeof body?.sessionToken === 'string' ? body.sessionToken : ''
  if (!sessionToken || !body?.response || typeof body.response !== 'object') {
    ctx.status = 400
    ctx.body = { error: 'sessionToken and response are required' }
    return
  }
  try {
    const credential = await finishRegistration({
      userId,
      sessionToken,
      response: body.response as never,
      name: typeof body.name === 'string' ? body.name : '',
    })
    ctx.body = { credential }
  } catch (error) {
    sendWebAuthnError(ctx, error)
  }
}

/**
 * GET /api/auth/webauthn/credentials
 * Authenticated. Lists only the caller's own credentials.
 */
export async function webauthnListCredentials(ctx: Context) {
  const userId = ctx.state.user?.id
  if (!userId) {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
    return
  }
  ctx.body = { credentials: listCredentialViews(userId) }
}

/**
 * DELETE /api/auth/webauthn/credentials/:id
 * Authenticated. Scoped to the caller so one account cannot delete another's passkey.
 */
export async function webauthnDeleteCredential(ctx: Context) {
  const userId = ctx.state.user?.id
  if (!userId) {
    ctx.status = 401
    ctx.body = { error: 'Unauthorized' }
    return
  }
  const id = Number(ctx.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    ctx.status = 400
    ctx.body = { error: 'Invalid credential id' }
    return
  }
  if (!deleteCredentialView(userId, id)) {
    ctx.status = 404
    ctx.body = { error: 'Credential not found' }
    return
  }
  ctx.body = { success: true }
}

/**
 * GET /api/auth/webauthn/config
 * Super-admin only. Reports the effective RP configuration.
 */
export async function webauthnGetConfig(ctx: Context) {
  ctx.body = describeRpConfig()
}

/**
 * PUT /api/auth/webauthn/config
 * Super-admin only. Applies new RP settings immediately (no restart).
 */
export async function webauthnUpdateConfig(ctx: Context) {
  const body = ctx.request.body as { rpID?: unknown; rpName?: unknown; origins?: unknown } | undefined
  try {
    const config = writeRpConfig({
      rpID: typeof body?.rpID === 'string' ? body.rpID : '',
      rpName: typeof body?.rpName === 'string' ? body.rpName : '',
      origins: Array.isArray(body?.origins)
        ? body.origins.filter((value): value is string => typeof value === 'string')
        : typeof body?.origins === 'string' ? body.origins : '',
    })
    ctx.body = { ...config, credentialsBound: hasAnyCredential() }
  } catch (error) {
    sendWebAuthnError(ctx, error)
  }
}
