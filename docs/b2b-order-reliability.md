# Numere consecutive și refuzuri B2B

Migrarea `0026_b2b_order_reliability` renumerotează o singură dată comenzile
existente după `created_at,id`, fără schimbarea ID-urilor sau a referințelor.
Numărul este atribuit de triggerul de inserare, sub blocarea rândului unic din
`b2b_order_counter`, în tranzacția comenzii, produselor, stocului și notificării.
Un rollback anulează și incrementarea contorului. O cerere repetată cu aceeași
`request_key`, inclusiv simultană, nu consumă alt număr. ID-urile interne pot avea
goluri; interfața afișează exclusiv `order_number`.

Creările noi primesc momentul real al alocării, după obținerea blocării, pentru
ca ordinea numerelor să corespundă ordinii cronologice și la cereri concurente.
Editarea și schimbarea stării nu renumerotează comenzile. Mesajele Telegram
istorice nu sunt editate sau retrimise de migrare.

## Evidența refuzurilor

`b2b_order_rejections` păstrează fiecare răspuns de refuz al operației
`saveOrder` care a trecut verificarea originii: identificatorul încercării,
data, modul, membrul/localul identificat pe server, cheia de reluare, comanda
editată dacă există, produsele/cantitățile, codul și motivul refuzului.
Pentru stoc se păstrează produsul, diferența cerută și stocul disponibil.
Diagnosticele conțin numai clasa/codul erorii și numele constrângerii, fără SQL,
tokenuri, cookie-uri, IP-uri sau corpul brut al cererii. Jurnalul nu are endpoint
public și nu produce notificări Telegram.

Salvarea jurnalului se face după anularea tranzacției refuzate. Dacă baza de
date nu este disponibilă, răspunsul de eroare conține totuși `attemptId`, iar
în logurile runtime apare `B2B_ORDER_REJECTION_AUDIT_FAILED` cu informații
sanitizate. Nu se poate garanta scrierea în baza de date în timpul unei pene a ei.
Refuzurile anterioare instalării migrării nu sunt reconstruite sau inventate.

Verificare administrativă în conexiune autorizată:

```sql
SELECT created_at, id AS attempt_id, location_name, order_id, request_key,
       http_status, error_code, reason, requested_items, stock_details, diagnostics
FROM b2b_order_rejections
ORDER BY created_at DESC;
```

Migrare: `scripts/migrate-b2b-order-reliability.mjs` afișează implicit doar
asocierea numerelor. `--apply --report <cale-privată>` salvează copia de siguranță,
aplică tranzacțional migrarea și verifică păstrarea datelor. Nu se rulează
comenzi artificiale în producție; scenariile de concurență/refuz sunt acoperite
în scheme temporare prin testele de integrare.
