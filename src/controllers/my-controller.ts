
import fastifyPlugin from 'fastify-plugin';
import {type Cradle} from '@fastify/awilix';
import {z} from 'zod';
import {serializerCompiler, validatorCompiler, type ZodTypeProvider} from 'fastify-type-provider-zod';
import {eq} from 'drizzle-orm';
import {orders} from '@/db/schema.js';
import {type ProductService} from '@/services/impl/product.service.js';

export const myController = fastifyPlugin(async server => {
	server.setValidatorCompiler(validatorCompiler);
	server.setSerializerCompiler(serializerCompiler);

	server.withTypeProvider<ZodTypeProvider>().post(
		'/orders/:orderId/processOrder',
		{
			schema: {
				params: z.object({
					orderId: z.coerce.number(),
				}),
			},
		},
		async (request, reply) => {
			const database: Cradle['db'] = server.diContainer.resolve('db');
			const ps: ProductService = server.diContainer.resolve('ps');

			const order = await database.query.orders.findFirst({
				where: eq(orders.id, request.params.orderId),
				with: {
					products: {columns: {}, with: {product: true}},
				},
			});

			if (!order) {
				return reply.status(404).send({error: 'Order not found'});
			}

			await Promise.all(
				order.products?.map(async ({product}) => {
					switch (product.type) {
						case 'NORMAL': {
							await ps.handleNormalProduct(product);
							break;
						}

						case 'SEASONAL': {
							await ps.handleSeasonalProduct(product);
							break;
						}

						case 'EXPIRABLE': {
							await ps.handleExpiredProduct(product);
							break;
						}								
						default: {
							throw new Error(`Unhandled product type: ${product.type}`);
						}
					}
				}) || [],
			);

			return reply.send({orderId: order.id});
		},
	);
});
