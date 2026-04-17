export type AppSurface = 'citizen' | 'admin' | 'responder'

export interface MinAppVersionDoc {
  citizen: string
  admin: string
  responder: string
  updatedAt: number
}

export interface AlertDoc {
  title: string
  body: string
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  publishedAt: number
  publishedBy: string
}
