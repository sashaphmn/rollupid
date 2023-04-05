/**
 * @file app/routes/dashboard/apps/$appId/index.tsx
 */

import type { ActionFunction, LoaderFunction } from '@remix-run/cloudflare'
import type { ScopeMeta } from '@proofzero/security/scopes'
import { json } from '@remix-run/cloudflare'
import {
  Form,
  useActionData,
  useSubmit,
  useOutletContext,
  useLoaderData,
} from '@remix-run/react'
import createStarbaseClient from '@proofzero/platform-clients/starbase'
import { requireJWT } from '~/utilities/session.server'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { RollType } from '~/types'
import { getAuthzHeaderConditionallyFromToken } from '@proofzero/utils'
import { generateTraceContextHeaders } from '@proofzero/platform-middleware/trace'

import { DeleteAppModal } from '~/components/DeleteAppModal/DeleteAppModal'
import type { appDetailsProps, errorsAuthProps } from '~/types'
import IconPicker from '~/components/IconPicker'
import { RotateCredsModal } from '~/components/RotateCredsModal/RotateCredsModal'

import { Loader } from '@proofzero/design-system/src/molecules/loader/Loader'
import { Text } from '@proofzero/design-system/src/atoms/text/Text'
import { Panel } from '@proofzero/design-system/src/atoms/panels/Panel'
import { ReadOnlyInput } from '@proofzero/design-system/src/atoms/form/ReadOnlyInput'
import { Input } from '@proofzero/design-system/src/atoms/form/Input'
import { InputToggle } from '@proofzero/design-system/src/atoms/form/InputToggle'
import { MultiSelect } from '@proofzero/design-system/src/atoms/form/MultiSelect'
import { PreLabeledInput } from '@proofzero/design-system/src/atoms/form/PreLabledInput'
import { Button } from '@proofzero/design-system/src/atoms/buttons/Button'
import { toast, ToastType } from '@proofzero/design-system/src/atoms/toast'
import { DocumentationBadge } from '~/components/DocumentationBadge'

/**
 * @file app/routes/dashboard/index.tsx
 */

// TODO: create a separate helper file for schemas and helper functions

type notificationHandlerType = (val: boolean) => void

const HTTP_MESSAGE = 'HTTP can only be used for localhost'

const URL_VALIDATION = ({
  val,
  required,
}: {
  val: string
  required: boolean
}) => {
  if (val?.length) {
    try {
      const url = new URL(val)
      const isLocal =
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      return isLocal || url.protocol === 'https:'
    } catch (ex) {
      return false
    }
  }
  return !required
}

const updatesSchema = z.object({
  name: z.string(),
  icon: z.string().url({ message: 'Invalid image upload' }),
  redirectURI: z.string().refine(
    (val) => {
      return URL_VALIDATION({ val, required: true })
    },
    { message: HTTP_MESSAGE }
  ),

  termsURL: z
    .string()
    .refine(
      (val) => {
        return URL_VALIDATION({ val, required: false })
      },
      { message: HTTP_MESSAGE }
    )
    .optional(),
  websiteURL: z
    .string()
    .refine(
      (val) => {
        return URL_VALIDATION({ val, required: false })
      },
      { message: HTTP_MESSAGE }
    )
    .optional(),
  twitterUser: z
    .string()
    .url()
    .startsWith('https://twitter.com/')
    .optional()
    .or(z.string().length(0)),
  mediumUser: z
    .string()
    .url()
    .startsWith('https://medium.com/@')
    .optional()
    .or(z.string().length(0)),
  mirrorURL: z
    .string()
    .url()
    .startsWith('https://mirror.xyz/')
    .optional()
    .or(z.string().length(0)),
  discordUser: z
    .string()
    .url()
    .startsWith('http://discord.com/')
    .optional()
    .or(z.string().length(0)),
})

export const loader: LoaderFunction = async ({ request, params, context }) => {
  if (!params.clientId) {
    throw new Error('Application Client ID is required for the requested route')
  }
  const jwt = await requireJWT(request)
  const starbaseClient = createStarbaseClient(Starbase, {
    ...getAuthzHeaderConditionallyFromToken(jwt),
    ...generateTraceContextHeaders(context.traceSpan),
  })

  const scopeMeta = await (await starbaseClient.getScopes.query()).scopes

  return json({ scopeMeta })
}

