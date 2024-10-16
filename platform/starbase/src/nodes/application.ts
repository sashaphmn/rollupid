import { toHex } from 'viem'

import { ApplicationURN } from '@proofzero/urns/application'
import { DOProxy } from 'do-proxy'
import {
  exportJWK,
  generateKeyPair,
  importJWK,
  jwtVerify,
  JWTVerifyResult,
  KeyLike,
  SignJWT,
} from 'jose'

import type { Environment } from '@proofzero/platform.core'

import {
  CUSTOM_DOMAIN_CHECK_INTERVAL,
  CUSTOM_DOMAIN_CHECK_PERIOD,
  STARBASE_API_KEY_ISSUER,
} from '../constants'
import type {
  AppAllFields,
  AppObject,
  AppReadableFields,
  AppUpdateableFields,
  ExternalAppDataPackageDetails,
} from '../types'
import {
  AppTheme,
  EmailOTPTheme,
  OGTheme,
  PaymasterType,
} from '../jsonrpc/validators/app'
import { InternalServerError, RollupError } from '@proofzero/errors'

import type { CustomDomain, ExternalAppDataPackageDefinition } from '../types'
import { getCloudflareFetcher, getCustomHostname } from '../utils/cloudflare'
import { getDNSRecordValue } from '@proofzero/utils'
import {
  ExternalAppDataPackageType,
  ServicePlanType,
} from '@proofzero/types/billing'
import { KeyPairSerialized } from '@proofzero/packages/types/application'
import {
  generateUsageKey,
  getStoredUsageWithMetadata,
  UsageCategory,
} from '@proofzero/utils/usage'
import ExternalAppDataPackages from '@proofzero/utils/externalAppDataPackages'
import { NodeMethodReturnValue } from '@proofzero/types/node'
import { ExternalStorageAlreadyDisabledError } from '../errors'
import { ExternalAppDataPackageStatus } from '../jsonrpc/validators/externalAppDataPackageDefinition'

type AppDetails = AppUpdateableFields & AppReadableFields
type AppProfile = AppUpdateableFields

interface KeyPair {
  publicKey: KeyLike | Uint8Array
  privateKey: KeyLike | Uint8Array
}

type Alarms = {
  customDomain?: {
    start: number
    current: number
    finish: number
  }
}

const JWT_OPTIONS = {
  alg: 'ES256',
  jti: {
    length: 24,
  },
}

export default class StarbaseApplication extends DOProxy {
  declare state: DurableObjectState
  declare env: Environment

  constructor(state: DurableObjectState, env: Environment) {
    super(state)
    this.env = env
    this.state = state
  }

  async init(clientId: string, clientName: string): Promise<void> {
    //These key-vals get stored as key-vals in the DO itself
    const entriesToStore: Partial<AppAllFields> = {
      clientId,
      clientName,
      app: {
        name: clientName,
        scopes: [],
      },
      createdTimestamp: Date.now(),
    }
    this.state.storage.put(entriesToStore)
  }

  async delete(): Promise<void> {
    //As per docs, this doesn't guarnatee deletion in cases of failure.
    //Only a subset of data may be deleted
    this.state.storage.deleteAll()
  }

  async update(updates: Partial<AppObject>): Promise<void> {
    const storedValues = await this.state.storage.get<AppObject>('app')
    if (!storedValues)
      throw new InternalServerError({ message: 'missing app object' })

    //Merge values in app object
    const mergedEntries = new Map(Object.entries(storedValues))
    Object.entries(updates).forEach(([k, v]) => mergedEntries.set(k, v))
    const mergedObject = Object.fromEntries(mergedEntries.entries())
    await this.state.storage.put('app', mergedObject)
  }

  async setPaymaster(paymaster: PaymasterType): Promise<void> {
    await this.state.storage.put('blockchain', { paymaster })
  }

  async getPaymaster(): Promise<PaymasterType> {
    const blockchain = (await this.state.storage.get('blockchain')) as {
      paymaster: PaymasterType
    }
    return blockchain?.paymaster as PaymasterType
  }

  async getDetails(): Promise<AppDetails> {
    const keysWeWant: Array<keyof AppDetails> = [
      'app',
      'clientId',
      'clientName',
      'published',
      'secretTimestamp',
      'apiKeyTimestamp',
      'createdTimestamp',
      'termsURL',
      'privacyURL',
      'customDomain',
      'appPlan',
      'externalAppDataPackageDefinition',
    ]
    const appObj = await this.state.storage.get(keysWeWant)
    const result = Object.fromEntries(appObj) as AppDetails
    return result
  }

