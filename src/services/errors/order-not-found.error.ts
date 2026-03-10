export class OrderNotFoundError extends Error {
	public constructor(orderId: number) {
		super(`Order ${orderId} not found`);
		this.name = 'OrderNotFoundError';
	}
}
