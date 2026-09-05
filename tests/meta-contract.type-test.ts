// Compile-only regression lock. `npm run typecheck` must fail if event_id, fbc, or the
// dynamic Purchase value ever become optional in the internal Pixel/CAPI contract.
import { resolveMetaEventId, type MetaCapiEvent, type MetaPurchaseData } from '../src/lib/helpers'

const normalizedPurchaseId = resolveMetaEventId('purchase_TypeGuard_123', 'Purchase').eventId

const purchaseData: MetaPurchaseData = {
  value: 1290,
  currency: 'BDT',
  content_ids: ['7'],
  content_type: 'product',
  contents: [{ id: '7', quantity: 1, item_price: 1160 }],
  order_id: 'NCB-TYPE-GUARD',
  delivery_category: 'home_delivery'
}

const validPurchaseEvent: MetaCapiEvent = {
  eventName: 'Purchase',
  eventId: normalizedPurchaseId,
  // Required key; null is the only correct value for an organic visitor.
  fbc: null,
  customData: purchaseData
}
void validPurchaseEvent

const unnormalizedEvent: MetaCapiEvent = {
  eventName: 'Purchase',
  // @ts-expect-error a plain string must pass through resolveMetaEventId first.
  eventId: 'purchase_raw_string_is_not_normalized',
  fbc: null,
  customData: purchaseData
}
void unnormalizedEvent

const unnormalizedFbcEvent: MetaCapiEvent = {
  eventName: 'Purchase',
  eventId: normalizedPurchaseId,
  // @ts-expect-error a real fbc string must pass through resolveMetaFbc first.
  fbc: 'fb.1.1788566400123.MixedCaseClickId',
  customData: purchaseData
}
void unnormalizedFbcEvent

// @ts-expect-error eventId must never become optional.
const missingEventId: MetaCapiEvent = {
  eventName: 'Purchase',
  fbc: null,
  customData: purchaseData
}
void missingEventId

// @ts-expect-error fbc must be handled explicitly (real exact value or null).
const missingFbc: MetaCapiEvent = {
  eventName: 'Purchase',
  eventId: normalizedPurchaseId,
  customData: purchaseData
}
void missingFbc

const missingDynamicValue = {
  currency: 'BDT',
  content_ids: ['7'],
  content_type: 'product' as const,
  contents: [{ id: '7', quantity: 1, item_price: 1160 }],
  order_id: 'NCB-NO-VALUE',
  delivery_category: 'home_delivery' as const
}

// @ts-expect-error Purchase customData requires the current dynamic value.
const invalidPurchaseEvent: MetaCapiEvent = {
  eventName: 'Purchase',
  eventId: normalizedPurchaseId,
  fbc: null,
  customData: missingDynamicValue
}
void invalidPurchaseEvent
