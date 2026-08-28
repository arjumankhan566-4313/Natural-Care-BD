// ============ Admin: Products, Packages, Couriers, Content (benefits/reviews/faqs/sections) ============
import { Hono } from 'hono'
import type { Bindings } from '../lib/helpers'
import { auditLog } from '../lib/helpers'
import { requireAuth, AdminUser } from '../lib/auth'

type Env = { Bindings: Bindings; Variables: { user: AdminUser } }
const r = new Hono<Env>()

// ---------- PRODUCTS ----------
const products = new Hono<Env>()
products.use('*', requireAuth('products'))

products.get('/', async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT p.*, (SELECT COUNT(*) FROM product_packages pk WHERE pk.product_id = p.id AND pk.is_active = 1) as package_count,
    (SELECT COUNT(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.product_id = p.id AND o.is_deleted = 0) as order_count
    FROM products p WHERE p.is_deleted = 0 ORDER BY p.sort_order, p.id
  `).all()
  return c.json({ products: rows.results || [] })
})

products.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ? AND is_deleted = 0').bind(id).first<any>()
  if (!product) return c.json({ error: 'not_found' }, 404)
  const packages = await c.env.DB.prepare('SELECT * FROM product_packages WHERE product_id = ? ORDER BY sort_order').bind(id).all()
  return c.json({ product, packages: packages.results || [] })
})

products.post('/', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const b = await c.req.json()
  if (!b.name || b.sale_price === undefined) return c.json({ error: 'validation', message: 'নাম ও মূল্য আবশ্যক' }, 400)
  const res = await db.prepare(`
    INSERT INTO products (name, subtitle, slug, description, features, benefits, ingredients, usage_instructions, package_details,
      main_image, gallery_images, video_url, regular_price, sale_price, product_cost, stock, low_stock_threshold, stock_status, is_active, is_featured, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    b.name, b.subtitle || '', (b.slug || b.name).toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, '-') + '-' + Date.now().toString(36),
    b.description || '', JSON.stringify(b.features || []), JSON.stringify(b.benefits || []),
    b.ingredients || '', b.usage_instructions || '', b.package_details || '',
    b.main_image || '', JSON.stringify(b.gallery_images || []), b.video_url || '',
    Number(b.regular_price || 0), Number(b.sale_price), Number(b.product_cost || 0),
    Number(b.stock || 0), Number(b.low_stock_threshold || 10),
    Number(b.stock || 0) <= 0 ? 'out_of_stock' : (Number(b.stock) <= Number(b.low_stock_threshold || 10) ? 'low_stock' : 'in_stock'),
    b.is_active === false ? 0 : 1, b.is_featured ? 1 : 0, Number(b.sort_order || 0)
  ).run()
  await auditLog(db, user.id, user.username, 'create', 'product', String(res.meta.last_row_id), `Product created: ${b.name}`)
  return c.json({ success: true, id: res.meta.last_row_id })
})

products.put('/:id', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const b = await c.req.json()
  const existing = await db.prepare('SELECT id, name FROM products WHERE id = ? AND is_deleted = 0').bind(id).first<any>()
  if (!existing) return c.json({ error: 'not_found' }, 404)
  const stock = Number(b.stock ?? 0)
  const threshold = Number(b.low_stock_threshold ?? 10)
  await db.prepare(`
    UPDATE products SET name=?, subtitle=?, description=?, features=?, benefits=?, ingredients=?, usage_instructions=?, package_details=?,
      main_image=?, gallery_images=?, video_url=?, regular_price=?, sale_price=?, product_cost=?, stock=?, low_stock_threshold=?,
      stock_status=?, is_active=?, is_featured=?, sort_order=?, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).bind(
    b.name, b.subtitle || '', b.description || '', JSON.stringify(b.features || []), JSON.stringify(b.benefits || []),
    b.ingredients || '', b.usage_instructions || '', b.package_details || '',
    b.main_image || '', JSON.stringify(b.gallery_images || []), b.video_url || '',
    Number(b.regular_price || 0), Number(b.sale_price || 0), Number(b.product_cost || 0), stock, threshold,
    stock <= 0 ? 'out_of_stock' : (stock <= threshold ? 'low_stock' : 'in_stock'),
    b.is_active === false ? 0 : 1, b.is_featured ? 1 : 0, Number(b.sort_order || 0), id
  ).run()
  await auditLog(db, user.id, user.username, 'update', 'product', String(id), `Product updated: ${b.name}`)
  return c.json({ success: true })
})

products.delete('/:id', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  await db.prepare('UPDATE products SET is_deleted = 1 WHERE id = ?').bind(id).run()
  await auditLog(db, user.id, user.username, 'soft_delete', 'product', String(id), 'Product soft-deleted')
  return c.json({ success: true })
})

// Packages
products.post('/:id/packages', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const productId = Number(c.req.param('id'))
  const b = await c.req.json()
  const res = await db.prepare(
    'INSERT INTO product_packages (product_id, name, quantity, price, regular_price, free_delivery, badge, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(productId, b.name, Number(b.quantity || 1), Number(b.price), Number(b.regular_price || 0), b.free_delivery ? 1 : 0, b.badge || null, b.is_active === false ? 0 : 1, Number(b.sort_order || 0)).run()
  await auditLog(db, user.id, user.username, 'create', 'package', String(res.meta.last_row_id), `Package: ${b.name} for product #${productId}`)
  return c.json({ success: true, id: res.meta.last_row_id })
})

