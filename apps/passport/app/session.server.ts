import {
  createCookieSessionStorage,
  // createCloudflareKVSessionStorage,
  redirect,
} from '@remix-run/cloudflare'
import type { Session } from '@remix-run/cloudflare'

import * as jose from 'jose'
import type { JWTPayload } from 'jose'

// USER PARAMS

const getUserSessionStorage = (env: Env) => {
  return createCookieSessionStorage({
    cookie: {
      domain: env.COOKIE_DOMAIN,
      name: 'PASSPORT_SESSION',
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV == 'production',
      maxAge: 60 * 60 * 24 * 90,
      httpOnly: true,
      secrets: [env.SECRET_SESSION_SALT],
    },
  })
}

export async function createUserSession(
  jwt: string,
  redirectTo: string,
  defaultProfileUrn: string, // NOTE: storing this temporarily in the session util RPC url remove address
  env: Env
) {
  const userStorage = getUserSessionStorage(env)
  const parsedJWT = parseJwt(jwt)
  const userSession = await userStorage.getSession()
  userSession.set('core', parsedJWT.iss)
  userSession.set('jwt', jwt)
  userSession.set('defaultProfileUrn', defaultProfileUrn)

  const consoleParamsStorage = await getConsoleParamsSessionStorage(env)
  const consoleParamsSession = await consoleParamsStorage.getSession()

  const headers = new Headers()
  headers.append('Set-Cookie', await userStorage.commitSession(userSession))
  headers.append(
    'Set-Cookie',
    await consoleParamsStorage.destroySession(consoleParamsSession)
  )

  return redirect(redirectTo, {
    headers,
  })
}

// TODO: reset cookie maxAge if valid
export function getUserSession(
  request: Request,
  renew: boolean = true,
  env: Env
) {
  const storage = getUserSessionStorage(env)
  return storage.getSession(request.headers.get('Cookie'))
}

export async function destroyUserSession(session: Session, env: Env) {
  const storage = getUserSessionStorage(env)
  return redirect(`/authenticate`, {
    headers: {
      'Set-Cookie': await storage.destroySession(session),
    },
  })
}

// CONSOLE PARAMS

const getConsoleParamsSessionStorage = (env: Env) => {
  return createCookieSessionStorage({
    cookie: {
      domain: env.COOKIE_DOMAIN,
      name: 'CONSOLE_PARAMS_SESSION',
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV == 'production',
      maxAge: 60 * 60 * 24 * 120,
      httpOnly: true,
      secrets: [env.SECRET_SESSION_SALT],
    },
  })
}

export async function createConsoleParamsSession(
  consoleParams: ConsoleParams,
  env: Env
) {
  const storage = getConsoleParamsSessionStorage(env)
  const session = await storage.getSession()
  session.set('params', JSON.stringify(consoleParams))

  return redirect('/authenticate', {
    headers: {
      'Set-Cookie': await storage.commitSession(session),
    },
  })
}

export async function getConsoleParamsSession(request: Request, env: Env) {
  const storage = getConsoleParamsSessionStorage(env)
  return storage.getSession(request.headers.get('Cookie'))
}

export async function requireJWT(
  request: Request,
  consoleParams: ConsoleParams,
  env: Env
) {
  const session = await getUserSession(request, false, env)
  const jwt = session.get('jwt')

  if (!jwt || typeof jwt !== 'string') {
    if (consoleParams.clientId)
      throw await createConsoleParamsSession(consoleParams, env)
    else throw redirect('/authenticate')
  }
  if (jwt) {
    const parsedJWT = parseJwt(jwt)
    const exp = parsedJWT?.exp
    if (exp && exp < Date.now() / 1000) {
      throw await destroyUserSession(session, env)
    }
  }

  return jwt
}

export function parseJwt(token: string): JWTPayload {
  const payload = jose.decodeJwt(token)
  if (!payload) {
    throw new Error('Invalid JWT')
  }
  return payload
}
