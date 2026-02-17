# Lagbyggare (React + TypeScript + Vite)

En webapp för idrottslärare där du kan:
- skapa klasser
- lägga in och redigera elevlistor
- sätta nivå (1-3) och kön (tjej/kille/okänd) per elev
- lägga till blockeringspar (elever som inte får vara i samma lag)
- generera slumpade och jämnt fördelade lag
- kopiera/exportera resultat
- skapa konto och logga in med e-post/lösenord så varje användare får sina egna sparade klasser

All data sparas lokalt i webbläsaren via `localStorage` när Supabase inte är konfigurerat.
När Supabase är konfigurerat används konto-inloggning och data sparas per användare i databasen.

## Teknik

- React 18
- TypeScript (strict mode)
- Vite
- CSS (ingen extern UI-ram)

## Kom igång lokalt

Krav: Node.js 18+ och npm.

```bash
npm install
npm run dev
```

Öppna adressen som Vite skriver ut, vanligtvis `http://localhost:5173`.

## Konton och inloggning (Supabase)

För att flera kollegor ska kunna använda appen med egna data:

1. Skapa ett Supabase-projekt.
2. Kör SQL från `supabase-schema.sql` i Supabase SQL Editor.
3. Skapa `.env` i projektet med:

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

4. I Supabase: `Authentication -> Providers -> Email`
   - **Enable email signups**: på
   - stäng av **Confirm email**.

När **Confirm email** är av stängd räcker det att ange e-post + lösenord för att konto ska skapas direkt utan verifieringsmail.

### Vercel-inställningar för konton

I Vercel-projektet måste samma variabler finnas under **Settings -> Environment Variables**:

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Lägg dem för **Production**, **Preview** och **Development** och kör sedan en ny deploy.
Om dessa saknas kör appen enbart lokal lagring och visar inte inloggningspanelen.

## Bygg för produktion

```bash
npm run build
```

Byggfiler hamnar i `dist/`.

## Förhandsvisa produktionsbuild

```bash
npm run preview
```

## Deploy till GitHub Pages (rekommenderat)

Projektet innehåller en färdig GitHub Actions-workflow:

- `.github/workflows/deploy.yml`

Så här publicerar du:

1. Pusha projektet till GitHub (branch `main` eller `master`).
2. Gå till repo: **Settings → Pages**.
3. Under **Build and deployment**, välj **Source: GitHub Actions**.
4. Workflowen körs automatiskt vid push och publicerar `dist/` till GitHub Pages.

Notera:
- Workflowen sätter rätt `base`-path automatiskt vid build, så appen fungerar både på projekt-sidor (`/repo-namn/`) och root-sidor.

## Deploy till Vercel

1. Skapa ett Git-repo och pusha projektet.
2. Importera repot i Vercel.
3. Framework preset: **Vite**.
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy.

## Deploy till Netlify

1. Skapa ett Git-repo och pusha projektet.
2. Importera repot i Netlify.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy.

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

Persistenslagret har versionsfält (`version`) för att kunna migrera senare.

## Algoritm för laggenerering

- Upp till 2000 försök per generering
- Varje försök:
  - slumpa elevordning
  - placera elever i lag med jämn målstorlek
  - balansera nivåsumma mellan lag
  - balansera könsfördelning mellan lag
  - kontrollera blockeringar under placering
- Vid lyckat försök returneras lag
- Om inget försök lyckas: tydligt fel + föreslagen åtgärd

## Kända begränsningar / TODO

- Valfri “Lås slump-seed” är inte implementerad ännu.
