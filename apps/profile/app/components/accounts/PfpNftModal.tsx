import { Modal } from '@proofzero/design-system/src/molecules/modal/Modal'
import { Text } from '@proofzero/design-system/src/atoms/text/Text'

import FilteredNftGrid from '../nfts/grid/filtered'
import UnfilteredNftGrid from '../nfts/grid/unfiltered'
import SelectableNft from '../nfts/interactible'
import { LoadingGridSquares } from '../nfts/grid/loading'
import { HiOutlineX } from 'react-icons/hi'

type PfpNftModalProps = {
  text: string
  nfts: any[]
  pfp: string
  displayName: string
  isOpen: boolean
  loadingConditions: boolean
  collection: string

  setCollection: (collection: string) => void
  handleClose: (value: boolean) => void
  handleSelectedNft: (nft: any) => void
}

const PfpNftModal = ({
  nfts,
  text,
  isOpen,
  pfp,
  loadingConditions,
  handleClose,
  displayName,
  handleSelectedNft,
  collection,
  setCollection,
}: PfpNftModalProps) => {
  const displayText = `Looks like ${displayName} doesn't own any NFTs`

  return (
    <Modal isOpen={isOpen} fixed handleClose={handleClose}>
      <div
        className="flex-1 relative bg-white
        overflow-x-visible max-h-[900px] w-screen min-[480px]:w-full px-2
      py-4 text-left transition-all rounded-lg overflow-y-auto"
      >
        <div className="flex flex-col w-full items-center justify-between px-3 pb-2 lg:pb-4">
          <Text
            className="lg:px-4 px-3 pb-2 text-center
            text-gray-800"
            size="2xl"
            weight="bold"
          >
            {text}
          </Text>
          <button
            className={`bg-white p-2 rounded-lg text-xl cursor-pointer
                      hover:bg-[#F3F4F6]`}
            onClick={() => {
              handleClose(false)
            }}
          >
            <HiOutlineX />
          </button>
        </div>

        {collection.length ? (
          <UnfilteredNftGrid
            nfts={nfts}
            isModal={true}
            displayText={displayText}
            loadingConditions={loadingConditions}
            setCollection={setCollection}
            collection={collection}
            preload={true}
            handleSelectedNft={(nft) => {
              handleSelectedNft(nft)
            }}
            nftRenderer={(nft, selected, handleSelectedNft) => (
              <SelectableNft
                nft={nft}
                hovered={true}
                selected={selected}
                handleSelectedNft={(nft: any) => {
                  handleSelectedNft(nft)
                }}
              />
            )}
            nftGrid={<LoadingGridSquares numberOfCells={30} />}
          />
        ) : (
          <FilteredNftGrid
            nfts={nfts}
            preload={true}
            isModal={true}
            displayText={displayText}
            pfp={pfp}
            loadingConditions={loadingConditions}
            filters
            handleSelectedNft={(nft) => {
              setCollection(nft.contract.address)
            }}
            nftRenderer={(nft, selected, handleSelectedNft) => (
              <SelectableNft
                nft={nft}
                selected={selected}
                handleSelectedNft={(nft: any) => {
                  setCollection(nft.contract.address)
                }}
              />
            )}
            nftGrid={<LoadingGridSquares numberOfCells={30} />}
          />
        )}
      </div>
    </Modal>
  )
}

export default PfpNftModal
