import {type Cradle} from '@fastify/awilix';
import {eq} from 'drizzle-orm';
import {type INotificationService} from '../notifications.port.js';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';


/**
 * Disponibility verification result
 */
type AvailabilityResult = 
  | { available: true }
  | { available: false; reason: 'out_of_stock'; leadTime: number }
  | { available: false; reason: 'out_of_season' }
  | { available: false; reason: 'expired'; expiryDate: Date };


export class ProductService {
	private readonly ns: INotificationService;
	private readonly db: Database;
	private readonly msInDay = 24 * 60 * 60 * 1000;

	public constructor({ns, db}: Pick<Cradle, 'ns' | 'db'>) {
		this.ns = ns;
		this.db = db;
	}

	/**
	 * Processes a list of products for an order
	 */
	public async processProducts(
		productList: Product[], 
		currentDate: Date = new Date()
	): Promise<void> {
		const productsToUpdate: Product[] = [];

		for (const product of productList) {
		const availabilityResult = this.checkAvailability(product, currentDate);

		if (availabilityResult.available) {
			product.available -= 1;
			productsToUpdate.push(product);
		} else {
			this.sendNotification(product, availabilityResult);
		}
		}

    	await this.updateProductStocks(productsToUpdate);
  	}

	/**
	 * Checks the availability of a product based on its type
	 */
	private checkAvailability(product: Product, currentDate: Date): AvailabilityResult {
		switch (product.type) {
		case 'NORMAL':
			return this.checkNormalProduct(product);
		case 'SEASONAL':
			return this.checkSeasonalProduct(product, currentDate);
		case 'EXPIRABLE':
			return this.checkExpirableProduct(product, currentDate);
		default:
			throw new Error(`Unknown product type: ${product.type}`);
		}
	}

	/**
	 * Checks the availability for type: NORMAL
	 */
	private checkNormalProduct(product: Product): AvailabilityResult {
		if (product.available > 0) {
		return { available: true };
		}
		return { 
		available: false, 
		reason: 'out_of_stock', 
		leadTime: product.leadTime 
		};
	}

	/**
	 * Checks the availability for type: SEASONAL
	 */
	private checkSeasonalProduct(product: Product, currentDate: Date): AvailabilityResult {
		const { seasonStartDate, seasonEndDate, available, leadTime } = product;
		
		const isInSeason = currentDate >= seasonStartDate! && currentDate <= seasonEndDate!;
		
		if (!isInSeason) {
		return { available: false, reason: 'out_of_season' };
		}
		
		if (available > 0) {
		return { available: true };
		}
		
		const restockDate = new Date(currentDate.getTime() + (leadTime * this.msInDay));
		
		if (restockDate > seasonEndDate!) {
		return { available: false, reason: 'out_of_season' };
		}
		
		return { 
		available: false, 
		reason: 'out_of_stock', 
		leadTime 
		};
	}

	/**
	 * Checks the availability for type: EXPIRABLE
	 */
	private checkExpirableProduct(product: Product, currentDate: Date): AvailabilityResult {
		const { expiryDate, available } = product;
		
		if (currentDate > expiryDate!) {
		return { 
			available: false, 
			reason: 'expired', 
			expiryDate: expiryDate! 
		};
		}
		
		if (available > 0) {
		return { available: true };
		}
		
		return { 
		available: false, 
		reason: 'out_of_stock', 
		leadTime: product.leadTime 
		};
	}

	/**
	 * Sends the appropriate notification based on the product availability result
	 */
  	private sendNotification(product: Product, result: AvailabilityResult): void {
		if (result.available) {
		return;
		}

		switch (result.reason) {
		case 'out_of_stock':
			this.ns.sendDelayNotification(result.leadTime, product.name);
			break;
		case 'out_of_season':
			this.ns.sendOutOfStockNotification(product.name);
			break;
		case 'expired':
			this.ns.sendExpirationNotification(product.name, result.expiryDate);
			break;
		}
	}


	/**
	 * Updates the stock levels of multiple products in the database.
	 */
  	private async updateProductStocks(productsToUpdate: Product[]): Promise<void> {
		for (const product of productsToUpdate) {
		await this.db
			.update(products)
			.set({ available: product.available })
			.where(eq(products.id, product.id));
		}
	}
}
