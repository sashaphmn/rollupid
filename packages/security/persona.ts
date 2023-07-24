import { AccessURN, AccessURNSpace } from '@proofzero/urns/access'
import { AddressURN, AddressURNSpace } from '@proofzero/urns/address'
import {
  generateTraceContextHeaders,
  TraceSpan,
} from '@proofzero/platform-middleware/trace'
import { AccountURN, AccountURNSpace } from '@proofzero/urns/account'
import { PlatformAddressURNHeader } from '@proofzero/types/headers'
import {
  BadRequestError,
  InternalServerError,
  RollupError,
  UnauthorizedError,
} from '@proofzero/errors'
import {
  CryptoAddressType,
  EmailAddressType,
  OAuthAddressType,
} from '@proofzero/types/address'
import {
  AuthorizationControlSelection,
  PersonaData,
} from '@proofzero/types/application'
import { AnyURN } from '@proofzero/urns'
import { EDGE_HAS_REFERENCE_TO } from '@proofzero/types/graph'
import { NO_OP_ADDRESS_PLACEHOLDER } from '@proofzero/platform.address/src/constants'
import createCoreClient from '@proofzero/platform-clients/core'

export async function validatePersonaData(
  accountUrn: AccountURN,
  personaData: PersonaData,
  coreFetcher: Fetcher,
  traceSpan: TraceSpan
): Promise<void> {
  //If there's nothing to validate, return right away
  if (!personaData) return

  for (const [scopeName, claimValue] of Object.entries(personaData)) {
    //TODO: Make this more generic to apply to any claims
    if (scopeName === 'email') {
      const addressUrnForEmail = claimValue
      if (!AddressURNSpace.is(addressUrnForEmail))
        throw new BadRequestError({
          message: 'Bad data received for address identifier',
        })

      const coreClient = createCoreClient(coreFetcher, {
        [PlatformAddressURNHeader]: addressUrnForEmail,
        ...generateTraceContextHeaders(traceSpan),
      })
      const retrievedAccountUrn = await coreClient.address.getAccount.query()

      if (retrievedAccountUrn !== accountUrn)
        throw new BadRequestError({
          message: 'Address provided does not belong to authenticated account',
        })

      const addressProfile = await coreClient.address.getAddressProfile.query()
      if (
        addressProfile.type !== OAuthAddressType.Google &&
        addressProfile.type !== OAuthAddressType.Microsoft &&
        addressProfile.type !== OAuthAddressType.Apple &&
        addressProfile.type !== EmailAddressType.Email
      )
        throw new BadRequestError({
          message: 'Address provided is not an email-compatible address',
        })
    } else if (['connected_accounts', 'erc_4337'].includes(scopeName)) {
      const authorizedAddressUrns = claimValue

      //If user selection is ALL, there's nothing further to validate
      if (claimValue === AuthorizationControlSelection.ALL) continue

      //If user selection is not ALL, check expected data type in personaData, ie. AddressURN[]
      if (
        !(
          authorizedAddressUrns &&
          Array.isArray(authorizedAddressUrns) &&
          authorizedAddressUrns.every((e) => AddressURNSpace.is(e))
        )
      ) {
        throw new BadRequestError({
          message: 'Bad data received for list of address identifiers',
        })
      }

      const coreClient = createCoreClient(coreFetcher, {
        ...generateTraceContextHeaders(traceSpan),
      })
      const accountAddresses = await coreClient.account.getAddresses.query({
        account: accountUrn,
      })

      const ownedAddressURNList =
        accountAddresses?.map((aa) => aa.baseUrn) || []

      //Check if authorized address set is fully owned by the account doing the authorization
      if (
        !accountAddresses ||
        !authorizedAddressUrns.every((addressURN) =>
          ownedAddressURNList.includes(addressURN)
        )
      ) {
        throw new UnauthorizedError({
          message:
            'Mismatch in addresses provided vs addresses connected to account',
        })
      }
    }
  }
}

