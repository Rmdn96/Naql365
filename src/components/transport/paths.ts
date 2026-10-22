/** Presentation family only. No authorization, identity or route redirection. */
export function isTransportPath(path: string) {
  return /^\/(ar|en)\/(?:transport(?:\/)?$|(?:request|guest)(?:\/|$)|account\/(?:requests|quotes|orders)(?:\/|$))/.test(
    path,
  );
}
