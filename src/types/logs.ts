export type LogLevel = "ERROR" | "WARN" | "INFO"

export interface AppLog {
  userId: string
  level: LogLevel
  source: "IMPORT" | "VALIDATION" | "STATS"
  activityId?: string
  message: string
  payload?: unknown
  createdAt: Date
}