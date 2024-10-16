import { generateTraceContextHeaders } from '@proofzero/platform-middleware/trace'
import { getRollupReqFunctionErrorWrapper } from '@proofzero/utils/errors'
import { LoaderFunction, redirect } from '@remix-run/cloudflare'
import createCoreClient from '@proofzero/platform-clients/core'
import { getAuthzHeaderConditionallyFromToken } from '@proofzero/utils'
import { BadRequestError } from '@proofzero/errors'
import {
  IdentityGroupURNSpace,
  type IdentityGroupURN,
} from '@proofzero/urns/identity-group'
import { CryptoAccountType } from '@proofzero/types/account'
import _ from 'lodash'
import { getUserSession } from '~/session.server'

export const loader: LoaderFunction = getRollupReqFunctionErrorWrapper(
  async ({ request, context, params }) => {
    const groupID = params.groupID
    if (!groupID || groupID === '') {
      throw new BadRequestError({
        message: 'Missing group',
      })
    }

    const identityGroupURN = IdentityGroupURNSpace.urn(
      groupID
    ) as IdentityGroupURN

    const invitationCode = params.invitationCode
    if (!invitationCode || invitationCode === '') {
      throw new BadRequestError({
        message: 'Missing invitation code',
      })
    }

    let jwt = await getUserSession(request, context.env)
    if (jwt) {
      return redirect(
        `${context.env.CONSOLE_APP_URL}/groups/enroll/${groupID}/${invitationCode}`
      )
    }

    const traceHeader = generateTraceContextHeaders(context.traceSpan)

    const coreClient = createCoreClient(context.env.Core, {
      ...getAuthzHeaderConditionallyFromToken(jwt),
      ...traceHeader,
    })

    const invDetails =
      await coreClient.identity.getIdentityGroupMemberInvitationDetails.query({
        invitationCode,
        identityGroupURN,
      })

    let login_hint = undefined
    switch (invDetails.accountType) {
      case CryptoAccountType.ETH:
        login_hint = 'wallet'
        break
      default:
        login_hint = invDetails.accountType
    }

    const qp = new URLSearchParams()

    if (login_hint) {
      qp.append('login_hint', login_hint)
    }

    qp.append('client_id', 'passport')
    qp.append('redirect_uri', new URL(request.url).toString())
    qp.append('state', 'skip')
    qp.append('scope', '')
    qp.append('rollup_action', `group_${groupID}_${invitationCode}`)

    return redirect(`/authorize?${qp.toString()}`)
  }
)