  async getProfile(): Promise<AppProfile> {
    const keysWeWant: Array<keyof AppProfile> = [
      'app',
      'clientName',
      'published',
    ]
    const appObj = await this.state.storage.get(keysWeWant)
    const result = Object.fromEntries(appObj) as AppProfile
    return result
  }

  async publish(published: boolean): Promise<void> {
    this.state.storage.put('published', published)
  }

  async rotateClientSecret(clientSecret: string): Promise<void> {
    this.state.storage.put({ clientSecret })
    this.state.storage.put('secretTimestamp', Date.now())
  }

  async validateClientSecret(hashedClientSecret: string): Promise<boolean> {
    const storedSecret = await this.state.storage.get('clientSecret')
    return storedSecret === hashedClientSecret
  }

  async rotateApiKey(appUrn: ApplicationURN): Promise<string> {
    const apiKey = await this.generateAndStore(appUrn)
    this.state.storage.put('apiKey', apiKey)
    this.state.storage.put('apiKeyTimestamp', Date.now())
    return apiKey
  }

  async generateAndStore(appURN: ApplicationURN): Promise<string> {
    const { privateKey: key } = await this.getJWTSigningKeyPair()

    const buffer = new Uint8Array(JWT_OPTIONS.jti.length)
    const jti = toHex(crypto.getRandomValues(buffer))

    const apiKey = await new SignJWT({})
      .setProtectedHeader(JWT_OPTIONS)
      .setIssuedAt()
      .setIssuer(STARBASE_API_KEY_ISSUER)
      .setJti(jti)
      .setSubject(appURN)
      .sign(key)

    return apiKey
  }

  async verify(apiKey: string): Promise<JWTVerifyResult | undefined> {
    const { alg } = JWT_OPTIONS
    const { publicKey: key } = await this.getJWTSigningKeyPair()
    const options = { algorithms: [alg] }
    try {
      return jwtVerify(apiKey, key, options)
    } catch (e) {
      console.error('Error verifying API key validity.', e)
    }
  }

  async getJWTSigningKeyPair(): Promise<KeyPair> {
    const { alg } = JWT_OPTIONS
    const stored = (await this.state.storage.get(
      'apiKeySigningKeyPair'
    )) as KeyPairSerialized
    if (stored) {
      return {
        publicKey: await importJWK(stored.publicKey, alg),
        privateKey: await importJWK(stored.privateKey, alg),
      }
    }

    const generated: KeyPair = await generateKeyPair(alg, {
      extractable: true,
    })

    this.state.storage.put('apiKeySigningKeyPair', {
      publicKey: await exportJWK(generated.publicKey),
      privateKey: await exportJWK(generated.privateKey),
    })

    return generated
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    const storedKey = await this.state.storage.get('apiKey')
    return apiKey === storedKey
  }

  async hasClientSecret(): Promise<boolean> {
    const storedSecret = await this.state.storage.get<string>('clientSecret')
    return (storedSecret && storedSecret.length > 0) || false
  }

  async getTheme(): Promise<AppTheme | undefined> {
    return this.state.storage.get<AppTheme>('theme')
  }

  async setTheme(theme: AppTheme): Promise<void> {
    return this.state.storage.put('theme', theme)
  }

  async setCustomDomainAlarm() {
    const start = Date.now()
    const current = start + 10000
    const finish = start + CUSTOM_DOMAIN_CHECK_PERIOD

    const alarms: Alarms = await this.getAlarms()
    alarms.customDomain = { start, current, finish }
    await this.state.storage.put({ alarms })
    await this.state.storage.setAlarm(current)
  }

  async unsetCustomDomainAlarm() {
    const alarms: Alarms = await this.getAlarms()
    delete alarms.customDomain
    await this.state.storage.put({ alarms })
  }

