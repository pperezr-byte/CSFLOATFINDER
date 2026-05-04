async function exportCSFloatCSV(options = {}) {
  const {
    weapons = ["AK-47", "AWP", "M4A4", "Desert Eagle"],
    pages = 40,
    limit = 50,
    sortBy = "most_recent",
    maxTotalRows = 600,
    minTotalRows = 300,
    balanceWeapons = true,
    sortRowsBy = ["arma", "price", "float"],
    sortDirection = "asc",
    delimiter = ";",
    includeExcelSepHint = true,
    filename = "armas.csv",
    requestDelayMs = 1200,
    requestJitterMs = 700,
    maxRetries = 5,
    backoffBaseMs = 1500,
    backoffMaxMs = 12000
  } = options;

  const rarityMap = {
    1: "Consumer Grade",
    2: "Industrial Grade",
    3: "Mil-Spec",
    4: "Restricted",
    5: "Classified",
    6: "Covert",
    7: "Contraband"
  };

  const seen = new Set();
  const rows = [];
  const rowsByWeapon = {};
  const weaponsLower = weapons.map((w) => String(w).toLowerCase());
  for (const w of weapons) rowsByWeapon[w] = [];

  const perWeaponCap = Math.max(1, Math.ceil(maxTotalRows / Math.max(1, weapons.length)));

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function randomJitter(max) {
    if (!max || max <= 0) return 0;
    return Math.floor(Math.random() * max);
  }

  function compareField(field, left, right) {
    if (["price", "float", "price_cents", "rareza"].includes(field)) {
      return Number(left[field] || 0) - Number(right[field] || 0);
    }
    if (field === "fecha") {
      return new Date(left[field]).getTime() - new Date(right[field]).getTime();
    }
    return String(left[field] ?? "").localeCompare(String(right[field] ?? ""), "es", { sensitivity: "base" });
  }

  async function fetchPageWithRetry(url) {
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: "GET",
          credentials: "include"
        });

        if (res.status === 429 || res.status === 403) {
          const body = await res.text();
          throw new Error(`Rate limited (${res.status}): ${body}`);
        }

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body}`);
        }

        return await res.json();
      } catch (err) {
        lastError = err;
        if (attempt >= maxRetries) break;

        const backoff =
          Math.min(backoffMaxMs, backoffBaseMs * Math.pow(2, attempt)) + randomJitter(900);
        console.warn(`Reintento ${attempt + 1}/${maxRetries} en ${backoff}ms -> ${err.message}`);
        await sleep(backoff);
      }
    }

    throw lastError || new Error("Fallo sin detalle al consultar la API.");
  }

  let cursor = null;
  for (let page = 1; page <= pages; page++) {
    const params = new URLSearchParams({
      limit: String(limit),
      sort_by: sortBy
    });
    if (cursor) params.set("cursor", cursor);

    const url = `/api/v1/listings?${params.toString()}`;
    console.log(`Consultando pagina ${page}/${pages}`);
    const data = await fetchPageWithRetry(url);
    const listings = Array.isArray(data) ? data : data.data || data.listings || data.results || [];
    if (!listings.length) break;

    for (const listing of listings) {
      const item = listing.item || {};
      const arma = String(item.item_name || item.market_hash_name || "");
      const marketHashName = String(item.market_hash_name || "");
      const text = `${arma} ${marketHashName}`.toLowerCase();
      const listingId = String(listing.id ?? "");

      const matches =
        weaponsLower.length === 0 || weaponsLower.some((w) => text.includes(w));
      if (!matches) continue;
      if (!listingId || seen.has(listingId)) continue;

      const row = {
        listing_id: listingId,
        arma,
        market_hash_name: marketHashName,
        price_cents: listing.price ?? "",
        price: typeof listing.price === "number" ? (listing.price / 100).toFixed(2) : "",
        float: item.float_value ?? "",
        rareza: item.rarity ?? "",
        rareza_nombre: rarityMap[item.rarity] || "",
        coleccion: item.collection ?? "",
        fecha: listing.created_at ?? ""
      };

      if (balanceWeapons && weapons.length > 0) {
        const matchedWeapon = weapons.find((w) => text.includes(String(w).toLowerCase()));
        if (!matchedWeapon) continue;
        if (rowsByWeapon[matchedWeapon].length >= perWeaponCap) continue;
        rowsByWeapon[matchedWeapon].push(row);
      } else {
        rows.push(row);
      }

      seen.add(listingId);
    }

    cursor = data.next_cursor || data.cursor || data.nextCursor || null;
    if (!cursor) break;

    const currentTotal = balanceWeapons && weapons.length > 0
      ? Object.values(rowsByWeapon).reduce((acc, arr) => acc + arr.length, 0)
      : rows.length;
    if (currentTotal >= maxTotalRows) break;

    await sleep(requestDelayMs + randomJitter(requestJitterMs));
  }

  const finalRows = balanceWeapons && weapons.length > 0
    ? Object.values(rowsByWeapon).flat().slice(0, maxTotalRows)
    : rows.slice(0, maxTotalRows);

  if (!finalRows.length) {
    console.log("No se encontraron resultados con esos filtros.");
    return;
  }

  const direction = String(sortDirection).toLowerCase() === "desc" ? -1 : 1;
  const sortFields = Array.isArray(sortRowsBy) && sortRowsBy.length
    ? sortRowsBy
    : ["arma", "price", "float"];

  finalRows.sort((left, right) => {
    for (const field of sortFields) {
      const diff = compareField(field, left, right);
      if (diff !== 0) return diff * direction;
    }
    return 0;
  });

  const headers = [
    "listing_id",
    "arma",
    "market_hash_name",
    "price_cents",
    "price",
    "float",
    "rareza",
    "rareza_nombre",
    "coleccion",
    "fecha"
  ];

  const d = delimiter || ";";
  const csvLines = [
    headers.join(d),
    ...finalRows.map((row) =>
      headers.map((h) => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(d)
    )
  ];

  const csvContent = includeExcelSepHint
    ? [`sep=${d}`, ...csvLines].join("\n")
    : csvLines.join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  const countByWeapon = {};
  for (const row of finalRows) {
    const matched = weapons.find((w) => row.arma.toLowerCase().includes(String(w).toLowerCase())) || "otros";
    countByWeapon[matched] = (countByWeapon[matched] || 0) + 1;
  }

  console.table(finalRows);
  console.log(`CSV descargado: ${filename} | filas: ${finalRows.length}`);
  console.log("Distribucion por arma:", countByWeapon);
  if (finalRows.length < minTotalRows) {
    console.warn(`Solo ${finalRows.length} filas (< ${minTotalRows}). Prueba mas pages o armas mas liquidas.`);
  }
}
