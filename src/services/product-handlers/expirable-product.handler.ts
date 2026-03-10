import {type Cradle} from '@fastify/awilix';
import {type INotificationService} from '../notifications.port.js';
import {type IProductHandler} from './product-handler.port.js';
import {type Product} from '@/db/schema.js';
import {type ProductRepository} from '@/repositories/product.repository.js';

export class ExpirableProductHandler implements IProductHandler {
	private readonly notificationService: INotificationService;
	private readonly productRepository: ProductRepository;

	public constructor({notificationService, productRepository}: Pick<Cradle, 'notificationService' | 'productRepository'>) {
		this.notificationService = notificationService;
		this.productRepository = productRepository;
	}

	public async handleOrder(product: Product): Promise<void> {
		if (!product.expiryDate) {
			throw new Error(`EXPIRABLE product "${product.name}" is missing expiryDate`);
		}

		const now = new Date();
		const isNotExpired = product.expiryDate > now;

		if (product.available > 0 && isNotExpired) {
			product.available -= 1;
			await this.productRepository.updateProduct(product);
			return;
		}

		this.notificationService.sendExpirationNotification(product.name, product.expiryDate);
		product.available = 0;
		await this.productRepository.updateProduct(product);
	}
}
