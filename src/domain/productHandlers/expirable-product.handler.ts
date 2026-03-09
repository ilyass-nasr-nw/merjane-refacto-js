import {eq} from 'drizzle-orm';
import {products, type Product} from '@/db/schema.js';
import { ProductService } from '@/services/impl/productService/product.service.js';

export class ExpirableProductHandler {
	constructor(
		private readonly db: any,
		private readonly ps: ProductService,
	) {}

	async handle(p: Product): Promise<void> {
		const currentDate = new Date();
		if (p.available > 0 && p.expiryDate! > currentDate) {
			p.available -= 1;
			await this.db.update(products).set(p).where(eq(products.id, p.id));
		} else {
			await this.ps.handleExpiredProduct(p);
		}
	}
}