products.put('/packages/:pkgId', async (c) => {
  const db = c.env.DB
  const b = await c.req.json()
  await db.prepare('UPDATE product_packages SET name=?, quantity=?, price=?, regular_price=?, free_delivery=?, badge=?, is_active=?, sort_order=? WHERE id=?')
    .bind(b.name, Number(b.quantity || 1), Number(b.price), Number(b.regular_price || 0), b.free_delivery ? 1 : 0, b.badge || null, b.is_active === false ? 0 : 1, Number(b.sort_order || 0), Number(c.req.param('pkgId'))).run()
  return c.json({ success: true })
})

products.delete('/packages/:pkgId', async (c) => {
  await c.env.DB.prepare('DELETE FROM product_packages WHERE id = ?').bind(Number(c.req.param('pkgId'))).run()
  return c.json({ success: true })
})

r.route('/products', products)

// ---------- COURIERS ----------
const couriers = new Hono<Env>()
couriers.use('*', requireAuth('couriers'))

couriers.get('/', async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT c.id, c.name, c.logo, c.has_api, c.delivery_charge, c.return_charge, c.cod_charge_percent, c.tracking_url_template, c.is_active,
      CASE WHEN c.api_key != '' AND c.api_key IS NOT NULL THEN 1 ELSE 0 END as api_configured,
      (SELECT COUNT(*) FROM orders o WHERE o.courier_id = c.id AND o.is_deleted = 0) as total_orders,
      (SELECT COUNT(*) FROM orders o WHERE o.courier_id = c.id AND o.status = 'delivered' AND o.is_deleted = 0) as delivered,
      (SELECT COUNT(*) FROM orders o WHERE o.courier_id = c.id AND o.status = 'returned' AND o.is_deleted = 0) as returned,
      (SELECT COUNT(*) FROM orders o WHERE o.courier_id = c.id AND o.status = 'cancelled' AND o.is_deleted = 0) as cancelled
    FROM couriers c WHERE c.is_deleted = 0 ORDER BY c.id
  `).all()
  return c.json({ couriers: rows.results || [] })
})

couriers.post('/', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const b = await c.req.json()
  if (!b.name) return c.json({ error: 'validation', message: 'কুরিয়ারের নাম দিন' }, 400)
  const res = await db.prepare(`
    INSERT INTO couriers (name, logo, has_api, api_key, secret_key, merchant_id, base_url, delivery_charge, return_charge, cod_charge_percent, tracking_url_template, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(b.name, b.logo || '', b.has_api ? 1 : 0, b.api_key || '', b.secret_key || '', b.merchant_id || '', b.base_url || '',
    Number(b.delivery_charge || 0), Number(b.return_charge || 0), Number(b.cod_charge_percent || 0), b.tracking_url_template || '', b.is_active === false ? 0 : 1).run()
  await auditLog(db, user.id, user.username, 'create', 'courier', String(res.meta.last_row_id), `Courier: ${b.name}`)
  return c.json({ success: true, id: res.meta.last_row_id })
})

couriers.put('/:id', async (c) => {
  const db = c.env.DB
  const user = c.get('user')
  const id = Number(c.req.param('id'))
  const b = await c.req.json()
  // Keep existing secrets if not resubmitted
  const existing = await db.prepare('SELECT api_key, secret_key FROM couriers WHERE id = ?').bind(id).first<any>()
  await db.prepare(`
    UPDATE couriers SET name=?, logo=?, has_api=?, api_key=?, secret_key=?, merchant_id=?, base_url=?,
      delivery_charge=?, return_charge=?, cod_charge_percent=?, tracking_url_template=?, is_active=? WHERE id=?
  `).bind(b.name, b.logo || '', b.has_api ? 1 : 0,
    b.api_key !== undefined && b.api_key !== '••••••••' ? b.api_key : (existing?.api_key || ''),
    b.secret_key !== undefined && b.secret_key !== '••••••••' ? b.secret_key : (existing?.secret_key || ''),
    b.merchant_id || '', b.base_url || '',
    Number(b.delivery_charge || 0), Number(b.return_charge || 0), Number(b.cod_charge_percent || 0), b.tracking_url_template || '', b.is_active === false ? 0 : 1, id).run()
  await auditLog(db, user.id, user.username, 'update', 'courier', String(id), `Courier updated: ${b.name}`)
  return c.json({ success: true })
})

