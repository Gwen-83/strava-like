// api/strava-oauth.ts
import type { VercelRequest, VercelResponse } from "@vercel/node"
import axios from "axios"

const CLIENT_ID = process.env.STRAVA_CLIENT_ID
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET

function logImport(
  level: "INFO" | "WARN" | "ERROR",
  message: string,
  payload?: unknown
) {
  const log = {
    level,
    source: "STRAVA_IMPORT",
    message,
    payload,
    at: new Date().toISOString(),
  }

  if (level === "ERROR") console.error(log)
  else if (level === "WARN") console.warn(log)
  else console.info(log)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Si demandé, retourner l'URL d'autorisation (ne jamais exposer CLIENT_SECRET)
  if (req.query.mode === "auth") {
    if (!CLIENT_ID) {
      logImport("ERROR", "Missing STRAVA_CLIENT_ID in env")
      return res.status(500).json({ error: "Server misconfiguration" })
    }
    // tenter de reconstituer l'origine (fallback si absent)
    const FRONTEND_URL = process.env.FRONTEND_URL

    if (!FRONTEND_URL) {
      return res.status(500).json({ error: "Missing FRONTEND_URL" })
    }

    const redirectUri = encodeURIComponent(
      `${FRONTEND_URL.replace(/\/$/, "")}/strava-callback`
    )

    const scope = "read,activity:read_all"
    const authUrl =
      `https://www.strava.com/oauth/authorize` +
      `?client_id=${CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${redirectUri}` +
      `&approval_prompt=force` +
      `&scope=${scope}`

    logImport("INFO", "Returning Strava auth URL")
    return res.status(200).json({ url: authUrl })
  }

  // existing token exchange flow (code param) — utilise CLIENT_ID/CLIENT_SECRET depuis process.env
  const code = req.query.code as string
  if (!code) return res.status(400).json({ error: "Missing code" })

  try {
    logImport("INFO", "OAuth exchange started")
    if (!CLIENT_ID || !CLIENT_SECRET) {
      logImport("ERROR", "Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET in env")
      return res.status(500).json({ error: "Server misconfiguration" })
    }

    // 1️⃣ Échange code → token
    const tokenResponse = await axios.post(
      "https://www.strava.com/oauth/token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }
    )

    const accessToken = tokenResponse.data.access_token

    // 2️⃣ Récupération de TOUTES les activités (pagination)
    let page = 1
    const perPage = 50
    let allActivities: any[] = []

    const MAX_PAGES = 10
    while (page <= MAX_PAGES) {
      const activitiesRes = await axios.get(
        "https://www.strava.com/api/v3/athlete/activities",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            page,
            per_page: perPage,
          },
        }
      )

      if (activitiesRes.data.length === 0) break

      allActivities.push(...activitiesRes.data)
      console.log("STRAVA page", page, "count", activitiesRes.data.length)

      page++
    }

    // 3️⃣ On renvoie tout au frontend
    res.status(200).json({ activities: allActivities })
  } catch (err: any) {
    console.error(err.response?.data || err.message)
    res.status(500).json({ error: err.response?.data || err.message })
    logImport("ERROR", "OAuth token exchange failed", err.response?.data || err)
  }
}