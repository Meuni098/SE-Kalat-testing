/** Read the deployment-owned key at runtime; never ship a usable fallback. */
export function sessionSigningKey():Uint8Array {
  const secret=process.env.NEXTAUTH_SECRET;
  if(!secret||new TextEncoder().encode(secret).length<32)throw new Error("NEXTAUTH_SECRET must be configured with at least 32 random bytes.");
  return new TextEncoder().encode(secret);
}
