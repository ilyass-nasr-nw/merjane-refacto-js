/* eslint-disable @typescript-eslint/switch-exhaustiveness-check */
/* eslint-disable max-depth */
/* eslint-disable no-await-in-loop */
import { eq } from "drizzle-orm";
import fastifyPlugin from "fastify-plugin";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { z } from "zod";
import { orders, products } from "@/db/schema.js";

export const myController = fastifyPlugin(async (server) => {
  // Add schema validator and serializer
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  server.withTypeProvider<ZodTypeProvider>().post(
    "/orders/:orderId/processOrder",
    {
      schema: {
        params: z.object({
          orderId: z.coerce.number(),
        }),
      },
    },
    async (request, reply) => {
		
      const dbse = server.diContainer.resolve("db");
      const ps = server.diContainer.resolve("ps");
      const order = (await dbse.query.orders
		.findFirst({
			where: eq(orders.id, request.params.orderId),
			with: {
				products: {
					columns: {},
					with: {
						product: true,
					},
				},
			},
		}));
      if (!order) {
        await reply.status(404).send({ message: "Order not found" });
      }
      const { products: productList } = order;
      if (!productList?.length) {
        await reply.status(400).send({ message: "No products in this order" });
      }

      await ps.productProcessingService(productList);

      await reply.send({ orderId: order.id });
	
    }
  );
});
