import { type Cradle } from "@fastify/awilix";
import { eq } from "drizzle-orm";
import { type Database } from "@/db/type.js";
import { orders, type Order } from "@/db/schema.js";


export class OrderService {
  private readonly db: Database;

  public constructor({  db }: Pick<Cradle, "db">) {
    this.db = db;
  }
  async findOrderWithProducts(orderId: number):Promise<Order> {
    return  await this.db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        products: {
          columns: {},
          with: { product: true },
        },
      },
    });
  }
}
