import type { ActionFunction } from '@remix-run/cloudflare'
import { redirect } from '@remix-run/cloudflare'
import { getValidatedSessionContext } from '~/session.server'

import { getCoreClient } from '~/platform.server'

import { getFlashSession, commitFlashSession } from '~/session.server'
import { BadRequestError } from '@proofzero/errors'
import { getRollupReqFunctionErrorWrapper } from '@proofzero/utils/errors'

export const action: ActionFunction = getRollupReqFunctionErrorWrapper(
  async ({ request, params, context }) => {
    const session = await getFlashSession(request, context.env)

    const { jwt } = await getValidatedSessionContext(
      request,
      context.authzQueryParams,
      context.env,
      context.traceSpan
    )

    const { clientId } = params

    if (!clientId) {
      throw new BadRequestError({ message: 'Client ID is required for query' })
    }

    try {
      const coreClient = getCoreClient({ context, jwt })
      await coreClient.authorization.revokeAppAuthorization.mutate({
        clientId,
        issuer: new URL(request.url).origin,
      })

      session.flash(
        'tooltipMessage',
        JSON.stringify({
          type: 'success',
          message: 'Access Removed',
        })
      )
    } catch (ex) {
      console.error(ex)

      session.flash(
        'tooltipMessage',
        JSON.stringify({
          type: 'error',
          message: 'Error Removing Access',
        })
      )
    }

    return redirect('/settings/applications', {
      headers: {
        'Set-Cookie': await commitFlashSession(request, context.env, session),
      },
    })
  }
)
