import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import { type FastifyInstance } from 'fastify';
import supertest from 'supertest';
import { eq } from 'drizzle-orm';
import { type DeepMockProxy, mockDeep } from 'vitest-mock-extended';
import { asValue } from 'awilix';
import { type INotificationService } from '@/services/notifications.port.js';
import {
	type ProductInsert,
	products,
	orders,
	ordersToProducts,
} from '@/db/schema.js';
import { type Database } from '@/db/type.js';
import { buildFastify } from '@/fastify.js';

describe('MyController Integration Tests', () => {
	let fastify: FastifyInstance;
	let database: Database;
	let notificationServiceMock: DeepMockProxy<INotificationService>;

	beforeEach(async () => {
		notificationServiceMock = mockDeep<INotificationService>();

		fastify = await buildFastify();
		fastify.diContainer.register({
			ns: asValue(notificationServiceMock as INotificationService),
		});
		await fastify.ready();
		database = fastify.database;
	});
	afterEach(async () => {
		await fastify.close();
	});

	it('Characterization: should verify all stock and notification outcomes', async () => {
		const client = supertest(fastify.server);
		const allProducts = createProducts();
		const orderId = await database.transaction(async tx => {
			const productList = await tx.insert(products).values(allProducts).returning({ productId: products.id });
			const [order] = await tx.insert(orders).values([{}]).returning({ orderId: orders.id });
			await tx.insert(ordersToProducts).values(productList.map(p => ({ orderId: order!.orderId, productId: p.productId })));
			return order!.orderId;
		});

		await client.post(`/orders/${orderId}/processOrder`).expect(200).expect('Content-Type', /application\/json/);

		const resultOrder = await database.query.orders.findFirst({ where: eq(orders.id, orderId) });
		expect(resultOrder!.id).toBe(orderId);

		// Assert: Verify current legacy behavior (The Characterization)
		const dbProducts = await database.query.products.findMany();

		// Verify NORMAL In-Stock: Should decrement (30 -> 29)
		const usbCable = dbProducts.find(p => p.name === 'USB Cable');

		expect(usbCable!.available).toBe(29);


		// Verify NORMAL Out-of-Stock: Should trigger delay notification
		expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(10, expect.anything());

		// Verify EXPIRABLE Expired: Should be set to 0 and notify
		const milk = dbProducts.find(p => p.name === 'Milk');
		expect(milk!.available).toBe(0);
		expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith('Milk', expect.anything());

		// Verify SEASONAL In-Season: Should decrement (30 -> 29)
		const watermelon = dbProducts.find(p => p.name === 'Watermelon');
		expect(watermelon!.available).toBe(29);
	});

	function createProducts(): ProductInsert[] {
		const d = 24 * 60 * 60 * 1000;
		return [
			{
				leadTime: 15, available: 30, type: 'NORMAL', name: 'USB Cable',
			},
			{
				leadTime: 10, available: 0, type: 'NORMAL', name: 'USB Dongle',
			},
			{
				leadTime: 15, available: 30, type: 'EXPIRABLE', name: 'Butter', expiryDate: new Date(Date.now() + (26 * d)),
			},
			{
				leadTime: 90, available: 6, type: 'EXPIRABLE', name: 'Milk', expiryDate: new Date(Date.now() - (2 * d)),
			},
			{
				leadTime: 15, available: 30, type: 'SEASONAL', name: 'Watermelon', seasonStartDate: new Date(Date.now() - (2 * d)), seasonEndDate: new Date(Date.now() + (58 * d)),
			},
			{
				leadTime: 15, available: 30, type: 'SEASONAL', name: 'Grapes', seasonStartDate: new Date(Date.now() + (180 * d)), seasonEndDate: new Date(Date.now() + (240 * d)),
			},
		];
	}
});