  async handleCustomDomainAlarm(alarms: Alarms) {
    if (!alarms.customDomain) return

    const now = Date.now()
    const { start, current, finish } = alarms.customDomain
    if (Math.abs(now - current) > 1000) return

    if (now < start || now >= finish) return

    const { storage } = this.state
    const stored = await storage.get<CustomDomain>('customDomain')
    if (!stored) return

    const fetcher = getCloudflareFetcher(this.env.TOKEN_CLOUDFLARE_API)
    const customDomain = await getCustomHostname(
      fetcher,
      this.env.INTERNAL_CLOUDFLARE_ZONE_ID,
      stored.id
    )

    for (const dnsRec of stored.dns_records) {
      dnsRec.value = await getDNSRecordValue(dnsRec.name, dnsRec.record_type)
    }
    customDomain.dns_records = stored.dns_records
    customDomain.ownership_verification = stored.ownership_verification
    customDomain.ssl.validation_records = stored.ssl.validation_records

    await storage.put({ customDomain })

    if (
      customDomain.status === 'active' &&
      customDomain.ssl.status === 'active' &&
      stored.dns_records.every((rec) => rec.value?.includes(rec.expected_value))
    )
      return this.unsetCustomDomainAlarm()

    const next = now + CUSTOM_DOMAIN_CHECK_INTERVAL
    alarms.customDomain.current = next
    await storage.put({ alarms })
    await storage.setAlarm(next)
  }

  async getAlarms(): Promise<Alarms> {
    return (await this.state.storage.get<Alarms>('alarms')) || {}
  }

  async alarm() {
    const alarms: Alarms = await this.getAlarms()
    if (alarms.customDomain) await this.handleCustomDomainAlarm(alarms)
  }

  async getEmailOTPTheme(): Promise<EmailOTPTheme | undefined> {
    return this.state.storage.get<EmailOTPTheme>('emailOTPTheme')
  }

  async setEmailOTPTheme(theme: EmailOTPTheme): Promise<void> {
    return this.state.storage.put('emailOTPTheme', theme)
  }

  async getOgTheme(): Promise<OGTheme | undefined> {
    return this.state.storage.get<OGTheme>('ogTheme')
  }

  async setOgTheme(theme: OGTheme): Promise<void> {
    return this.state.storage.put('ogTheme', theme)
  }

  async getAppPlan(): Promise<ServicePlanType | undefined> {
    return this.state.storage.get<ServicePlanType>('appPlan')
  }

  async setAppPlan(planType: ServicePlanType): Promise<void> {
    return this.state.storage.put('appPlan', planType)
  }

