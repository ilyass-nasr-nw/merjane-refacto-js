import {type Cradle} from '@fastify/awilix';
import {type INotificationService} from '../notifications.port.js';
import {type IProductHandler} from './product-handler.port.js';
import {type Product} from '@/db/schema.js';
import {type ProductRepository} from '@/repositories/product.repository.js';

export class NormalProductHandler implements IProductHandler {
	private readonly notificationService: INotificationService;
	private readonly productRepository: ProductRepository;

	public constructor({notificationService, productRepository}: Pick<Cradle, 'notificationService' | 'productRepository'>) {
		this.notificationService = notificationService;
		this.productRepository = productRepository;
	}

	public async handleOrder(product: Product): Promise<void> {
		if (product.available > 0) {
			product.available -= 1;
			await this.productRepository.updateProduct(product);
			return;
		}

		if (product.leadTime > 0) {
			await this.productRepository.updateProduct(product);
			this.notificationService.sendDelayNotification(product.leadTime, product.name);
		}
	}
}
