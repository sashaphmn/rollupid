import { z } from 'zod'
import { router } from '@proofzero/platform.core'
import { Context } from '../context'
import { getApplicationNodeByClientId } from '../../nodes/application'
import { BadRequestError } from '@proofzero/errors'
import { ApplicationURNSpace } from '@proofzero/urns/application'
import { AppClientIdParamSchema } from '../validators/app'
import { EDGE_APPLICATION } from '../../types'
import { EDGE_HAS_REFERENCE_TO } from '@proofzero/types/graph'
import { createAnalyticsEvent } from '@proofzero/utils/analytics'
import type { IdentityURN } from '@proofzero/urns/identity'

export const DeleteAppInput = AppClientIdParamSchema

export const deleteApp = async ({
  input,
  ctx,
}: {
  input: z.infer<typeof DeleteAppInput>
  ctx: Context
}): Promise<void> => {
  const appURN = ApplicationURNSpace.componentizedUrn(input.clientId)
  if (!ctx.ownAppURNs || !ctx.ownAppURNs.includes(appURN))
    throw new Error(
      `Request received for clientId ${input.clientId} which is not owned by provided account.`
    )

  if (!ctx.identityURN) throw new Error('No identity URN in context')

  const appDO = await getApplicationNodeByClientId(
    input.clientId,
    ctx.StarbaseApp
  )

  if (await appDO.storage.get('customDomain'))
    throw new BadRequestError({
      message: 'The application has a custom domain configuration',
    })

  const caller = router.createCaller(ctx)

  const [{ edges: srcEdges }, { edges: dstEdges }] = await Promise.all([
    caller.edges.getEdges({
      query: { src: { baseUrn: appURN } },
    }),
    caller.edges.getEdges({
      query: { dst: { baseUrn: appURN } },
    }),
  ])

  await Promise.all(
    srcEdges.concat(dstEdges).map((e) =>
      caller.edges.removeEdge({
        tag: e.tag,
        src: e.src.baseUrn,
        dst: e.dst.baseUrn,
      })
    )
  )

  await caller.edges.deleteNode({
    urn: appURN,
  })
  await appDO.class.delete()

  ctx.waitUntil?.(
    createAnalyticsEvent({
      apiKey: ctx.POSTHOG_API_KEY,
      eventName: 'identity_deleted_app',
      distinctId: ctx.identityURN as IdentityURN,
      properties: {
        $groups: { app: input.clientId },
      },
    })
  )
}
