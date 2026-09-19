// Supabase's browser SDK contains startsWith("sb_secret_") to classify keys.
// The bare discriminator is not a credential; any payload after it is suspect.
// Hosted suites additionally compare every actual privileged fixture credential.
export function hasSupabaseSecretMaterial(source: string): boolean {
  return /sb_secret_[A-Za-z0-9_-]+/.test(source);
}
