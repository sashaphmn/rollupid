import React from 'react'

import { TbUserCircle, TbWorldCog } from 'react-icons/tb'

const connectedAccountsSVG = (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 21L5.5 18.5M18.5 5.5L21 3M10 11L8 13M13 14L11 16M7 12L12 17L10.5 18.5C10.1737 18.8371 9.78351 19.1059 9.35225 19.2907C8.921 19.4755 8.45728 19.5727 7.98811 19.5765C7.51894 19.5803 7.0537 19.4907 6.61951 19.3129C6.18531 19.1351 5.79084 18.8727 5.45908 18.5409C5.12731 18.2092 4.86489 17.8147 4.6871 17.3805C4.50931 16.9463 4.41971 16.4811 4.42352 16.0119C4.42733 15.5427 4.52447 15.079 4.70929 14.6477C4.8941 14.2165 5.16289 13.8263 5.5 13.5L7 12ZM17 12L12 7L13.5 5.5C13.8263 5.16289 14.2165 4.8941 14.6477 4.70929C15.079 4.52447 15.5427 4.42733 16.0119 4.42352C16.4811 4.41971 16.9463 4.50931 17.3805 4.6871C17.8147 4.86489 18.2092 5.12731 18.5409 5.45908C18.8727 5.79084 19.1351 6.18531 19.3129 6.61951C19.4907 7.0537 19.5803 7.51894 19.5765 7.98811C19.5727 8.45728 19.4755 8.921 19.2907 9.35225C19.1059 9.78351 18.8371 10.1737 18.5 10.5L17 12Z"
      stroke="CurrentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const emailSVG = (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M3 7C3 6.46957 3.21071 5.96086 3.58579 5.58579C3.96086 5.21071 4.46957 5 5 5H19C19.5304 5 20.0391 5.21071 20.4142 5.58579C20.7893 5.96086 21 6.46957 21 7M3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7M3 7L12 13L21 7"
      stroke="CurrentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const smartContractsSVG = (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M3.87868 3.87868C4.44129 3.31607 5.20435 3 6 3H16C16.5304 3 17.0391 3.21071 17.4142 3.58579C17.7893 3.96086 18 4.46957 18 5V7C18.5304 7 19.0391 7.21071 19.4142 7.58579C19.7893 7.96086 20 8.46957 20 9V10.5C20 11.0523 19.5523 11.5 19 11.5C18.4477 11.5 18 11.0523 18 10.5V9H6C5.65606 9 5.3182 8.94094 5 8.82843V18C5 18.2652 5.10536 18.5196 5.29289 18.7071C5.48043 18.8946 5.73478 19 6 19H13.5C14.0523 19 14.5 19.4477 14.5 20C14.5 20.5523 14.0523 21 13.5 21H6C5.20435 21 4.44129 20.6839 3.87868 20.1213C3.31607 19.5587 3 18.7956 3 18V6C3 5.20435 3.31607 4.44129 3.87868 3.87868ZM5 6C5 6.26522 5.10536 6.51957 5.29289 6.70711C5.48043 6.89464 5.73478 7 6 7H16L16 5L6 5C5.73478 5 5.48043 5.10536 5.29289 5.29289C5.10536 5.48043 5 5.73478 5 6Z"
      fill="CurrentColor"
    />
    <path
      d="M17.8944 13.4472C18.1414 12.9532 17.9412 12.3526 17.4472 12.1056C16.9532 11.8586 16.3526 12.0588 16.1056 12.5528L14.1056 16.5528C13.9506 16.8628 13.9671 17.2309 14.1493 17.5257C14.3316 17.8205 14.6534 18 15 18H17.382L16.1056 20.5528C15.8586 21.0468 16.0588 21.6474 16.5528 21.8944C17.0468 22.1414 17.6474 21.9412 17.8944 21.4472L19.8944 17.4472C20.0494 17.1372 20.0329 16.7691 19.8507 16.4743C19.6684 16.1795 19.3466 16 19 16H16.618L17.8944 13.4472Z"
      fill="CurrentColor"
    />
  </svg>
)

// eslint-disable-next-line react/display-name
export default ({ scope }: { scope: string }) => {
  let icon: JSX.Element
  switch (scope) {
    case 'connected_accounts':
      icon = connectedAccountsSVG
      break
    case 'email':
      icon = emailSVG
      break
    case 'erc_4337':
      icon = smartContractsSVG
      break
    case 'profile':
      icon = <TbUserCircle className="w-6 h-6" />
      break
    case 'system_identifiers':
      icon = <TbWorldCog className="w-6 h-6" />
      break
  }
  return (
    <div className="w-[38px] h-[38px] rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-200 flex justify-center items-center flex-shrink-0">
      {icon}
    </div>
  )
}
