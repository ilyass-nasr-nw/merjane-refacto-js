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

	public productTypesServicesObject: Record<string, (product: Product) => Promise<void>> = {
		NORMAL: (product: Product) => this.handleNormalProduct(product),
		SEASONAL: (product: Product) => this.handleSeasonalProduct(product),
		EXPIRABLE: (product: Product) => this.handleExpiredProduct(product),
		FLASHSALE: (product: Product) => this.handleFlashSaleProduct(product),
	};

	public  processProducts(productList: Product[]) {
		return Promise.all(productList.map(async ({product, quantity}: {product: Product, quantity: number}) => {
			const {type} = product;
			const handler = this.productTypesServicesObject[type];
			if (handler) {
				await handler(product);
			}
		}
		));
	}

	public updateProduct(p: Product): Promise<void> {
		return this.db.update(products).set(p).where(eq(products.id, p.id));
	}

	public async notifyDelay(leadTime: number, p: Product): Promise<void> {
		p.leadTime = leadTime;
		await this.updateProduct(p);
		this.ns.sendDelayNotification(leadTime, p.name);
	}

	public async handleNormalProduct(p: Product): Promise<void> {
		if (p.available > 0) {
			await this.updateProduct({...p, available: p.available - 1});
		} else {
			const {leadTime} = p;
			if (leadTime > 0) {
				await this.notifyDelay(leadTime, p);
			}
		}
	}

	public async handleSeasonalProduct(p: Product): Promise<void> {
		const currentDate = new Date();
		const d = 1000 * 60 * 60 * 24;
		if (currentDate > p.seasonStartDate! && currentDate < p.seasonEndDate! && p.available > 0) {
			await this.updateProduct({ ...p, available: p.available - 1 });
		} else if (new Date(currentDate.getTime() + (p.leadTime * d)) > p.seasonEndDate!) {
			this.ns.sendOutOfStockNotification(p.name);
			await this.updateProduct({ ...p, available: 0 });
		} else if (p.seasonStartDate! > currentDate) {
			this.ns.sendOutOfStockNotification(p.name);
			await this.updateProduct(p);
		} else {
			await this.notifyDelay(p.leadTime, p);
		}
	}

	public async handleExpiredProduct(p: Product): Promise<void> {
		const currentDate = new Date();
		if (p.available > 0 && p.expiryDate! > currentDate) {
			await this.updateProduct({ ...p, available: p.available - 1 });
		}
		else {
			this.ns.sendExpirationNotification(p.name, p.expiryDate!);
			await this.updateProduct({ ...p, available: 0 });
		}
		
	}

	public async handleFlashSaleProduct(p: Product): Promise<void> {
		const currentDate = new Date();
		if (currentDate > p.flashSaleStartDate! && currentDate < p.flashSaleEndDate! && p.available > 0) {
			await this.updateProduct({ ...p, available: p.available - 1 });
		} else if (currentDate > p.flashSaleEndDate!){
			this.ns.sendOutOfStockNotification(p.name);
			await this.updateProduct({ ...p, available: 0 });
		}
	}
}
