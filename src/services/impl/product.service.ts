import {type Cradle} from '@fastify/awilix';
import {type IProductHandler} from '../product-handlers/product-handler.port.js';
import {type Product} from '@/db/schema.js';
import {type ProductType} from '@/types/product-type.js';

export class ProductService {
	private readonly handlers: Record<ProductType, IProductHandler>;

	public constructor({normalProductHandler, seasonalProductHandler, expirableProductHandler}: Pick<Cradle, 'normalProductHandler' | 'seasonalProductHandler' | 'expirableProductHandler'>) {
		this.handlers = {
			NORMAL: normalProductHandler,
			SEASONAL: seasonalProductHandler,
			EXPIRABLE: expirableProductHandler,
		};
	}

	public async processProduct(product: Product): Promise<void> {
		const handler = this.handlers[product.type];
		if (!handler) {
			throw new Error(`Unknown product type: ${product.type as string}`);
		}

		await handler.handleOrder(product);
	}
}
