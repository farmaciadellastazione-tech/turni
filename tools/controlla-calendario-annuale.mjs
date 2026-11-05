// controlla-calendario-annuale.mjs — avvisa quando arriva il calendario turni ANNUALE.
//
// Uso: node tools/controlla-calendario-annuale.mjs
//
// Il calendario annuale (bozza a settembre, ufficiale/ordinanza a gennaio) NON si
// importa da solo: arriva in Word una volta l'anno e va controllato a mano (nuovi
// alias, note, ecc. — vedi tools/README.md). Questo script si limita ad accorgersene
// e a mandare una mail di avviso al titolare (alla casella stessa).
//
// Anti-ripetizione: dopo l'avviso la mail di Federfarma riceve l'etichetta Gmail
// ETICHETTA; le mail già etichettate non vengono più considerate. Se l'invio
// dell'avviso fallisce, l'etichetta NON viene messa (riprova al run successivo).
//
// Autenticazione: stessa App Password Gmail del resto dell'automazione
//   GMAIL_USER, GMAIL_APP_PASSWORD  (IMAP per leggere/etichettare, SMTP per l'avviso)
//
// Exit: 0 = ok (avviso inviato o niente di nuovo) · 2 = credenziali mancanti · 1 = errore.

import { createRequire } from 'node:module';
import { calendarioAnnuale } from './selezione-mail.mjs';

const require = createRequire(import.meta.url);
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');

export const ETICHETTA = 'Calendario turni annuale';
// Nella sintassi di ricerca Gmail gli spazi del nome etichetta diventano trattini.
const ETICHETTA_RICERCA = ETICHETTA.toLowerCase().replace(/\s+/g, '-');

function testoAvviso(info, mail) {
  const quando = mail.date ? mail.date.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' }) : '?';
  return [
    `È arrivato da Federfarma il calendario turni ${info.anno} (${info.tipo}).`,
    '',
    `Mail del ${quando}: "${mail.subject}"`,
    `Allegato: ${info.allegato}`,
    mail.link ? `Apri la mail: ${mail.link}` : null,
    '',
    'La bacheca NON lo carica da sola. Cosa fare:',
    '1. Apri Claude Code nella cartella del progetto turni e scrivi:',
    `   "è arrivato il calendario turni ${info.anno} (${info.tipo}), caricalo"`,
    '2. Claude genera data/turni-' + info.anno + '.json dal file (procedura in tools/README.md),',
    '   ti mostra eventuali giorni non riconosciuti e, se è un definitivo, le differenze',
    '   rispetto alla bozza già caricata.',
    '',
    `La mail di Federfarma ha ora l'etichetta "${ETICHETTA}": non riceverai altri avvisi per questa.`,
    '',
    '— Automazione bacheca turni (GitHub Actions)',
  ].filter(r => r !== null).join('\n');
}

async function main() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.error('Mancano GMAIL_USER / GMAIL_APP_PASSWORD.');
    return 2;
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com', port: 993, secure: true,
    auth: { user, pass }, logger: false,
  });
  await client.connect();
  try {
    const mailboxes = await client.list();
    const allMailbox = mailboxes.find(m => m.specialUse === '\\All');
    const lock = await client.getMailboxLock(allMailbox?.path || 'INBOX');
    try {
      // Pre-filtro lato Gmail (largo); la decisione vera la prende calendarioAnnuale().
      const uids = await client.search({
        gmraw: `from:federfarmalaspezia.it has:attachment filename:calendario newer_than:120d -label:${ETICHETTA_RICERCA}`,
      }, { uid: true });
      if (!uids?.length) { console.log('Nessuna nuova mail col calendario annuale.'); return 0; }

      const annoCorrente = new Date().getFullYear();
      const transport = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass },
      });

      for (const uid of [...uids].sort((a, b) => a - b)) {
        const msg = await client.fetchOne(String(uid), { source: true, threadId: true }, { uid: true });
        const parsed = await simpleParser(msg.source);
        const nomi = (parsed.attachments || []).map(a => a.filename || '');
        const info = calendarioAnnuale(parsed.subject || '', nomi, annoCorrente);
        if (!info) continue;

        // X-GM-THRID (decimale) -> id esadecimale usato negli URL di Gmail.
        let link = '';
        try { if (msg.threadId) link = 'https://mail.google.com/mail/u/0/#all/' + BigInt(msg.threadId).toString(16); } catch {}

        console.log(`Calendario ${info.anno} (${info.tipo}) in "${parsed.subject}" — invio avviso.`);
        await transport.sendMail({
          from: user,
          to: user,
          subject: `📅 Calendario turni ${info.anno} (${info.tipo}) arrivato da Federfarma`,
          text: testoAvviso(info, { subject: parsed.subject, date: parsed.date, link }),
        });
        await client.messageFlagsAdd(String(uid), [ETICHETTA], { uid: true, useLabels: true });
        console.log(`  Avviso inviato, etichetta "${ETICHETTA}" applicata.`);
      }
      return 0;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

main().then(code => process.exit(code)).catch(err => { console.error(err); process.exit(1); });
