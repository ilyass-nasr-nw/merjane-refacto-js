import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import { mockDeep, type DeepMockProxy } from 'vitest-mock-extended';
import { type INotificationService } from '../notifications.port.js';
import { createDatabaseMock, cleanUp } from '../../utils/test-utils/database-tools.ts.js';
import { ProductService } from './product.service.js';
import { products, type Product } from '@/db/schema.js';
import { type Database } from '@/db/type.js';

describe('ProductService Tests', () => {
	let notificationServiceMock: DeepMockProxy<INotificationService>;
	let productService: ProductService;
	let databaseMock: Database;
	let databaseName: string;
	let sqlite: any;

	beforeEach(async () => {
		({ databaseMock, databaseName, sqlite } = await createDatabaseMock());
		notificationServiceMock = mockDeep<INotificationService>();
		productService = new ProductService({
			ns: notificationServiceMock,
			db: databaseMock,
		});
	});

	afterEach(async () => cleanUp(databaseName, sqlite));

	it('should handle delay notification correctly', async () => {
		// GIVEN
		const product: Product = {
			id: 1,
			leadTime: 15,
			available: 0,
			type: 'NORMAL',
			name: 'RJ45 Cable',
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
		};
		await databaseMock.insert(products).values(product);

		// WHEN
		await productService.notifyDelay(product.leadTime, product);

		// THEN
		expect(product.available).toBe(0);
		expect(product.leadTime).toBe(15);
		expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(product.leadTime, product.name);
		const result = await databaseMock.query.products.findFirst({
			where: (product, { eq }) => eq(product.id, product.id),
		});
		expect(result).toEqual(product);
	});

	it('should decrement stock for NORMAL product when available', async () => {
		const product = createProduct({ type: 'NORMAL', available: 10 });
		await databaseMock.insert(products).values(product);

		await productService.processProduct(product);

		const updatedProduct = await databaseMock.query.products.findFirst();
		expect(updatedProduct!.available).toBe(9);
	});

	it('should handle delay notification correctly for NORMAL product', async () => {
		const product = createProduct({ type: 'NORMAL', available: 0, leadTime: 15 });
		await databaseMock.insert(products).values(product);

		await productService.processProduct(product);

		expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(15, product.name);
	});

	it('should handle stockout when delivery arrives after season ends', async () => {
		const product = createProduct({
			type: 'SEASONAL',
			available: 0,
			leadTime: 30, // Expected delivery: Jan 29, 2026
			seasonEndDate: new Date('2026-01-15'), // Season ends earlier
		});
		await databaseMock.insert(products).values(product);

		await productService.processProduct(product);

		expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith(product.name);
		const updatedProduct = await databaseMock.query.products.findFirst();
		expect(updatedProduct!.available).toBe(0);
	});


	it('should set stock to 0 and notify when expirable product is expired', async () => {
		const expiredProduct = createProduct({
			type: 'EXPIRABLE',
			available: 5,
			expiryDate: new Date('2025-12-01'), // Already expired
		});
		await databaseMock.insert(products).values(expiredProduct);

		await productService.processProduct(expiredProduct);

		const updatedProduct = await databaseMock.query.products.findFirst();
		expect(updatedProduct!.available).toBe(0);
		expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalled();
	});

	/* --- Test Helper --- */
	function createProduct(overrides: Partial<Product>): Product {
		return {
			id: Math.floor(Math.random() * 1000),
			name: 'Test Product',
			type: 'NORMAL',
			available: 10,
			leadTime: 0,
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
			...overrides,
		};
	}
});