  async setExternalAppDataPackage(
    clientId: string,
    externalAppDataPackage:
      | {
          packageType: ExternalAppDataPackageType
          subscriptionID: string
        }
      | undefined,
    autoTopUp = false
  ): Promise<NodeMethodReturnValue<boolean, RollupError>> {
    const externalStorageUsageWriteKey = generateUsageKey(
      clientId,
      UsageCategory.ExternalAppDataWrite
    )
    const externalStorageUsageReadKey = generateUsageKey(
      clientId,
      UsageCategory.ExternalAppDataRead
    )

    const externalStorageWrites = await this.env.UsageKV.get(
      externalStorageUsageWriteKey
    )
    const externalStorageReads = await this.env.UsageKV.get(
      externalStorageUsageReadKey
    )

    const packageDetails: ExternalAppDataPackageDetails | undefined =
      externalAppDataPackage
        ? {
            ...externalAppDataPackage,
            ...ExternalAppDataPackages[externalAppDataPackage.packageType],
          }
        : undefined

    if (packageDetails) {
      const packageDef =
        await this.state.storage.get<ExternalAppDataPackageDefinition>(
          'externalAppDataPackageDefinition'
        )

      if (!externalStorageWrites) {
        await this.env.UsageKV.put(externalStorageUsageWriteKey, '0', {
          metadata: {
            limit: packageDetails.writes,
          },
        })
      } else {
        let limit = packageDetails.writes
        if (packageDef) {
          const {
            numValue: externalStorageWriteVal,
            metadata: externalStorageWriteMetadata,
          } = await getStoredUsageWithMetadata(
            this.env.UsageKV,
            externalStorageUsageWriteKey
          )
          const writeOutstandingLimit =
            externalStorageWriteMetadata.limit >
            packageDef.packageDetails.writes
              ? externalStorageWriteMetadata.limit -
                Math.max(
                  externalStorageWriteVal,
                  packageDef.packageDetails.writes
                )
              : 0
          limit = packageDetails.writes + Math.max(writeOutstandingLimit, 0)
        }

        await this.env.UsageKV.put(
          externalStorageUsageWriteKey,
          externalStorageWrites,
          {
            metadata: {
              limit,
            },
          }
        )
      }
      if (!externalStorageReads) {
        await this.env.UsageKV.put(externalStorageUsageReadKey, '0', {
          metadata: {
            limit: packageDetails.reads,
          },
        })
      } else {
        let limit = packageDetails.reads
        if (packageDef) {
          const {
            numValue: externalStorageReadVal,
            metadata: externalStorageReadMetadata,
          } = await getStoredUsageWithMetadata(
            this.env.UsageKV,
            externalStorageUsageReadKey
          )
          const readOutstandingLimit =
            externalStorageReadMetadata.limit > packageDef.packageDetails.reads
              ? externalStorageReadMetadata.limit -
                Math.max(
                  externalStorageReadVal,
                  packageDef.packageDetails.reads
                )
              : 0
          limit = packageDetails.reads + Math.max(readOutstandingLimit, 0)
        }

        await this.env.UsageKV.put(
          externalStorageUsageReadKey,
          externalStorageReads,
          {
            metadata: {
              limit,
            },
          }
        )
      }
    } else {
      if (!externalStorageWrites && !externalStorageReads) {
        return { error: ExternalStorageAlreadyDisabledError }
      } else if (externalStorageWrites || externalStorageReads) {
        console.warn(
          `external storage reads or writes for ${clientId} in a bad state; ${externalStorageWrites} writes and ${externalStorageReads} reads.`
        )
      }

      await this.env.UsageKV.delete(externalStorageUsageWriteKey)
      await this.env.UsageKV.delete(externalStorageUsageReadKey)
    }

    if (packageDetails) {
      await this.state.storage.put<ExternalAppDataPackageDefinition>(
        'externalAppDataPackageDefinition',
        {
          packageDetails,
          status: ExternalAppDataPackageStatus.Enabled,
          autoTopUp,
        }
      )
    } else {
      const currentPackageDefinition =
        await this.state.storage.get<ExternalAppDataPackageDefinition>(
          'externalAppDataPackageDefinition'
        )
      if (!currentPackageDefinition) {
        throw new InternalServerError({
          message:
            'No existing package definition found when attempting cancellation',
        })
      }

      await this.state.storage.put<ExternalAppDataPackageDefinition>(
        'externalAppDataPackageDefinition',
        {
          packageDetails: currentPackageDefinition.packageDetails,
          status: ExternalAppDataPackageStatus.Deleting,
          autoTopUp: false,
        }
      )
    }

    return { value: true }
  }

  async setExternalAppDataPackageStatus(
    status: ExternalAppDataPackageStatus
  ): Promise<void> {
    const currentPackageDefinition =
      await this.state.storage.get<ExternalAppDataPackageDefinition>(
        'externalAppDataPackageDefinition'
      )
    if (!currentPackageDefinition) {
      throw new InternalServerError({
        message: 'No existing package definition found when setting status',
      })
    }

    if (
      currentPackageDefinition.status === ExternalAppDataPackageStatus.Deleting
    ) {
      throw new InternalServerError({
        message: 'Cannot set status when package is in deleting state',
      })
    }

    await this.state.storage.put<ExternalAppDataPackageDefinition>(
      'externalAppDataPackageDefinition',
      {
        packageDetails: currentPackageDefinition.packageDetails,
        status,
        autoTopUp: currentPackageDefinition.autoTopUp,
      }
    )
  }

  async setQueueLimitAndOffset(
    input:
      | {
          limit: number
          offset: number
        }
      | undefined
  ): Promise<void> {
    if (!input) {
      await this.state.storage.delete('deletionQuery')
    } else {
      await this.state.storage.put('deletionQuery', input)
    }
  }

  async getQueueLimitAndOffset(): Promise<
    | {
        limit: number
        offset: number
      }
    | undefined
  > {
    return this.state.storage.get('deletionQuery')
  }

  async deleteAppPlan(): Promise<boolean> {
    return this.state.storage.delete('appPlan')
  }
}

export const getApplicationNodeByClientId = async (
  clientId: string,
  durableObject: DurableObjectNamespace
) => {
  const proxy = StarbaseApplication.wrap(durableObject)
  const appDO = proxy.getByName(clientId)
  return appDO
}
