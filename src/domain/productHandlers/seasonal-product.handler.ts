import {eq} from 'drizzle-orm';
import {products, type Product} from '@/db/schema.js';
import { ProductService } from '@/services/impl/productService/product.service.js';
 
export class SeasonalProductHandler {
	constructor(
		private readonly db: any,
		private readonly ps: ProductService,
	) {}

	async handle(p: Product): Promise<void> {
		const currentDate = new Date();
		if (currentDate > p.seasonStartDate! && currentDate < p.seasonEndDate! && p.available > 0) {
			p.available -= 1;
			await this.db.update(products).set(p).where(eq(products.id, p.id));
		} else {
			await this.ps.handleSeasonalProduct(p);
		}
	}
}