import { redirect } from '@remix-run/cloudflare'
import type { ActionFunction } from '@remix-run/cloudflare'
import createCoreClient from '@proofzero/platform-clients/core'
import { requireJWT } from '~/utilities/session.server'
import { getAuthzHeaderConditionallyFromToken } from '@proofzero/utils'
import { generateTraceContextHeaders } from '@proofzero/platform-middleware/trace'
import {
  JsonError,
  getErrorCause,
  getRollupReqFunctionErrorWrapper,
} from '@proofzero/utils/errors'
import {
  BadRequestError,
  InternalServerError,
  UnauthorizedError,
} from '@proofzero/errors'

export const action: ActionFunction = getRollupReqFunctionErrorWrapper(
  async ({ request, context }) => {
    const formData = await request.formData()
    const clientId = formData.get('clientId')?.toString()

    if (!clientId)
      throw new BadRequestError({ message: 'Client ID is required' })

    const jwt = await requireJWT(request, context.env)

    const coreClient = createCoreClient(context.env.Core, {
      ...getAuthzHeaderConditionallyFromToken(jwt),
      ...generateTraceContextHeaders(context.traceSpan),
    })
    try {
      await coreClient.starbase.deleteApp.mutate({ clientId })
      return redirect('/')
    } catch (error) {
      const cause = getErrorCause(error)
      const traceparent = context.traceSpan.getTraceParent()
      if (cause instanceof BadRequestError) {
        throw cause
      } else if (cause instanceof UnauthorizedError) {
        throw error
      } else {
        console.error(error)
        throw JsonError(
          new InternalServerError({
            message: 'Could not delete the application',
            cause: error,
          }),
          traceparent
        )
      }
    }
  }
)

export default () => {}
