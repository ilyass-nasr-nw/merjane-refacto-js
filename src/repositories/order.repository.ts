import {eq} from 'drizzle-orm';
import {type Cradle} from '@fastify/awilix';
import {orders} from '@/db/schema.js';
import {type Database} from '@/db/type.js';
import {type ProductType} from '@/types/product-type.js';

export type OrderWithProducts = {
	id: number;
	products: Array<{
		product: {
			id: number;
			leadTime: number;
			available: number;
			type: ProductType;
			name: string;
			expiryDate: Date | null;
			seasonStartDate: Date | null;
			seasonEndDate: Date | null;
		};
	}>;
};

export class OrderRepository {
	private readonly db: Database;

	public constructor({db}: Pick<Cradle, 'db'>) {
		this.db = db;
	}

	public async findOrderWithProducts(orderId: number): Promise<OrderWithProducts | undefined> {
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
