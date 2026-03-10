import {type Product} from '@/db/schema.js';

export type IProductHandler = {
	handleOrder(product: Product): Promise<void>;
};
