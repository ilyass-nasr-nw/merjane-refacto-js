import {eq} from 'drizzle-orm';
import {products, type Product} from '@/db/schema.js';
import { ProductService } from '@/services/impl/productService/product.service.js';

export class NormalProductHandler {
	constructor(
		private readonly db: any,
		private readonly ps: ProductService,
	) {}

	async handle(p: Product): Promise<void> {
		if (p.available > 0) {
			p.available -= 1;
			await this.db.update(products).set(p).where(eq(products.id, p.id));
		} else {
			const {leadTime} = p;
			if (leadTime > 0) {
				await this.ps.notifyDelay(leadTime, p);
			}
		}
	}
}