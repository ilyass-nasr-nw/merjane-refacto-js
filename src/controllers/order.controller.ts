import fastifyPlugin from 'fastify-plugin';
import {serializerCompiler, validatorCompiler, type ZodTypeProvider} from 'fastify-type-provider-zod';
import {z} from 'zod';
import {OrderNotFoundError} from '@/services/errors/order-not-found.error.js';

export const orderController = fastifyPlugin(async server => {
	server.setValidatorCompiler(validatorCompiler);
	server.setSerializerCompiler(serializerCompiler);

	server.withTypeProvider<ZodTypeProvider>().post('/orders/:orderId/processOrder', {
		schema: {
			params: z.object({
				orderId: z.coerce.number(),
			}),
		},
	}, async (request, reply) => {
		const orderService = server.diContainer.resolve('orderService');

		try {
			const result = await orderService.processOrder(request.params.orderId);
			await reply.send(result);
		} catch (error) {
			if (error instanceof OrderNotFoundError) {
				return reply.code(404).send({error: error.message});
			}

			throw error;
		}
	});
});
