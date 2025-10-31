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
      const result = await productService.findById(product.id);
      expect(result).toEqual({
        ...product,
        expiryDate: null,
        available: 0,
      });
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
      const result = await productService.findById(product.id);
      expect(result).toEqual({
        ...product,
        expiryDate: null,
        available: 3,
      });
    });

    it("should call sendDelayNotification", async () => {
      vi.spyOn(productService, "notifyDelay").mockResolvedValue();

      const now = new Date();
      const product: Product = {
        id: 1,
        name: "In-Season Product",
        type: "SEASONAL",
        available: 5,
        leadTime: 2,
        seasonStartDate: new Date(now.getTime() - 1000),
        seasonEndDate: new Date(now.getTime() * 10000),
      };
      await productService.insertProducts([product]);
      await productService.handleSeasonalProduct(product);
      expect(productService.notifyDelay).toHaveBeenCalledWith(2, product);
    });
  });

  describe("handleExpiredProduct", () => {
    it("should decrease available", async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const product: Product = {
        id: 1,
        name: "Valid Product",
        type: "EXPIRABLE",
        available: 3,
        expiryDate: futureDate,
        leadTime: 2,
        seasonEndDate: null,
        seasonStartDate: null,
      };
      await productService.insertProducts([product]);
      await productService.handleExpiredProduct(product);

      expect(product.available).toBe(2);
      const result = await productService.findById(product.id);
      expect(result).toEqual({ ...product, available: 2 });
    });
    it("should send expiration notification", async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const product: Product = {
        id: 1,
        name: "Unavailable Product",
        type: "EXPIRABLE",
        available: 0,
        expiryDate: futureDate,
        leadTime: 2,
        seasonEndDate: null,
        seasonStartDate: null,
      };
      await productService.insertProducts([product]);
      await productService.handleExpiredProduct(product);

      expect(product.available).toBe(0);
      const result = await productService.findById(product.id);
      expect(result).toEqual({ ...product, available: 0 });
    });
  });

  describe("productProcessingService", () => {
    it("should process EXPIRABLE product and call handleExpiredProduct", async () => {
      vi.spyOn(productService, "handleExpiredProduct").mockResolvedValue();
      const product: Product = {
        id: 3,
        type: "EXPIRABLE",
        available: 0,
        leadTime: 2,
        expiryDate: new Date(Date.now() - 1000), // expired
        name: "Expirable",
      };
      await productService.insertProducts([product]);
      await productService.productProcessingService([{ product }]);
      expect(productService.handleExpiredProduct).toHaveBeenCalledWith(product);
    });
    it("should process NORMAL product if available > 0 and call updateProducts", async () => {
      vi.spyOn(productService, "updateProducts").mockResolvedValue();
      const product: Product = {
        id: 3,
        type: "NORMAL",
        available: 1,
        leadTime: 2,
        expiryDate: new Date(Date.now() - 1000), // expired
        name: "normale",
      };
      await productService.insertProducts([product]);
      await productService.productProcessingService([{ product }]);
      expect(productService.updateProducts).toHaveBeenCalledWith(product);
    });
    it("should process NORMAL product if available = 0 and send notification", async () => {
      vi.spyOn(productService, "notifyDelay").mockResolvedValue();
      const fixedDate = new Date("2025-01-01T12:00:00Z");

      const product: Product = {
        id: 3,
        type: "NORMAL",
        available: 0,
        leadTime: 2,
        expiryDate: fixedDate, // expired
        name: "normale",
      };
      await productService.insertProducts([product]);
      await productService.productProcessingService([{ product }]);
      expect(productService.notifyDelay).toHaveBeenCalledWith(2, {
        available: 0,
        expiryDate: fixedDate,
        id: 3,
        leadTime: 2,
        name: "normale",
        type: "NORMAL",
      });
    });
    it("should process SEASONAL product if available > 0 and call updateProducts", async () => {
      vi.spyOn(productService, "updateProducts").mockResolvedValue();
      const product: Product = {
        id: 3,
        type: "SEASONAL",
        available: 1,
        leadTime: 2,
        expiryDate: new Date(Date.now() - 1000), // expired
        name: "seasonal",
      };
      await productService.insertProducts([product]);
      await productService.productProcessingService([{ product }]);
      expect(productService.updateProducts).toHaveBeenCalledWith(product);
    });

    it("should process SEASONAL product if available = 0 and call handleSeasonalProduct", async () => {
      vi.spyOn(productService, "handleSeasonalProduct").mockResolvedValue();
      const product: Product = {
        id: 3,
        type: "SEASONAL",
        available: 0,
        leadTime: 2,
        expiryDate: new Date(Date.now() - 1000), // expired
        name: "seasonal",
      };
      await productService.insertProducts([product]);
      await productService.productProcessingService([{ product }]);
      expect(productService.handleSeasonalProduct).toHaveBeenCalledWith(
        product
      );
    });
  });
});
