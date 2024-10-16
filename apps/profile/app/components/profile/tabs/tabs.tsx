import { useState } from 'react'
import classNames from 'classnames'
import { Text } from '@proofzero/design-system/src/atoms/text/Text'

const tabs: Record<
  string,
  {
    title: string
    disabled?: boolean
  }
> = {
  links: { title: 'Links' },
  gallery: { title: 'Gallery' },
}

export type ProfileTabsProps = {
  path: string
  handleTab: (tab: string, opts: { replace: boolean }) => void
  enableGallery?: boolean
}

const ProfileTabs = ({ path, handleTab }: ProfileTabsProps) => {
  const [currentTab, setCurrentTab] = useState<string>(path || 'links')
  return (
    <div className="block">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex" aria-label="Tabs">
          {Object.keys(tabs).map((tab) => {
            return (
              <button
                key={tab}
                disabled={tabs[tab].disabled}
                onClick={() => {
                  setCurrentTab(tab)
                  handleTab(`./${tab}`, { replace: true })
                }}
                className={classNames(
                  tab === currentTab
                    ? 'border-indigo-500 font-semibold text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                  'whitespace-nowrap py-4 px-1 border-b-2 flex-1'
                )}
              >
                <Text
                  size="sm"
                  weight="medium"
                  className={classNames(
                    tabs[tab].disabled ? 'text-gray-300' : null
                  )}
                >
                  {tabs[tab].title}
                </Text>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export default ProfileTabs
