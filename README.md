# Prince — Pałac Piasków

Oryginalna webowa platformówka inspirowana klasycznymi przygodami w perskim pałacu. Grafika proceduralna Canvas 2D, płynna animacja postaci, przyspieszanie, tolerancja skoku po zejściu z krawędzi i buforowanie skoku. Bez zapożyczonych grafik i bez backendu.

## Uruchomienie

Wymagany Node.js 22.12+ (środowisko zweryfikowane z 24.19.0) i npm.

```sh
npm ci
npm run dev -- --port 5173
```

## Sprawdzenie

```sh
npm test
npm run build
```

`npm run preview -- --port 4173` uruchamia podgląd zbudowanej wersji.

## GitHub Pages

W repozytorium wybierz Settings → Pages → Build and deployment → Source: GitHub Actions. Workflow `.github/workflows/pages.yml` testuje, buduje i publikuje grę po każdym pushu do `main`. Można go też uruchomić ręcznie w zakładce Actions. Gra będzie dostępna pod adresem https://quisustinet.github.io/Prince/. Konfiguracja Vite ustawia bazową ścieżkę `/Prince/`; lokalny serwer również udostępnia grę pod tą ścieżką.

## Zasady

Zbierz trzy fragmenty światła i dotrzyj do bramy po prawej stronie. Unikaj kolców i przepaści. Zebrane fragmenty pozostają po upadku. Strzałki lub A/D: ruch; spacja, W lub strzałka w górę: skok; P/Escape: pauza; R: restart. Na ekranach dotykowych użyj przycisków. Dźwięk jest opcjonalny i włącza się przyciskiem. Utrata aktywności okna wstrzymuje grę.

Gra działa bez usług zewnętrznych i sekretów. Opcjonalne fonty Google mają lokalne zamienniki. Pierwsza wersja obejmuje jeden poziom; nie zawiera walki ani chwytania krawędzi.
