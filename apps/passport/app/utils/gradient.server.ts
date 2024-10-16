import createImageClient from '@proofzero/platform-clients/image'
import {
  generateTraceContextHeaders,
  TraceSpan,
} from '@proofzero/platform-middleware/trace'

export const generateGradient = async (
  gradientSeed: string,
  env: Env,
  traceSpan: TraceSpan
) => {
  const imageClient = createImageClient(env.Images, {
    headers: generateTraceContextHeaders(traceSpan),
  })
  const gradient = imageClient.getGradient.mutate({ gradientSeed })
  return gradient
}
