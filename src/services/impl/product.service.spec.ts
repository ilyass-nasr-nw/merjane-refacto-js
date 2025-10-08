import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {type INotificationService} from '../notifications.port.js';
import {createDatabaseMock, cleanUp} from '../../utils/test-utils/database-tools.ts.js';
import {ProductService} from './product.service.js';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

describe('ProductService Tests', () => {
	let notificationServiceMock: DeepMockProxy<INotificationService>;
	let productService: ProductService;
	let databaseMock: Database;
	let databaseName: string;
	const msInDay = 24 * 60 * 60 * 1000;


	beforeEach(async () => {
		({databaseMock, databaseName} = await createDatabaseMock());
		notificationServiceMock = mockDeep<INotificationService>();
		productService = new ProductService({
			ns: notificationServiceMock,
			db: databaseMock,
		});
	});

	afterEach(async () => cleanUp(databaseName));


	//TO DO: needs more coverage

	
	describe('Multiple Products Processing', () => {
		it('should process multiple products correctly', async () => {
		const currentDate = new Date();
		const products: Product[] = [
			{
			id: 1,
			name: 'USB Cable',
			type: 'NORMAL',
			available: 10,
			leadTime: 15,
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
			},
			{
			id: 2,
			name: 'USB Dongle',
			type: 'NORMAL',
			available: 0,
			leadTime: 10,
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
			},
			{
			id: 3,
			name: 'Milk',
			type: 'EXPIRABLE',
			available: 30,
			leadTime: 15,
			expiryDate: new Date(currentDate.getTime() + 26 * msInDay),
			seasonStartDate: null,
			seasonEndDate: null,
			},
		];

		await productService.processProducts(products, currentDate);

		// USB Cable - success
		expect(products[0]!.available).toBe(9);
		
		// USB Dongle - delay notification
		expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(10, 'USB Dongle');
		
		// Milk - success
		expect(products[2]!.available).toBe(29);
		
		});
	});
});

