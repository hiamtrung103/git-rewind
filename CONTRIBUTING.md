# Contributing

Start with a small, focused change. For a larger feature, open an issue describing the user problem and an example of the expected behavior.

Run `npm test` and `npm run build` before submitting a pull request. For UI changes, check a narrow screen and a desktop screen, and include a screenshot. Add tests when a change affects history extraction or the JSON schema.

Keep exports local. Do not commit a history file from a private repository or include credentials in fixtures. The demo and tests should use fictional identities and content.

The project intentionally has no runtime dependencies. Explain the tradeoff if proposing a new one.
