import { orders } from "@/db/schema";
import { Database } from "@/db/type";
import { eq } from "lodash";
import {type Cradle} from '@fastify/awilix';

export class OrderService {
    private readonly db: Database;

    public constructor({ db }: Pick<Cradle, 'db'>) {
        this.db = db;
    }

    public getOrder(orderId: number) {
        return this.db.query.orders.findFirst({
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
    }
}