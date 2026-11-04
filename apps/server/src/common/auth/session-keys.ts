// Redis keys shared by the token issuer (modules/auth) and the verifier
// (common/auth). Kept here so common/ never imports from a module.

/** Present while a revoked session's access tokens may still be unexpired. */
export const sessionRevokedKey = (sessionId: string) => `sessrev:${sessionId}`;
