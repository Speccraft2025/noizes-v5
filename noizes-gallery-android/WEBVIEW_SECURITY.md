# WebView security

Each active experience is served under `https://noizes.local/object/` by request interception. Only normalized entries inside that object can resolve. Android file/content access, mixed content, new windows, downloads, and non-package requests are blocked. JavaScript and DOM storage are enabled because they are part of the format contract.

The bridge exposes no `Context`, filesystem path, credential, reflection surface, arbitrary intent, or native execution. External links and resource requests are denied in this build; online consent is future work. WebView debugging is not enabled. A renderer crash exits safely instead of taking down the app.
