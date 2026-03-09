import {type Product} from '@/db/schema.js';
import {type OrderRepository} from '@/repositories/order.repository.js';
import { NormalProductHandler } from '@/domain/productHandlers/normal-product.handler.js';
import { SeasonalProductHandler } from '@/domain/productHandlers/seasonal-product.handler.js';
import { ExpirableProductHandler } from '@/domain/productHandlers/expirable-product.handler.js';
import { ProductService } from '../productService/product.service.js';

export class OrderService {
	private readonly handlers: Record<string, any>;

	constructor(
		private readonly orderRepository: OrderRepository,
		db: any,
		ps: ProductService,
	) {
		this.handlers = {
			NORMAL: new NormalProductHandler(db, ps),
			SEASONAL: new SeasonalProductHandler(db, ps),
			EXPIRABLE: new ExpirableProductHandler(db, ps),
		};
	}

	async processOrder(orderId: number) {
		const order = await this.orderRepository.findByIdWithProducts(orderId);
		const {products: productList} = order;

		if (productList) {
			for (const {product: p} of productList) {
				await this.handlers[(p as Product).type].handle(p);
			}
		}

		return {orderId: order.id};
	}
}