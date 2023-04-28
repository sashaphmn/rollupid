import { DOProxy } from 'do-proxy'

import * as jose from 'jose'

import { hexlify } from '@ethersproject/bytes'
import { randomBytes } from '@ethersproject/random'

import { InternalServerError } from '@proofzero/errors'

import { AccountURN } from '@proofzero/urns/account'
import type { Scope } from '@proofzero/types/access'

import { JWT_ENC_HEADERS, JWT_OPTIONS } from '../constants'

import {
  ExpiredTokenError,
  InvalidTokenError,
  TokenClaimValidationFailedError,
  TokenVerificationFailedError,
} from '../errors'

import { ClaimValueType } from '@proofzero/security/persona'

type TokenStore = DurableObjectStorage | DurableObjectTransaction

type Token = {
  jwt: string
  scope: Scope
}

type TokenMap = Record<string, Token>
type TokenIndex = Array<string>
type TokenState = {
  tokenMap: TokenMap
  tokenIndex: TokenIndex
}

export interface EncryptTokenOption {
  encrypt: { secret: string }
}

export interface SignTokenOption {
  sign: { jwk: jose.JWK }
}

export interface CommonTokenOptions
  extends Partial<EncryptTokenOption>,
    Partial<SignTokenOption> {
  jku: string
  account: AccountURN
  clientId: string
  issuer: string
}

interface AccessTokenOptions extends CommonTokenOptions {
  expirationTime: string
  scope: Scope
}

interface RefreshTokenOptions extends CommonTokenOptions {
  scope: Scope
}

interface IdTokenOptions extends CommonTokenOptions {
  expirationTime: string
  idTokenClaims: Record<string, ClaimValueType>
}

export default class Access extends DOProxy {
  declare state: DurableObjectState

  constructor(state: DurableObjectState) {
    super(state)
    this.state = state
  }

  async getTokenState(store?: TokenStore): Promise<TokenState> {
    if (!store) {
      store = this.state.storage
    }

    return {
      tokenMap: (await store.get<TokenMap>('tokenMap')) || {},
      tokenIndex: (await store.get<TokenIndex>('tokenIndex')) || [],
    }
  }

  async generateAccessToken(options: AccessTokenOptions): Promise<string> {
    const { jku, account, clientId, expirationTime, issuer, scope } = options

    //Need to convert scope array to space-delimited string, per spec
    const payload = { scope: scope.join(' ') }

    const jti = hexlify(randomBytes(JWT_OPTIONS.jti.length))

    if (options.encrypt) {
      const secret = jose.base64url.decode(options.encrypt.secret)
      const header = { ...JWT_ENC_HEADERS, type: 'JWT' }
      return new jose.EncryptJWT(payload)
        .setProtectedHeader(header)
        .setExpirationTime(expirationTime)
        .setAudience([clientId])
        .setIssuedAt()
        .setIssuer(issuer)
        .setJti(jti)
        .setSubject(account)
        .encrypt(secret)
    } else if (options.sign) {
      const { jwk } = options.sign
      const { alg, kid } = jwk

      if (!alg) throw new InternalServerError({ message: 'missing alg in jwk' })

      const key = await jose.importJWK(jwk)
      const header = { alg, jku, kid, typ: 'JWT' }
      return new jose.SignJWT(payload)
        .setProtectedHeader(header)
        .setExpirationTime(expirationTime)
        .setAudience([clientId])
        .setIssuedAt()
        .setIssuer(issuer)
        .setJti(jti)
        .setSubject(account)
        .sign(key)
    } else {
      throw new Error('unknown token operation')
    }
  }

  async generateRefreshToken(options: RefreshTokenOptions): Promise<string> {
    const { jku, account, clientId, issuer, scope } = options
    const jti = hexlify(randomBytes(JWT_OPTIONS.jti.length))

    const payload = { scope: scope.join(' ') }

    let jwt: string

    if (options.encrypt) {
      const secret = jose.base64url.decode(options.encrypt.secret)
      const header = { ...JWT_ENC_HEADERS, type: 'JWT' }
      jwt = await new jose.EncryptJWT(payload)
        .setProtectedHeader(header)
        .setAudience([clientId])
        .setIssuedAt()
        .setIssuer(issuer)
        .setJti(jti)
        .setSubject(account)
        .encrypt(secret)
    } else if (options.sign) {
      const { jwk } = options.sign
      const { alg, kid } = jwk

      if (!alg) throw new InternalServerError({ message: 'missing alg in jwk' })

      const key = await jose.importJWK(jwk)
      const header = { alg, jku, kid, typ: 'JWT' }
      jwt = await new jose.SignJWT(payload)
        .setProtectedHeader(header)
        .setAudience([clientId])
        .setIssuedAt()
        .setIssuer(issuer)
        .setJti(jti)
        .setSubject(account)
        .sign(key)
    } else {
      throw new Error('unknown token operation')
    }

    await this.store(jti, jwt, scope)
    return jwt
  }

