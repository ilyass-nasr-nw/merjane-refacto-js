import {type Cradle} from '@fastify/awilix';
import {type OrderRepo} from '@/repositories/order-repo.js';
import {type ProductRepo} from '@/repositories/product-repo.js';
import {type ProductService} from '@/services/impl/product.service.js';
import {productHandlers} from '@/services/product-strategies.js';

export class OrderProcessor {
	private readonly orderRepo: OrderRepo;
	private readonly productRepo: ProductRepo;
	private readonly ps: ProductService;

	public constructor({orderRepo, productRepo, ps}: Pick<Cradle, 'orderRepo' | 'productRepo' | 'ps'>) {
		this.orderRepo = orderRepo;
		this.productRepo = productRepo;
		this.ps = ps;
	}

	public async process(orderId: number): Promise<{orderId: number}> {
		const order = await this.orderRepo.findWithProducts(orderId);
		if (!order) {
			throw new Error(`Order with id ${orderId} not found`);
		}

		for (const {product} of order.products ?? []) {
			const handler = productHandlers[product.type];
			await handler(product, {productRepo: this.productRepo, ps: this.ps});
		}

		return {orderId: order.id};
	}
}
