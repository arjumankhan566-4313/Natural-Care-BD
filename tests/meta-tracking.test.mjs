import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMetaPurchaseData,
  buildMetaPurchaseDataResult,
  isMetaPurchaseData,
  isValidMetaEventId,
  logTrackingDiagnostic,
  parseMetaFbc,
  recoverMetaPurchaseData,
  resolveMetaEventId,
  resolveMetaFbc
} from '../src/lib/helpers.ts'
import { readFileSync } from 'node:fs'

test('Meta event IDs are accepted unchanged and malformed IDs are rejected', () => {
  const mixedCaseId = 'Lead_AbC-123_XyZ'
  assert.equal(isValidMetaEventId(mixedCaseId), true)
  assert.equal(isValidMetaEventId(` ${mixedCaseId}`), false)
  assert.equal(isValidMetaEventId(''), false)
  assert.equal(isValidMetaEventId('bad\nvalue'), false)
})

test('missing or corrupt event IDs are recovered to a valid monitored ID', () => {
  const missing = resolveMetaEventId(undefined, 'Lead')
  const corrupt = resolveMetaEventId(' bad\nid ', 'Purchase')
  const valid = resolveMetaEventId('Lead_ExactCase_123', 'Lead')

  assert.equal(missing.usedFallback, true)
  assert.equal(missing.reason, 'missing')
  assert.match(missing.eventId, /^lead_recovered_[a-f0-9]{32}$/)
  assert.equal(isValidMetaEventId(missing.eventId), true)
  assert.equal(corrupt.usedFallback, true)
  assert.equal(corrupt.reason, 'invalid')
  assert.match(corrupt.eventId, /^purchase_recovered_[a-f0-9]{32}$/)
  assert.deepEqual(valid, {
    eventId: 'Lead_ExactCase_123', usedFallback: false, reason: 'valid'
  })
})

test('diagnostic logging cannot break an event when serialization or D1 persistence fails', async () => {
  const circular = {}
  circular.self = circular
  const db = {
    prepare() {
      return {
        bind() { return this },
        async run() { throw new Error('diagnostic table unavailable') }
      }
    }
  }
  const originalWarn = console.warn
  console.warn = () => {}
  try {
    await assert.doesNotReject(logTrackingDiagnostic(db, {
      severity: 'warning', code: 'PURCHASE_DATA_FALLBACK', source: 'capi',
      eventName: 'Purchase', eventId: 'purchase_DiagnosticSafety', details: circular
    }))
  } finally {
    console.warn = originalWarn
  }
})

test('a valid _fbc cookie is parsed and passed through byte-for-byte', () => {
  const raw = 'fb.1.1788566400123.AbCdEf_123-XyZ'
  assert.deepEqual(parseMetaFbc(raw), {
    raw,
    subdomainIndex: '1',
    creationTime: '1788566400123',
    clickId: 'AbCdEf_123-XyZ'
  })
  assert.equal(resolveMetaFbc(raw, 'AbCdEf_123-XyZ', '1788566400123', 1788566500000), raw)
})

test('fbc reconstruction preserves the exact case-sensitive fbclid', () => {
  const clickId = 'IwAR2F4-dbP0l7Mn1Iaw_QqGCINEz7PYX'
  assert.equal(
    resolveMetaFbc('', clickId, '1788566400123', 1788566500000),
    `fb.1.1788566400123.${clickId}`
  )
})

test('a new URL fbclid replaces a stale cookie without modifying the new ID', () => {
  const stale = 'fb.1.1788566300123.OldClickId'
  const current = 'NewClickID_With-MixedCase'
  assert.equal(
    resolveMetaFbc(stale, current, '1788566400123', 1788566500000),
    `fb.1.1788566400123.${current}`
  )
})

test('an older session fbclid cannot overwrite a newer valid cookie from another tab', () => {
  const newerCookie = 'fb.1.1788566500123.NewerMixedCaseClick'
  assert.equal(
    resolveMetaFbc(newerCookie, 'OlderSessionClick', '1788566400123', 1788566600000),
    newerCookie
  )
})

test('invalid/seconds timestamps fall back to current milliseconds, not a modified click ID', () => {
  const clickId = 'AbCdEf'
  assert.equal(
    resolveMetaFbc('', clickId, '1788566400', 1788566500456),
    `fb.1.1788566500456.${clickId}`
  )
})

test('Purchase custom_data is dynamic and server-authoritative', () => {
  const first = buildMetaPurchaseData(1080, 'NCB-ONE', [
    { product_id: 7, quantity: 1, unit_price: 950 }
  ])
  const second = buildMetaPurchaseData(2020, 'NCB-TWO', [
    { product_id: 7, quantity: 2, unit_price: 950 }
  ])

  assert.equal(first.value, 1080)
  assert.equal(second.value, 2020)
  assert.notEqual(first.value, second.value)
  assert.equal(first.currency, 'BDT')
  assert.equal(first.order_id, 'NCB-ONE')
  assert.deepEqual(second.contents, [{ id: '7', quantity: 2, item_price: 950 }])
})

