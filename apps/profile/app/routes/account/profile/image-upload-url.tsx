import type { ActionFunction, LoaderFunction } from '@remix-run/cloudflare'
import { json, redirect } from '@remix-run/cloudflare'
import { requireJWT } from '~/utils/session.server'

import createImageClient from '@proofzero/platform-clients/image'
import { generateTraceContextHeaders } from '@proofzero/platform-middleware/trace'

export const loader: LoaderFunction = async ({ request, context }) => {
  await requireJWT(request, context.env)
  return redirect('/account/profile')
}

export const action: ActionFunction = async ({ request, context }) => {
  await requireJWT(request, context.env)

  const imageClient = createImageClient(context.env.Images, {
    headers: generateTraceContextHeaders(context.traceSpan),
  })
  const { uploadURL } = await imageClient.upload.mutate()
  return json(uploadURL)
}
