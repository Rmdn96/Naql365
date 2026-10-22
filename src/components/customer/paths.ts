/** Layout ownership only. These predicates do not authorize a request. */
export function isCustomerPath(path: string) {
  return /^\/(ar|en)\/account(?:\/|$)/.test(path);
}
