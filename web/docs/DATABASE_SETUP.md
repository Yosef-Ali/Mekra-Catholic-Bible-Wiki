# Database Setup Guide

## Overview

This application uses **Neon PostgreSQL** as the database and **Drizzle ORM** for database operations. The database stores Bible book information and is accessed through secure server-side API routes.

## Architecture

```
┌─────────────────┐
│   React Client  │
│   (Browser)     │
└────────┬────────┘
         │ HTTP Requests
         ↓
┌─────────────────┐
│  Vite Server    │
│  + Middleware   │
│  (API Routes)   │
└────────┬────────┘
         │ SQL Queries
         ↓
┌─────────────────┐
│ Neon PostgreSQL │
│   (Database)    │
└─────────────────┘
```

## Security Model

✅ **SECURE**: Database credentials stay server-side only
✅ **SECURE**: Client communicates via `/api/*` endpoints
❌ **INSECURE**: Never import `services/db.ts` in client code

## Database Schema

### `books` Table

```sql
CREATE TABLE books (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,        -- English name (e.g., "Genesis")
  amharic_name VARCHAR(255) NOT NULL, -- Amharic name (e.g., "ኦሪት ዘፍጥረት")
  chapters INTEGER NOT NULL,          -- Number of chapters
  section VARCHAR(50) NOT NULL        -- 'OT', 'NT', or 'Apocrypha'
);
```

## Setup Instructions

### 1. Environment Configuration

Ensure your `.env` file contains:

```env
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Generate Database Schema

```bash
pnpm drizzle-kit generate
```

This creates migration files in the `drizzle/` directory.

### 4. Push Schema to Database

```bash
pnpm drizzle-kit push
```

This applies the schema to your Neon database.

### 5. Seed the Database

Populate the database with Bible book data:

```bash
pnpm tsx services/seed.ts
```

Expected output:
```
🌱 Seeding database...
Found 73 books to seed.
✅ Seeding completed successfully!
```

### 6. Verify Setup

Start the development server:

```bash
pnpm dev
```

Test the API endpoints:

```bash
# Health check
curl http://localhost:3000/api/health

# Get all books
curl http://localhost:3000/api/books

# Get books by section
curl http://localhost:3000/api/books/section/NT
```

## API Endpoints

### Books

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/books` | Get all Bible books |
| GET | `/api/books/:id` | Get a specific book by ID |
| GET | `/api/books/section/:section` | Get books by section (OT/NT/Apocrypha) |
| GET | `/api/books/search?q=query` | Search books by name |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | API health check |

## Development

### Database Migrations

When you update the schema in `services/schema.ts`:

```bash
# Generate migration
pnpm drizzle-kit generate

# Apply migration
pnpm drizzle-kit push
```

### Database Studio

View and edit data using Drizzle Studio:

```bash
pnpm drizzle-kit studio
```

Opens at `https://local.drizzle.studio`

## Frontend Integration

### Using the API Client

```typescript
import { booksApi } from '../services/apiClient';

// Get all books
const books = await booksApi.getAll();

// Get by section
const oldTestament = await booksApi.getBySection('OT');

// Search
const results = await booksApi.search('John');
```

### Example Component

```typescript
function BooksComponent() {
  const [books, setBooks] = useState<BibleBook[]>([]);

  useEffect(() => {
    async function fetchBooks() {
      const data = await booksApi.getAll();
      setBooks(data);
    }
    fetchBooks();
  }, []);

  return (
    <div>
      {books.map(book => (
        <div key={book.id}>{book.amharicName}</div>
      ))}
    </div>
  );
}
```

## Troubleshooting

### Database Connection Error

**Error:** `DATABASE_URL is not defined`

**Solution:** Ensure `.env` file contains `DATABASE_URL`

### Seed Script Fails

**Error:** `relation "books" does not exist`

**Solution:** Run `pnpm drizzle-kit push` to create the schema first

### API Returns Empty Data

**Solution:** Run the seed script: `pnpm tsx services/seed.ts`

### Client-Side Database Import Error

**Error:** "Database connection attempted in browser"

**Solution:** Use `apiClient.ts` instead of importing `db.ts` directly

## Production Deployment

### Environment Variables

Set these in your hosting platform:

- `DATABASE_URL` - Neon connection string
- `GEMINI_API_KEY` - Google Gemini API key

### Build Command

```bash
pnpm build
```

### Start Command

```bash
pnpm preview
```

## Future Enhancements

- [ ] Add bookmarks table for user-specific data
- [ ] Add chat history table
- [ ] Add user authentication
- [ ] Add full-text search with PostgreSQL
- [ ] Add database indexes for performance
- [ ] Add caching layer (Redis)

## Resources

- [Neon Documentation](https://neon.tech/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Vite Server API](https://vitejs.dev/guide/api-plugin.html#configureserver)
