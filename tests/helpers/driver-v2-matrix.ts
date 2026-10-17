export const driverVisualStates = [
  'today',
  'upcoming',
  'ready',
  'active',
  'reassigned',
  'issue-form',
  'issue-validation',
  'issue-open',
  'pod-form',
  'pod-validation',
  'pod-final',
  'completed-detail',
  'completed-list',
  'empty-upcoming',
  'command-error',
  'loading',
  'command-busy-disabled',
  'offline-unconfirmed',
  'pod-upload-pending',
] as const;
export type DriverVisualState = (typeof driverVisualStates)[number];
export const driverCoreStates = new Set<DriverVisualState>([
  'today',
  'ready',
  'pod-form',
  'completed-detail',
]);
export function driverPresentations(state: DriverVisualState) {
  return [
    ...[360, 1440].map((width) => ({ width, theme: 'light', system: 'light' })),
    ...(driverCoreStates.has(state)
      ? [
          ...[390, 768, 1280].map((width) => ({ width, theme: 'light', system: 'light' })),
          ...['dark', 'system'].flatMap((theme) =>
            [360, 1440].map((width) => ({
              width,
              theme,
              system: width === 360 ? 'dark' : 'light',
            })),
          ),
        ]
      : []),
  ];
}
export function requiredDriverMatrix() {
  return driverVisualStates.flatMap((state) =>
    (['SA', 'EG'] as const).flatMap((market) =>
      (['ar', 'en'] as const).flatMap((locale) =>
        driverPresentations(state).map((view) => ({
          id: [market, locale, state, view.width, view.theme, view.system].join('-'),
          state,
          market,
          locale,
          ...view,
        })),
      ),
    ),
  );
}
