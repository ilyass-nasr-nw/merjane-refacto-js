import { type Cradle } from '@fastify/awilix';
import { eq } from 'drizzle-orm';
import { type INotificationService } from '../notifications.port.js';
import { products, type Product } from '@/db/schema.js';
import { type Database } from '@/db/type.js';

const PRODUCT_TYPES = {
	NORMAL: 'NORMAL',
	SEASONAL: 'SEASONAL',
	EXPIRABLE: 'EXPIRABLE',
} as const;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export class ProductService {
	private readonly notificationService: INotificationService;
	private readonly db: Database;

	public constructor({ ns, db }: Pick<Cradle, 'ns' | 'db'>) {
		this.notificationService = ns;
		this.db = db;
	}

	/**
 * Primary Entry Point: Orchestrates product processing based on type (OCP).
 */
	public async processProduct(product: Product): Promise<void> {
		const handlers: Record<string, (p: Product) => Promise<void>> = {
			[PRODUCT_TYPES.NORMAL]: this.handleNormalProduct.bind(this),
			[PRODUCT_TYPES.SEASONAL]: this.handleSeasonalProduct.bind(this),
			[PRODUCT_TYPES.EXPIRABLE]: this.handleExpiredProduct.bind(this),
		};

		const handler = handlers[product.type];
		if (handler) {
			await handler(product);
		}
	}

	private async persistUpdate(product: Product): Promise<void> {
		await this.db.update(products).set(product).where(eq(products.id, product.id));
	}

	/* --- Normal Product Logic --- */

	private async handleNormalProduct(product: Product): Promise<void> {
		if (product.available > 0) {
			product.available -= 1;
			await this.persistUpdate(product);
			return;
		}

		if (product.leadTime > 0) {
			await this.notifyDelay(product.leadTime, product);
		}
	}

	public async notifyDelay(leadTime: number, product: Product): Promise<void> {
		product.leadTime = leadTime;
		await this.db.update(products).set(product).where(eq(products.id, product.id));
		this.notificationService.sendDelayNotification(leadTime, product.name);
	}



	/* --- Seasonal Product Logic --- */

	private async handleSeasonalProduct(product: Product): Promise<void> {
		const today = new Date();

		if (this.isWithinSeason(product, today) && product.available > 0) {
			product.available -= 1;
			await this.persistUpdate(product);
			return;
		}

		await this.handleSeasonalExceptions(product, today);
	}

	private isWithinSeason(product: Product, date: Date): boolean {
		return product.seasonStartDate! < date && product.seasonEndDate! > date;
	}

	private async handleSeasonalExceptions(product: Product, today: Date): Promise<void> {
		if (this.isDeliveryAfterSeason(product, today)) {
			return this.handleSeasonalStockout(product);
		}

		if (this.isBeforeSeasonStarts(product, today)) {
			this.notificationService.sendOutOfStockNotification(product.name);
			await this.persistUpdate(product);
			return;
		}

		await this.notifyDelay(product.leadTime, product);
	}

	private isBeforeSeasonStarts(product: Product, today: Date): boolean {
		return product.seasonStartDate ? product.seasonStartDate > today : false;
	}

	private async handleSeasonalStockout(product: Product): Promise<void> {
		this.notificationService.sendOutOfStockNotification(product.name);
		product.available = 0;
		await this.persistUpdate(product);
	}

	private isDeliveryAfterSeason(product: Product, today: Date): boolean {
		const deliveryDate = new Date(today.getTime() + (product.leadTime * MS_PER_DAY));
		return deliveryDate > product.seasonEndDate!;
	}


	/* --- Expirable Product Logic --- */

	private async handleExpiredProduct(product: Product): Promise<void> {
		const today = new Date();

		if (product.available > 0 && !this.isExpired(product, today)) {
			product.available -= 1;
			await this.persistUpdate(product);
			return;
		}

		this.notificationService.sendExpirationNotification(product.name, product.expiryDate!);
		product.available = 0;
		await this.persistUpdate(product);
	}

	private isExpired(product: Product, today: Date): boolean {
		return product.expiryDate ? product.expiryDate <= today : false;
	}

}
