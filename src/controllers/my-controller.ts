
import fastifyPlugin from 'fastify-plugin';
import {z} from 'zod';
import {serializerCompiler, validatorCompiler, type ZodTypeProvider} from 'fastify-type-provider-zod';
import {type ProductService} from '@/services/impl/product.service.js';
import {type OrderService} from '@/services/impl/order.service.js';

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
			const ps: ProductService = server.diContainer.resolve('ps');
			const or: OrderService = server.diContainer.resolve('or');

			const order = await or.getOrderWithProducts(request.params.orderId);
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
