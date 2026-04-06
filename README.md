# TaskBit — Notebook TODO app

PHP + SQLite TODO app with **guest mode** (localStorage, 1 notebook, max **3 lists**) and **account sync** (SQLite on the server). Drag-and-drop reordering uses **SortableJS**.

## Requirements

- PHP **8.1+** with extensions: `pdo_sqlite`, `session`
- Or **Docker**

## Local development

```bash
cd public
php -S 127.0.0.1:8080 router.php
```

Open `http://127.0.0.1:8080`.

- Database file (default): `database/app.sqlite` (created automatically)
- Sessions: `storage/sessions/` (writable by the web user)

Optional env:

- `TASKBIT_DB_PATH` — absolute path to SQLite file (e.g. `/tmp/taskbit.sqlite`)

## Docker

Compose (recommended):

```bash
docker compose up --build
```

Or build and run manually:

```bash
docker build -t taskbit .
docker run --rm -p 8080:80 \
  -v taskbit-data:/var/www/data \
  taskbit
```

Then open `http://localhost:8080`.

SQLite is stored at `/var/www/data/app.sqlite` inside the container (persisted with the Compose named volume or the `docker run` volume).

## Features

- Register / login with **username + email + password**; login accepts **username or email**.
- Guest mode without an account: data in `localStorage` under `taskbit_guest_v1`.
- On register/login, guest data is **merged** into the account via `POST /api/merge`.
- Logged-in users: unlimited notebooks and lists; reorder **notebooks**, **lists**, and **items** (including items across lists).

## API (JSON, session cookie)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/state` | Full state for current user |
| POST | `/api/merge` | Import guest notebook payload |
| POST | `/api/notebooks` | Create notebook `{ "name" }` |
| PATCH | `/api/notebooks/{id}` | Rename |
| DELETE | `/api/notebooks/{id}` | Delete |
| POST | `/api/notebooks/{id}/lists` | Create list `{ "name" }` |
| PATCH | `/api/lists/{id}` | Rename |
| DELETE | `/api/lists/{id}` | Delete |
| POST | `/api/lists/{id}/items` | Create item `{ "title" }` |
| PATCH | `/api/items/{id}` | `{ "title"?, "completed"? }` |
| DELETE | `/api/items/{id}` | Delete |
| POST | `/api/reorder/notebooks` | `{ "notebook_ids": [1,2,3] }` |
| POST | `/api/reorder/lists` | `{ "notebook_id", "list_ids": [...] }` |
| POST | `/api/reorder/items` | `{ "updates": [{ "id", "list_id", "position" }, ...] }` |

## License

MIT (or your choice).
