import fastifyPlugin from 'fastify-plugin';
import {serializerCompiler, validatorCompiler, type ZodTypeProvider} from 'fastify-type-provider-zod';
import {z} from 'zod';
import {OrderRepository} from '@/repositories/order.repository.js';
import { OrderService } from '@/services/impl/orderService/order.service.js';

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
		const db = server.diContainer.resolve('db');
		const ps = server.diContainer.resolve('ps');

		const orderRepository = new OrderRepository(db);
		const orderService = new OrderService(orderRepository, db, ps);

		const result = await orderService.processOrder(request.params.orderId);

		await reply.send(result);
	});
});