import {eq} from 'drizzle-orm';
import {type Cradle} from '@fastify/awilix';
import {products} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

export class ProductRepo {
	private readonly db: Database;

	public constructor({db}: Pick<Cradle, 'db'>) {
		this.db = db;
	}

	public async decrementAvailable(productId: number): Promise<void> {
		const current = await this.db.query.products.findFirst({where: eq(products.id, productId)});
		if (!current || current.available <= 0) {
			return;
		}

		await this.db.update(products)
			.set({available: current.available - 1})
			.where(eq(products.id, productId));
	}
}
