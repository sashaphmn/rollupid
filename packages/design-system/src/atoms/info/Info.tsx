import React from 'react'

import { HiOutlineExclamationTriangle } from 'react-icons/hi2'

import iIcon from './i.svg'
import { Tooltip } from 'flowbite-react'
import { Text } from '../../atoms/text/Text'

export default function Info({
  name,
  description,
  placement = 'bottom',
  editable = false,
  warning = false,
}: {
  name: string
  description: string | JSX.Element
  placement?: 'top' | 'bottom' | 'left' | 'right'
  editable?: boolean
  warning?: boolean
}) {
  return (
    <div className="w-fit flex-shrink-0">
      <Tooltip
        arrow={false}
        content={
          <div className="max-w-[322px]">
            {!editable && (
              <Text size="xs" className="text-left text-gray-400">
                NON-EDITABLE FIELD
              </Text>
            )}
            <Text
              size="xs"
              className="text-left text-gray-700 whitespace-normal"
            >
              {description}
            </Text>
          </div>
        }
        className="!bg-white shadow absolute z-5 w-max"
        placement={placement}
      >
        {warning ? (
          <HiOutlineExclamationTriangle className="text-orange-500" />
        ) : (
          <img src={iIcon} alt={`${name} info`} />
        )}
      </Tooltip>
    </div>
  )
}
