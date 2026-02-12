# Lagbyggare (React + TypeScript + Vite)

En webapp för idrottslärare där du kan:
- skapa klasser
- lägga in och redigera elevlistor
- lägga till blockeringspar (elever som inte får vara i samma lag)
- generera slumpade och jämnt fördelade lag
- kopiera/exportera resultat

All data sparas lokalt i webbläsaren via `localStorage` (ingen backend).

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
  students: string[];
  blocks: Array<{ a: string; b: string }>;
};
```

Persistenslagret har versionsfält (`version`) för att kunna migrera senare.

## Algoritm för laggenerering

- Upp till 2000 försök per generering
- Varje försök:
  - slumpa elevordning
  - placera elever i lag med jämn målstorlek
  - kontrollera blockeringar under placering
- Vid lyckat försök returneras lag
- Om inget försök lyckas: tydligt fel + föreslagen åtgärd

## Kända begränsningar / TODO

- Valfri “Lås slump-seed” är inte implementerad ännu.
