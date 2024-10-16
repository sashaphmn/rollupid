import { Link, useSubmit } from '@remix-run/react'

import { BiLink } from 'react-icons/bi'
import { AiOutlineUser } from 'react-icons/ai'
import { RiCollageLine } from 'react-icons/ri'
import { HiOutlineExternalLink, HiOutlineLogout } from 'react-icons/hi'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'

import missingImage from '../../assets/missing-nft.svg'

import { Text } from '@proofzero/design-system'

import { Popover } from '@headlessui/react'

import { SideNavItem } from './item'

const subNavigation = [
  {
    name: 'User Settings',
    href: '/account/profile',
    icon: AiOutlineUser,
    exists: true,
  },
  {
    name: 'Profile Links',
    href: '/account/links',
    icon: BiLink,
    exists: true,
  },
  {
    name: 'NFT Gallery',
    href: '/account/gallery',
    icon: RiCollageLine,
    exists: true,
  },
]

export const DesktopSideNav = ({
  profile,
  identityURN,
}: {
  profile: { displayName: string; pfp?: { image: string } }
  identityURN: string
}) => {
  return (
    <aside
      className="fixed bottom-0 z-50 w-full lg:relative
      lg:col-start-1 lg:col-end-3 bg-gray-50"
    >
      <nav
        className="flex flex-row justify-center items-center lg:flex-none
      hidden lg:block space-y-1"
      >
        <SideNavBarebone profile={profile} identityURN={identityURN} />
      </nav>
    </aside>
  )
}

export const MobileSideNav = ({
  profile,
  identityURN,
  close,
  ref,
  open,
}: {
  profile: { displayName: string; pfp?: { image: string } }
  identityURN: string
  close: (
    focusableElement?:
      | HTMLElement
      | React.MutableRefObject<HTMLElement | null>
      | undefined
  ) => void
  ref?: React.Dispatch<React.SetStateAction<undefined>>
  open?: boolean
}) => {
  const submit = useSubmit()

  return (
    <nav className="flex flex-col flex-none justify-center items-center h-full">
      <div
        className="hidden h-[80px] sm:max-lg:flex w-full
      items-center justify-end"
      >
        <Popover.Button
          ref={ref}
          className="bg-gray-50 inline-flex items-center justify-center mr-2
                   text-gray-500 hover:text-gray-400 focus:outline-none p-2
                   focus:ring-2 focus:ring-gray-800 focus:ring-offset-2
                   focus:ring-offset-gray-800 rounded-lg"
        >
          <span className="sr-only">Open main menu</span>
          {open ? (
            <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
          ) : (
            <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
          )}
        </Popover.Button>
      </div>

      <SideNavBarebone
        profile={profile}
        identityURN={identityURN}
        close={close}
      />

      <button
        className="mt-auto px-4 py-4 hover:bg-gray-100 w-full
         text-left flex items-center text-red-500 text-sm"
        style={{ cursor: 'pointer' }}
        onClick={() => {
          close()
          submit(null, { method: 'post', action: '/signout/' })
        }}
      >
        <HiOutlineLogout size={22} className="mr-2" />
        <Text className="truncate" size="sm" weight="medium">
          Sign Out
        </Text>
      </button>
    </nav>
  )
}

export const SideNavBarebone = ({
  profile,
  identityURN,
  close,
}: {
  profile: { displayName: string; pfp?: { image: string } }
  identityURN: string
  close?: (
    focusableElement?:
      | HTMLElement
      | React.MutableRefObject<HTMLElement | null>
      | undefined
  ) => void
}) => {
  return (
    <div
      className="w-full"
      onClick={() => {
        if (close) close()
      }}
    >
      <div className="flex flex-row items-center mx-3 pb-6 pt-8 truncate">
        <img
          src={profile.pfp?.image}
          className="w-[42px] h-[42px] rounded-full mr-2"
          alt="PFP"
          onError={({ currentTarget }) => {
            currentTarget.onerror = null
            currentTarget.src = missingImage
          }}
        />
        <div className="flex-1 w-1 flex flex-col">
          <Text size="sm" weight="medium" className="truncate mb-1.5">
            {profile.displayName}
          </Text>
          <Link
            to={`/p/${identityURN}`}
            target="_blank"
            className="flex flex-row items-center text-indigo-500"
          >
            <Text size="xs" className="truncate">
              Open my Profile
            </Text>
            <HiOutlineExternalLink size={16} className="ml-2" />
          </Link>
        </div>
      </div>
      {subNavigation.map((item) => (
        <SideNavItem key={item.name} item={item} />
      ))}
    </div>
  )
}
