import { z } from 'zod'
import { router } from '@proofzero/platform.core'
import { Context } from '../context'
import { getApplicationNodeByClientId } from '../../nodes/application'
import {
  type ApplicationURN,
  ApplicationURNSpace,
} from '@proofzero/urns/application'
import { EDGE_PAYS_APP } from '@proofzero/types/graph'
import { IdentityRefURNValidator } from '@proofzero/platform-middleware/inputValidators'

export const DeleteSubscriptionPlansInput = z.object({
  URN: IdentityRefURNValidator,
})
type DeleteSubscriptionPlansParams = z.infer<
  typeof DeleteSubscriptionPlansInput
>

export const deleteSubscriptionPlans = async ({
  input,
  ctx,
}: {
  input: DeleteSubscriptionPlansParams
  ctx: Context
}): Promise<void> => {
  const { URN } = input

  const caller = router.createCaller(ctx)

  const { edges } = await caller.edges.getEdges({
    query: {
      src: { baseUrn: URN },
      tag: EDGE_PAYS_APP,
    },
  })

  const appURNs = edges.map((edge) => edge.dst.baseUrn)

  const clientIds = appURNs.map((appURN) =>
    ApplicationURNSpace.decode(appURN as ApplicationURN)
  )

  if (appURNs.length !== 0) {
    await Promise.all([
      // This is a way to delete all edges associated with payments
      Promise.all(
        appURNs.map((appURN) =>
          caller.edges.removeEdge({
            src: URN,
            tag: EDGE_PAYS_APP,
            dst: appURN,
          })
        )
      ),
      // This is a way to delete all app plans
      Promise.all(
        clientIds.map(async (clientId) => {
          await caller.starbase.deleteCustomDomain({
            clientId,
          })

          const appDO = await getApplicationNodeByClientId(
            clientId,
            ctx.env.StarbaseApp
          )
          appDO.class.deleteAppPlan()
        })
      ),
    ])
  }
}
