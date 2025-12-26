export function buildActivityId(
  source: string,
  externalId: string | number
) {
  return `activity_${source}_${externalId}`
}