/* Sets authorization references to other nodes in the graph. Assumes that
 * validation has been executed and trusts validity of data being passed in */
export async function setPersonaReferences(
  accessNode: AccessURN,
  scope: string[],
  personaData: PersonaData,
  coreFetcher: Fetcher,
  traceSpan: TraceSpan
) {
  //We could have multiple nodes being referenced across multiple scope values
  //so we create a unique listing of them before creating the edges
  const uniqueAuthorizationReferences = new Set<AnyURN>()

  for (const scopeEntry of scope) {
    //TODO: make this more generic so it applies to all claims
    if (scopeEntry === 'email' && personaData.email) {
      uniqueAuthorizationReferences.add(personaData.email)
    } else if (
      scopeEntry === 'connected_accounts' &&
      personaData.connected_accounts &&
      Array.isArray(personaData.connected_accounts)
    ) {
      //This (correctly) gets skipped when personaData value of
      //connected_accounts is set to ALL
      personaData.connected_accounts.forEach((addressUrn) =>
        uniqueAuthorizationReferences.add(addressUrn)
      )
    } else if (
      scopeEntry === 'erc_4337' &&
      personaData.erc_4337 &&
      Array.isArray(personaData.erc_4337)
    ) {
      //This (correctly) gets skipped when personaData value of
      //erc_4337 is set to ALL
      personaData.erc_4337.forEach((addressUrn) =>
        uniqueAuthorizationReferences.add(addressUrn)
      )
    }
  }

  const coreClient = createCoreClient(
    coreFetcher,
    generateTraceContextHeaders(traceSpan)
  )

  //TODO: The next set of 3 operations will need to be optmizied into a single
  //SQL transaction

  //Get existing references
  const edgesToDelete = await coreClient.edges.getEdges.query({
    query: { tag: EDGE_HAS_REFERENCE_TO, src: { baseUrn: accessNode } },
  })

  //Delete existing references
  edgesToDelete.edges.forEach(
    async (edge) =>
      await coreClient.edges.removeEdge.mutate({
        tag: edge.tag,
        dst: edge.dst.baseUrn,
        src: edge.src.baseUrn,
      })
  )

  //Add new references
  const edges = await Promise.allSettled(
    [...uniqueAuthorizationReferences].map((refUrn) => {
      //This returns promises that get awaited collectively above
      return coreClient.edges.makeEdge.mutate({
        src: accessNode,
        tag: EDGE_HAS_REFERENCE_TO,
        dst: refUrn,
      })
    })
  )
}

export type ClaimValueType =
  | string
  | {
      [K: string]: ClaimValueType
    }
  | ClaimValueType[]

export type ClaimName = string
export type ScopeValueName = string
export type ClaimValuePairs = Record<ClaimName, ClaimValueType>

export type ScopeClaimsResponse = {
  claims: ClaimValuePairs
  meta: {
    urns: AnyURN[]
    valid: boolean
  }
}

export type ClaimData = {
  [s: ScopeValueName]: ScopeClaimsResponse
}

export type ScopeClaimRetrieverFunction = (
  scopeEntry: ScopeValueName,
  accountUrn: AccountURN,
  clientId: string,
  accessUrn: AccessURN,
  coreFetcher: Fetcher,
  personaData: PersonaData,
  traceSpan: TraceSpan
) => Promise<ClaimData>

function createInvalidClaimDataObject(scopeEntry: ScopeValueName): ClaimData {
  return {
    [scopeEntry]: {
      claims: {},
      meta: {
        urns: [],
        valid: false,
      },
    },
  }
}

class InvalidPersonaDataError extends RollupError {
  constructor() {
    super({ message: 'Invalid persona data' })
  }
}

