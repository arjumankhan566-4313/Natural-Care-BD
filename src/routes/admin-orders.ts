// ============ Admin: Orders management ============
import { Hono } from 'hono'
import type { Bindings } from '../lib/helpers'
import { auditLog, notify, recalcOrderProfit, refreshCustomerStats, ORDER_STATUSES, validBDPhone, normalizePhone, getSettings, sendSms, fillSmsTemplate, runBackground } from '../lib/helpers'
import { requireAuth, AdminUser } from '../lib/auth'
import { isSteadfast, courierApiReady, steadfastCreateOrder } from '../lib/steadfast'

type Env = { Bindings: Bindings; Variables: { user: AdminUser } }
const r = new Hono<Env>()
r.use('*', requireAuth('orders'))

// List orders with search/filter/pagination
r.get('/', async (c) => {
  const db = c.env.DB
  const q = c.req.query()
  const conditions: string[] = ['o.is_deleted = 0']
  const params: any[] = []

  if (q.status) { conditions.push('o.status = ?'); params.push(q.status) }
  if (q.risk_level) { conditions.push('o.risk_level = ?'); params.push(q.risk_level) }
  if (q.courier_id) { conditions.push('o.courier_id = ?'); params.push(Number(q.courier_id)) }
  if (q.date_from) { conditions.push("date(o.created_at, '+6 hours') >= ?"); params.push(q.date_from) }
  if (q.date_to) { conditions.push("date(o.created_at, '+6 hours') <= ?"); params.push(q.date_to) }
  if (q.campaign) { conditions.push('(o.utm_campaign LIKE ? OR o.campaign_id = ?)'); params.push(`%${q.campaign}%`, q.campaign) }
  if (q.search) {
    conditions.push('(o.order_number LIKE ? OR o.phone LIKE ? OR o.customer_name LIKE ? OR o.tracking_id LIKE ?)')
    const s = `%${q.search}%`
    params.push(s, s, s, s)
  }

  const where = conditions.join(' AND ')
  const page = Math.max(1, Number(q.page || 1))
  const limit = Math.min(100, Number(q.limit || 25))
  const offset = (page - 1) * limit

  const [rows, count] = await Promise.all([
    db.prepare(`
      SELECT o.id, o.order_number, o.customer_name, o.phone, o.district, o.grand_total, o.status, o.risk_level, o.risk_score,
             o.is_verified, o.tracking_id, o.net_profit, o.created_at, c2.name as courier_name,
             (SELECT GROUP_CONCAT(product_name || ' ×' || quantity, ', ') FROM order_items WHERE order_id = o.id) as items_summary
      FROM orders o LEFT JOIN couriers c2 ON c2.id = o.courier_id
      WHERE ${where} ORDER BY o.id DESC LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all(),
    db.prepare(`SELECT COUNT(*) as total FROM orders o WHERE ${where}`).bind(...params).first<{ total: number }>()
  ])

  return c.json({ orders: rows.results || [], total: count?.total || 0, page, limit })
})

// Status counts for dashboard tabs
r.get('/counts', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT status, COUNT(*) as cnt FROM orders WHERE is_deleted = 0 GROUP BY status`
  ).all()
  const counts: Record<string, number> = {}
  let total = 0
  for (const row of (rows.results || []) as any[]) { counts[row.status] = row.cnt; total += row.cnt }
  return c.json({ counts, total })
})

// Order details
r.get('/:id', async (c) => {
  const db = c.env.DB
  const id = Number(c.req.param('id'))
  const order = await db.prepare(`
    SELECT o.*, c2.name as courier_name FROM orders o LEFT JOIN couriers c2 ON c2.id = o.courier_id WHERE o.id = ? AND o.is_deleted = 0
  `).bind(id).first<any>()
  if (!order) return c.json({ error: 'not_found' }, 404)

  const [items, history, transfers, courierLogs] = await Promise.all([
    db.prepare('SELECT * FROM order_items WHERE order_id = ?').bind(id).all(),
    db.prepare('SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id').bind(id).all(),
    db.prepare('SELECT * FROM courier_transfers WHERE order_id = ? ORDER BY id').bind(id).all(),
    db.prepare('SELECT * FROM courier_status_logs WHERE order_id = ? ORDER BY id DESC').bind(id).all()
  ])

  order.risk_reasons = JSON.parse(order.risk_reasons || '[]')
  // Financial breakdown
  const netSales = order.subtotal - order.discount + order.delivery_charge
  const totalCost = order.product_cost + order.packaging_cost + order.courier_cost + order.cod_charge + order.ad_cost + order.other_cost
  const financial = {
    net_sales: netSales,
    total_cost: totalCost,
    net_profit: order.net_profit,
    profit_margin: netSales > 0 ? Math.round((order.net_profit / netSales) * 1000) / 10 : 0,
    roi: totalCost > 0 ? Math.round((order.net_profit / totalCost) * 1000) / 10 : 0
  }

  return c.json({ order, items: items.results || [], history: history.results || [], transfers: transfers.results || [], courierLogs: courierLogs.results || [], financial })
})

// Update order status
r.put('/:id/status', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const { status, note } = await c.req.json()
  if (!ORDER_STATUSES.includes(status)) return c.json({ error: 'invalid_status' }, 400)

  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND is_deleted = 0').bind(id).first<any>()
  if (!order) return c.json({ error: 'not_found' }, 404)
  const oldStatus = order.status
  if (oldStatus === status) return c.json({ error: 'same_status', message: 'অর্ডারটি ইতিমধ্যে এই স্ট্যাটাসে আছে' }, 400)

  const extra: string[] = []
  const params: any[] = []
  if (status === 'shipped') { extra.push('shipped_at = CURRENT_TIMESTAMP') }
  if (status === 'delivered') { extra.push('delivered_at = CURRENT_TIMESTAMP'); extra.push('paid_amount = grand_total') }

  await db.prepare(`UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP${extra.length ? ', ' + extra.join(', ') : ''} WHERE id = ?`)
    .bind(status, id).run()
  await db.prepare('INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by) VALUES (?, ?, ?, ?, ?)')
    .bind(id, oldStatus, status, note || '', user.username).run()

  // Stock deduction on confirm; restore on cancel/return (if it was confirmed before)
  const confirmedStatuses = ['confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered']
  const wasConfirmed = confirmedStatuses.includes(oldStatus)
  const nowConfirmed = confirmedStatuses.includes(status)
  const items = await db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').bind(id).all()
  if (!wasConfirmed && nowConfirmed) {
    for (const it of (items.results || []) as any[]) {
      await db.prepare(`UPDATE products SET stock = MAX(0, stock - ?), stock_status = CASE WHEN stock - ? <= 0 THEN 'out_of_stock' WHEN stock - ? <= low_stock_threshold THEN 'low_stock' ELSE 'in_stock' END WHERE id = ?`)
        .bind(it.quantity, it.quantity, it.quantity, it.product_id).run()
    }
  }
  if (wasConfirmed && (status === 'cancelled' || status === 'returned')) {
    // restore stock (business rule: restore by default)
    for (const it of (items.results || []) as any[]) {
      await db.prepare(`UPDATE products SET stock = stock + ?, stock_status = CASE WHEN stock + ? > low_stock_threshold THEN 'in_stock' WHEN stock + ? > 0 THEN 'low_stock' ELSE 'out_of_stock' END WHERE id = ?`)
        .bind(it.quantity, it.quantity, it.quantity, it.product_id).run()
    }
    // Return financial impact: courier return charge
    if (status === 'returned' && order.courier_id) {
      const courier = await db.prepare('SELECT return_charge FROM couriers WHERE id = ?').bind(order.courier_id).first<any>()
      if (courier?.return_charge) {
        await db.prepare('UPDATE orders SET courier_cost = courier_cost + ? WHERE id = ?').bind(courier.return_charge, id).run()
      }
    }
  }

  await recalcOrderProfit(db, id)
  if (order.customer_id) await refreshCustomerStats(db, order.customer_id)
  await auditLog(db, user.id, user.username, 'status_change', 'order', String(order.order_number), `${oldStatus} → ${status}${note ? ' | ' + note : ''}`)
  await notify(db, 'status_change', 'অর্ডার স্ট্যাটাস পরিবর্তন', `${order.order_number}: ${oldStatus} → ${status} (${user.username})`, `/admin#/orders/${id}`)

  // Delivery-confirmation SMS — only fires if admin has configured an SMS gateway.
  if (status === 'delivered') {
    const s = await getSettings(db, ['sms_on_delivered_enabled', 'sms_on_delivered_template', 'brand_name'])
    if (s.sms_on_delivered_enabled !== '0') {
      runBackground(c, sendSms(db, {
        phone: order.phone,
        orderId: id,
        eventType: 'delivered',
        message: fillSmsTemplate(s.sms_on_delivered_template || 'প্রিয় {name}, আপনার অর্ডার #{order_number} সফলভাবে ডেলিভারি সম্পন্ন হয়েছে। ধন্যবাদ — {brand}', {
          name: order.customer_name, order_number: order.order_number, brand: s.brand_name || 'Nature Care Bangladesh'
        })
      }))
    }
  }

  return c.json({ success: true, status })
})

// Update order financials / notes / fields
r.put('/:id', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const body = await c.req.json()
  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND is_deleted = 0').bind(id).first<any>()
  if (!order) return c.json({ error: 'not_found' }, 404)

  const allowed = ['customer_name', 'phone', 'alt_phone', 'address', 'district', 'upazila', 'area', 'order_note', 'admin_notes',
    'discount', 'delivery_charge', 'product_cost', 'packaging_cost', 'courier_cost', 'cod_charge', 'ad_cost', 'other_cost',
    'paid_amount', 'tracking_id', 'tracking_url']

  // Validate + normalize phone numbers before saving (prevents malformed numbers reaching courier APIs)
  if (body.phone !== undefined) {
    const np = normalizePhone(String(body.phone))
    if (!validBDPhone(np)) return c.json({ error: 'validation', message: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন (01XXXXXXXXX)' }, 400)
    body.phone = np
  }
  if (body.alt_phone !== undefined && body.alt_phone) {
    const nap = normalizePhone(String(body.alt_phone))
    if (!validBDPhone(nap)) return c.json({ error: 'validation', message: 'বিকল্প ফোন নম্বরটি সঠিক নয়' }, 400)
    body.alt_phone = nap
  }
  if (body.customer_name !== undefined && String(body.customer_name).trim().length < 2) {
    return c.json({ error: 'validation', message: 'নাম দিন (কমপক্ষে ২ অক্ষর)' }, 400)
  }

  const sets: string[] = []
  const params: any[] = []
  const changes: string[] = []
  for (const k of allowed) {
    if (body[k] !== undefined) {
      sets.push(`${k} = ?`)
      params.push(body[k])
      if (String(order[k]) !== String(body[k])) changes.push(`${k}: ${order[k]} → ${body[k]}`)
    }
  }
  if (!sets.length) return c.json({ error: 'no_changes' }, 400)

  // Recalc grand total if pricing fields changed
  const discount = body.discount !== undefined ? Number(body.discount) : order.discount
  const deliveryCharge = body.delivery_charge !== undefined ? Number(body.delivery_charge) : order.delivery_charge
  sets.push('grand_total = ?')
  params.push(order.subtotal - discount + deliveryCharge)
  sets.push('updated_at = CURRENT_TIMESTAMP')

  await db.prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id).run()
  await recalcOrderProfit(db, id)
  // Keep linked customer record in sync (name/phone/address edits)
  if (order.customer_id) {
    const custSets: string[] = []
    const custParams: any[] = []
    if (body.customer_name !== undefined) { custSets.push('name = ?'); custParams.push(body.customer_name) }
    if (body.phone !== undefined) { custSets.push('phone = ?'); custParams.push(body.phone) }
    if (body.alt_phone !== undefined) { custSets.push('alt_phone = ?'); custParams.push(body.alt_phone) }
    if (body.address !== undefined) { custSets.push('address = ?'); custParams.push(body.address) }
    if (body.district !== undefined) { custSets.push('district = ?'); custParams.push(body.district) }
    if (body.upazila !== undefined) { custSets.push('upazila = ?'); custParams.push(body.upazila) }
    if (custSets.length) {
      await db.prepare(`UPDATE customers SET ${custSets.join(', ')} WHERE id = ?`).bind(...custParams, order.customer_id).run()
    }
  }
  if (changes.length) await auditLog(db, user.id, user.username, 'update', 'order', order.order_number, changes.join('; '))

  const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<any>()
  return c.json({ success: true, order: updated })
})

// Assign / transfer courier (with optional Steadfast API push)
r.post('/:id/transfer', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const { courier_id, tracking_id, delivery_charge, courier_charge, note, weight, send_via_api } = await c.req.json()

  const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND is_deleted = 0').bind(id).first<any>()
  if (!order) return c.json({ error: 'not_found' }, 404)
  const newCourier = await db.prepare('SELECT * FROM couriers WHERE id = ? AND is_deleted = 0').bind(Number(courier_id)).first<any>()
  if (!newCourier) return c.json({ error: 'invalid_courier', message: 'কুরিয়ার পাওয়া যায়নি' }, 400)

  const oldCourier = order.courier_id
    ? await db.prepare('SELECT id, name FROM couriers WHERE id = ?').bind(order.courier_id).first<any>()
    : null

  // ---- Steadfast API push: create consignment automatically ----
  let finalTrackingId = tracking_id || ''
  let consignmentId = ''
  let apiNote = ''
  if (send_via_api) {
    if (!isSteadfast(newCourier)) {
      return c.json({ error: 'api_unsupported', message: 'এই কুরিয়ারে API ইন্টিগ্রেশন নেই — ম্যানুয়ালি ট্র্যাকিং আইডি দিন' }, 400)
    }
    if (!courierApiReady(newCourier)) {
      return c.json({ error: 'api_not_configured', message: 'Steadfast API Key/Secret Key দেওয়া হয়নি — কুরিয়ার সেকশন থেকে কনফিগার করুন' }, 400)
    }
    // Avoid duplicate consignments for the same order
    if (order.consignment_id) {
      return c.json({ error: 'already_sent', message: `এই অর্ডার আগেই Steadfast-এ পাঠানো হয়েছে (Consignment: ${order.consignment_id})। ডুপ্লিকেট এড়াতে আর পাঠানো হলো না।` }, 400)
    }
    const fullAddress = [order.address, order.upazila, order.district].filter(Boolean).join(', ')
    const codDue = Math.max(0, Number(order.grand_total || 0) - Number(order.paid_amount || 0))
    const wNote = weight ? `Weight: ${weight}kg. ` : ''
    const sfRes = await steadfastCreateOrder(newCourier, {
      invoice: order.order_number,
      recipient_name: order.customer_name,
      recipient_phone: order.phone,
      recipient_address: fullAddress,
      cod_amount: codDue,
      note: (wNote + (note || '')).trim()
    })
    if (!sfRes.ok) {
      await notify(db, 'courier_error', '⚠️ Steadfast-এ অর্ডার পাঠানো ব্যর্থ', `${order.order_number}: ${sfRes.message}`, `/admin#/orders/${id}`)
      return c.json({ error: 'steadfast_failed', message: sfRes.message }, 502)
    }
    finalTrackingId = sfRes.tracking_code || ''
    consignmentId = sfRes.consignment_id || ''
    apiNote = ` | Steadfast API ✅ Consignment: ${consignmentId}`
  }

  // Build tracking URL from template
  let trackingUrl = ''
  if (finalTrackingId && newCourier.tracking_url_template) {
    trackingUrl = newCourier.tracking_url_template.replace('{tracking_id}', encodeURIComponent(finalTrackingId))
  }

  await db.prepare(`
    INSERT INTO courier_transfers (order_id, from_courier_id, from_courier_name, to_courier_id, to_courier_name, tracking_id, delivery_charge, courier_charge, note, transferred_by, weight, consignment_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, oldCourier?.id || null, oldCourier?.name || null, newCourier.id, newCourier.name,
    finalTrackingId, Number(delivery_charge || 0), Number(courier_charge || newCourier.delivery_charge || 0), note || '', user.username,
    Number(weight || 0), consignmentId).run()

  await db.prepare(`
    UPDATE orders SET courier_id = ?, tracking_id = ?, tracking_url = ?, consignment_id = CASE WHEN ? != '' THEN ? ELSE consignment_id END,
      courier_cost = ?, delivery_charge = COALESCE(?, delivery_charge), updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).bind(newCourier.id, finalTrackingId, trackingUrl, consignmentId, consignmentId,
    Number(courier_charge || newCourier.delivery_charge || 0),
    delivery_charge !== undefined && delivery_charge !== null && delivery_charge !== '' ? Number(delivery_charge) : null, id).run()

  const historyNote = (oldCourier
    ? `Order transferred from ${oldCourier.name} to ${newCourier.name}${finalTrackingId ? ' | Tracking: ' + finalTrackingId : ''}`
    : `Courier assigned: ${newCourier.name}${finalTrackingId ? ' | Tracking: ' + finalTrackingId : ''}`)
    + (weight ? ` | ওজন: ${weight}kg` : '') + apiNote
  await db.prepare('INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by) VALUES (?, ?, ?, ?, ?)')
    .bind(id, order.status, order.status, historyNote, user.username).run()

  // Recalc order grand total (delivery may have changed) then profit
  const refreshed = await db.prepare('SELECT subtotal, discount, delivery_charge FROM orders WHERE id = ?').bind(id).first<any>()
  await db.prepare('UPDATE orders SET grand_total = ? WHERE id = ?').bind(refreshed.subtotal - refreshed.discount + refreshed.delivery_charge, id).run()
  await recalcOrderProfit(db, id)
  await auditLog(db, user.id, user.username, 'courier_transfer', 'order', order.order_number, historyNote)
  if (consignmentId) {
    await notify(db, 'courier_sent', '🚚 Steadfast-এ অর্ডার পাঠানো হয়েছে', `${order.order_number} — Tracking: ${finalTrackingId} | Consignment: ${consignmentId}`, `/admin#/orders/${id}`)
  }

  // Courier-pickup SMS to the customer — fires whenever a tracking ID exists
  // (manual transfer or Steadfast API), only if admin has configured an SMS gateway.
  if (finalTrackingId) {
    const s = await getSettings(db, ['sms_on_courier_enabled', 'sms_on_courier_template', 'brand_name'])
    if (s.sms_on_courier_enabled !== '0') {
      runBackground(c, sendSms(db, {
        phone: order.phone,
        orderId: id,
        eventType: 'courier_sent',
        message: fillSmsTemplate(s.sms_on_courier_template || 'প্রিয় {name}, আপনার অর্ডার #{order_number} কুরিয়ারে পাঠানো হয়েছে। ট্র্যাকিং: {tracking_id}। ধন্যবাদ — {brand}', {
          name: order.customer_name, order_number: order.order_number, tracking_id: finalTrackingId, brand: s.brand_name || 'Nature Care Bangladesh'
        })
      }))
    }
  }

  return c.json({ success: true, message: historyNote, tracking_url: trackingUrl, tracking_id: finalTrackingId, consignment_id: consignmentId })
})

// Soft delete
r.delete('/:id', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const order = await db.prepare('SELECT order_number, customer_id FROM orders WHERE id = ?').bind(id).first<any>()
  if (!order) return c.json({ error: 'not_found' }, 404)
  await db.prepare('UPDATE orders SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id).run()
  if (order.customer_id) await refreshCustomerStats(db, order.customer_id)
  await auditLog(db, user.id, user.username, 'soft_delete', 'order', order.order_number, 'Order soft-deleted (recoverable)')
  return c.json({ success: true })
})

// Restore soft-deleted
r.post('/:id/restore', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  await db.prepare('UPDATE orders SET is_deleted = 0 WHERE id = ?').bind(id).run()
  const order = await db.prepare('SELECT order_number, customer_id FROM orders WHERE id = ?').bind(id).first<any>()
  if (order?.customer_id) await refreshCustomerStats(db, order.customer_id)
  await auditLog(db, user.id, user.username, 'restore', 'order', order?.order_number || String(id), 'Order restored')
  return c.json({ success: true })
})

export default r
