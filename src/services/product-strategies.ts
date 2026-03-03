import {type Product} from '@/db/schema.js';
import {type ProductRepo} from '@/repositories/product-repo.js';
import {type ProductService} from '@/services/impl/product.service.js';

export type ProductHandlerDeps = {
	productRepo: ProductRepo;
	ps: ProductService;
};

export type ProductHandler = (product: Product, deps: ProductHandlerDeps) => Promise<void>;

export type ProductHandlers = Record<Product['type'], ProductHandler>;

export const productHandlers: ProductHandlers = {
	NORMAL: async (p, deps) => {
		if (p.available > 0) {
			await deps.productRepo.decrementAvailable(p.id);
		} else if (p.leadTime > 0) {
			await deps.ps.notifyDelay(p.leadTime, p);
		}
	},
	SEASONAL: async (p, deps) => {
		const now = new Date();
		if (now > p.seasonStartDate! && now < p.seasonEndDate! && p.available > 0) {
			await deps.productRepo.decrementAvailable(p.id);
		} else {
			await deps.ps.handleSeasonalProduct(p);
		}
	},
	EXPIRABLE: async (p, deps) => {
		const now = new Date();
		if (p.available > 0 && p.expiryDate! > now) {
			await deps.productRepo.decrementAvailable(p.id);
		} else {
			await deps.ps.handleExpiredProduct(p);
		}
	},
};
