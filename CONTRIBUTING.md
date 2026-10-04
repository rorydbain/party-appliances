# Contributing

Party Appliances is currently an opinionated macOS project built around one
tested Canon and Epson setup. Bug fixes, clearer setup instructions and focused
reliability improvements are welcome. Discuss broader camera or printer support
before building it; each hardware profile needs a complete physical test.

## Development

```sh
npm ci
npm test
cd cloud && npm ci && npm test
```

Run `npm run test:app` only when an interactive Electron smoke test is intended;
it opens application windows. Do not use a real capture library or camera for
automated tests.

Keep changes local-first. A missing camera, printer, network or cloud profile
should fail independently and should never lose a capture already committed to
disk. Add focused tests for queue state, retry behaviour and media scheduling.

Never commit event profiles, upload tokens, admin credentials, guest photographs,
capture queues, diagnostics or commercial LUT/font files.
