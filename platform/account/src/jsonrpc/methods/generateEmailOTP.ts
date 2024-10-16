import { z } from 'zod'

import generateRandomString from '@proofzero/utils/generateRandomString'

import { Context } from '../../context'
import { AccountNode } from '../../nodes'
import EmailAccount from '../../nodes/email'

import { EMAIL_VERIFICATION_OPTIONS } from '../../constants'
import { EmailThemePropsSchema } from '../../../../email/src/emailFunctions'

export const GenerateEmailOTPInput = z.object({
  email: z.string(),
  clientId: z.string(),
  passportURL: z.string().url(),
  themeProps: EmailThemePropsSchema.optional(),
  preview: z.boolean().optional(),
})

export const GenerateEmailOTPOutput = z.string()

type GenerateEmailOTPParams = z.infer<typeof GenerateEmailOTPInput>

export const generateEmailOTPMethod = async ({
  input,
  ctx,
}: {
  input: GenerateEmailOTPParams
  ctx: Context
}): Promise<string> => {
  const { email, themeProps, preview, clientId, passportURL } = input
  const emailAccountNode = new EmailAccount(ctx.account as AccountNode, ctx.env)

  const state = generateRandomString(EMAIL_VERIFICATION_OPTIONS.STATE_LENGTH)

  const delayMiliseconds = preview ? 15000 : undefined
  const code = await emailAccountNode.generateVerificationCode(
    state,
    delayMiliseconds
  )

  await ctx.emailClient.sendOTP.mutate({
    clientId,
    state,
    emailAddress: email,
    name: email,
    otpCode: code,
    themeProps,
    passportURL,
  })
  return state
}
