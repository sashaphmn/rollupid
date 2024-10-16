import { z } from 'zod'
import { router } from '@proofzero/platform.core'
import { Context } from '../context'
import { IdentityRefURNValidator } from '@proofzero/platform-middleware/inputValidators'
import { EDGE_HAS_REFERENCE_TO, EDGE_PAYS_APP } from '@proofzero/types/graph'
import { ApplicationURNSpace } from '@proofzero/urns/application'
import { getApplicationNodeByClientId } from '../../nodes/application'
import { ServicePlanType } from '@proofzero/types/billing'

export const ReconcileAppSubscriptionsInputSchema = z.object({
  URN: IdentityRefURNValidator,
  count: z.number(),
  plan: z.nativeEnum(ServicePlanType),
})
type ReconcileAppSubscriptionsInput = z.infer<
  typeof ReconcileAppSubscriptionsInputSchema
>

export const ReconcileAppsSubscriptionsOutputSchema = z.array(
  z.object({
    appURN: z.string(),
    clientID: z.string(),
    plan: z.nativeEnum(ServicePlanType),
    devEmail: z.string().optional(),
    appName: z.string(),
    customDomain: z.boolean(),
  })
)
export type ReconcileAppsSubscriptionsOutput = z.infer<
  typeof ReconcileAppsSubscriptionsOutputSchema
>

export const reconcileAppSubscriptions = async ({
  input,
  ctx,
}: {
  input: ReconcileAppSubscriptionsInput
  ctx: Context
}): Promise<ReconcileAppsSubscriptionsOutput> => {
  const { URN, plan, count } = input
  const caller = router.createCaller(ctx)
  const { edges } = await caller.edges.getEdges({
    query: {
      src: { baseUrn: URN },
      tag: EDGE_PAYS_APP,
    },
  })

  const reconciledApps = []
  const apps = []
  for (const edge of edges) {
    if (!ApplicationURNSpace.is(edge.dst.baseUrn)) continue
    const clientID = ApplicationURNSpace.decode(edge.dst.baseUrn)
    const appDO = await getApplicationNodeByClientId(
      clientID,
      ctx.env.StarbaseApp
    )

    const appDetails = await appDO.class.getDetails()
    if (appDetails.createdTimestamp != null) {
      const { edges: contactEdges } = await caller.edges.getEdges({
        query: {
          src: { baseUrn: edge.dst.baseUrn },
          tag: EDGE_HAS_REFERENCE_TO,
        },
      })

      let devEmail
      if (contactEdges[0]) {
        devEmail = contactEdges[0].dst.qc.alias
      }

      apps.push({
        ...appDetails,
        appURN: edge.dst.baseUrn,
        devEmail,
      })
    }
  }

  const planApps = apps.filter((app) => app.appPlan === plan)
  if (planApps.length > count) {
    const targetApps = planApps
      .sort((a, b) => +b.createdTimestamp! - +a.createdTimestamp!)
      .slice(0, planApps.length - count)
      .map((app) => ({
        appURN: app.appURN,
        clientID: app.clientId,
        devEmail: app.devEmail,
        appName: app.app?.name ?? 'Undefined',
        plan,
        customDomain: Boolean(app.customDomain),
      }))

    for (const app of targetApps) {
      await caller.edges.removeEdge({
        src: URN,
        tag: EDGE_PAYS_APP,
        dst: app.appURN,
      })

      const appDO = await getApplicationNodeByClientId(
        app.clientID,
        ctx.env.StarbaseApp
      )
      await appDO.class.deleteAppPlan()

      reconciledApps.push(app)
    }
  }

  return reconciledApps
}
