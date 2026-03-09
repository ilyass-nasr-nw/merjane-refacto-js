import {describe, it, expect, vi, beforeEach} from 'vitest';
import {NormalProductHandler} from '@/domain/productHandlers/normal-product.handler.js';
import {SeasonalProductHandler} from '@/domain/productHandlers/seasonal-product.handler.js';
import {ExpirableProductHandler} from '@/domain/productHandlers/expirable-product.handler.js';

const TODAY = new Date('2024-06-15');
const DAY = 24 * 60 * 60 * 1000;

let db: any;

let ps: any;

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(TODAY);

	db = {
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			}),
		}),
	};

	ps = {
		notifyDelay: vi.fn(),
		handleSeasonalProduct: vi.fn(),
		handleExpiredProduct: vi.fn(),
	};
});


describe('NORMAL product', () => {
	it('decrements stock when product is available', async () => {
		const product = {id: 1, type: 'NORMAL', available: 5, leadTime: 3} as any;

		await new NormalProductHandler(db, ps).handle(product);

		expect(product.available).toBe(4);
		expect(db.update).toHaveBeenCalled();
	});

	it('notifies delay when out of stock and leadTime > 0', async () => {
		const product = {id: 1, type: 'NORMAL', available: 0, leadTime: 3} as any;

		await new NormalProductHandler(db, ps).handle(product);

		expect(ps.notifyDelay).toHaveBeenCalledWith(3, product);
	});

	it('does nothing when out of stock and leadTime is 0', async () => {
		const product = {id: 1, type: 'NORMAL', available: 0, leadTime: 0} as any;

		await new NormalProductHandler(db, ps).handle(product);

		expect(ps.notifyDelay).not.toHaveBeenCalled();
		expect(db.update).not.toHaveBeenCalled();
	});
});


describe('SEASONAL product', () => {
	it('decrements stock when in season and available', async () => {
		const product = {
			id: 2,
			type: 'SEASONAL',
			available: 5,
			seasonStartDate: new Date(TODAY.getTime() - (2 * DAY)),   // started 2 days ago
			seasonEndDate: new Date(TODAY.getTime() + (58 * DAY)),    // ends in 58 days
		} as any;

		await new SeasonalProductHandler(db, ps).handle(product);

		expect(product.available).toBe(4);
		expect(db.update).toHaveBeenCalled();
	});

	it('calls handleSeasonalProduct when out of stock during season', async () => {
		const product = {
			id: 2,
			type: 'SEASONAL',
			available: 0,
			seasonStartDate: new Date(TODAY.getTime() - (2 * DAY)),
			seasonEndDate: new Date(TODAY.getTime() + (58 * DAY)),
		} as any;

		await new SeasonalProductHandler(db, ps).handle(product);

		expect(ps.handleSeasonalProduct).toHaveBeenCalledWith(product);
	});

	it('calls handleSeasonalProduct when season has not started yet', async () => {
		const product = {
			id: 2,
			type: 'SEASONAL',
			available: 5,
			seasonStartDate: new Date(TODAY.getTime() + (180 * DAY)),  // starts in 180 days
			seasonEndDate: new Date(TODAY.getTime() + (240 * DAY)),
		} as any;

		await new SeasonalProductHandler(db, ps).handle(product);

		expect(ps.handleSeasonalProduct).toHaveBeenCalledWith(product);
	});
});


describe('EXPIRABLE product', () => {
	it('decrements stock when available and not expired', async () => {
		const product = {
			id: 3,
			type: 'EXPIRABLE',
			available: 5,
			expiryDate: new Date(TODAY.getTime() + (26 * DAY)),  // expires in 26 days
		} as any;

		await new ExpirableProductHandler(db, ps).handle(product);

		expect(product.available).toBe(4);
		expect(db.update).toHaveBeenCalled();
	});

	it('calls handleExpiredProduct when product has expired', async () => {
		const product = {
			id: 3,
			type: 'EXPIRABLE',
			available: 6,
			expiryDate: new Date(TODAY.getTime() - (2 * DAY)),  // expired 2 days ago
		} as any;

		await new ExpirableProductHandler(db, ps).handle(product);

		expect(ps.handleExpiredProduct).toHaveBeenCalledWith(product);
	});

	it('calls handleExpiredProduct when out of stock', async () => {
		const product = {
			id: 3,
			type: 'EXPIRABLE',
			available: 0,
			expiryDate: new Date(TODAY.getTime() + (26 * DAY)),
		} as any;

		await new ExpirableProductHandler(db, ps).handle(product);

		expect(ps.handleExpiredProduct).toHaveBeenCalledWith(product);
	});
});