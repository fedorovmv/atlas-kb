# Test Results

Environment used during generation:

- Node.js: v22.16.0
- npm: 10.9.2

Commands run:

```bash
npm run build
npm test
npm run memory -- --root examples/synapse-mini validate
npm run memory -- --root examples/synapse-mini context "почему registry не выбирает агента"
```

Result:

```text
Test Files  3 passed (3)
Tests       9 passed (9)
Memory validation OK
```