couriers.delete('/:id', async (c) => {
  await c.env.DB.prepare('UPDATE couriers SET is_deleted = 1, is_active = 0 WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return c.json({ success: true })
})

r.route('/couriers', couriers)

// ---------- CONTENT: benefits, reviews, faqs, sections ----------
const content = new Hono<Env>()
content.use('*', requireAuth('content'))

// Benefits
content.get('/benefits', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM benefits ORDER BY sort_order, id').all()
  return c.json({ benefits: rows.results || [] })
})
content.post('/benefits', async (c) => {
  const b = await c.req.json()
  const res = await c.env.DB.prepare('INSERT INTO benefits (icon, title, description, image, sort_order, is_visible) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(b.icon || 'fa-check-circle', b.title, b.description || '', b.image || '', Number(b.sort_order || 0), b.is_visible === false ? 0 : 1).run()
  return c.json({ success: true, id: res.meta.last_row_id })
})
content.put('/benefits/:id', async (c) => {
  const b = await c.req.json()
  await c.env.DB.prepare('UPDATE benefits SET icon=?, title=?, description=?, image=?, sort_order=?, is_visible=? WHERE id=?')
    .bind(b.icon || 'fa-check-circle', b.title, b.description || '', b.image || '', Number(b.sort_order || 0), b.is_visible === false ? 0 : 1, Number(c.req.param('id'))).run()
  return c.json({ success: true })
})
content.delete('/benefits/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM benefits WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return c.json({ success: true })
})

// Reviews
content.get('/reviews', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM reviews ORDER BY sort_order, id DESC').all()
  return c.json({ reviews: rows.results || [] })
})
content.post('/reviews', async (c) => {
  const b = await c.req.json()
  const res = await c.env.DB.prepare('INSERT INTO reviews (customer_name, customer_image, review_text, rating, is_published, is_featured, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(b.customer_name, b.customer_image || '', b.review_text, Math.min(5, Math.max(1, Number(b.rating || 5))), b.is_published === false ? 0 : 1, b.is_featured ? 1 : 0, Number(b.sort_order || 0)).run()
  return c.json({ success: true, id: res.meta.last_row_id })
})
content.put('/reviews/:id', async (c) => {
  const b = await c.req.json()
  await c.env.DB.prepare('UPDATE reviews SET customer_name=?, customer_image=?, review_text=?, rating=?, is_published=?, is_featured=?, sort_order=? WHERE id=?')
    .bind(b.customer_name, b.customer_image || '', b.review_text, Math.min(5, Math.max(1, Number(b.rating || 5))), b.is_published === false ? 0 : 1, b.is_featured ? 1 : 0, Number(b.sort_order || 0), Number(c.req.param('id'))).run()
  return c.json({ success: true })
})
content.delete('/reviews/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return c.json({ success: true })
})

// FAQs
content.get('/faqs', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM faqs ORDER BY sort_order, id').all()
  return c.json({ faqs: rows.results || [] })
})
content.post('/faqs', async (c) => {
  const b = await c.req.json()
  const res = await c.env.DB.prepare('INSERT INTO faqs (question, answer, sort_order, is_visible) VALUES (?, ?, ?, ?)')
    .bind(b.question, b.answer, Number(b.sort_order || 0), b.is_visible === false ? 0 : 1).run()
  return c.json({ success: true, id: res.meta.last_row_id })
})
content.put('/faqs/:id', async (c) => {
  const b = await c.req.json()
  await c.env.DB.prepare('UPDATE faqs SET question=?, answer=?, sort_order=?, is_visible=? WHERE id=?')
    .bind(b.question, b.answer, Number(b.sort_order || 0), b.is_visible === false ? 0 : 1, Number(c.req.param('id'))).run()
  return c.json({ success: true })
})
content.delete('/faqs/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM faqs WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return c.json({ success: true })
})

// Page sections (section builder)
content.get('/sections', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM page_sections ORDER BY sort_order, id').all()
  return c.json({ sections: rows.results || [] })
})
content.post('/sections', async (c) => {
  const b = await c.req.json()
  const res = await c.env.DB.prepare('INSERT INTO page_sections (section_type, title, content, is_visible, sort_order) VALUES (?, ?, ?, ?, ?)')
    .bind(b.section_type, b.title || '', typeof b.content === 'string' ? b.content : JSON.stringify(b.content || {}), b.is_visible === false ? 0 : 1, Number(b.sort_order || 0)).run()
  return c.json({ success: true, id: res.meta.last_row_id })
})
content.put('/sections/:id', async (c) => {
  const b = await c.req.json()
  await c.env.DB.prepare('UPDATE page_sections SET section_type=?, title=?, content=?, is_visible=?, sort_order=? WHERE id=?')
    .bind(b.section_type, b.title || '', typeof b.content === 'string' ? b.content : JSON.stringify(b.content || {}), b.is_visible === false ? 0 : 1, Number(b.sort_order || 0), Number(c.req.param('id'))).run()
  return c.json({ success: true })
})
content.delete('/sections/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM page_sections WHERE id = ?').bind(Number(c.req.param('id'))).run()
  return c.json({ success: true })
})

r.route('/content', content)

export default r
