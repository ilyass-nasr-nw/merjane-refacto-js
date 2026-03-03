import {type Cradle, diContainer} from '@fastify/awilix';
import {asClass, asValue} from 'awilix';
import {type FastifyBaseLogger, type FastifyInstance} from 'fastify';
import {type INotificationService} from '@/services/notifications.port.js';
import {NotificationService} from '@/services/impl/notification.service.js';
import {type Database} from '@/db/type.js';
import {ProductService} from '@/services/impl/product.service.js';
import { OrderProcessor } from '@/services/order-processor';
import { OrderRepo } from '@/repositories/order-repo';
import { ProductRepo } from '@/repositories/product-repo';

declare module '@fastify/awilix' {

	interface Cradle { // eslint-disable-line @typescript-eslint/consistent-type-definitions
		logger: FastifyBaseLogger;
		db: Database;
		ns: INotificationService;
		ps: ProductService;
		orderProcessor: OrderProcessor;
		orderRepo: OrderRepo;
		productRepo: ProductRepo;
	}
}

export async function configureDiContext(
	server: FastifyInstance,
): Promise<void> {
	diContainer.register({
		logger: asValue(server.log),
	});
	diContainer.register({
		db: asValue(server.database),
	});
	diContainer.register({
		ns: asClass(NotificationService),
	});
	diContainer.register({
		ps: asClass(ProductService),
	});
	diContainer.register({
		orderProcessor: asClass(OrderProcessor),
	});
	diContainer.register({
		orderRepo: asClass(OrderRepo),
	});
	diContainer.register({
		productRepo: asClass(ProductRepo),
	});
}

export function resolve<Service extends keyof Cradle>(
	service: Service,
): Cradle[Service] {
	return diContainer.resolve(service);
}
