### Consignes JS:

- Si probleme de version pnpm, utiliser `corepack enable pnpm` qui devrait automatiquement utiliser la bonne version
- Ne pas modifier les classes qui ont un commentaire: `// WARN: Should not be changed during the exercise
`
- Pour lancer les tests: `pnpm test`
  - integration only in watch mode `pnpm test:integration`
  - unit only in watch mode `pnpm test:unit`


Refactoring Approach
My main goal was to move the business logic out of the controller and into a dedicated service, making the code easier to test and maintain. I followed these steps:

1. Creating a Safety Net
Before touching any code, I wrote Integration Tests for the existing controller. Since the original logic had many edge cases (seasonal dates, expiration, etc.), these tests acted as a baseline. This ensured that my refactored version produced the exact same results as the original version.

2. Moving Logic to a Service
I moved all the business rules into a ProductService.

The Controller is now very small, it just handles the request, fetches the order, and tells the service to process the products.

The Service is now the single source of truth for "how" a product is handled.

3. Improving Code Readability (SRP)
Inside the service, I broke down the large, complex loop into small, descriptive private methods. Instead of one giant function, I now have specific methods This makes the logic much easier to read .

4. Replacing the Switch Statement
I replaced the long switch statement with a handler map. This makes the code more flexible; if we need to add a new product type in the future, we can simply add a new handler without risking changes to the existing logic for Normal or Seasonal products.