test('Purchase payload supports multiple products and rounds money to two decimals', () => {
  const data = buildMetaPurchaseData(1234.567, 'NCB-MULTI', [
    { product_id: 'SKU-A', quantity: 1, unit_price: 333.335 },
    { product_id: 'SKU-B', quantity: 2, unit_price: 400 }
  ])

  assert.equal(data.value, 1234.57)
  assert.deepEqual(data.content_ids, ['SKU-A', 'SKU-B'])
  assert.deepEqual(data.contents, [
    { id: 'SKU-A', quantity: 1, item_price: 333.34 },
    { id: 'SKU-B', quantity: 2, item_price: 400 }
  ])
  assert.equal(isMetaPurchaseData(data), true)
  assert.equal(isMetaPurchaseData({ ...data, value: '1234.57' }), false)
  assert.equal(isMetaPurchaseData({ ...data, contents: [{ id: 'SKU-A', quantity: '1', item_price: 333.34 }] }), false)
})

test('missing Purchase total recovers from current trusted item prices without throwing', () => {
  const recovered = buildMetaPurchaseDataResult(Number.NaN, 'NCB-RECOVERED', [
    { product_id: 9, quantity: 2, unit_price: 525.25 }
  ])

  assert.equal(recovered.usedFallback, true)
  assert.deepEqual(recovered.issues, ['price_from_item_total'])
  assert.equal(recovered.data.value, 1050.5)
  assert.equal(recovered.data.order_id, 'NCB-RECOVERED')
  assert.equal(isMetaPurchaseData(recovered.data), true)
})

test('a finite but stale Purchase price is replaced by the matching order total', async () => {
  const db = {
    prepare(sql) {
      return {
        bind() { return this },
        async first() {
          if (/FROM orders/i.test(sql)) return { id: 4, order_number: 'NCB-CURRENT', grand_total: 1080 }
          return null
        },
        async all() {
          if (/FROM order_items/i.test(sql)) {
            return { results: [{ product_id: 7, quantity: 1, unit_price: 950 }] }
          }
          return { results: [] }
        }
      }
    }
  }
  const stale = buildMetaPurchaseData(950, 'NCB-CURRENT', [
    { product_id: 7, quantity: 1, unit_price: 950 }
  ])
  const eventId = resolveMetaEventId('purchase_CurrentPrice_Check', 'Purchase').eventId
  const recovered = await recoverMetaPurchaseData(db, stale, eventId)

  assert.equal(recovered.source, 'order')
  assert.equal(recovered.data.value, 1080)
  assert.equal(recovered.data.order_id, 'NCB-CURRENT')
})

test('corrupt Purchase runtime input still normalizes to a complete schema', () => {
  const recovered = buildMetaPurchaseDataResult(Number.NaN, '', [
    { product_id: '', quantity: 0, unit_price: Number.NaN }
  ], 'invalid')

  assert.equal(recovered.usedFallback, true)
  assert.equal(recovered.data.value, 0)
  assert.equal(recovered.data.currency, 'BDT')
  assert.deepEqual(recovered.data.contents, [{ id: 'unknown', quantity: 1, item_price: 0 }])
  assert.equal(isMetaPurchaseData(recovered.data), true)
})

test('/events route keeps non-dropping ID and Purchase-price recovery wired in', () => {
  const source = readFileSync(new URL('../src/routes/public.ts', import.meta.url), 'utf8')
  const routeStart = source.indexOf("pub.post('/events'")
  const routeSource = source.slice(routeStart)

  assert.ok(routeStart > 0)
  assert.match(routeSource, /resolveMetaEventId\(body\.event_id, eventName\)/)
  assert.match(routeSource, /recoverMetaPurchaseData\(db, eventData, eventId\)/)
  assert.match(routeSource, /recovered_event_id: idResolution\.usedFallback/)
  assert.match(routeSource, /fbc: requestFbc/)
  assert.doesNotMatch(routeSource, /error:\s*['"]invalid_event_id['"]/)
})

test('browser Pixel and server report consume one required normalized envelope', () => {
  const source = readFileSync(new URL('../public/static/landing.js', import.meta.url), 'utf8')

  assert.match(source, /function normalizeTrackingEnvelope\(eventName, data, eventId\)/)
  assert.match(source, /event_id: resolveBrowserEventId\(eventName, eventId\)/)
  assert.match(source, /fbc: currentMetaFbc\(\)/)
  assert.match(source, /data: normalizeEventData\(eventName, data\)/)
  assert.match(source, /window\.fbq\('track', envelope\.event_name, envelope\.data, \{ eventID: envelope\.event_id \}\)/)
  assert.match(source, /reportServerEvent\(envelope\.event_name, envelope\.data, envelope\.event_id, userData, envelope\)/)
  assert.match(source, /normalizePurchaseData\(o\.meta_purchase, o\)/)
})

test('deployment workflow runs tracking tests before build/deploy', () => {
  const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')
  const testIndex = workflow.indexOf('run: npm test')
  const buildIndex = workflow.indexOf('run: npm run build')
  const deployIndex = workflow.indexOf('run: npx wrangler deploy')

  assert.ok(testIndex > 0)
  assert.ok(buildIndex > testIndex)
  assert.ok(deployIndex > buildIndex)
})
