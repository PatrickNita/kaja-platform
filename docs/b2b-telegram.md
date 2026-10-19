# Notificări Telegram B2B

Botul existent este administrator cu drept de publicare în canalul B2B.
`TELEGRAM_B2B_CHAT_ID` conține ID-ul numeric al canalului (`-100…`).
`TELEGRAM_CHAT_ID` rămâne exclusiv destinația rezumatelor interne existente.
Configurația de producție nu se copiază în Git sau în mesaje.

Se notifică doar comenzi create și modificări efective de cantități/produse.
Fiecare eveniment este salvat atomic cu comanda, unic după comandă/versiune.
Instantele precedente și curente sunt păstrate fără linkuri de acces sau date fiscale.
Coada `b2b-telegram` trimite imediat și reîncearcă erorile.
Mesajele lungi sunt împărțite; progresul este salvat pe fragmente.
Telegram nu oferă o cheie de idempotentă pentru `sendMessage`: o întrerupere exact
după acceptarea mesajului, înainte de înregistrarea rezultatului, poate produce
o repetare la reluare. Cererile API repetate nu creează evenimente duplicate.

## Recuperare administrativă

Într-un mediu autorizat cu variabilele reale configurate:

```
node --env-file=<fișier-privat> scripts/b2b-telegram.mjs --pending
node --env-file=<fișier-privat> scripts/b2b-telegram.mjs --event=123
```

Se procesează maximum 100 de evenimente nesent, în ordine. Rulați din nou dacă
rămân evenimente. Cele deja trimise nu sunt retrimise. Nu se folosește botul real
în testele unitare sau de integrare.

`node scripts/b2b-telegram.mjs --test` trimite explicit un mesaj TEST în canalul
configurat, fără a crea comenzi. Nu rulați acest test pentru deploymenturi preview.

Verificați evenimentele cu `sent_at is null` și mesajele de eroare B2B din Vercel.
Un eșec al publicării în coadă păstrează evenimentul; se reia prin scriptul de mai sus.
