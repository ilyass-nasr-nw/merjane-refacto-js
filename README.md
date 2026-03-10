# Merjane - Order Processing & Inventory System

An order processing system for Merjane that manages product inventory across three distinct product types: **Normal**, **Seasonal**, and **Expirable**. Each type follows specific business rules for stock management, restock delays, and customer notifications.

This repository is the result of a refactoring exercise focused on replacing conditional logic with clean architecture and the Strategy Pattern.

---

## Refactoring Approach

The original implementation concentrated all business logic inside a single controller using nested `switch`/`if` statements, direct database access, and no separation of concerns.

The refactoring goals were:

- Remove conditional complexity based on product type
- Introduce the Strategy Pattern using dedicated product handlers
- Enforce SOLID principles throughout the codebase
- Maintain strict separation of concerns across layers
- Ensure zero regression via comprehensive unit and integration tests
- Improve type safety and error handling

---

## Architecture Overview

```
Request
  │
  ▼
Controller (HTTP + validation)
  │
  ▼
OrderService (orchestration)
  │
  ▼
ProductService (handler dispatch)
  │
  ├── NormalProductHandler
  ├── SeasonalProductHandler
  └── ExpirableProductHandler
        │
        ▼
  ProductRepository / OrderRepository
        │
        ▼
  Database (Drizzle ORM + SQLite)
```

### Layer Responsibilities


| Layer                | Responsibility                                                          |
| -------------------- | ----------------------------------------------------------------------- |
| **Controller**       | HTTP request/response, input validation (Zod), error mapping (404, 500) |
| **OrderService**     | Fetches orders, iterates products, delegates to ProductService          |
| **ProductService**   | Resolves the correct handler by product type, dispatches execution      |
| **Product Handlers** | Encapsulate business rules for a single product type                    |
| **Repositories**     | Database read/write operations via Drizzle ORM                          |
| **Database**         | SQLite via better-sqlite3, schema managed by Drizzle                    |


---

## Strategy Pattern Implementation

Each product type has a dedicated handler class:

- `NormalProductHandler` -- stock decrement, restock delay notifications
- `SeasonalProductHandler` -- season date validation, out-of-stock notifications
- `ExpirableProductHandler` -- expiration checks, expiration notifications

All handlers implement the shared `IProductHandler` interface:

```typescript
type IProductHandler = {
  handleOrder(product: Product): Promise<void>;
};
```

`ProductService` acts as a dispatcher using a handler map:

```typescript
class ProductService {
  private readonly handlers: Record<ProductType, IProductHandler>;

  async processProduct(product: Product): Promise<void> {
    const handler = this.handlers[product.type];
    await handler.handleOrder(product);
  }
}
```

No `switch`, no `if/else` -- handler resolution is a simple map lookup. Handlers are injected via Awilix dependency injection.

---

## Design Principles

### SOLID

- **SRP** -- Controllers handle HTTP. Services orchestrate. Handlers contain business rules. Repositories manage persistence.
- **OCP** -- Adding a new product type requires no changes to existing code (see [Extending the System](#extending-the-system)).
- **DIP** -- Services depend on abstractions (`IProductHandler`, `INotificationService`), not concrete implementations.

### Dependency Injection

All dependencies are registered and resolved through **Awilix**. No class directly instantiates its dependencies. The DI container is configured in `src/di/di.context.ts`.

---

## Testing Strategy

The project includes two levels of testing:

**Unit tests** (`product.service.spec.ts`):

- Test each product type handler through `ProductService`
- Use real SQLite databases (per-test isolation) with mocked notification service
- Cover: stock decrement, delay notifications, out-of-stock, expiration, seasonal limits

**Integration tests** (`my-controller.integration.spec.ts`):

- Test the full HTTP flow through Fastify + real database
- Verify DB state after order processing
- Verify correct notification calls for each product type
- Cover: individual product types, mixed orders, edge cases (leadTime=0, before season, expired)

Tests ensure that the refactoring introduced **zero regressions** against the original behavior.

```bash
pnpm test              # Run all tests
pnpm test:unit         # Unit tests (watch mode)
pnpm test:integration  # Integration tests (watch mode)
```

---

## Extending the System

To add a new product type (e.g. `FLASH_SALE`):

1. Add the type to the `ProductType` union in `src/types/product-type.ts`
2. Create `src/services/product-handlers/flash-sale-product.handler.ts` implementing `IProductHandler`
3. Register the handler in `src/di/di.context.ts`
4. Add the handler to the `ProductService` constructor map

No changes to `ProductService`, `OrderService`, or the controller are required.

---

## Running the Project

### Prerequisites

- Node.js >= 20
- pnpm (use `corepack enable pnpm` if needed)

### Install dependencies

```bash
pnpm install
```

### Start the development server

```bash
pnpm dev
```

### Run tests

```bash
pnpm test
```

### Lint

```bash
pnpm lint
```

---

## Code Quality

Improvements applied during refactoring:

- **Strict TypeScript** -- `strict`, `noImplicitAny`, `strictNullChecks` enabled via `@tsconfig/strictest`
- **ProductType union** -- `'NORMAL' | 'SEASONAL' | 'EXPIRABLE'` replaces raw strings, enabling compile-time exhaustive checking
- **Runtime validation** -- Handlers validate required fields (expiry date, season dates) instead of using non-null assertions
- **Typed errors** -- `OrderNotFoundError` class enables proper HTTP 404 responses instead of generic 500s
- **Explicit dispatch** -- Unknown product types throw errors instead of being silently ignored
- **Zero lint errors** -- XO linter passes clean

---

## Tech Stack


| Tool        | Purpose              |
| ----------- | -------------------- |
| TypeScript  | Language             |
| Fastify     | HTTP framework       |
| Drizzle ORM | Database queries     |
| SQLite      | Database             |
| Awilix      | Dependency injection |
| Vitest      | Testing framework    |
| Zod         | Input validation     |
| XO          | Linting              |
| pnpm        | Package manager      |


---

