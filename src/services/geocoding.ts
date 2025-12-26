export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<string | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
    {
      headers: {
        "User-Agent": "strava-like-app", // obligatoire pour Nominatim
      },
    }
  )

  if (!res.ok) return null

  const data = await res.json()

  const address = data.address
  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    null
  )
}