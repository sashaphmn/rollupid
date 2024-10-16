---
description: Scopes Definitions
---

This is a listing of scope values Rollup supports and plans to support for Rollup accounts.

# Scopes

| Scope Name              | Scope Description                                                                                                                                                                                                                                                     | Availability |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `openid`                | Standard scope value indicating the authorization request to be an OIDC request. This provides an ID token as part of the token exchange.                                                                                                                             | ✅           |
| `profile`               | Standard scope value indicating that basic profile claims will be included in the ID token (see `openid`) as well as in the responses of calls to `/userinfo` endpoint. Currently, this includes the `name` and `picture` claims.                                     | ✅           |
| `email`                 | Standard scope value indicating that a configured email address will be included in the ID token as well as the `/userinfo` endpoint response. The value of this claim will come from the connected account the authorizing user selects in the authorization screen. | ✅           |
| `connected_accounts`    | Scope value that indicates that the type and address of each connected account will be included in the ID token as well as the `/userinfo` endpoint response.                                                                                                         | ✅           |
| `smart contract wallet` | Scope value which indicates that the blockchain address and name of smart contract wallet will be included in the ID token as well as the `/userinfo` endpoint response.                                                                                                                                                                                 | ✅           |
| `storage`               |                                                                                                                                                                                                                                                                       | ⏳           |
| `kyc`                   |                                                                                                                                                                                                                                                                       | 📅           |
