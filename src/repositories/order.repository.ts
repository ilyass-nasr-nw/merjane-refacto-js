import {eq} from 'drizzle-orm';
import {orders} from '@/db/schema.js';

export class OrderRepository {
	constructor(private readonly db: any) {}

	async findByIdWithProducts(orderId: number) {
		return (await this.db.query.orders.findFirst({
			where: eq(orders.id, orderId),
			with: {
				products: {
					columns: {},
					with: {
						product: true,
					},
				},
			},
		}))!;
	}
}