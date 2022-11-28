import { hexlify } from '@ethersproject/bytes'
import { randomBytes } from '@ethersproject/random'
import { DurableObject } from '@kubelt/platform.commons'

import { createFetcherJsonRpcClient } from '@kubelt/platform.commons/src/jsonrpc'

import { CODE_OPTIONS } from './constants'

import {
  AccessApi,
  AuthorizationApi as Api,
  AuthorizationRequest,
  AuthorizeResult,
  Environment,
  ExchangeAuthorizationCodeResult,
  Scope,
} from './types'

export default class Authorization extends DurableObject<Environment, Api> {
  methods(): Api {
    return {
      // get: this.get.bind(this),
      getType: this.getType.bind(this),
      setType: this.setType.bind(this),
      getName: this.getName.bind(this),
      setName: this.setName.bind(this),
      authorize: this.authorize.bind(this),
      exchangeCode: this.exchangeCode.bind(this),
    }
  }

  async authorize(
    account: string,
    clientId: string,
    redirectUri: string,
    scope: Scope,
    state: string
  ): Promise<AuthorizeResult> {
    console.log({ account, clientId, redirectUri, scope, state })

    const code = hexlify(randomBytes(CODE_OPTIONS.length))
    await this.storage.put({
      account,
      clientId,
      [`codes/${code}`]: { redirectUri, scope, state },
    })

    return { code, state }
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
    clientId: string
  ): Promise<ExchangeAuthorizationCodeResult> {
    const { Access } = this.env

    const account = await this.storage.get<string>('account')

    console.log('account', account)
    if (!account) {
      throw 'missing account name'
    }

    const request = await this.storage.get<AuthorizationRequest>(
      `codes/${code}`
    )
    if (!request) {
      throw 'missing authorization request'
    }

    if (redirectUri != request.redirectUri) {
      throw 'invalid redirect URI'
    }

    await this.storage.delete(`codes/${code}`)

    const { scope } = request
    const access = Access.get(Access.newUniqueId())
    const client = createFetcherJsonRpcClient<AccessApi>(access)
    return client.generate(account, clientId, scope)
  }
}
