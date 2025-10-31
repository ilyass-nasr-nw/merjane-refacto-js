import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockDeep, type DeepMockProxy } from "vitest-mock-extended";
import { type INotificationService } from "../notifications.port.js";
import {
  createDatabaseMock,
  cleanUp,
} from "../../utils/test-utils/database-tools.ts.js";
import { ProductService } from "./product.service.js";
import { products, type Product } from "@/db/schema.js";
import { type Database } from "@/db/type.js";
import { createProducts } from "src/services/impl/utils";

describe("ProductService Tests", () => {
  let notificationServiceMock: DeepMockProxy<INotificationService>;
  let productService: ProductService;
  let databaseMock: Database;
  let databaseName: string;

  beforeEach(async () => {
    ({ databaseMock, databaseName } = await createDatabaseMock());
    notificationServiceMock = mockDeep<INotificationService>();
    productService = new ProductService({
      ns: notificationServiceMock,
      db: databaseMock,
    });
  });

  afterEach(async () => cleanUp(databaseName));

  describe("notifyDelay", () => {
    it("should handle delay notification correctly", async () => {
      // GIVEN
      const product: Product = {
        id: 1,
        leadTime: 15,
        available: 0,
        type: "NORMAL",
        name: "RJ45 Cable",
        expiryDate: null,
        seasonStartDate: null,
        seasonEndDate: null,
      };
      const ids = await productService.insertProducts([product]);

      // WHEN
      await productService.notifyDelay(product.leadTime, product);

      // THEN
      expect(product.available).toBe(0);
      expect(product.leadTime).toBe(15);
      expect(
        notificationServiceMock.sendDelayNotification
      ).toHaveBeenCalledWith(product.leadTime, product.name);
      const result = await productService.findById(product.id);
      expect(result).toEqual(product);
    });
  });
  describe("insertProducts", () => {
    it("should insert products correctly and returning ids", async () => {
      const products = createProducts();
      const ids = await productService.insertProducts(products);
      expect(ids).toEqual([
        { productId: 1 },
        { productId: 2 },
        { productId: 3 },
        { productId: 4 },
        { productId: 5 },
        { productId: 6 },
      ]);
    });
  });
  describe("updateProducts", () => {
    it("should update products correctly by id", async () => {
      const newProduct: Product = {
        id: 1,
        leadTime: 15,
        available: 0,
        type: "SEASONAL",
        name: "RJ45 Cable",
        expiryDate: null,
        seasonStartDate: null,
        seasonEndDate: null,
      };
      const oldProduct: Product = {
        id: 1,
        leadTime: 15,
        available: 0,
        type: "NORMAL",
        name: "RJ45 Cable",
        expiryDate: null,
        seasonStartDate: null,
        seasonEndDate: null,
      };
      await productService.insertProducts([oldProduct]);
      await productService.updateProducts(newProduct);
      const result = await productService.findById(newProduct.id);
      expect(result).toEqual(newProduct);
    });
  });
  describe("findById", () => {
    it("should get products correctly by id", async () => {
      const product: Product = {
        id: 1,
        leadTime: 15,
        available: 0,
        type: "SEASONAL",
        name: "RJ45 Cable",
        expiryDate: null,
        seasonStartDate: null,
        seasonEndDate: null,
      };
      await productService.insertProducts([product]);
      const result = await productService.findById(product.id);
      expect(result).toEqual(product);
    });
  });
  describe("handleSeasonalProduct", () => {
    it("should mark product unavailable", async () => {
      const product: Product = {
        id: 1,
        name: "Seasonal Product",
        type: "SEASONAL",
        available: 5,
        leadTime: 10,
        seasonStartDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        seasonEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      };

      product.leadTime = 10;
      product.seasonEndDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      await productService.insertProducts([product]);
      await productService.handleSeasonalProduct(product);

      expect(
        notificationServiceMock.sendOutOfStockNotification
      ).toHaveBeenCalledWith(product.name);
      expect(product.available).toBe(0);
    });
    it("should send out of stock", async () => {
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const product: Product = {
        id: 2,
        name: "Future Seasonal",
        type: "SEASONAL",
        available: 3,
        leadTime: 1,
        seasonStartDate: futureDate,
        seasonEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      };
      await productService.insertProducts([product]);

      await productService.handleSeasonalProduct(product);

      expect(
        notificationServiceMock.sendOutOfStockNotification
      ).toHaveBeenCalledWith(product.name);
    });
   
  });

  describe("handleExpiredProduct", () => {
    it("should decrease available if product is not expired and available", async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const product: Product = {
        id: 1,
        name: "Valid Product",
        type: "EXPIRABLE",
        available: 3,
        expiryDate: futureDate,
      };

      await productService.handleExpiredProduct(product);

      expect(product.available).toBe(2);
    });
  });
});

