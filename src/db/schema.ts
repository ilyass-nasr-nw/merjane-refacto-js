import {relations} from 'drizzle-orm';
import {
	integer, pgTable, serial, varchar, date,
	primaryKey,
} from 'drizzle-orm/pg-core';
// Declaring enum in database
export const products = pgTable('products', {
	id: serial('id').primaryKey(),
	leadTime: integer('lead_time').notNull(),
	available: integer('available').notNull(),
	type: varchar('type', {length: 256}).notNull(),
	name: varchar('name', {length: 256}).notNull(),
	expiryDate: date('expiry_date', {mode: 'date'}),
	seasonStartDate: date('season_start_date', {mode: 'date'}),
	seasonEndDate: date('season_end_date', {mode: 'date'}),
	flashSaleStartDate: date('flash_sale_start_date', {mode: 'date'}),
	flashSaleEndDate: date('flash_sale_end_date', {mode: 'date'}),

});

export type Product = typeof products.$inferSelect;
export type ProductInsert = typeof products.$inferInsert;

export const orders = pgTable('orders', {
	id: serial('id').primaryKey().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type OrderInsert = typeof orders.$inferInsert;

export const ordersToProducts = pgTable('orders_to_products', {
	orderId: integer('order_id').references(() => orders.id).notNull(),
	productId: integer('product_id').references(() => products.id).notNull(),
}, t => ({
	pk: primaryKey({columns: [t.orderId, t.productId]}),
}));

export const productsRelations = relations(products, ({many}) => ({
	orders: many(ordersToProducts),
}));

export const ordersRelations = relations(orders, ({many}) => ({
	products: many(ordersToProducts),
}));

export const ordersToProductsRelations = relations(ordersToProducts, ({one}) => ({
	product: one(products, {
		fields: [ordersToProducts.productId],
		references: [products.id],
	}),
	order: one(orders, {
		fields: [ordersToProducts.orderId],
		references: [orders.id],
	}),
}));

