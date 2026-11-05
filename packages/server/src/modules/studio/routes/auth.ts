import Router from '@koa/router'
import * as ctrl from '../controllers/auth'
import * as webauthnCtrl from '../controllers/webauthn'
import { requireSuperAdmin } from '../middleware/auth'

// Public routes (no auth required)
export const authPublicRoutes = new Router()
authPublicRoutes.get('/api/auth/status', ctrl.authStatus)
authPublicRoutes.post('/api/auth/login', ctrl.login)
authPublicRoutes.post('/api/auth/app-login', ctrl.appLogin)
authPublicRoutes.post('/api/auth/mcu-login', ctrl.microcontrollerLogin)

// Passkey (WebAuthn) public entry points. These stay separate from the password
// routes so disabling passkeys never touches the password login path.
authPublicRoutes.get('/api/auth/webauthn/status', webauthnCtrl.webauthnStatus)
authPublicRoutes.post('/api/auth/webauthn/login/begin', webauthnCtrl.webauthnLoginBegin)
authPublicRoutes.post('/api/auth/webauthn/login/finish', webauthnCtrl.webauthnLoginFinish)

// Protected routes (auth required)
export const authProtectedRoutes = new Router()
authProtectedRoutes.post('/api/auth/setup', ctrl.setupPassword)

// Passkey credential management for the signed-in account.
authProtectedRoutes.post('/api/auth/webauthn/register/begin', webauthnCtrl.webauthnRegisterBegin)
authProtectedRoutes.post('/api/auth/webauthn/register/finish', webauthnCtrl.webauthnRegisterFinish)
authProtectedRoutes.get('/api/auth/webauthn/credentials', webauthnCtrl.webauthnListCredentials)
authProtectedRoutes.delete('/api/auth/webauthn/credentials/:id', webauthnCtrl.webauthnDeleteCredential)

// Passkey RP configuration — instance-wide, so super-admin only.
authProtectedRoutes.get('/api/auth/webauthn/config', requireSuperAdmin, webauthnCtrl.webauthnGetConfig)
authProtectedRoutes.put('/api/auth/webauthn/config', requireSuperAdmin, webauthnCtrl.webauthnUpdateConfig)
authProtectedRoutes.get('/api/auth/me', ctrl.currentUser)
authProtectedRoutes.post('/api/auth/change-password', ctrl.changePassword)
authProtectedRoutes.post('/api/auth/change-username', ctrl.changeUsername)
authProtectedRoutes.get('/api/auth/avatar', ctrl.getMyAvatar)
authProtectedRoutes.put('/api/auth/avatar', ctrl.updateMyAvatar)
authProtectedRoutes.delete('/api/auth/password', ctrl.removePassword)
authProtectedRoutes.get('/api/auth/users', requireSuperAdmin, ctrl.listManagedUsers)
authProtectedRoutes.post('/api/auth/users', requireSuperAdmin, ctrl.createManagedUser)
authProtectedRoutes.put('/api/auth/users/:id', requireSuperAdmin, ctrl.updateManagedUser)
authProtectedRoutes.delete('/api/auth/users/:id', requireSuperAdmin, ctrl.deleteManagedUser)
authProtectedRoutes.get('/api/auth/locked-ips', requireSuperAdmin, ctrl.listLockedIps)
authProtectedRoutes.delete('/api/auth/locked-ips', requireSuperAdmin, ctrl.unlockIpHandler)
