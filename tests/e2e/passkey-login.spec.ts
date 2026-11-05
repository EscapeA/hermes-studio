import { test, expect, type Page } from '@playwright/test'

/**
 * Passkey (WebAuthn) login journey.
 *
 * The ceremony is mocked at the `navigator.credentials` boundary instead of using
 * a CDP virtual authenticator: these assertions are about what the login page
 * offers and which requests it makes.
 *
 * Page-side state (mock mode, request log) lives on `window` because the test body
 * runs in the Node process — a closure variable there is invisible to the page,
 * so mutating it silently does nothing.
 */
const RP_ID = 'studio.test'

const statusWithCredential = { enabled: true, hasCredentials: true }
const statusWithoutCredential = { enabled: true, hasCredentials: false }
const statusUnconfigured = { enabled: false, hasCredentials: false }

const beginResponse = {
  sessionToken: 'session-token-fixture',
  options: { challenge: 'Y2hhbGxlbmdl', rpId: RP_ID, timeout: 60000, userVerification: 'preferred' },
}

const sessionToken =
  'header.' + Buffer.from(JSON.stringify({ sub: 1, role: 'super_admin', username: 'fixture' })).toString('base64') + '.signature'

const loginResponse = {
  token: sessionToken,
  userId: 1,
  profiles: ['default'],
  theme: { preset: 'ink', mode: 'dark' },
}

async function setup(page: Page, status: typeof statusWithCredential): Promise<void> {
  // Routes go FIRST: the login view asks for the passkey status on mount, so the
  // mock must be in place before the init script runs and the page navigates.
  await page.route('**/api/auth/status', route =>
    route.fulfill({ json: { hasPasswordLogin: true, hasUsers: true } }))
  await page.route('**/api/auth/webauthn/status', route => route.fulfill({ json: status }))
  await page.route('**/api/auth/webauthn/login/begin', route => route.fulfill({ json: beginResponse }))
  await page.route('**/api/auth/webauthn/login/finish', route => route.fulfill({ json: loginResponse }))

  await page.addInitScript(() => {
    localStorage.setItem('hermes_locale', 'en')
    ;(window as any).__passkeyMode = 'success'
    ;(window as any).__passkeyRequests = []

    const bytes = (text: string) => new TextEncoder().encode(text).buffer
    const fakeCredential = {
      id: 'credential-id',
      rawId: bytes('credential-id'),
      type: 'public-key',
      authenticatorAttachment: 'platform',
      getClientExtensionResults: () => ({}),
      response: {
        clientDataJSON: bytes('{}'),
        attestationObject: bytes(''),
        authenticatorData: bytes(''),
        signature: bytes('sig'),
        userHandle: bytes('1'),
        getTransports: () => ['internal'],
      },
    }

    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {
        get: async () => {
          const mode = (window as any).__passkeyMode
          if (mode === 'cancel') {
            const error: any = new Error('The operation either timed out or was not allowed.')
            error.name = 'NotAllowedError'
            throw error
          }
          if (mode === 'unknown') {
            const error: any = new Error('An unknown error occurred while talking to the credential manager.')
            error.name = 'UnknownError'
            throw error
          }
          return fakeCredential
        },
        create: async () => fakeCredential,
      },
    })

    // Record ceremony calls from inside the page so ordering is observable.
    const originalFetch = window.fetch.bind(window)
    window.fetch = ((input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input?.url || ''
      if (url.includes('/api/auth/webauthn/')) {
        ;(window as any).__passkeyRequests.push({ url, method: init?.method || 'GET' })
      }
      return originalFetch(input, init)
    }) as typeof window.fetch
  })
}

// Serial: the suite is fullyParallel, and the login view needs ~2s to fetch the
// passkey status. Five workers racing the same dev server starve each other and
// produce flaky "element not found" failures that look like product bugs.
test.describe.configure({ mode: 'serial' })

test.describe('passkey login', () => {
  test('hides the entry when no passkey is bound on the instance', async ({ page }) => {
    await setup(page, statusWithoutCredential)
    await page.goto('/login')

    // Wait for the password form (always present), then assert the passkey entry
    // stays absent. Asserting absence immediately would only prove "not loaded yet".
    await expect(page.locator('.login-btn')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(3000)
    await expect(page.locator('.login-btn-passkey')).toHaveCount(0)
  })

  test('hides the entry when the RP is not configured', async ({ page }) => {
    await setup(page, statusUnconfigured)
    await page.goto('/login')

    await expect(page.locator('.login-btn')).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(3000)
    await expect(page.locator('.login-btn-passkey')).toHaveCount(0)
  })

  test('signs in through the ceremony and stores the session', async ({ page }) => {
    await setup(page, statusWithCredential)
    await page.goto('/login')

    const passkeyButton = page.locator('.login-btn-passkey')
    await expect(passkeyButton).toBeVisible()
    await passkeyButton.click()

    await expect.poll(() => page.evaluate(() => localStorage.getItem('hermes_api_key')))
      .toBe(sessionToken)

    // The status probe also hits /api/auth/webauthn/; only the ceremony halves
    // matter here, and they must be exactly these two, in this order.
    const calls = await page.evaluate(() => (window as any).__passkeyRequests)
    const ceremony = calls
      .map((call: any) => String(call.url).split('/api/')[1])
      .filter((path: string) => path.includes('/login/'))
    expect(ceremony).toEqual(['auth/webauthn/login/begin', 'auth/webauthn/login/finish'])
    const ceremonyCalls = calls.filter((call: any) => String(call.url).includes('/login/'))
    expect(ceremonyCalls.every((call: any) => call.method === 'POST')).toBe(true)
  })

  test('reports a cancelled ceremony without storing a session', async ({ page }) => {
    await setup(page, statusWithCredential)
    await page.goto('/login')
    const button = page.locator('.login-btn-passkey')
    await expect(button).toBeVisible({ timeout: 15000 })
    // Set the mode only after the page has settled: addInitScript re-runs on every
    // navigation and would otherwise reset this flag before the click.
    await page.evaluate(() => { (window as any).__passkeyMode = 'cancel' })
    await button.click()

    await expect(page.locator('.login-error')).toContainText(/no passkey was found/i)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('hermes_api_key'))).toBeNull()
    const calls = await page.evaluate(() => (window as any).__passkeyRequests)
    expect(calls.some((call: any) => String(call.url).includes('login/finish'))).toBe(false)
  })

  test('maps an unknown credential-manager error to a configuration hint', async ({ page }) => {
    await setup(page, statusWithCredential)
    await page.goto('/login')
    const button = page.locator('.login-btn-passkey')
    await expect(button).toBeVisible({ timeout: 15000 })
    await page.evaluate(() => { (window as any).__passkeyMode = 'unknown' })
    await button.click()

    await expect(page.locator('.login-error')).toContainText(/RP ID|domain/i)
  })
})
