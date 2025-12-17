import {eq} from 'drizzle-orm';
import {type Cradle} from '@fastify/awilix';
import {orders} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

export class OrderRepo {
	private readonly db: Database;

	public constructor({db}: Pick<Cradle, 'db'>) {
		this.db = db;
	}

	public async findWithProducts(orderId: number) {
		return this.db.query.orders.findFirst({
			where: eq(orders.id, orderId),
			with: {
				products: {
					columns: {},
					with: {
						product: true,
					},
				},
			},
		});
	}
}


