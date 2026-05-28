# IITIL Portal Client

Enterprise React frontend for the IITIL HRMS + ATS + Admin Portal.

## Stack

- React 19
- TypeScript
- Vite
- TailwindCSS
- ShadCN-style Radix primitives
- Framer Motion
- React Router
- React Hook Form + Zod
- Zustand
- TanStack Query
- Axios
- TanStack Table
- Lucide React
- Sonner

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

Default API base URL:

```text
http://localhost:4000/api/v1
```

The UI uses real API calls only. Modules render skeleton, empty, or error states until their backend endpoints are implemented.
