import { type Cradle } from "@fastify/awilix";
import { eq } from "drizzle-orm";
import { type INotificationService } from "../notifications.port.js";
import { products, type Product } from "@/db/schema.js";
import { type Database } from "@/db/type.js";

export class ProductService {
  private readonly ns: INotificationService;
  private readonly db: Database;

  public constructor({ ns, db }: Pick<Cradle, "ns" | "db">) {
    this.ns = ns;
    this.db = db;
  }

  public async findById(id:number): Promise<Product> {
	return await this.db.query.products.findFirst({
		where: eq(products.id, id),
	  });
  }
  public async insertProducts(ps:Product[]): Promise<Number> {
	return await this.db.insert(products).values(ps).returning({ productId: products.id });
  }
  public async updateProducts(p: Product): Promise<void> {
    await this.db.update(products).set(p).where(eq(products.id, p.id));
  }

  public async notifyDelay(leadTime: number, p: Product): Promise<void> {
    p.leadTime = leadTime;
    await this.updateProducts(p);
    this.ns.sendDelayNotification(leadTime, p.name);
  }

  public async handleSeasonalProduct(p: Product): Promise<void> {
    const currentDate = new Date();
    const d = 1000 * 60 * 60 * 24;
    if (new Date(currentDate.getTime() + p.leadTime * d) > p.seasonEndDate!) {
      this.ns.sendOutOfStockNotification(p.name);
      p.available = 0;
      await this.updateProducts(p);
    } else if (p.seasonStartDate! > currentDate) {
      this.ns.sendOutOfStockNotification(p.name);
      await this.updateProducts(p);
    } else {
      await this.notifyDelay(p.leadTime, p);
    }
  }

  public async handleExpiredProduct(p: Product): Promise<void> {
    const currentDate = new Date();
    if (p.available > 0 && p.expiryDate! > currentDate) {
      p.available -= 1;
      await this.updateProducts(p);
    } else {
      this.ns.sendExpirationNotification(p.name, p.expiryDate!);
      p.available = 0;
      await this.updateProducts(p);
    }
  }
  private readonly handlers = {
    NORMAL: async (p: Product) => {
      if (p.available > 0) {
        p.available -= 1;
        await this.updateProducts(p);
      } else {
        const { leadTime } = p;
        if (leadTime > 0) {
          await this.notifyDelay(leadTime, p);
        }
      }
    },

    SEASONAL: async (p: Product) => {
      const currentDate = new Date();
      if (
        currentDate > p.seasonStartDate! &&
        currentDate < p.seasonEndDate! &&
        p.available > 0
      ) {
        p.available -= 1;
        await this.updateProducts(p);
      } else {
        await this.handleSeasonalProduct(p);
      }
    },

    EXPIRABLE: async (p: Product) => {
      {
        const currentDate = new Date();
        if (p.available > 0 && p.expiryDate! > currentDate) {
          p.available -= 1;
          await this.updateProducts(p);
        } else {
          await this.handleExpiredProduct(p);
        }
      }
    },
  };
  public async productProcessingService(productList: Product[]): Promise<void> {
    if (productList) {
      for (const { product: p } of productList) {
        const handler = this.handlers[p.type as keyof typeof this.handlers];
        if (handler) {
          await handler.call(this, p);
        }
      }
    }
  }
}
