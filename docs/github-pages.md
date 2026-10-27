# GitHub Pages demo mode

GitHub Pages serves the static restaurant site. On Pages, the existing sign-in screen uses `public/users.json` and browser `localStorage` for public demonstration accounts. Anyone can fetch the JSON file and read both usernames and passwords. This is demo-only sign-in; it does not securely authenticate or protect private data. The saved account is local to the browser and can be changed by its user.

Public demo accounts:

| Role | Username | Password |
| --- | --- | --- |
| Owner demo | `demo-owner` | `demo-owner-public` |
| Guest demo | `demo-guest` | `demo-guest-public` |

Do not replace these with real credentials or put private customer, employee, or business data in the JSON file. The login fetches `users.json` from the deployed site and remembers only the selected demo username in `localStorage`.

The owner and guest page layouts are demonstrations. Live reservations and cancellations, table ordering, guest profile edits, menu changes, owner profile/password changes, private record exports, and notifications need server-side storage and are not saved by demo sign-in. Online reservations on the static site direct visitors to contact the restaurant.

The GitHub Actions workflow builds with the repository-specific Pages base path, exports the site to `out/`, and deploys the static files. Check the **Actions** tab for the **Publish GitHub Pages** workflow after pushing to `main`.
