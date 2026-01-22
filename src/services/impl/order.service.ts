import {type Cradle} from '@fastify/awilix';
import {eq} from 'drizzle-orm';
import {orders} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

export class OrderService {
	private readonly db: Database;

	public constructor({db}: Pick<Cradle, 'db'>) {
		this.db = db;
	}

	public async getOrderWithProducts(orderId: number) {
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
