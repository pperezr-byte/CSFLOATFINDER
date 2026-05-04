# Recolectar datos visibles de CSFloat

## Lo importante

El `30 de abril de 2026` la documentación pública de CSFloat sigue mostrando `GET /api/v1/listings`, pero al probarlo responde:

`You need to be logged in to search listings`

Eso significa que para recolectar datos visibles del market necesitas usar tu sesion normal del navegador.

## Variables que exporta el script

- `price_cents`
- `price`
- `float`
- `rareza`
- `rareza_nombre`
- `arma`
- `market_hash_name`
- `coleccion`
- `fecha`
- `tipo`
- `estado`

## Archivo

Script: [csfloat_public_export.ps1](C:/Users/xris/Documents/Codex/2026-04-30-como-puedo-recolectar-datos-de-una/csfloat_public_export.ps1)
Script navegador (recomendado): [csfloat_browser_export.js](C:/Users/xris/Documents/Codex/2026-04-30-como-puedo-recolectar-datos-de-una/csfloat_browser_export.js)

## Paso 1: sacar tu cookie de sesion

1. Inicia sesion en CSFloat en tu navegador.
2. Abre `F12` -> `Network`.
3. Recarga la pagina del market.
4. Busca una peticion a `/api/v1/listings`.
5. Copia el header `Cookie` completo.

## Paso 2: ejecutar el script

Ejemplo filtrando por arma:

```powershell
powershell -ExecutionPolicy Bypass -File .\csfloat_public_export.ps1 `
  -Weapon "AK-47" `
  -Pages 3 `
  -PageSize 50 `
  -CookieHeader "pega_aqui_tu_cookie_completa" `
  -Output "ak47.csv"
```

Ejemplo con nombre exacto de CSFloat:

```powershell
powershell -ExecutionPolicy Bypass -File .\csfloat_public_export.ps1 `
  -MarketHashName "AK-47 | Redline (Field-Tested)" `
  -Pages 2 `
  -CookieHeader "pega_aqui_tu_cookie_completa" `
  -Output "redline_ft.csv"
```

## Notas

- `PageSize` acepta de `1` a `50`.
- `Pages` controla cuantas paginas intentas descargar.
- Si CSFloat cambia el cursor de paginacion, puede que haya que ajustar el script.
- `price` se calcula como `price_cents / 100`.

## Opcion recomendada: consola del navegador

Si PowerShell devuelve `You need to be logged in to search listings`, usa el script de navegador.

1. Abre CSFloat logueado y ve al market.
2. Presiona `F12` -> `Console`.
3. Pega todo el contenido de `csfloat_browser_export.js`.
4. Ejecuta:

```js
exportCSFloatCSV({
  weapons: ["AK-47", "AWP", "M4A4"],
  pages: 5,
  sortRowsBy: ["arma", "price", "float"],
  sortDirection: "asc",
  filename: "armas.csv"
});
```
aaaaaaaaaa
El archivo se descarga ya ordenado y separado por `;`, compatible con Excel en configuracion regional en espanol.

Ejemplos de orden:

```js
// 1) Ordenar por precio (barato -> caro)
exportCSFloatCSV({
  weapons: ["AK-47", "AWP", "M4A4"],
  pages: 5,
  sortRowsBy: ["price"],
  sortDirection: "asc",
  filename: "armas_precio_asc.csv"
});

// 2) Ordenar por fecha (nuevo -> antiguo)
exportCSFloatCSV({
  weapons: ["AK-47", "AWP", "M4A4"],
  pages: 5,
  sortRowsBy: ["fecha"],
  sortDirection: "desc",
  filename: "armas_recientes.csv"
});
```
(async () => {
  const r = await fetch("file:///C:/Users/xris/Documents/Codex/2026-04-30-como-puedo-recolectar-datos-de-una/csfloat_browser_export.js");
  const code = await r.text();
  eval(code);
  console.log(typeof exportCSFloatCSV);
})();
aaaaaaaaaaa
typeof exportCSFloatCSV
aaaaaaaaaaaaa
exportCSFloatCSV({
  weapons: ["AK-47", "AWP", "M4A4", "Desert Eagle"],
  pages: 50,
  limit: 50,
  maxTotalRows: 600,
  minTotalRows: 300,
  balanceWeapons: true,
  requestDelayMs: 1800,
  requestJitterMs: 1200,
  maxRetries: 6,
  backoffBaseMs: 2000,
  filename: "armas_600.csv"
});
