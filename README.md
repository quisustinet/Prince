# Prince — Pałac Piasków

Oryginalna webowa platformówka inspirowana klasycznymi przygodami w perskim pałacu. Grafika proceduralna Canvas 2D, szkieletowa animacja postaci i ruch z bezwładnością. Kolana i łokcie pracują niezależnie; postać pochyla się przy biegu i hamowaniu, ugina nogi przy lądowaniu, chwyta krawędzie i podciąga się na platformy. Bez zapożyczonych grafik i bez backendu.

## Uruchomienie

Wymagany Node.js 22.12+ (środowisko zweryfikowane z 24.19.0) i npm.

```sh
npm ci
npm run dev -- --port 5173
```

Otwórz lokalną ścieżkę `/Prince/` na porcie 5173.

## Sprawdzenie

```sh
npm test
npm run build
```

`npm run preview -- --port 4173` uruchamia podgląd zbudowanej wersji.

## GitHub Pages

W repozytorium wybierz Settings → Pages → Build and deployment → Source: GitHub Actions. Workflow `.github/workflows/pages.yml` testuje, buduje i publikuje grę po każdym pushu do `main`. Można go też uruchomić ręcznie w zakładce Actions. Gra będzie dostępna pod adresem https://quisustinet.github.io/Prince/. Konfiguracja Vite ustawia bazową ścieżkę `/Prince/`; lokalny serwer również udostępnia grę pod tą ścieżką.

## Zasady

Zbierz trzy fragmenty światła i dotrzyj do bramy po prawej stronie. Pierwsza wysoka półka uczy chwytu i podciągania; kolejne odcinki wymagają rozbiegu oraz skoków nad ostrzami. Po wejściu na oznaczone platformy zapisuje się punkt powrotu. Zebrane fragmenty pozostają po upadku.

| Sterowanie | Działanie |
| --- | --- |
| ← / → albo A / D | Bieg z rozpędem; puszczenie kierunku wytraca prędkość, przeciwny kierunek hamuje przed obrotem |
| Spacja / W / ↑ | Skok; przytrzymaj, by skoczyć wyżej, puść wcześniej dla krótkiego skoku |
| W locie twarzą do krawędzi | Automatyczny chwyt przy opadaniu w zasięgu dłoni |
| W / ↑ / spacja podczas zwisu | Podciągnięcie na półkę |
| S / ↓ podczas zwisu | Puszczenie krawędzi |
| P / Escape | Pauza / wznowienie |
| R | Nowa próba od początku, z wyzerowaniem fragmentów |

Na ekranach dotykowych są przyciski kierunków, puszczenia krawędzi oraz skoku/podciągania. Dźwięk jest opcjonalny i włącza się przyciskiem. Utrata aktywności okna wstrzymuje grę.

## Ruch i animacja

`src/physics.js` prowadzi symulację w stałym kroku 1/120 s: przyspieszenie, tarcie, ograniczona kontrola w powietrzu, grawitacja, zmienna wysokość skoku, krótka tolerancja skoku po zejściu z krawędzi i buforowanie skoku przed lądowaniem. Z pełnego biegu postać zatrzymuje się po około 0,42 s i 57 pikselach świata (nieco ponad dwie szerokości ciała); krótkie naciśnięcia wymagają znacznie mniej miejsca. Przeciwny kierunek hamuje mocniej, a obrót następuje dopiero po wytraceniu rozpędu. Chwyt utrzymuje pozycję przy krawędzi, a podciąganie przenosi ciało na półkę w czasie; sprawdza wolne miejsce nad nią. Kolizje działają z boków, od góry i od spodu platform.

`src/character.js` rysuje szkielet z animacją stawów: bieg, hamowanie, skok, opadanie, ugięcie po lądowaniu, zwis i podciąganie. Jednolita skala świata zachowuje proporcje ciała na telefonie. Efekty kontaktu obejmują cień, kurz przy krokach/lądowaniu oraz drobiny przy chwycie.

Testy obejmują również przejście całego poziomu z zebraniem fragmentów i wykorzystaniem chwytu oraz podciągania.

Gra działa bez usług zewnętrznych i sekretów. Opcjonalne fonty Google mają lokalne zamienniki. Gra obejmuje jeden poziom. Walka i przeciwnicy nie są jeszcze zaimplementowane.
