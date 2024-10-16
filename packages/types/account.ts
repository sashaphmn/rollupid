export enum NodeType {
  Crypto = 'crypto',
  Vault = 'vault',
  Contract = 'contract',
  OAuth = 'oauth',
  Email = 'email',
  Handle = 'handle',
  WebAuthN = 'webauthn',
}

export enum CryptoAccountType {
  ETH = 'eth',
  Wallet = 'smart_contract_wallet',
}

export enum OAuthAccountType {
  Google = 'google',
  GitHub = 'github',
  Twitter = 'twitter',
  Microsoft = 'microsoft',
  Apple = 'apple',
  Discord = 'discord',
}

export enum EmailAccountType {
  Email = 'email',
  Mask = 'mask',
}

export enum WebauthnAccountType {
  WebAuthN = 'webauthn',
}

export enum HandleAccountType {
  Handle = 'handle',
}

export type AccountType =
  | CryptoAccountType
  | OAuthAccountType
  | HandleAccountType
  | EmailAccountType
  | WebauthnAccountType
