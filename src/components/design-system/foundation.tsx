import type { HTMLAttributes } from 'react';

export type DesignFamily = 'public' | 'auth' | 'customer' | 'staff' | 'driver';

/** Visual ownership only. Auth and domain authorization remain at their existing boundaries. */
export function DesignFoundation({
  family,
  ...props
}: HTMLAttributes<HTMLDivElement> & { family: DesignFamily }) {
  return <div {...props} data-design-family={family} />;
}
