const API_BASE = 'https://hxapi.huaxinvending.com'
const MCH_ID = '485410120201108'
const MCH_SECRET = 'Victor20260110Ab'
const SIGN = '742ec60a88d8224587cec0fc5755454ed'

interface AuthState {
  authorization: string
  jsessionId: string
  expiresAt: number
}

class FabricanteAPI {
  private auth: AuthState | null = null

  /** Authenticate and cache token for 30 minutes */
  async authenticate(): Promise<void> {
    // Reuse if still valid (with 60s margin)
    if (this.auth && Date.now() < this.auth.expiresAt - 60_000) return

    const res = await fetch(`${API_BASE}/api/mch/mchLogin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mch_id: MCH_ID,
        mch_secret: MCH_SECRET,
        sign: SIGN,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Auth failed [${res.status}]: ${text}`)
    }

    const data = await res.json()

    const authorization = data.authorization ?? data.data?.authorization ?? ''
    const jsessionId = data.jsessionId ?? data.data?.jsessionId ?? data.JSESSIONID ?? ''

    if (!authorization) {
      throw new Error(`Auth response missing authorization: ${JSON.stringify(data)}`)
    }

    this.auth = {
      authorization,
      jsessionId,
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 min
    }

    console.log('[FabricanteAPI] Authenticated OK')
  }

  /** Make an authenticated POST request */
  async request<T = unknown>(path: string, body: Record<string, unknown> = {}): Promise<T> {
    await this.authenticate()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': this.auth!.authorization,
    }
    if (this.auth!.jsessionId) {
      headers['Cookie'] = `JSESSIONID=${this.auth!.jsessionId}`
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const responseText = await res.text()

    if (!res.ok) {
      // If server returns HTML (nginx error page), give a clean message
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
        throw new Error(`API ${path} temporarily unavailable (server returned HTML error page, status ${res.status})`)
      }
      throw new Error(`API ${path} failed [${res.status}]: ${responseText.substring(0, 200)}`)
    }

    // Guard against HTML responses even on 200 status
    if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
      throw new Error(`API ${path} returned HTML instead of JSON (status ${res.status})`)
    }

    try {
      return JSON.parse(responseText) as T
    } catch {
      throw new Error(`API ${path} returned invalid JSON (status ${res.status}): ${responseText.substring(0, 100)}`)
    }
  }

  /** Get orders for a machine on a specific date, with automatic pagination */
  async getOrders(imei: string, fecha: string): Promise<{ orders: unknown[]; total: number }> {
    let allOrders: unknown[] = []
    let page = 1
    let totalPages = 1

    while (page <= totalPages) {
      const data = await this.request<Record<string, unknown>>(
        '/api/mch/getOrders',
        { imei, fecha, page, pageSize: 100 }
      )

      const orders = (data.ordenes ?? data.orders ?? data.ventas ?? data.list ?? []) as unknown[]
      allOrders = [...allOrders, ...orders]

      totalPages = (data.total_pages ?? data.totalPages ?? data.pages ?? 1) as number
      page++
    }

    return { orders: allOrders, total: allOrders.length }
  }

  /** Get machine status */
  async getMachineStatus(imei: string): Promise<Record<string, unknown>> {
    return await this.request('/api/mch/getMachineStatus', { imei })
  }

  /** Get toppings / stock for a machine */
  async getToppings(imei: string): Promise<Record<string, unknown>> {
    return await this.request('/api/mch/getToppings', { imei })
  }

  /** Update stock for a specific position */
  async updateStock(
    imei: string,
    position: string,
    cantidad: number
  ): Promise<Record<string, unknown>> {
    return await this.request('/api/mch/updateStock', {
      imei,
      position,
      cantidad,
    })
  }
}

export const fabricanteAPI = new FabricanteAPI()
