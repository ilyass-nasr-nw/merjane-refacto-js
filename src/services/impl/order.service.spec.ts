import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createDatabaseMock,
  cleanUp,
} from "../../utils/test-utils/database-tools.ts.js";
import { OrderService } from "./order.service";
import { Order, orders } from "@/db/schema.js";
import { type Database } from "@/db/type.js";

describe("OrderService Tests", () => {
  let orderService: OrderService;
  let databaseMock: Database;
  let databaseName: string;

  beforeEach(async () => {
    ({ databaseMock, databaseName } = await createDatabaseMock());
    orderService = new OrderService({
      db: databaseMock,
    });
  });

  afterEach(async () => cleanUp(databaseName));
  describe("findOrderWithProducts", () => {
    it("should get order correctly by id", async () => {
      const order: Order = {
        id: 1,
      };
      await databaseMock.insert(orders).values(order);
      const result = await orderService.findOrderWithProducts(1);
      expect(result).toEqual(order);
    });
  });
});