//These retriever functions will be moved elsewhere as part of ticket #2013
async function emailClaimRetriever(
  scopeEntry: ScopeValueName,
  accountUrn: AccountURN,
  clientId: string,
  accessUrn: AccessURN,
  coreFetcher: Fetcher,
  personaData: PersonaData,
  traceSpan: TraceSpan
): Promise<ClaimData> {
  const coreClient = createCoreClient(
    coreFetcher,
    generateTraceContextHeaders(traceSpan)
  )

  if (personaData.email) {
    const emailAddressUrn = personaData.email
    const edgesResults = await coreClient.edges.getEdges.query({
      query: {
        src: { baseUrn: accessUrn },
        dst: { baseUrn: emailAddressUrn },
        tag: EDGE_HAS_REFERENCE_TO,
      },
    })
    const emailAddress = edgesResults.edges[0].dst.qc.alias
    const claimData: ClaimData = {
      [scopeEntry]: {
        claims: {
          email: emailAddress,
        },
        meta: {
          urns: [emailAddressUrn],
          valid: true,
        },
      },
    }
    return claimData
  }
  throw new InvalidPersonaDataError()
}

async function profileClaimsRetriever(
  scopeEntry: ScopeValueName,
  accountUrn: AccountURN,
  clientId: string,
  accessUrn: AccessURN,
  coreFetcher: Fetcher,
  personaData: PersonaData,
  traceSpan: TraceSpan
): Promise<ClaimData> {
  const coreClient = createCoreClient(
    coreFetcher,
    generateTraceContextHeaders(traceSpan)
  )
  const nodeResult = await coreClient.edges.findNode.query({
    baseUrn: accountUrn,
  })
  if (nodeResult && nodeResult.baseUrn) {
    return {
      [scopeEntry]: {
        claims: {
          name: nodeResult.qc.name,
          picture: nodeResult.qc.picture,
        },
        meta: {
          urns: [nodeResult.baseUrn],
          valid: true,
        },
      },
    }
  } else throw new InvalidPersonaDataError()
}

async function erc4337ClaimsRetriever(
  scopeEntry: ScopeValueName,
  accountUrn: AccountURN,
  clientId: string,
  accessUrn: AccessURN,
  coreFetcher: Fetcher,
  personaData: PersonaData,
  traceSpan: TraceSpan
): Promise<ClaimData> {
  const result = {
    erc_4337: {
      claims: {
        erc_4337: new Array(),
      },
      meta: {
        urns: new Array(),
        valid: true,
      },
    },
  } as const

  const coreClient = createCoreClient(
    coreFetcher,
    generateTraceContextHeaders(traceSpan)
  )

  if (personaData.erc_4337 === AuthorizationControlSelection.ALL) {
    //Referencable persona submission pointing to all connected sc wallets
    //at any point in time
    const accountAddresses =
      (
        await coreClient.account.getAddresses.query({
          account: accountUrn,
        })
      )?.filter(
        (address) => address.rc.addr_type === CryptoAddressType.Wallet
      ) || []

    for (const addressNode of accountAddresses) {
      result.erc_4337.claims.erc_4337.push({
        type: addressNode.rc.addr_type,
        identifier: addressNode.qc.alias,
      })
      result.erc_4337.meta.urns.push(addressNode.baseUrn)
    }
  } else {
    const walletAddressUrns = personaData.erc_4337 as AddressURN[]

    const coreClient = createCoreClient(
      coreFetcher,
      generateTraceContextHeaders(traceSpan)
    )
    const addressProfiles =
      await coreClient.address.getAddressProfileBatch.query(walletAddressUrns)

    addressProfiles.forEach((profile, idx) => {
      result.erc_4337.claims.erc_4337.push({
        nickname: profile.title,
        address: profile.address,
      })
      result.erc_4337.meta.urns.push(walletAddressUrns[idx])
    })
  }
  return result
}

