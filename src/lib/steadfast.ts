// ============ Steadfast Courier API integration ============
// Official docs: https://portal.packzy.com/api/v1 (Steadfast Courier Ltd.)
// Auth headers: Api-Key + Secret-Key

export interface SteadfastResult {
  ok: boolean
  message: string
  tracking_code?: string
  consignment_id?: string
  raw?: any
}

function baseUrl(courier: any): string {
  return String(courier.base_url || 'https://portal.packzy.com/api/v1').trim().replace(/\/+$/, '')
}

function apiHeaders(courier: any): Record<string, string> {
  return {
    'Api-Key': String(courier.api_key || '').trim(),
    'Secret-Key': String(courier.secret_key || '').trim(),
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
}

// Detect if a courier row is Steadfast (by name or base URL)
export function isSteadfast(courier: any): boolean {
  const hay = `${courier?.name || ''} ${courier?.base_url || ''}`.toLowerCase()
  return hay.includes('steadfast') || hay.includes('packzy') || hay.includes('স্টেডফাস্ট')
}

export function courierApiReady(courier: any): boolean {
  return !!(courier && courier.has_api && courier.api_key && courier.secret_key)
}

// ---- Create consignment (place order) ----
export async function steadfastCreateOrder(courier: any, payload: {
  invoice: string
  recipient_name: string
  recipient_phone: string
  recipient_address: string
  cod_amount: number
  note?: string
}): Promise<SteadfastResult> {
  try {
    const res = await fetch(`${baseUrl(courier)}/create_order`, {
      method: 'POST',
      headers: apiHeaders(courier),
      body: JSON.stringify({
        invoice: payload.invoice,
        recipient_name: payload.recipient_name.slice(0, 100),
        recipient_phone: payload.recipient_phone.replace(/[^0-9]/g, '').slice(-11),
        recipient_address: payload.recipient_address.slice(0, 250),
        cod_amount: Math.max(0, Math.round(payload.cod_amount)),
        note: (payload.note || '').slice(0, 250)
      })
    })
    const data: any = await res.json().catch(() => null)

    if (res.ok && data?.consignment?.tracking_code) {
      return {
        ok: true,
        message: 'Steadfast-এ কনসাইনমেন্ট তৈরি হয়েছে',
        tracking_code: String(data.consignment.tracking_code),
        consignment_id: String(data.consignment.consignment_id || ''),
        raw: data
      }
    }

    // Extract meaningful error
    let msg = data?.message || `Steadfast API error (HTTP ${res.status})`
    if (data?.errors && typeof data.errors === 'object') {
      const details = Object.values(data.errors).flat().join('; ')
      if (details) msg += ` — ${details}`
    }
    if (res.status === 401) msg = 'API Key / Secret Key ভুল — Steadfast মার্চেন্ট প্যানেল থেকে সঠিক key দিন'
    return { ok: false, message: msg, raw: data }
  } catch (e: any) {
    return { ok: false, message: `Steadfast সার্ভারে সংযোগ ব্যর্থ: ${e?.message || 'network error'}` }
  }
}

// ---- Check balance (used to test credentials) ----
export async function steadfastGetBalance(courier: any): Promise<{ ok: boolean; balance?: number; message: string }> {
  try {
    const res = await fetch(`${baseUrl(courier)}/get_balance`, { headers: apiHeaders(courier) })
    const data: any = await res.json().catch(() => null)
    if (res.ok && data && data.current_balance !== undefined) {
      return { ok: true, balance: Number(data.current_balance), message: 'সংযোগ সফল' }
    }
    if (res.status === 401) return { ok: false, message: 'API Key / Secret Key ভুল' }
    return { ok: false, message: data?.message || `HTTP ${res.status}` }
  } catch (e: any) {
    return { ok: false, message: `সংযোগ ব্যর্থ: ${e?.message || 'network error'}` }
  }
}

// ---- Check delivery status by tracking code ----
export async function steadfastStatusByTracking(courier: any, trackingCode: string): Promise<{ ok: boolean; delivery_status?: string; message: string }> {
  try {
    const res = await fetch(`${baseUrl(courier)}/status_by_trackingcode/${encodeURIComponent(trackingCode)}`, { headers: apiHeaders(courier) })
    const data: any = await res.json().catch(() => null)
    if (res.ok && data?.delivery_status) {
      return { ok: true, delivery_status: String(data.delivery_status), message: 'OK' }
    }
    return { ok: false, message: data?.message || `HTTP ${res.status}` }
  } catch (e: any) {
    return { ok: false, message: e?.message || 'network error' }
  }
}

// Bangla labels for Steadfast delivery statuses
export const STEADFAST_STATUS_BN: Record<string, string> = {
  pending: 'পেন্ডিং (এখনো ডেলিভারি হয়নি)',
  delivered_approval_pending: 'ডেলিভারড — অ্যাপ্রুভাল পেন্ডিং',
  partial_delivered_approval_pending: 'আংশিক ডেলিভারড — অ্যাপ্রুভাল পেন্ডিং',
  cancelled_approval_pending: 'বাতিল — অ্যাপ্রুভাল পেন্ডিং',
  unknown_approval_pending: 'অজানা — সাপোর্টে যোগাযোগ করুন',
  delivered: 'ডেলিভারড ✅',
  partial_delivered: 'আংশিক ডেলিভারড',
  cancelled: 'বাতিল ❌',
  hold: 'হোল্ডে আছে',
  in_review: 'রিভিউতে আছে (অর্ডার গৃহীত)',
  unknown: 'অজানা স্ট্যাটাস'
}
