/* eslint-disable @typescript-eslint/switch-exhaustiveness-check */
/* eslint-disable max-depth */
/* eslint-disable no-await-in-loop */
import {eq} from 'drizzle-orm';
import fastifyPlugin from 'fastify-plugin';
import {serializerCompiler, validatorCompiler, type ZodTypeProvider} from 'fastify-type-provider-zod';
import {z} from 'zod';
import {orders, products} from '@/db/schema.js';

export const myController = fastifyPlugin(async server => {
	// Add schema validator and serializer
	server.setValidatorCompiler(validatorCompiler);
	server.setSerializerCompiler(serializerCompiler);

	server.withTypeProvider<ZodTypeProvider>().post('/orders/:orderId/processOrder', {
		schema: {
		params: z.object({
			orderId: z.coerce.number(),
		}),
		},
	}, async (request, reply) => {
		const db = server.diContainer.resolve('db');
		const ps = server.diContainer.resolve('ps');

		// Get order with its products
		const order = await db.query.orders.findFirst({
		where: eq(orders.id, request.params.orderId),
		with: {
			products: {
			columns: {},
			with: {
				product: true,
			},
			},
		},
		});

		if (!order) {
		return reply.code(404).send({ error: 'Order not found' });
		}

		// Extract the list of products
		const productList = order.products.map(p => p.product);

		// Delegate the processing to the service
		await ps.processProducts(productList);

		return reply.send({ orderId: order.id });
	});
});