async function connectedAccountsClaimsRetriever(
  scopeEntry: ScopeValueName,
  accountUrn: AccountURN,
  clientId: string,
  accessUrn: AccessURN,
  coreFetcher: Fetcher,
  personaData: PersonaData,
  traceSpan: TraceSpan
): Promise<ClaimData> {
  const result = {
    connected_accounts: {
      claims: {
        connected_accounts: new Array(),
      },
      meta: {
        urns: new Array(),
        valid: true,
      },
    },
  }

  const coreClient = createCoreClient(
    coreFetcher,
    generateTraceContextHeaders(traceSpan)
  )

  if (personaData.connected_accounts === AuthorizationControlSelection.ALL) {
    //Referencable persona submission pointing to all connected addresses
    //at any point in time
    const accountAddresses =
      (
        await coreClient.account.getAddresses.query({
          account: accountUrn,
        })
      )?.filter(
        (address) => address.rc.addr_type !== CryptoAddressType.Wallet
      ) || []

    for (const addressNode of accountAddresses) {
      result.connected_accounts.claims.connected_accounts.push({
        type: addressNode.rc.addr_type,
        identifier: addressNode.qc.alias,
      })
      result.connected_accounts.meta.urns.push(addressNode.baseUrn)
    }
  } else {
    //Static persona submission of addresses
    const authorizedAddresses = personaData.connected_accounts as AddressURN[]

    const nodeQueries = authorizedAddresses.map((address) => ({
      baseUrn: address,
    }))
    const nodeResults = await coreClient.edges.findNodeBatch.query(nodeQueries)

    nodeResults.forEach((addressNode, i) => {
      if (!addressNode)
        throw new InternalServerError({
          message: `Did not find result for node ${authorizedAddresses[i]}`,
        })
      result.connected_accounts.claims.connected_accounts.push({
        type: addressNode.rc.addr_type,
        identifier: addressNode.qc.alias,
      })
      result.connected_accounts.meta.urns.push(addressNode.baseUrn)
    })
  }
  return result
}

export const scopeClaimRetrievers: Record<
  ScopeValueName,
  ScopeClaimRetrieverFunction
> = {
  profile: profileClaimsRetriever,
  email: emailClaimRetriever,
  erc_4337: erc4337ClaimsRetriever,
  connected_accounts: connectedAccountsClaimsRetriever,
}

export async function getClaimValues(
  accountUrn: AccountURN,
  clientId: string,
  scope: string[],
  coreFetcher: Fetcher,
  traceSpan: TraceSpan,
  preFetchedPersonaData?: PersonaData
): Promise<ClaimData> {
  let result: ClaimData = {}

  let personaData = preFetchedPersonaData
  if (!personaData) {
    const coreClient = createCoreClient(
      coreFetcher,
      generateTraceContextHeaders(traceSpan)
    )
    personaData = await coreClient.access.getPersonaData.query({
      accountUrn,
      clientId,
    })
  }

  const accessId = `${AccountURNSpace.decode(accountUrn)}@${clientId}`
  const accessUrn = AccessURNSpace.componentizedUrn(accessId)

  const retrieverPromises = scope.map((scopeValue) => {
    const retrieverFunction = scopeClaimRetrievers[scopeValue]
    if (!retrieverFunction) return
    else
      return retrieverFunction(
        scopeValue,
        accountUrn,
        clientId,
        accessUrn,
        coreFetcher,
        personaData || {},
        traceSpan
      )
  })

  const retrieverResults = await Promise.allSettled(retrieverPromises)
  retrieverResults
    .map((r, idx) =>
      //In cases of errors in retriever, we don't retrun any claims and we mark the object
      //as invalid. It's the responsibility of caller to handle that upstream.
      r.status === 'fulfilled'
        ? r.value
        : createInvalidClaimDataObject(scope[idx])
    )
    .forEach((claimData) => (result = { ...result, ...claimData }))
  return result
}

export const userClaimsFormatter = (
  claimData: ClaimData,
  includeScopeValues?: string[]
): ClaimValuePairs => {
  let result: ClaimValuePairs = {}
  for (const scopeEntry of Object.keys(claimData)) {
    if (includeScopeValues) {
      if (includeScopeValues.includes(scopeEntry))
        result = { ...result, ...claimData[scopeEntry].claims }
      else continue
    } else {
      result = { ...result, ...claimData[scopeEntry].claims }
    }
  }
  return result
}
