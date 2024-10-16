import { AccountURNInput } from '@proofzero/platform-middleware/inputValidators'
import { JWK } from 'jose'
import { z } from 'zod'

//TODO: Will have to revise and integrated with Scope in next iteration
export const ClaimName = z.union([
  z.literal('email'),
  z.literal('openid'),
  z.literal('connected_accounts'),
  z.literal('erc_4337'),
  z.literal('profile'),
])
export type ClaimName = z.infer<typeof ClaimName>

export const ClaimValue = z.any()
export type ClaimValue = z.infer<typeof ClaimValue>

export const PersonaData = z.record(ClaimName, ClaimValue)
export type PersonaData = z.infer<typeof PersonaData>

export enum AuthorizationControlSelection {
  ALL,
  NONE,
}
export const AuthorizationControlSelectionEnum = z.nativeEnum(
  AuthorizationControlSelection
)

export const AppData = z.object({
  smartWalletSessionKeys: z
    .array(
      z.object({
        urn: AccountURNInput,
        publicSessionKey: z.string(),
      })
    )
    .optional(),
})

export type AppDataType = z.infer<typeof AppData>

export interface KeyPairSerialized {
  publicKey: JWK
  privateKey: JWK
}
