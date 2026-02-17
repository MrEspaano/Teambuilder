# Lagbyggare (React + TypeScript + Vite + Vercel Postgres)

En webapp för idrottslärare där varje användare skapar eget konto (e-post + lösenord) och får sina egna klasser i molnet.

## Funktioner

- skapa klasser
- lägga in och redigera elevlistor
- sätta nivå (1-3) och kön (tjej/kille/okänd) per elev
- lägga till blockeringspar (elever som inte får vara i samma lag)
- generera slumpade och jämnt fördelade lag
- kopiera/exportera resultat
- konto per användare med data synkad mellan enheter

## Teknik

- React 18
- TypeScript (strict mode)
- Vite
- Vercel Serverless Functions (`/api/*`)
- Vercel Postgres
- JWT-auth (egen implementation)

## Lokal utveckling

Krav: Node.js 18+ och npm.

```bash
npm install
npm run dev
```

Obs: `npm run dev` startar bara frontend (Vite).
För att testa API + auth lokalt, använd `vercel dev` med rätt miljövariabler.

## Vercel setup (utan Supabase)

### 1. Koppla Vercel Postgres

I Vercel-projektet:

- gå till `Storage`
- skapa/koppla en `Postgres`-databas
- koppla databasen till projektet

Detta skapar automatiskt Postgres-miljövariabler i projektet.

### 2. Lägg till JWT-hemlighet

I `Project -> Settings -> Environment Variables`:

- `AUTH_JWT_SECRET` = lång slumpad sträng (minst 32 tecken)

Lägg den för `Production`, `Preview`, `Development`.

### 3. Deploya om

Kör `Redeploy` i Vercel efter att variabler är satta.

## Databasschema

Appen försöker skapa tabeller automatiskt vid första API-anrop.
Du kan också köra SQL manuellt från `postgres-schema.sql`.

## Deploy till Vercel

1. Pusha till GitHub.
2. Importera repot i Vercel.
3. Framework preset: `Vite`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Lägg till `AUTH_JWT_SECRET` och Postgres integration.
7. Redeploy.

## Datamodell

```ts
type Class = {
  id: string;
  name: string;
  students: Array<{
    name: string;
    level: 1 | 2 | 3;
    gender: "tjej" | "kille" | "okänd";
  }>;
  blocks: Array<{ a: string; b: string }>;
};
```
