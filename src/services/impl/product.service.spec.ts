import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import {eq} from 'drizzle-orm';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {type INotificationService} from '../notifications.port.js';
import {createDatabaseMock, cleanUp} from '../../utils/test-utils/database-tools.ts.js';
import {ProductService} from './product.service.js';
import {ProductRepository} from '@/repositories/product.repository.js';
import {NormalProductHandler} from '@/services/product-handlers/normal-product.handler.js';
import {SeasonalProductHandler} from '@/services/product-handlers/seasonal-product.handler.js';
import {ExpirableProductHandler} from '@/services/product-handlers/expirable-product.handler.js';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';
import {DAY_MS} from '@/utils/constants.js';

describe('ProductService Tests', () => {
	let notificationServiceMock: DeepMockProxy<INotificationService>;
	let productService: ProductService;
	let databaseMock: Database;
	let databaseName: string;
	let closeDatabase: () => void;

	beforeEach(async () => {
		({databaseMock, databaseName, close: closeDatabase} = await createDatabaseMock());
		notificationServiceMock = mockDeep<INotificationService>();

		const productRepository = new ProductRepository({db: databaseMock});
		const handlerDeps = {notificationService: notificationServiceMock, productRepository};

		productService = new ProductService({
			normalProductHandler: new NormalProductHandler(handlerDeps),
			seasonalProductHandler: new SeasonalProductHandler(handlerDeps),
			expirableProductHandler: new ExpirableProductHandler(handlerDeps),
		});
	});

	afterEach(async () => {
		closeDatabase();
		await cleanUp(databaseName);
	});

	describe('processProduct - NORMAL', () => {
		it('should decrement available and update DB when in stock', async () => {
			const product: Product = {
				id: 1, leadTime: 15, available: 30, type: 'NORMAL', name: 'USB Cable',
				expiryDate: null, seasonStartDate: null, seasonEndDate: null,
			};
			await databaseMock.insert(products).values(product);

			await productService.processProduct(product);

			const result = await databaseMock.query.products.findFirst({where: eq(products.id, 1)});
			expect(result!.available).toBe(29);
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});

		it('should send delay notification when out of stock with leadTime > 0', async () => {
			const product: Product = {
				id: 1, leadTime: 15, available: 0, type: 'NORMAL', name: 'RJ45 Cable',
				expiryDate: null, seasonStartDate: null, seasonEndDate: null,
			};
			await databaseMock.insert(products).values(product);

			await productService.processProduct(product);

			expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(15, 'RJ45 Cable');
			const result = await databaseMock.query.products.findFirst({where: eq(products.id, 1)});
			expect(result!.available).toBe(0);
		});

		it('should do nothing when out of stock with leadTime = 0', async () => {
			const product: Product = {
				id: 1, leadTime: 0, available: 0, type: 'NORMAL', name: 'Dead Product',
				expiryDate: null, seasonStartDate: null, seasonEndDate: null,
			};
			await databaseMock.insert(products).values(product);

			await productService.processProduct(product);

			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
		});
	});

	describe('processProduct - SEASONAL', () => {
		it('should decrement available when in season and in stock', async () => {
			const product: Product = {
				id: 1, leadTime: 15, available: 30, type: 'SEASONAL', name: 'Watermelon',
				expiryDate: null,
				seasonStartDate: new Date(Date.now() - (10 * DAY_MS)),
				seasonEndDate: new Date(Date.now() + (60 * DAY_MS)),
			};
			await databaseMock.insert(products).values(product);

			await productService.processProduct(product);

			const result = await databaseMock.query.products.findFirst({where: eq(products.id, 1)});
			expect(result!.available).toBe(29);
			expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
		});

		it('should send out-of-stock notification and set available to 0 when leadTime exceeds season end', async () => {
			const product: Product = {
				id: 1, leadTime: 90, available: 0, type: 'SEASONAL', name: 'Watermelon',
				expiryDate: null,
				seasonStartDate: new Date(Date.now() - (10 * DAY_MS)),
				seasonEndDate: new Date(Date.now() + (30 * DAY_MS)),
			};
			await databaseMock.insert(products).values(product);

			await productService.processProduct(product);

			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Watermelon');
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
			const result = await databaseMock.query.products.findFirst({where: eq(products.id, 1)});
			expect(result!.available).toBe(0);
		});

		it('should send out-of-stock notification when season has not started yet', async () => {
			const product: Product = {
				id: 1, leadTime: 15, available: 30, type: 'SEASONAL', name: 'Grapes',
				expiryDate: null,
				seasonStartDate: new Date(Date.now() + (180 * DAY_MS)),
				seasonEndDate: new Date(Date.now() + (240 * DAY_MS)),
			};
			await databaseMock.insert(products).values(product);

			await productService.processProduct(product);

			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith('Grapes');
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
			const result = await databaseMock.query.products.findFirst({where: eq(products.id, 1)});
			expect(result!.available).toBe(30);
		});

		it('should send delay notification when in season, out of stock, and leadTime fits within season', async () => {
			const product: Product = {
				id: 1, leadTime: 15, available: 0, type: 'SEASONAL', name: 'Watermelon',
				expiryDate: null,
				seasonStartDate: new Date(Date.now() - (10 * DAY_MS)),
				seasonEndDate: new Date(Date.now() + (60 * DAY_MS)),
			};
			await databaseMock.insert(products).values(product);

			await productService.processProduct(product);

			expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
			expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(15, 'Watermelon');
		});
	});

	describe('processProduct - EXPIRABLE', () => {
		it('should decrement available when not expired and in stock', async () => {
			const product: Product = {
				id: 1, leadTime: 15, available: 10, type: 'EXPIRABLE', name: 'Butter',
				expiryDate: new Date(Date.now() + (26 * DAY_MS)),
				seasonStartDate: null, seasonEndDate: null,
			};
			await databaseMock.insert(products).values(product);

			await productService.processProduct(product);

			expect(notificationServiceMock.sendExpirationNotification).not.toHaveBeenCalled();
			const result = await databaseMock.query.products.findFirst({where: eq(products.id, 1)});
			expect(result!.available).toBe(9);
		});

		it('should send expiration notification and set available to 0 when expired', async () => {
			const expiryDate = new Date(Date.now() - (2 * DAY_MS));
			const product: Product = {
				id: 1, leadTime: 90, available: 6, type: 'EXPIRABLE', name: 'Milk',
				expiryDate, seasonStartDate: null, seasonEndDate: null,
			};
			await databaseMock.insert(products).values(product);

			await productService.processProduct(product);

			expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith('Milk', expiryDate);
			const result = await databaseMock.query.products.findFirst({where: eq(products.id, 1)});
			expect(result!.available).toBe(0);
		});

		it('should send expiration notification and set available to 0 when not expired but out of stock', async () => {
			const expiryDate = new Date(Date.now() + (26 * DAY_MS));
			const product: Product = {
				id: 1, leadTime: 15, available: 0, type: 'EXPIRABLE', name: 'Butter',
				expiryDate, seasonStartDate: null, seasonEndDate: null,
			};
			await databaseMock.insert(products).values(product);

			await productService.processProduct(product);

			expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith('Butter', expiryDate);
			const result = await databaseMock.query.products.findFirst({where: eq(products.id, 1)});
			expect(result!.available).toBe(0);
		});
	});
});
