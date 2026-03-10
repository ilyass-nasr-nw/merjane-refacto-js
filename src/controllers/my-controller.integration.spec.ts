import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import {type FastifyInstance} from 'fastify';
import supertest from 'supertest';
import {eq} from 'drizzle-orm';
import {type DeepMockProxy, mockDeep} from 'vitest-mock-extended';
import {asValue} from 'awilix';
import {type INotificationService} from '@/services/notifications.port.js';
import {
	type ProductInsert,
	products,
	orders,
	ordersToProducts,
} from '@/db/schema.js';
import {type Database} from '@/db/type.js';
import {buildFastify} from '@/fastify.js';
import {DAY_MS} from '@/utils/constants.js';

describe('MyController Integration Tests', () => {
	let fastify: FastifyInstance;
	let database: Database;
	let notificationServiceMock: DeepMockProxy<INotificationService>;
	let client: ReturnType<typeof supertest>;

	beforeEach(async () => {
		notificationServiceMock = mockDeep<INotificationService>();

		fastify = await buildFastify();
		fastify.diContainer.register({
			notificationService: asValue(notificationServiceMock as INotificationService),
		});
		await fastify.ready();
		database = fastify.database;
		client = supertest(fastify.server);
	});
	afterEach(async () => {
		await fastify.close();
	});

	function createOrderWithProduct(product: ProductInsert): number {
		return database.transaction(tx => {
			const inserted = tx.insert(products).values(product).returning({productId: products.id}).get();
			const order = tx.insert(orders).values([{}]).returning({orderId: orders.id}).get();
			tx.insert(ordersToProducts).values([{orderId: order.orderId, productId: inserted.productId}]).run();
			return order.orderId;
		});
	}

	function createOrderWithProducts(allProducts: ProductInsert[]): number {
		return database.transaction(tx => {
			const productList = tx.insert(products).values(allProducts).returning({productId: products.id}).all();
			const order = tx.insert(orders).values([{}]).returning({orderId: orders.id}).get();
			tx.insert(ordersToProducts).values(productList.map(p => ({orderId: order.orderId, productId: p.productId}))).run();
			return order.orderId;
		});
	}

	async function getProduct(productId: number) {
		return database.query.products.findFirst({where: eq(products.id, productId)});
	}

	describe('NORMAL product', () => {
		it('should decrement available when product is in stock', async () => {
			const orderId = createOrderWithProduct({
				leadTime: 15, available: 30, type: 'NORMAL', name: 'USB Cable',
			});

			await client.post(`/orders/${orderId}/processOrder`).expect(200);

			const result = await getProduct(1);
			expect(result!.available).toBe(29);
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});

		it('should send delay notification when out of stock with leadTime > 0', async () => {
			const orderId = createOrderWithProduct({
				leadTime: 10, available: 0, type: 'NORMAL', name: 'USB Dongle',
			});

			await client.post(`/orders/${orderId}/processOrder`).expect(200);

			const result = await getProduct(1);
			expect(result!.available).toBe(0);
			expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(10, 'USB Dongle');
		});

		it('should do nothing when out of stock with leadTime = 0', async () => {
			const orderId = createOrderWithProduct({
				leadTime: 0, available: 0, type: 'NORMAL', name: 'Dead Product',
			});

			await client.post(`/orders/${orderId}/processOrder`).expect(200);

			const result = await getProduct(1);
			expect(result!.available).toBe(0);
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
			expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
		});
	});

	describe('SEASONAL product', () => {
		it('should decrement available when in season and in stock', async () => {
			const orderId = createOrderWithProduct({
				leadTime: 15, available: 30, type: 'SEASONAL', name: 'Watermelon',
				seasonStartDate: new Date(Date.now() - (2 * DAY_MS)),
				seasonEndDate: new Date(Date.now() + (58 * DAY_MS)),
			});

			await client.post(`/orders/${orderId}/processOrder`).expect(200);

			const result = await getProduct(1);
			expect(result!.available).toBe(29);
			expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});

		it('should send delay notification when in season, out of stock, and leadTime fits within season', async () => {
			const orderId = createOrderWithProduct({
				leadTime: 15, available: 0, type: 'SEASONAL', name: 'Watermelon',
				seasonStartDate: new Date(Date.now() - (10 * DAY_MS)),
				seasonEndDate: new Date(Date.now() + (60 * DAY_MS)),
			});

			await client.post(`/orders/${orderId}/processOrder`).expect(200);

			expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(15, 'Watermelon');
			expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
		});

		it('should send out-of-stock notification when in season, out of stock, and leadTime exceeds season end', async () => {
			const orderId = createOrderWithProduct({
				leadTime: 90, available: 0, type: 'SEASONAL', name: 'Watermelon',
				seasonStartDate: new Date(Date.now() - (10 * DAY_MS)),
				seasonEndDate: new Date(Date.now() + (30 * DAY_MS)),
			});

			await client.post(`/orders/${orderId}/processOrder`).expect(200);

			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Watermelon');
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
			const result = await getProduct(1);
			expect(result!.available).toBe(0);
		});

		it('should send out-of-stock notification when season has not started', async () => {
			const orderId = createOrderWithProduct({
				leadTime: 15, available: 30, type: 'SEASONAL', name: 'Grapes',
				seasonStartDate: new Date(Date.now() + (180 * DAY_MS)),
				seasonEndDate: new Date(Date.now() + (240 * DAY_MS)),
			});

			await client.post(`/orders/${orderId}/processOrder`).expect(200);

			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Grapes');
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});
	});

	describe('EXPIRABLE product', () => {
		it('should decrement available when not expired and in stock', async () => {
			const orderId = createOrderWithProduct({
				leadTime: 15, available: 30, type: 'EXPIRABLE', name: 'Butter',
				expiryDate: new Date(Date.now() + (26 * DAY_MS)),
			});

			await client.post(`/orders/${orderId}/processOrder`).expect(200);

			const result = await getProduct(1);
			expect(result!.available).toBe(29);
			expect(notificationServiceMock.sendExpirationNotification).not.toHaveBeenCalled();
		});

		it('should send expiration notification and set available to 0 when expired', async () => {
			const expiryDate = new Date(Date.now() - (2 * DAY_MS));
			const orderId = createOrderWithProduct({
				leadTime: 90, available: 6, type: 'EXPIRABLE', name: 'Milk',
				expiryDate,
			});

			await client.post(`/orders/${orderId}/processOrder`).expect(200);

			expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith('Milk', expiryDate);
			const result = await getProduct(1);
			expect(result!.available).toBe(0);
		});

		it('should send expiration notification and set available to 0 when not expired but out of stock', async () => {
			const expiryDate = new Date(Date.now() + (26 * DAY_MS));
			const orderId = createOrderWithProduct({
				leadTime: 15, available: 0, type: 'EXPIRABLE', name: 'Butter',
				expiryDate,
			});

			await client.post(`/orders/${orderId}/processOrder`).expect(200);

			expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith('Butter', expiryDate);
			const result = await getProduct(1);
			expect(result!.available).toBe(0);
		});
	});

	describe('Mixed order with all product types', () => {
		it('should process all product types correctly in a single order', async () => {
			const allProducts: ProductInsert[] = [
				{
					leadTime: 15, available: 30, type: 'NORMAL', name: 'USB Cable',
				},
				{
					leadTime: 10, available: 0, type: 'NORMAL', name: 'USB Dongle',
				},
				{
					leadTime: 15, available: 30, type: 'EXPIRABLE', name: 'Butter',
					expiryDate: new Date(Date.now() + (26 * DAY_MS)),
				},
				{
					leadTime: 90, available: 6, type: 'EXPIRABLE', name: 'Milk',
					expiryDate: new Date(Date.now() - (2 * DAY_MS)),
				},
				{
					leadTime: 15, available: 30, type: 'SEASONAL', name: 'Watermelon',
					seasonStartDate: new Date(Date.now() - (2 * DAY_MS)),
					seasonEndDate: new Date(Date.now() + (58 * DAY_MS)),
				},
				{
					leadTime: 15, available: 30, type: 'SEASONAL', name: 'Grapes',
					seasonStartDate: new Date(Date.now() + (180 * DAY_MS)),
					seasonEndDate: new Date(Date.now() + (240 * DAY_MS)),
				},
			];

			const orderId = createOrderWithProducts(allProducts);

			await client.post(`/orders/${orderId}/processOrder`).expect(200);

			const usbCable = await getProduct(1);
			expect(usbCable!.available).toBe(29);

			const usbDongle = await getProduct(2);
			expect(usbDongle!.available).toBe(0);
			expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(10, 'USB Dongle');

			const butter = await getProduct(3);
			expect(butter!.available).toBe(29);

			const milk = await getProduct(4);
			expect(milk!.available).toBe(0);
			expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalled();

			const watermelon = await getProduct(5);
			expect(watermelon!.available).toBe(29);

			const grapes = await getProduct(6);
			expect(grapes!.available).toBe(30);
			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Grapes');
		});
	});
});
