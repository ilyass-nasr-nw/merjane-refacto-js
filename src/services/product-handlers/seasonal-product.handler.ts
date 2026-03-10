import {type Cradle} from '@fastify/awilix';
import {type INotificationService} from '../notifications.port.js';
import {type IProductHandler} from './product-handler.port.js';
import {type Product} from '@/db/schema.js';
import {type ProductRepository} from '@/repositories/product.repository.js';
import {DAY_MS} from '@/utils/constants.js';

export class SeasonalProductHandler implements IProductHandler {
	private readonly notificationService: INotificationService;
	private readonly productRepository: ProductRepository;

	public constructor({notificationService, productRepository}: Pick<Cradle, 'notificationService' | 'productRepository'>) {
		this.notificationService = notificationService;
		this.productRepository = productRepository;
	}

	public async handleOrder(product: Product): Promise<void> {
		if (!product.seasonStartDate || !product.seasonEndDate) {
			throw new Error(`SEASONAL product "${product.name}" is missing season dates`);
		}

		const now = new Date();
		const isInSeason = now > product.seasonStartDate && now < product.seasonEndDate;

		if (isInSeason && product.available > 0) {
			product.available -= 1;
			await this.productRepository.updateProduct(product);
			return;
		}

		await this.handleOutOfStock(product, product.seasonStartDate, product.seasonEndDate);
	}

	private async handleOutOfStock(product: Product, seasonStartDate: Date, seasonEndDate: Date): Promise<void> {
		const now = new Date();
		const restockDate = new Date(now.getTime() + (product.leadTime * DAY_MS));
		const isBeforeSeason = seasonStartDate > now;

		if (restockDate > seasonEndDate || isBeforeSeason) {
			this.notificationService.sendOutOfStockNotification(product.name);
			if (restockDate > seasonEndDate) {
				product.available = 0;
			}

			await this.productRepository.updateProduct(product);
			return;
		}

		await this.productRepository.updateProduct(product);
		this.notificationService.sendDelayNotification(product.leadTime, product.name);
	}
}
