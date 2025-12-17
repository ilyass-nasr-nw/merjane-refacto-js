import {describe, it, expect, beforeEach} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {productHandlers} from './product-strategies.js';
import {type Product} from '@/db/schema.js';
import {type ProductRepo} from '@/repositories/product-repo.js';
import {type ProductService} from '@/services/impl/product.service.js';

describe('productHandlers', () => {
	let productRepo: DeepMockProxy<ProductRepo>;
	let productService: DeepMockProxy<ProductService>;

	beforeEach(() => {
		productRepo = mockDeep<ProductRepo>();
		productService = mockDeep<ProductService>();
	});

	function deps() {
		return {productRepo, ps: productService};
	}

	it('NORMAL: decrements available when stock > 0', async () => {
		const product: Product = {
			id: 1,
			leadTime: 0,
			available: 5,
			type: 'NORMAL',
			name: 'USB Cable',
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
		};

		await productHandlers.NORMAL(product, deps());

		expect(productRepo.decrementAvailable).toHaveBeenCalledWith(1);
		expect(productService.notifyDelay).not.toHaveBeenCalled();
	});

	it('NORMAL: calls notifyDelay when no stock but leadTime > 0', async () => {
		const product: Product = {
			id: 2,
			leadTime: 10,
			available: 0,
			type: 'NORMAL',
			name: 'Adapter',
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
		};

		await productHandlers.NORMAL(product, deps());

		expect(productRepo.decrementAvailable).not.toHaveBeenCalled();
		expect(productService.notifyDelay).toHaveBeenCalledWith(10, product);
	});

	it('SEASONAL: decrements available when in season and stock > 0', async () => {
		const now = new Date();
		const product: Product = {
			id: 3,
			leadTime: 0,
			available: 3,
			type: 'SEASONAL',
			name: 'Watermelon',
			expiryDate: null,
			seasonStartDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
			seasonEndDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
		};

		await productHandlers.SEASONAL(product, deps());

		expect(productRepo.decrementAvailable).toHaveBeenCalledWith(3);
		expect(productService.handleSeasonalProduct).not.toHaveBeenCalled();
	});

	it('SEASONAL: delegates to ProductService when out of season or no stock', async () => {
		const now = new Date();
		const product: Product = {
			id: 4,
			leadTime: 0,
			available: 0,
			type: 'SEASONAL',
			name: 'Grapes',
			expiryDate: null,
			seasonStartDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
			seasonEndDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
		};

		await productHandlers.SEASONAL(product, deps());

		expect(productRepo.decrementAvailable).not.toHaveBeenCalled();
		expect(productService.handleSeasonalProduct).toHaveBeenCalledWith(product);
	});

	it('EXPIRABLE: decrements available when not expired and stock > 0', async () => {
		const now = new Date();
		const product: Product = {
			id: 5,
			leadTime: 0,
			available: 2,
			type: 'EXPIRABLE',
			name: 'Butter',
			expiryDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
			seasonStartDate: null,
			seasonEndDate: null,
		};

		await productHandlers.EXPIRABLE(product, deps());

		expect(productRepo.decrementAvailable).toHaveBeenCalledWith(5);
		expect(productService.handleExpiredProduct).not.toHaveBeenCalled();
	});

	it('EXPIRABLE: delegates to ProductService when expired or no stock', async () => {
		const now = new Date();
		const product: Product = {
			id: 6,
			leadTime: 0,
			available: 0,
			type: 'EXPIRABLE',
			name: 'Milk',
			expiryDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
			seasonStartDate: null,
			seasonEndDate: null,
		};

		await productHandlers.EXPIRABLE(product, deps());

		expect(productRepo.decrementAvailable).not.toHaveBeenCalled();
		expect(productService.handleExpiredProduct).toHaveBeenCalledWith(product);
	});
});


