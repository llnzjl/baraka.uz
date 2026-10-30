# Website languages

The customer site supports Korean (`ko`), English (`en`), Russian (`ru`), and Uzbek (`uz`). The shared language selector saves the choice as `baraka-language` in localStorage, updates the document language, and carries the choice through guest sign-in, the restaurant site, guest profile, ordering, and reservations. It still works in memory when browser storage is unavailable.

`src/lib/site-language.ts` contains Russian and Uzbek website copy alongside the existing English/Korean text passed by components. `src/data/menu-translations.ts` translates the 72 existing dishes and supplies search text for all four languages. Prices, guest-entered names, addresses, and stored booking/order data are not rewritten when the language changes.

If the owner edits a dish name or description, the website shows the updated source field until its translation is updated, rather than showing an obsolete translated recipe. New dishes also display the owner’s original text. Owner management screens retain their existing language; the customer-facing pages and shared sign-in controls are translated.

Reservation translations remain in `src/lib/booking/copy.ts` and `status-copy.ts`. The static GitHub Pages version retains its translated phone-booking notice; adding languages does not enable backend services on Pages.

Run `npm test` for translation coverage, multilingual search, and owner-edit fallback checks. Production output was also checked in a mobile browser for language persistence and layouts at 320, 360, and 390 CSS pixels.
