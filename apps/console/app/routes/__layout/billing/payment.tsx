import { generateTraceContextHeaders } from '@proofzero/platform-middleware/trace'
import { getRollupReqFunctionErrorWrapper } from '@proofzero/utils/errors'
import { type LoaderFunction } from '@remix-run/cloudflare'
import { requireJWT } from '~/utilities/session.server'
import createCoreClient from '@proofzero/platform-clients/core'
import {
  getAuthzHeaderConditionallyFromToken,
  parseJwt,
} from '@proofzero/utils'
import { updatePaymentMethod } from '~/services/billing/stripe'
import { type AccountURN } from '@proofzero/urns/account'
import { BadRequestError } from '@proofzero/errors'

export const loader: LoaderFunction = getRollupReqFunctionErrorWrapper(
  async ({ request, context }) => {
    const jwt = await requireJWT(request, context.env)
    const parsedJwt = parseJwt(jwt!)
    const accountURN = parsedJwt.sub as AccountURN

    const traceHeader = generateTraceContextHeaders(context.traceSpan)

    const coreClient = createCoreClient(context.env.Core, {
      ...getAuthzHeaderConditionallyFromToken(jwt),
      ...traceHeader,
    })

    const { customerID } = await coreClient.account.getStripePaymentData.query({
      accountURN,
    })

    const headers = request.headers
    let returnURL = headers.get('Referer')
    if (!returnURL) {
      throw new BadRequestError({
        message: 'No Referer found in request.',
      })
    }

    return updatePaymentMethod(
      {
        customerID,
        returnURL,
      },
      context.env
    )
  }
)