export const action: ActionFunction = async ({ request, params, context }) => {
  if (!params.clientId) {
    throw new Error('Application Client ID is required for the requested route')
  }

  let rotatedSecret, updates

  const jwt = await requireJWT(request)
  const starbaseClient = createStarbaseClient(Starbase, {
    ...getAuthzHeaderConditionallyFromToken(jwt),
    ...generateTraceContextHeaders(context.traceSpan),
  })

  const formData = await request.formData()
  const op = formData.get('op')
  const published = formData.get('published') === '1'
  const errors: errorsAuthProps = {}

  // As part of the rolling operation
  // we only need to remove the keys
  // because the loader gets called again
  // populating the values if empty
  switch (op) {
    case RollType.RollClientSecret:
      rotatedSecret = (
        await starbaseClient.rotateClientSecret.mutate({
          clientId: params.clientId,
        })
      ).secret
      break
    case 'update_app':
      const entries = formData.entries()
      const scopes = Array.from(entries)
        .filter((entry) => {
          return entry[0].endsWith('][id]')
        })
        .map((entry) => entry[1] as string)

      updates = {
        name: formData.get('name')?.toString(),
        icon: formData.get('icon') as string | undefined,
        redirectURI: formData.get('redirectURI') as string | undefined,
        termsURL: formData.get('termsURL') as string | undefined,
        websiteURL: formData.get('websiteURL') as string | undefined,
        twitterUser: formData.get('twitterUser') as string | undefined,
        mediumUser: formData.get('mediumUser') as string | undefined,
        mirrorURL: formData.get('mirrorURL') as string | undefined,
        discordUser: formData.get('discordUser') as string | undefined,
        scopes: Array.from(scopes),
      }

      const zodErrors = updatesSchema.safeParse(updates)
      if (!zodErrors.success) {
        zodErrors.error.errors.forEach((er: any) => {
          errors[`${er.path[0]}`] = er.message
        })
      }

      if (Object.keys(errors).length === 0) {
        await Promise.all([
          starbaseClient.updateApp.mutate({
            clientId: params.clientId,
            updates,
          }),
          starbaseClient.publishApp.mutate({
            clientId: params.clientId,
            published: published,
          }),
        ])
      }
      break
  }

  return json({
    rotatedSecret,
    updatedApp: { published, app: { ...updates } },
    errors,
  })
}

// Component
// -----------------------------------------------------------------------------

