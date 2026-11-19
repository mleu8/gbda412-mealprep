# Prep

A mobile-first smart meal container companion prototype built with React, TypeScript, Tailwind CSS, Vite, and Lucide icons.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

## Prototype behavior

- Container pairing, connection status, battery levels, temperature controls, and ready-time behavior are simulated.
- Meal and container edits persist in localStorage in the browser.
- Nutritional values are estimates from a small local ingredient database.
- Temperature controls are demo interactions only, not validated food-safety guidance.
- Use `Reset demo data` in Preferences to restore the sample app state.

## GitHub Pages

The Vite build uses relative asset paths so it can be served from a project Pages URL such
as `https://mleu8.github.io/gbda412-mealprep/`.
