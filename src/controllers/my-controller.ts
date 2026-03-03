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
      const db = server.diContainer.resolve("db");
      const productService = server.diContainer.resolve("ps");
      const order = (await db.query.orders.findFirst({
        where: eq(orders.id, request.params.orderId),
        with: {
          products: {
            columns: {},
            with: {
              product: true,
            },
          },
        },
      }))!;

      // TODO: check if an order object is not found
      if (!order) {
        return reply.status(404).send({ error: "Order not found" });
      }

      const { products: productList } = order;

      // TODO: check if products object is not found
      if (!productList) {
        return reply.status(400).send({ error: "No products found in order" });
      }

      const normalProduct = async (p) => {
        if (p.available > 0) {
          p.available -= 1;
          await db.update(products).set(p).where(eq(products.id, p.id));
        } else {
          const { leadTime } = p;
          if (leadTime > 0) {
            await productService.notifyDelay(leadTime, p);
          }
        }
      };

      const seasonalProduct = async (p) => {
        const currentDate = new Date();
        if (
          currentDate > p.seasonStartDate! &&
          currentDate < p.seasonEndDate! &&
          p.available > 0
        ) {
          p.available -= 1;
          await db.update(products).set(p).where(eq(products.id, p.id));
        } else {
          await productService.handleSeasonalProduct(p);
        }
      };

      const expirableProduct = async (p) => {
        const currentDate = new Date();
        if (p.available > 0 && p.expiryDate! > currentDate) {
          p.available -= 1;
          await db.update(products).set(p).where(eq(products.id, p.id));
        } else {
          await productService.handleExpiredProduct(p);
        }
      };

      for (const { product: p } of productList) {
        switch (p.type) {
          case "NORMAL": {
            await normalProduct(p);
            break;
          }

          case "SEASONAL": {
            await seasonalProduct(p);
            break;
          }

          case "EXPIRABLE": {
            await expirableProduct(p);
            break;
          }
        }
      }

      await reply.send({ orderId: order.id });
    }
  );
});