export default function AppDetailIndexPage() {
  const submit = useSubmit()
  const actionData = useActionData()
  const outletContextData = useOutletContext<{
    notificationHandler: notificationHandlerType
    appDetails: appDetailsProps
    rotationResult: any
  }>()
  const { scopeMeta }: { scopeMeta: ScopeMeta } = useLoaderData()

  const [isFormChanged, setIsFormChanged] = useState(false)
  const [isImgUploading, setIsImgUploading] = useState(false)
  const [rollKeyModalOpen, setRollKeyModalOpen] = useState(false)

  const { notificationHandler, appDetails } = outletContextData
  const rotatedSecret =
    outletContextData?.rotationResult?.rotatedClientSecret ||
    actionData?.rotatedSecret

  if (actionData?.updatedApp) {
    appDetails.app = actionData.updatedApp.app
    appDetails.published = actionData.updatedApp.published
  }

  const errors = actionData?.errors

  useEffect(() => {
    if (errors) {
      notificationHandler(Object.keys(errors).length === 0)
      setIsFormChanged(!(Object.keys(errors).length === 0))
    }
  }, [errors])

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  return (
    <>
      {isImgUploading ? <Loader /> : null}
      <DeleteAppModal
        clientId={appDetails.clientId as string}
        appName={appDetails.app.name}
        deleteAppCallback={() => {
          setDeleteModalOpen(false)
        }}
        isOpen={deleteModalOpen}
      />

      <Form
        method="post"
        encType="multipart/form-data"
        onChange={() => {
          setIsFormChanged(true)
        }}
      >
        <fieldset disabled={isImgUploading}>
          <input type="hidden" name="op" value="update_app" />

          <section className="flex flex-col space-y-5">
            <div className="flex flex-row justify-between space-x-5 max-sm:pl-6">
              <div className="flex flex-row items-center space-x-3">
                <Text size="2xl" weight="semibold" className="text-gray-900">
                  OAuth
                </Text>
                <DocumentationBadge
                  url={'https://docs.rollup.id/platform/console/oauth'}
                />
              </div>
              <Button
                type="submit"
                btnType="primary-alt"
                disabled={!isFormChanged}
              >
                Save
              </Button>
            </div>

            <RotateCredsModal
              isOpen={rollKeyModalOpen}
              rotateCallback={() => {
                setRollKeyModalOpen(false)
                submit(
                  {
                    op: RollType.RollClientSecret,
                  },
                  {
                    method: 'post',
                  }
                )
              }}
              closeCallback={() => setRollKeyModalOpen(false)}
            />

            <div className="flex flex-col md:flex-row space-y-5 lg:space-y-0 lg:space-x-5">
              <div className="flex-1">
                <Panel title="OAuth Settings">
                  <div className="flex flex-col md:flex-row space-y-8 md:space-y-0 md:space-x-8 md:items-end">
                    <div className="flex-1">
                      <ReadOnlyInput
                        id="oAuthAppId"
                        label="Client ID"
                        value={appDetails.clientId!}
                        copyable
                        onCopy={() =>
                          toast(
                            ToastType.Success,
                            { message: 'Client ID copied to clipboard!' },
                            {
                              duration: 2000,
                            }
                          )
                        }
                        disabled
                      />
                    </div>

                    <div className="flex-1">
                      <ReadOnlyInput
                        id="oAuthAppSecret"
                        label="Client Secret"
                        value={rotatedSecret ?? 's3cr3t-l337-h4x0r5'}
                        hidden={rotatedSecret ? false : true}
                        copyable={rotatedSecret ? true : false}
                        onCopy={() =>
                          toast(
                            ToastType.Success,
                            { message: 'Client secret copied to clipboard!' },
                            {
                              duration: 2000,
                            }
                          )
                        }
                        disabled
                      />
                    </div>

                    <div>
                      <Text
                        size="xs"
                        weight="medium"
                        className="text-gray-400 text-right md:text-left"
                      >
                        Created:{' '}
                        {new Date(
                          appDetails.secretTimestamp as number
                        ).toDateString()}
                      </Text>

                      <div className="text-right">
                        <Text
                          type="span"
                          size="xs"
                          weight="medium"
                          className="text-indigo-500 cursor-pointer"
                          onClick={() => setRollKeyModalOpen(true)}
                        >
                          Roll keys
                        </Text>
                      </div>
                    </div>
                  </div>
                </Panel>
              </div>

              <div>
                <Panel title="Application Status">
                  <div className="flex flex-col h-full justify-center">
                    <InputToggle
                      name="published"
                      id="published"
                      label="Published"
                      onToggle={() => {
                        ;(setIsFormChanged as (val: boolean) => {})(true)
                      }}
                      checked={appDetails.published}
                    />
                  </div>
                </Panel>
              </div>
            </div>

            <Panel title="Details">
              <div className="flex flex-col md:space-y-5">
                <div className="flex flex-col md:flex-row space-y-8 md:space-y-0 md:space-x-8 md:items-end">
                  <div className="flex-1">
                    <Input
                      id="name"
                      label="Application Name"
                      error={errors?.['name']}
                      defaultValue={appDetails.app.name}
                      required
                    />
                  </div>

                  <div className="flex-1">
                    <MultiSelect
                      label="Scopes"
                      disabled={false}
                      onChange={() => {
                        setIsFormChanged(true)
                      }}
                      fieldName="scopes"
                      items={Object.entries(scopeMeta).map(([key, value]) => {
                        return {
                          id: key,
                          val: value.name,
                          desc: value.description,
                        }
                      })}
                      selectedItems={appDetails.app.scopes?.map((scope) => {
                        const meta = scopeMeta[scope]
                        return {
                          id: scope,
                          val: meta.name,
                          desc: meta.description,
                        }
                      })}
                      requiredItems={[
                        {
                          id: 'openid',
                          val: scopeMeta['openid'].name,
                          desc: scopeMeta['openid'].description,
                        },
                      ]}
                    />
                  </div>
                </div>

                <div className="my-8 md:my-0">
                  <ReadOnlyInput
                    id="appDomains"
                    label="Domain(s)"
                    className="cursor-no-drop"
                    value=""
                    required
                  />
                  <Text
                    type="span"
                    size="xs"
                    weight="medium"
                    className="text-gray-400"
                  >
                    <a
                      className="text-indigo-500"
                      href="https://discord.gg/rollupid"
                    >
                      Contact us
                    </a>{' '}
                    to enable this feature
                  </Text>
                </div>

                <div className="flex flex-col md:flex-row space-y-8 md:space-y-0 md:space-x-8 md:items-end">
                  <div className="flex-1">
                    <Input
                      id="redirectURI"
                      label="Redirect URL"
                      type="url"
                      required
                      error={errors?.['redirectURI']}
                      placeholder="www.example.com"
                      defaultValue={appDetails.app.redirectURI}
                    />
                    {errors?.redirectURI ? (
                      <Text
                        className="mb-1.5 mt-1.5 text-red-500"
                        size="xs"
                        weight="normal"
                      >
                        {errors.redirectURI || ''}
                      </Text>
                    ) : (
                      <div className="sm:mb-[1.755rem]" />
                    )}
                  </div>

                  <div className="flex-1">
                    <Input
                      id="termsURL"
                      label="Terms of Service URL"
                      type="url"
                      error={errors?.['termsURL']}
                      placeholder="www.example.com"
                      defaultValue={appDetails.app.termsURL}
                    />
                    {errors?.termsURL ? (
                      <Text
                        className="mb-1.5 mt-1.5 text-red-500"
                        size="xs"
                        weight="normal"
                      >
                        {errors.termsURL || ''}
                      </Text>
                    ) : (
                      <div className="sm:mb-[1.755rem]" />
                    )}
                  </div>

                  <div className="flex-1">
                    <Input
                      id="websiteURL"
                      label="Website"
                      error={errors?.['websiteURL']}
                      type="url"
                      placeholder="www.example.com"
                      defaultValue={appDetails.app.websiteURL}
                    />
                    {errors?.websiteURL ? (
                      <Text
                        className="mb-1.5 mt-1.5 text-red-500"
                        size="xs"
                        weight="normal"
                      >
                        {errors.websiteURL || ''}
                      </Text>
                    ) : (
                      <div className="sm:mb-[1.755rem]" />
                    )}
                  </div>
                </div>

                <div>
                  <IconPicker
                    id="icon"
                    errorMessage={errors?.['icon']}
                    invalid={
                      errors !== undefined &&
                      errors.hasOwnProperty('icon') &&
                      (errors['icon'] as string).length > 0
                    }
                    setIsFormChanged={
                      setIsFormChanged as (val: boolean) => void
                    }
                    setIsImgUploading={
                      setIsImgUploading as (val: boolean) => void
                    }
                    url={appDetails.app.icon}
                  />
                </div>
              </div>
            </Panel>

            <Panel title="Links">
              <div className="flex flex-col space-y-8 md:space-y-5 truncate">
                <div className="flex flex-col md:flex-row space-y-8 md:space-y-0 md:space-x-8 md:items-end">
                  <div className="flex-1">
                    <PreLabeledInput
                      id="discordUser"
                      label="Discord"
                      preLabel="http://discord.com/"
                      defaultValue={appDetails.app.discordUser}
                    />
                  </div>
                  <div className="flex-1">
                    <PreLabeledInput
                      id="twitterUser"
                      label="Twitter"
                      preLabel="https://twitter.com/"
                      defaultValue={appDetails.app.twitterUser}
                    />
                  </div>
                </div>

                <div className="flex flex-col md:flex-row space-y-8 md:space-y-0 md:space-x-8 md:items-end">
                  <div className="flex-1">
                    <PreLabeledInput
                      id="mediumUser"
                      label="Medium"
                      preLabel="https://medium.com/@"
                      defaultValue={appDetails.app.mediumUser}
                    />
                  </div>
                  <div className="flex-1">
                    <PreLabeledInput
                      id="mirrorURL"
                      label="Mirror"
                      preLabel="https://mirror.xyz/"
                      defaultValue={appDetails.app.mirrorURL}
                    />
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Danger Zone">
              <Text
                type="span"
                weight="medium"
                size="sm"
                className="text-red-500 cursor-pointer"
                onClick={() => {
                  setDeleteModalOpen(true)
                }}
              >
                Delete the App
              </Text>
            </Panel>
          </section>
        </fieldset>
      </Form>
    </>
  )
}