  async generateIdToken(options: IdTokenOptions): Promise<string> {
    const { jku, account, clientId, expirationTime, idTokenClaims, issuer } =
      options

    if (options.encrypt) {
      const secret = jose.base64url.decode(options.encrypt.secret)
      const header = { ...JWT_ENC_HEADERS, type: 'JWT' }
      return new jose.EncryptJWT(idTokenClaims)
        .setProtectedHeader(header)
        .setExpirationTime(expirationTime)
        .setAudience([clientId])
        .setIssuedAt()
        .setIssuer(issuer)
        .setSubject(account)
        .encrypt(secret)
    } else if (options.sign) {
      const { jwk } = options.sign
      const { alg, kid } = jwk
      if (!alg) throw new InternalServerError({ message: 'missing alg in jwk' })
      return new jose.SignJWT(idTokenClaims)
        .setProtectedHeader({ alg, jku, kid, typ: 'JWT' })
        .setExpirationTime(expirationTime)
        .setAudience([clientId])
        .setIssuedAt()
        .setIssuer(issuer)
        .setSubject(account)
        .sign(await jose.importJWK(jwk))
    } else {
      throw new Error('unknown token operation')
    }
  }

  async store(jti: string, jwt: string, scope: Scope): Promise<void> {
    await this.state.storage.transaction(async (txn) => {
      const { tokenMap, tokenIndex } = await this.getTokenState(txn)
      if (tokenMap[jti]) {
        throw new Error('refresh token id exists')
      }

      tokenMap[jti] = { jwt, scope }
      tokenIndex.push(jti)

      const put = async (
        tokenMap: TokenMap,
        tokenIndex: TokenIndex
      ): Promise<void> => {
        try {
          await txn.put({ tokenMap, tokenIndex })
        } catch (error) {
          if (error instanceof RangeError) {
            const expungeTokenId = tokenIndex.shift()
            if (expungeTokenId) {
              delete tokenMap[expungeTokenId]
            }
            await put(tokenMap, tokenIndex)
          }
        }
      }

      await put(tokenMap, tokenIndex)
    })
  }

  async verify(
    jwt: string,
    jwks: jose.JSONWebKeySet
  ): Promise<jose.JWTVerifyResult> {
    const { kid } = jose.decodeProtectedHeader(jwt)
    if (kid) {
      try {
        return await jose.jwtVerify(jwt, jose.createLocalJWKSet(jwks))
      } catch (error) {
        if (error instanceof jose.errors.JWTClaimValidationFailed)
          throw TokenClaimValidationFailedError
        else if (error instanceof jose.errors.JWTExpired)
          throw ExpiredTokenError
        else if (error instanceof jose.errors.JWTInvalid)
          throw InvalidTokenError
        else throw TokenVerificationFailedError
      }
    } else {
      // TODO: Initial signing keys didn't have `kid` property.
      // Tokens signed by these keys won't have `kid` property in the header.
      // This case will be invalid after 90 days.
      const local = await this.getJWTPublicKey()
      if (local) {
        const { alg } = JWT_OPTIONS
        const key = await jose.importJWK(local, alg)
        try {
          return await jose.jwtVerify(jwt, key)
        } catch (error) {
          if (error instanceof jose.errors.JWTClaimValidationFailed)
            throw TokenClaimValidationFailedError
          else if (error instanceof jose.errors.JWTExpired)
            throw ExpiredTokenError
          else if (error instanceof jose.errors.JWTInvalid)
            throw InvalidTokenError
          else throw TokenVerificationFailedError
        }
      }
    }

    throw TokenVerificationFailedError
  }

  async revoke(token: string, jwks: jose.JSONWebKeySet): Promise<void> {
    const { payload } = await this.verify(token, jwks)
    await this.state.storage.transaction(async (txn) => {
      const { jti } = payload
      if (!jti) {
        throw new Error('missing token id')
      }

      const { tokenMap, tokenIndex } = await this.getTokenState(txn)
      delete tokenMap[jti]

      const index = tokenIndex.findIndex((jti) => jti == payload.jti)
      if (index > -1) {
        tokenIndex.splice(index, 1)
      }

      await txn.put({ tokenMap, tokenIndex })
    })
  }

  async deleteAll(): Promise<void> {
    await this.state.storage.deleteAll()
  }

  async getJWTPublicKey(): Promise<jose.JWK | undefined> {
    const { alg } = JWT_OPTIONS
    const { storage } = this.state

    const stored = await storage.get<{ publicKey: jose.JWK }>('signingKey')
    if (stored) {
      return { alg, ...stored.publicKey }
    }
  }
}
