import { z } from 'zod'

import { BadRequestError } from '@proofzero/errors'
import { AuthorizationURNSpace } from '@proofzero/urns/authorization'
import { IdentityURNSpace } from '@proofzero/urns/identity'

import { initIdentityNodeByName } from '@proofzero/platform.identity/src/nodes'

import { Context } from '../../context'
import { initAuthorizationNodeByName } from '../../nodes'
import { PersonaData } from '@proofzero/types/application'

export const GetPersonaDataInput = z.object({
  identityURN: z.string(),
  clientId: z.string(),
})

export const GetPersonaDataOutput = PersonaData

export const getPersonaDataMethod = async ({
  input,
  ctx,
}: {
  input: z.infer<typeof GetPersonaDataInput>
  ctx: Context
}): Promise<z.infer<typeof GetPersonaDataOutput>> => {
  const { clientId } = input

  if (!clientId)
    throw new BadRequestError({
      message: 'missing client id',
    })

  if (!IdentityURNSpace.is(input.identityURN))
    throw new BadRequestError({
      message: 'missing identity',
    })

  const identityNode = initIdentityNodeByName(
    input.identityURN,
    ctx.env.Identity
  )
  const forwardIdentityURN = await identityNode.class.getForwardIdentityURN()
  const identityURN = forwardIdentityURN || input.identityURN

  const nss = `${IdentityURNSpace.decode(identityURN)}@${clientId}`
  const urn = AuthorizationURNSpace.componentizedUrn(nss)
  const authorizationNode = initAuthorizationNodeByName(
    urn,
    ctx.env.Authorization
  )

  const personaData =
    (await authorizationNode.storage.get<PersonaData>('personaData')) || {}
  return personaData
}
