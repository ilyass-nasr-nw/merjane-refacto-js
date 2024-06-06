import { describe, it, expect, vi } from 'vitest';
import { OrderService } from '@/services/impl/order.service';
import { Database } from '@/db/type';
import { orders } from '@/db/schema';
import { eq } from 'lodash';

// Mock the database
const mockDb: Partial<Database> = {
  query: {
    orders: {
      findFirst: vi.fn(),
    },
  },
};

describe('OrderService', () => {
  it('should fetch an order by orderId', async () => {
    const orderId = 123;
    const expectedOrder = {
      id: orderId,
      products: [
        {
          product: { id: 1, name: 'Product 1' },
        },
      ],
    };

    // Mock the implementation of findFirst
    mockDb.query.orders.findFirst = vi.fn().mockResolvedValue(expectedOrder);

    const orderService = new OrderService({ db: mockDb as Database });
    const order = await orderService.getOrder(orderId);

    // Assertions
    expect(order).toEqual(expectedOrder);
    expect(mockDb.query.orders.findFirst).toHaveBeenCalledWith({
      where: eq(orders.id, orderId),
      with: {
        products: {
          columns: {},
          with: {
            product: true,
          },
        },
      },
    });
  });
});
