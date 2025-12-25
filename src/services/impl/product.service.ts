import {type Cradle} from '@fastify/awilix';
import {eq} from 'drizzle-orm';
import {type INotificationService} from '../notifications.port.js';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

export class ProductService {
	private readonly ns: INotificationService;
	private readonly db: Database;

	public constructor({ns, db}: Pick<Cradle, 'ns' | 'db'>) {
		this.ns = ns;
		this.db = db;
	}

	public async notifyDelay(leadTime: number, product: Product): Promise<void> {
		product.leadTime = leadTime;
		await this.updateProduct(product);
		this.ns.sendDelayNotification(leadTime, product.name);
	}

	public async handleNormalProduct(product: Product): Promise<void> {
		if (product.available > 0) {
			product.available -= 1;
			await this.updateProduct(product);
		} else if (product.leadTime > 0) {
			await this.notifyDelay(product.leadTime, product);
		}
	}

	public async handleSeasonalProduct(product: Product): Promise<void> {
		const now = new Date();
		const restockDate = new Date(now.getTime() + (product.leadTime * 24 * 60 * 60 * 1000));

		if (restockDate > product.seasonEndDate! || now < product.seasonStartDate!) {
			product.available = 0;
			await this.updateProduct(product);
			this.ns.sendOutOfStockNotification(product.name);
		} else {
			await this.notifyDelay(product.leadTime, product);
		}
	}

	public async handleExpiredProduct(product: Product): Promise<void> {
		const now = new Date();

		if (product.available > 0 && product.expiryDate! > now) {
			product.available -= 1;
			await this.updateProduct(product);
		} else {
			product.available = 0;
			await this.updateProduct(product);
			this.ns.sendExpirationNotification(product.name, product.expiryDate!);
		}
	}

	public async processOrderProducts(orderProducts: Array<{product: Product}>): Promise<void> {
		await Promise.all(
			orderProducts.map(async ({product}) => {
				switch (product.type) {
					case 'NORMAL': {
						await this.handleNormalProduct(product);
						break;
					}

					case 'SEASONAL': {
						await this.handleSeasonalProduct(product);
						break;
					}

					case 'EXPIRABLE': {
						await this.handleExpiredProduct(product);
						break;
					}

					default: {
						throw new Error(`Unhandled product type: ${product.type}`);
					}
				}
			}),
		);
	}

	private async updateProduct(product: Product): Promise<void> {
		await this.db.update(products).set(product).where(eq(products.id, product.id));
	}
}
