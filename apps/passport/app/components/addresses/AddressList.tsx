import { AddressURNSpace } from '@proofzero/urns/address'
import type { AddressURN } from '@proofzero/urns/address'

import { List } from '@proofzero/design-system/src/atoms/lists/List'
import { Text } from '@proofzero/design-system/src/atoms/text/Text'

import type { AddressListItemProps } from './AddressListItem'
import { AddressListItem } from './AddressListItem'

export type AddressListProps = {
  addresses: AddressListItemProps[]
  primaryAddressURN: AddressURN
  showReconnectAccount?: boolean
  onSetPrimary?: (id: string) => void
}

export const AddressList = ({
  addresses,
  primaryAddressURN,
  showReconnectAccount = true,
  onSetPrimary,
}: AddressListProps) => {
  return addresses.length ? (
    <List
      items={addresses.map((ali) => ({
        key: ali.id,
        val: ali,
        primary:
          AddressURNSpace.decode(ali.id as AddressURN) ===
          AddressURNSpace.decode(primaryAddressURN),
      }))}
      itemRenderer={(item) => (
        <AddressListItem
          key={item.key}
          {...item.val}
          primary={item.primary}
          showReconnectAccount={showReconnectAccount}
          onSetPrimary={onSetPrimary}
        />
      )}
    />
  ) : (
    <div className="w-full flex flex-col items-center justify-center">
      <Text className="mb-[27px] text-gray-500">
        No Vaults Account Detected ☹️
      </Text>
    </div>
  )
}
