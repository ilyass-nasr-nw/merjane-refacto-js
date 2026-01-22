# Project Overview

## Product Management System

Each product has two main properties:

- **available**: the number of units currently in stock.  
- **leadTime**: the number of days required for restocking.

At the end of each order, the system **decrements the `available` value** for each ordered product.

### Product Types

1. **NORMAL**  
   - No special behavior.  
   - If out of stock, a **delay is simply communicated to the customer**.

2. **SEASONAL**  
   - Available only during certain periods of the year.  
   - If out of stock, a delay is announced, but if the delay exceeds the season, the product is **considered unavailable**.  
   - Customers are notified of this unavailability.

3. **EXPIRABLE**  
   - Has an **expiration date**.  
   - Can be sold normally as long as it hasn’t expired.  
   - After expiration, the product is no longer available.

This system ensures efficient stock tracking, proper handling of different product types, and appropriate communication with customers.

## What Was Done

1. **Controller Refactoring**
   - `myController` handles order processing via `/orders/:orderId/processOrder`.
   - Properly handles different product types (`NORMAL`, `SEASONAL`, `EXPIRABLE`) with **exhaustive switch checks**.
   - Improved code readability and maintainability for the team.

2. **Service Refactoring**
   - `ProductService` encapsulates all product-related logic.
   - Handles availability updates, seasonal checks, expiry handling, and notifications.
   - Private `updateProduct` ensures consistent database updates.
   - Notification logic is separated via `INotificationService`.

3. **Integration Testing**
   - Built a **Vitest-based integration test** for the controller.
   - Ensures `processOrder` endpoint works as expected with various product scenarios.
   - Mocks notification service for isolated testing.
   - Database state is controlled using transactions.

4. **Environment Management**
   - Added `.env.example` to define required environment variables.
   - Keeps sensitive information out of source control.
   - Provides guidance for setting up the environment for development and testing.

5. **Code Readability & Maintainability**
   - Consistent formatting, naming conventions, and indentation.
   - Added type annotations for clarity.
   - Organized imports for better readability.
   - Refactored complex logic for easier future iterations.

The current implementation focuses on making the tests work and refactoring the controller and service for clarity and maintainability. For the future, several improvements can be made:

- **Extend Test Coverage**  
  - Add tests for edge cases, such as multiple seasonal products with overlapping dates.  
  - Test expirables with past and future expiration dates.  
  - Simulate orders with mixed product types to ensure correct notifications.

- **Improve Code Quality & CI/CD**  
  - Implement automated linting (`xo`, `eslint`) and formatting (`prettier`) checks in CI/CD pipelines.  
  - Ensure coding conventions are consistently enforced across the team.

- **Enhance Notification Logic**  
  - Add advanced notification rules (e.g., batching notifications per order, retry logic on failure).  
  - Track which notifications have been sent to avoid duplicates.

- **Service & Controller Enhancements**  
  - Introduce helper utilities to reduce repetitive logic in `ProductService`.  
  - Consider a more modular approach for handling different product types (`Strategy` pattern or similar).  
  - Make controllers more composable for easier extension in future APIs.

- **Database & Performance Optimization**  
  - Optimize queries for high-volume orders.  
  - Use transactions efficiently to handle bulk inserts and updates.  
  - Consider caching frequently accessed data like seasonal product windows.

- **Integration**  
  - Connect with frontend services or additional microservices for a full order-processing workflow.  
  - Prepare APIs for third-party integrations, e.g., inventory sync or notification services.

- **Environment & Security**  
  - Use `.env.example` for sensitive values like database credentials and API keys.  
  - Ensure all environment variables are validated at startup for safety.

These steps will help the codebase remain maintainable, scalable, and secure, while providing a solid foundation for future feature development.

## Getting Started

1. Copy `.env.example.dev` to `.env.dev` and fill in your environment variables.  
2. Install dependencies:  
   ```bash
   npm install
