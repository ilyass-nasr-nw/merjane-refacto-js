/* eslint-disable @typescript-eslint/switch-exhaustiveness-check */
/* eslint-disable max-depth */
/* eslint-disable no-await-in-loop */
import { eq } from 'drizzle-orm';
import fastifyPlugin from 'fastify-plugin';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { orders } from '@/db/schema.js';

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
		const productService = server.diContainer.resolve('ps');
		const orderRecord = await db.query.orders.findFirst({
			where: eq(orders.id, request.params.orderId),
			with: {
				products: { with: { product: true } },
			},
		});

		if (!orderRecord) {
			return reply.status(404).send({ error: 'Order not found' });
		}
		const { products: orderItems } = orderRecord;
		for (const { product } of orderItems) {
			await productService.processProduct(product);
		}

		return reply.send({ orderId: orderRecord.id });
	});
});

