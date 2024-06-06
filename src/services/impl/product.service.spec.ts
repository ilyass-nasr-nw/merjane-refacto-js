import {
	describe, it, expect, beforeEach,
	beforeAll, vi, afterEach
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {migrate} from 'drizzle-orm/pglite/migrator';
import {type INotificationService} from '../notifications.port.js';
import {ProductService} from './product.service.js';
import {products, type Product} from '@/db/schema.js';
import * as schema from '@/db/schema.js';

const mockNotificationService = {
	sendDelayNotification: vi.fn(),
	sendOutOfStockNotification: vi.fn(),
	sendExpirationNotification: vi.fn()
};
  
const mockDb = {
	update: vi.fn().mockReturnValue({
	  set: vi.fn().mockReturnThis(),
	  where: vi.fn().mockResolvedValue(undefined)
	})
};
  
const sampleProduct = {
	id: 1,
	name: 'Sample Product',
	type: 'NORMAL',
	available: 10,
	leadTime: 5,
	seasonStartDate: new Date(Date.now() - 1000),
	seasonEndDate: new Date(Date.now() + 1000),
	expiryDate: new Date(Date.now() + 1000),
	flashSaleStartDate: new Date(Date.now() - 1000),
	flashSaleEndDate: new Date(Date.now() + 1000)
};

describe('ProductService Tests', () => {
	const client = new PGlite();
	let notificationServiceMock: DeepMockProxy<INotificationService>;
	const databaseMock = drizzle(client, {schema});
	let productService: ProductService;

	beforeAll(async () => {
		await migrate(databaseMock, {migrationsFolder: 'src/db/migrations'});
	});

	beforeEach(() => {
		notificationServiceMock = mockDeep<INotificationService>();
		productService = new ProductService({
			ns: notificationServiceMock,
			db: databaseMock,
		});
	});

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
			flashSaleStartDate: null,
			flashSaleEndDate: null,
		};
		await databaseMock.insert(products).values(product);

		// WHEN
		await productService.notifyDelay(product.leadTime, product);

		// THEN
		expect(product.available).toBe(0);
		expect(product.leadTime).toBe(15);
		expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(product.leadTime, product.name);
		const result = await databaseMock.query.products.findFirst({
			where: (product, {eq}) => eq(product.id, product.id),
		});
		expect(result).toEqual(product);
	});

});

describe('ProductService', () => {
  let productService: ProductService;

  beforeEach(() => {
    productService = new ProductService({ ns: mockNotificationService, db: mockDb });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should process products of all types correctly', async () => {
    const productsList = [
      { product: { ...sampleProduct, type: 'NORMAL' }, quantity: 1 },
      { product: { ...sampleProduct, type: 'SEASONAL' }, quantity: 1 },
      { product: { ...sampleProduct, type: 'EXPIRABLE' }, quantity: 1 },
      { product: { ...sampleProduct, type: 'FLASHSALE' }, quantity: 1 }
    ];
    await productService.processProducts(productsList);

    expect(mockDb.update(products).set).toHaveBeenCalledTimes(4);
  });

  it('should handle normal products with available stock correctly', async () => {
    const product = { ...sampleProduct, type: 'NORMAL', available: 1 };
    await productService.handleNormalProduct(product);

    expect(mockDb.update(products).set).toHaveBeenCalledWith({ ...product, available: 0 });
    expect(mockNotificationService.sendDelayNotification).not.toHaveBeenCalled();
  });

  it('should handle normal products with no available stock and lead time correctly', async () => {
    const product = { ...sampleProduct, type: 'NORMAL', available: 0, leadTime: 2 };
    await productService.handleNormalProduct(product);

    expect(mockNotificationService.sendDelayNotification).toHaveBeenCalledWith(product.leadTime, product.name);
  });

  it('should handle seasonal products within season and available stock correctly', async () => {
    const product = { ...sampleProduct,
		type: 'SEASONAL',
		available: 1,
		seasonStartDate: new Date(Date.now() - 1000),
		seasonEndDate: new Date(Date.now() + 1000)
	};
    await productService.handleSeasonalProduct(product);

    expect(mockDb.update(products).set).toHaveBeenCalledWith({ ...product, available: 0 });
    expect(mockNotificationService.sendOutOfStockNotification).not.toHaveBeenCalled();
  });

  it('should handle expired products before expiry date correctly', async () => {
    const product = { ...sampleProduct, type: 'EXPIRABLE', available: 1, expiryDate: new Date(Date.now() + 1000) };
    await productService.handleExpiredProduct(product);

    expect(mockDb.update(products).set).toHaveBeenCalledWith({ ...product, available: 0 });
    expect(mockNotificationService.sendExpirationNotification).not.toHaveBeenCalled();
  });

  it('should handle expired products after expiry date correctly', async () => {
    const product = { ...sampleProduct, type: 'EXPIRABLE', available: 1, expiryDate: new Date(Date.now() - 1000) };
    await productService.handleExpiredProduct(product);

    expect(mockNotificationService.sendExpirationNotification).toHaveBeenCalledWith(product.name, product.expiryDate);
  });

  it('should handle flash sale products within sale period and available stock correctly', async () => {
    const product = { ...sampleProduct,
		type: 'FLASHSALE',
		available: 1,
		flashSaleEndDate: new Date(Date.now() + 1000),
		flashSaleStartDate: new Date(Date.now() - 1000)
	};
    await productService.handleFlashSaleProduct(product);

    expect(mockDb.update(products).set).toHaveBeenCalledWith({ ...product, available: 0 });
	expect(mockNotificationService.sendOutOfStockNotification).not.toHaveBeenCalled();
  });

  it('should handle flash sale products after sale period correctly', async () => {
    const product = { ...sampleProduct, type: 'FLASHSALE', available: 1, flashSaleEndDate: new Date(Date.now() - 1000) };
    await productService.handleFlashSaleProduct(product);

    expect(mockNotificationService.sendOutOfStockNotification).toHaveBeenCalledWith(product.name);
  });
});