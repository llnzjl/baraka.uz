# GitHub Pages

The `baraka` repository publishes the static public restaurant website at
`https://llnzjl.github.io/baraka/`. The root URL `https://llnzjl.github.io/`
is reserved for a separate repository named `llnzjl.github.io`.

GitHub Pages serves static files. The Pages build publishes the restaurant home
page, menu, contact details, and static assets. Server features such as owner
sign-in, live reservations, order management, and menu editing require an
application server and are unavailable on this Pages deployment. The reservation
section directs visitors to call the restaurant instead of showing invented
availability.

The `Publish GitHub Pages` workflow deploys on every push to `main`. Check its
run under the repository's **Actions** tab. After the first successful run,
GitHub serves the site at the project URL above.
