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

export class ProductService {
	private readonly ns: INotificationService;
	private readonly db: Database;

	public constructor({ ns, db }: Pick<Cradle, 'ns' | 'db'>) {
		this.ns = ns;
		this.db = db;
	}

	/**
	 * Primary Entry Point: Orchestrates product processing based on type (OCP).
	 */
	public async processProduct(product: Product): Promise<void> {
		const handlers: Record<string, (p: Product) => Promise<void>> = {
			[PRODUCT_TYPES.NORMAL]: this.handleNormalProduct.bind(this),
			[PRODUCT_TYPES.SEASONAL]: this.handleSeasonalProduct.bind(this),
			[PRODUCT_TYPES.EXPIRABLE]: this.handleExpirableProduct.bind(this),
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

	}

	public async notifyDelay(leadTime: number, p: Product): Promise<void> {
		p.leadTime = leadTime;
		await this.db.update(products).set(p).where(eq(products.id, p.id));
		this.ns.sendDelayNotification(leadTime, p.name);
	}

	public async handleSeasonalProduct(p: Product): Promise<void> {
		const currentDate = new Date();
		const d = 1000 * 60 * 60 * 24;
		if (new Date(currentDate.getTime() + (p.leadTime * d)) > p.seasonEndDate!) {
			this.ns.sendOutOfStockNotification(p.name);
			p.available = 0;
			await this.db.update(products).set(p).where(eq(products.id, p.id));
		} else if (p.seasonStartDate! > currentDate) {
			this.ns.sendOutOfStockNotification(p.name);
			await this.db.update(products).set(p).where(eq(products.id, p.id));
		} else {
			await this.notifyDelay(p.leadTime, p);
		}
	}

	public async handleExpirableProduct(p: Product): Promise<void> {
		const currentDate = new Date();
		if (p.available > 0 && p.expiryDate! > currentDate) {
			p.available -= 1;
			await this.db.update(products).set(p).where(eq(products.id, p.id));
		} else {
			this.ns.sendExpirationNotification(p.name, p.expiryDate!);
			p.available = 0;
			await this.db.update(products).set(p).where(eq(products.id, p.id));
		}
	}
}
