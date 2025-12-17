import {describe, it, expect} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {OrderProcessor}from './order-processor.js';
import {type OrderRepo}from '@/repositories/order-repo.js';
import {type ProductRepo}from '@/repositories/product-repo.js';
import {type ProductService}from '@/services/impl/product.service.js';
import {type Product}from '@/db/schema.js';

describe('OrderProcessor', () => {
	let orderRepo: DeepMockProxy<OrderRepo>;
	let productRepo: DeepMockProxy<ProductRepo>;
	let productService: DeepMockProxy<ProductService>;

	function createSut(): OrderProcessor {
		orderRepo = mockDeep<OrderRepo>();
		productRepo = mockDeep<ProductRepo>();
		productService = mockDeep<ProductService>();

		return new OrderProcessor({
			orderRepo,
			productRepo,
			ps: productService,
		} as any);
	}

	it('should process all products and return order id', async () => {
		// GIVEN
		const sut = createSut();
		const products: Array<{product: Product}> = [
			{
				product: {
					id: 1,
					leadTime: 10,
					available: 5,
					type: 'NORMAL',
					name: 'USB Cable',
					expiryDate: null,
					seasonStartDate: null,
					seasonEndDate: null,
				},
			},
			{
				product: {
					id: 2,
					leadTime: 0,
					available: 0,
					type: 'NORMAL',
					name: 'Adapter',
					expiryDate: null,
					seasonStartDate: null,
					seasonEndDate: null,
				},
			},
		];

		orderRepo.findWithProducts.mockResolvedValue({
			id: 42,
			products,
		} as any);

		// WHEN
		const result = await sut.process(42);

		// THEN
		expect(result).toEqual({orderId: 42});
		expect(orderRepo.findWithProducts).toHaveBeenCalledWith(42);
		expect(productRepo.decrementAvailable).toHaveBeenCalledWith(1);
	});

	it('should throw when order does not exist', async () => {
		// GIVEN
		const sut = createSut();
		orderRepo.findWithProducts.mockResolvedValue(null as any);

		// WHEN / THEN
		await expect(sut.process(99)).rejects.toThrowError('Order with id 99 not found');
	});
});