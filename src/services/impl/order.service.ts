import {type Cradle} from '@fastify/awilix';
import {OrderNotFoundError} from '../errors/order-not-found.error.js';
import {type ProductService} from './product.service.js';
import {type OrderRepository} from '@/repositories/order.repository.js';

export class OrderService {
	private readonly orderRepository: OrderRepository;
	private readonly productService: ProductService;

	public constructor({orderRepository, productService}: Pick<Cradle, 'orderRepository' | 'productService'>) {
		this.orderRepository = orderRepository;
		this.productService = productService;
	}

	public async processOrder(orderId: number): Promise<{orderId: number}> {
		const order = await this.orderRepository.findOrderWithProducts(orderId);

		if (!order) {
			throw new OrderNotFoundError(orderId);
		}

		for (const {product} of order.products) {
			await this.productService.processProduct(product);
		}

		return {orderId: order.id};
	}
}
