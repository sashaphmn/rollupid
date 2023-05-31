export const seviceBindings = true
declare global {
  const Starbase: Fetcher
  const Images: Fetcher
  const Account: Fetcher

  const SECRET_SESSION_KEY: string
  const COOKIE_DOMAIN: string
  const PASSPORT_URL: string
  const STORAGE_NAMESPACE: string
  const INTERNAL_GOOGLE_ANALYTICS_TAG: string
  const PROFILE_APP_URL: string

  const INTERNAL_PASSPORT_SERVICE_NAME: string

  const INTERNAL_CLOUDFLARE_ZONE_ID: string
  const TOKEN_CLOUDFLARE_API: string
}
