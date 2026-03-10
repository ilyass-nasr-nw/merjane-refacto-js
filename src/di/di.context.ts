import {type Cradle, diContainer} from '@fastify/awilix';
import {asClass, asValue} from 'awilix';
import {type FastifyBaseLogger, type FastifyInstance} from 'fastify';
import {type INotificationService} from '@/services/notifications.port.js';
import {NotificationService} from '@/services/impl/notification.service.js';
import {type Database} from '@/db/type.js';
import {ProductService} from '@/services/impl/product.service.js';
import {OrderService} from '@/services/impl/order.service.js';
import {ProductRepository} from '@/repositories/product.repository.js';
import {OrderRepository} from '@/repositories/order.repository.js';
import {NormalProductHandler} from '@/services/product-handlers/normal-product.handler.js';
import {SeasonalProductHandler} from '@/services/product-handlers/seasonal-product.handler.js';
import {ExpirableProductHandler} from '@/services/product-handlers/expirable-product.handler.js';

declare module '@fastify/awilix' {

	interface Cradle {
		logger: FastifyBaseLogger;
		db: Database;
		notificationService: INotificationService;
		productRepository: ProductRepository;
		orderRepository: OrderRepository;
		normalProductHandler: NormalProductHandler;
		seasonalProductHandler: SeasonalProductHandler;
		expirableProductHandler: ExpirableProductHandler;
		productService: ProductService;
		orderService: OrderService;
	}
}

export async function configureDiContext(
	server: FastifyInstance,
): Promise<void> {
	diContainer.register({
		logger: asValue(server.log),
		db: asValue(server.database),
		notificationService: asClass(NotificationService),
		productRepository: asClass(ProductRepository),
		orderRepository: asClass(OrderRepository),
		normalProductHandler: asClass(NormalProductHandler),
		seasonalProductHandler: asClass(SeasonalProductHandler),
		expirableProductHandler: asClass(ExpirableProductHandler),
		productService: asClass(ProductService),
		orderService: asClass(OrderService),
	});
}

export function resolve<Service extends keyof Cradle>(
	service: Service,
): Cradle[Service] {
	return diContainer.resolve(service);
}
