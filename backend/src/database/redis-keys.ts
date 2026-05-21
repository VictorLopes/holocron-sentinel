export const CacheKeys = {
  EVENT_EXTERNAL_ID: (externalId: string) => `event:external_id:${externalId}`,
  ENTITY: (entityId: string | number) => `entity:${entityId}`,
} as const;

export type CacheKeyName = keyof typeof CacheKeys;

export function getCacheKey<T extends CacheKeyName>(
  name: T,
  value: Parameters<(typeof CacheKeys)[T]>[0],
): string {
  return CacheKeys[name](value as any);
}
