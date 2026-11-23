import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Server } from 'node:net';
import { and, eq } from 'drizzle-orm';
import { bootstrap } from '../../src/lib/server/bootstrap';
import { getServerEnv, getServerDatabase } from '../../src/lib/server/runtime';
import { getDb } from '../../src/db';
import { users, mailboxes, messages, messageTrackingEvents, messageTrackingLinks } from '../../src/db/schema';
import { sendEmail } from '../../src/lib/email/send';
import { processInboundMessage, getMessageWithBodyForUser } from '../../src/lib/email/inbound';
import { setMailTrackingEnabled } from '../../src/lib/tracking/settings';
import { instrumentHtml } from '../../src/lib/tracking/instrument';
import { TRACKING_RATE_LIMIT_PER_IP } from '../../src/lib/tracking/rate-limit';
import { GET as pixelGet } from '../../src/app/t/o/[token]/route';
import { GET as clickGet } from '../../src/app/t/c/[token]/[link]/route';

const root = mkdtempSync(join(tmpdir(), 'mailflare-tracking-'));
after(() => rmSync(root, { recursive: true, force: true }));
async function listen(server: Server) { await new Promise<void>((r) => server.listen(0, '127.0.0.1', r)); return (server.address() as { port: number }).port; }

const BASE = 'https://mail.example.test';
const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';

test('Mail tracking', async (t) => {
	const deliveries: string[] = [];
	const smtp = createServer((socket) => {
		socket.setEncoding('utf8'); socket.write('220 test.local ESMTP\r\n'); let buffer = '', data = false;
		socket.on('data', (chunk) => {
			buffer += chunk;
			while (buffer.includes('\r\n')) {
				if (data) { const end = buffer.indexOf('\r\n.\r\n'); if (end < 0) return; deliveries.push(buffer.slice(0, end)); buffer = buffer.slice(end + 5); data = false; socket.write('250 2.0.0 Ok: queued as TEST' + deliveries.length + '\r\n'); continue; }
				const end = buffer.indexOf('\r\n'), line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
				if (/^EHLO/i.test(line)) socket.write('250-test.local\r\n250 DSN\r\n'); else if (/^HELO/i.test(line)) socket.write('250 test.local\r\n');
				else if (/^DATA/i.test(line)) { data = true; socket.write('354 send data\r\n'); } else if (/^QUIT/i.test(line)) socket.end('221 bye\r\n'); else if (/^RCPT TO:.*reject@/i.test(line)) socket.write('550 5.1.1 <reject@example.test>: Recipient address rejected: User unknown\r\n'); else socket.write('250 OK\r\n');
			}
		});
	});
	const port = await listen(smtp);
	Object.assign(process.env, { DATA_DIR: join(root, 'app'), ADMIN_EMAIL: 'owner@example.test', ADMIN_PASSWORD: 'Test-Only-Long-Password-123!', MAIL_ADDRESS: 'hello@example.test', MAIL_DOMAINS: 'example.test', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port), SMTP_ALLOW_INSECURE: 'true', SMTP_ALLOWED_FROM: 'hello@example.test', APP_URL: BASE });
	delete process.env.SMTP_USER; delete process.env.SMTP_PASSWORD;
	await bootstrap();
	const env = getServerEnv(), db = getDb(env), raw = getServerDatabase().sqlite;
	const [user] = await db.select().from(users); const [mailbox] = await db.select().from(mailboxes);
	const html = '<html><body><p>Hi <a href="https://example.org/offer?a=1&amp;b=2">our offer</a> and <a href="https://example.org/docs">the docs</a>.</p>'
		+ '<p><a href="https://example.org/unsubscribe?u=1">Unsubscribe</a> <a href="mailto:hi@example.test">mail us</a> <a href="https://example.org/raw">https://example.org/raw</a></p>'
		+ '<div data-trt-signature="1"><table><tr><td><a href="https://www.trtdigital.ma">trtdigital.ma</a> <a href="https://example.org/sig-link">Site</a></td></tr></table></div></body></html>';
	async function send(overrides: Partial<Parameters<typeof sendEmail>[1]> = {}) {
		const before = deliveries.length;
		const result = await sendEmail(env, { userId: user.id, mailboxId: mailbox.id, from: 'hello@example.test', to: 'recipient@example.test', subject: 'Tracked', html, text: 'Plain version https://example.org/offer?a=1&b=2', ...overrides });
		assert.equal(deliveries.length, before + 1);
		const row = (await db.select().from(messages).where(eq(messages.id, result.messageId)))[0];
		return { id: result.messageId, row, wire: deliveries[deliveries.length - 1] };
	}
	const setSentAt = (id: string, secondsAgo: number) => raw.prepare('UPDATE messages SET sent_at=? WHERE id=?').run(Math.floor(Date.now() / 1000) - secondsAgo, id);
	const unq = (wire: string) => wire.replace(/=\r\n/g, '').replace(/=3D/g, '=').replace(/=2E/g, '.');
	const hit = (token: string, ip = '203.0.113.7', ua = BROWSER) => pixelGet(new Request(`${BASE}/t/o/${token}.gif`, { headers: { 'x-forwarded-for': ip, 'user-agent': ua } }), { params: Promise.resolve({ token: `${token}.gif` }) });
	const click = (token: string, link: string, ip = '203.0.113.7', ua = BROWSER, query = '') => clickGet(new Request(`${BASE}/t/c/${token}/${link}${query}`, { headers: { 'x-forwarded-for': ip, 'user-agent': ua } }), { params: Promise.resolve({ token, link }) });
	const counters = async (id: string) => (await db.select().from(messages).where(eq(messages.id, id)))[0];

	await t.test('HTML mail is instrumented: pixel + rewritten links, with the right links left alone', async () => {
		const { row, wire } = await send();
		assert.ok(row.trackingToken && /^[A-Za-z0-9_-]{32}$/.test(row.trackingToken), 'random 32-char token');
		assert.ok(!row.trackingToken.includes(row.id) && !row.trackingToken.toLowerCase().includes('recipient'), 'token never contains mail id or address');
		const w = unq(wire);
		assert.match(w, new RegExp(`${BASE}/t/o/${row.trackingToken}\\.gif`));
		const tracked = [...w.matchAll(new RegExp(`${BASE}/t/c/${row.trackingToken}/([A-Za-z0-9_-]+)`, 'g'))].map((m) => m[1]);
		assert.equal(new Set(tracked).size, 2, 'two tracked links (offer + docs)');
		for (const untouched of ['https://example.org/unsubscribe?u=1', 'mailto:hi@example.test', 'https://example.org/raw', 'https://www.trtdigital.ma', 'https://example.org/sig-link']) assert.ok(w.includes(untouched), `${untouched} untouched`);
		assert.ok(!w.includes('href="https://example.org/offer'), 'tracked href replaced');
		const links = await db.select().from(messageTrackingLinks).where(eq(messageTrackingLinks.messageId, row.id));
		assert.deepEqual(links.map((l) => l.url).sort(), ['https://example.org/docs', 'https://example.org/offer?a=1&b=2']);
		assert.ok(!(row.htmlBody ?? '').includes('/t/o/'), 'stored copy keeps the original HTML (viewing it never fires the pixel)');
		assert.ok(w.includes('Plain version https://example.org/offer?a=1&b=2'), 'plain-text alternative untouched');
	});

	await t.test('delivery status: accepted by the SMTP server is recorded with its response', async () => {
		const { row } = await send();
		assert.equal(row.deliveryStatus, 'sent'); assert.match(row.deliveryDetail ?? '', /queued as TEST/); assert.ok(row.sentAt);
		const ev = await db.select().from(messageTrackingEvents).where(and(eq(messageTrackingEvents.messageId, row.id), eq(messageTrackingEvents.type, 'accepted')));
		assert.equal(ev.length, 1);
	});

	await t.test('plain-text mail is left untouched and gets no token', async () => {
		const { row, wire } = await send({ html: undefined, text: 'Just text https://example.org/x' });
		assert.equal(row.trackingToken, null); assert.ok(!wire.includes('/t/o/')); assert.ok(wire.includes('https://example.org/x'));
	});

	await t.test('open pixel: a hit right after sending is not counted; later hits are; dedupe; delivered inferred', async () => {
		const { id, row } = await send(); const token = row.trackingToken!;
		const early = await hit(token); assert.equal(early.status, 200);
		assert.equal((await counters(id)).openCount, 0, 'hit in the first seconds ignored');
		const ignored = await db.select().from(messageTrackingEvents).where(and(eq(messageTrackingEvents.messageId, id), eq(messageTrackingEvents.type, 'open')));
		assert.equal(ignored[0].ignored, 'too_soon');
		setSentAt(id, 120);
		await hit(token, '198.51.100.1', 'Googlebot-like bot/1.0'); assert.equal((await counters(id)).openCount, 0, 'bot user agent ignored');
		await hit(token); let c = await counters(id);
		assert.equal(c.openCount, 1); assert.ok(c.firstOpenedAt && c.lastOpenedAt); assert.equal(c.deliveryStatus, 'delivered');
		await hit(token); assert.equal((await counters(id)).openCount, 1, 'immediate repeat from same client counted once');
		raw.prepare("UPDATE message_tracking_events SET at=at-60 WHERE message_id=? AND type='open'").run(id);
		await hit(token); c = await counters(id); assert.equal(c.openCount, 2);
		assert.ok(c.lastOpenedAt!.getTime() >= c.firstOpenedAt!.getTime());
		const first = await db.select().from(messageTrackingEvents).where(and(eq(messageTrackingEvents.messageId, id), eq(messageTrackingEvents.isFirst, true)));
		assert.equal(first.length, 1, 'exactly one first-open event (drives the sender notification)');
	});

	await t.test('unknown token: pixel answers exactly like a known one, nothing is stored', async () => {
		const { row } = await send(); const known = await hit(row.trackingToken!);
		const unknown = await hit('A'.repeat(32));
		assert.equal(unknown.status, known.status); assert.equal(unknown.headers.get('content-type'), known.headers.get('content-type'));
		assert.equal(unknown.headers.get('content-length'), known.headers.get('content-length'));
		assert.deepEqual(new Uint8Array(await unknown.arrayBuffer()), new Uint8Array(await known.arrayBuffer()));
		const malformed = await hit('x'); assert.equal(malformed.status, 200);
		assert.equal(raw.prepare("SELECT count(*) AS n FROM message_tracking_events WHERE message_id IS NULL OR message_id NOT IN (SELECT id FROM messages)").get()!.n, 0);
	});

	await t.test('click: redirects to the stored link, records which link and when; never to a URL from the request', async () => {
		const { id, row } = await send(); const token = row.trackingToken!;
		const links = await db.select().from(messageTrackingLinks).where(eq(messageTrackingLinks.messageId, id));
		const offer = links.find((l) => l.url.includes('/offer'))!; setSentAt(id, 120);
		const res = await click(token, offer.linkKey, '203.0.113.9', BROWSER, '?url=https://evil.example&to=https://evil.example');
		assert.equal(res.status, 302); assert.equal(res.headers.get('location'), 'https://example.org/offer?a=1&b=2');
		const c = await counters(id); assert.equal(c.clickCount, 1); assert.ok(c.firstClickedAt && c.lastClickedAt); assert.equal(c.deliveryStatus, 'delivered');
		const ev = await db.select().from(messageTrackingEvents).where(and(eq(messageTrackingEvents.messageId, id), eq(messageTrackingEvents.type, 'click')));
		assert.equal(ev.length, 1); assert.equal(ev[0].url, 'https://example.org/offer?a=1&b=2'); assert.equal(ev[0].isFirst, true);
	});

	await t.test('changed link / unknown token give the same 404 and record nothing', async () => {
		const { id, row } = await send(); const token = row.trackingToken!;
		const links = await db.select().from(messageTrackingLinks).where(eq(messageTrackingLinks.messageId, id)); setSentAt(id, 120);
		const tampered = await click(token, links[0].linkKey.slice(0, -1) + (links[0].linkKey.endsWith('A') ? 'B' : 'A'));
		const wrongToken = await click('B'.repeat(32), links[0].linkKey);
		const otherMail = await send(); const crossLink = await click(otherMail.row.trackingToken!, links[0].linkKey);
		const bodies = await Promise.all([tampered, wrongToken, crossLink].map(async (r) => [r.status, r.headers.get('location'), await r.text()]));
		for (const b of bodies) assert.deepEqual(b, [404, null, 'Not found']);
		assert.equal((await counters(id)).clickCount, 0);
	});

	await t.test('click right after sending, a link scanner and a scanner user agent are not counted but still redirect', async () => {
		const early = await send(); const earlyLink = (await db.select().from(messageTrackingLinks).where(eq(messageTrackingLinks.messageId, early.id)))[0];
		const r1 = await click(early.row.trackingToken!, earlyLink.linkKey); assert.equal(r1.status, 302);
		assert.equal((await counters(early.id)).clickCount, 0, 'click in the first seconds ignored');

		const burst = await send(); setSentAt(burst.id, 120);
		const burstLinks = await db.select().from(messageTrackingLinks).where(eq(messageTrackingLinks.messageId, burst.id));
		for (const l of burstLinks) assert.equal((await click(burst.row.trackingToken!, l.linkKey, '192.0.2.50')).status, 302);
		const b = await counters(burst.id); assert.equal(b.clickCount, 0, 'every link hit at once = scanner');
		assert.equal((await db.select().from(messageTrackingEvents).where(and(eq(messageTrackingEvents.messageId, burst.id), eq(messageTrackingEvents.isFirst, true)))).length, 0, 'no first-click notification from a scanner');

		const bot = await send(); setSentAt(bot.id, 120);
		const botLink = (await db.select().from(messageTrackingLinks).where(eq(messageTrackingLinks.messageId, bot.id)))[0];
		await click(bot.row.trackingToken!, botLink.linkKey, '192.0.2.60', 'Mozilla/5.0 (compatible; Proofpoint URL Defense)');
		assert.equal((await counters(bot.id)).clickCount, 0);
		await click(bot.row.trackingToken!, botLink.linkKey, '198.51.100.20', BROWSER);
		assert.equal((await counters(bot.id)).clickCount, 1, 'a real click afterwards still counts');
	});

	await t.test('rate limit: over the limit nothing more is recorded, but the answer does not change', async () => {
		const { id, row } = await send(); setSentAt(id, 120);
		let last: Response | null = null;
		for (let i = 0; i < TRACKING_RATE_LIMIT_PER_IP + 5; i++) last = await hit(row.trackingToken!, '203.0.113.200');
		assert.equal(last!.status, 200);
		const total = raw.prepare("SELECT count(*) AS n FROM message_tracking_events WHERE message_id=? AND type='open'").get(id)!.n as number;
		assert.ok(total <= TRACKING_RATE_LIMIT_PER_IP, `recorded ${total} (limit ${TRACKING_RATE_LIMIT_PER_IP})`);
		const links = await db.select().from(messageTrackingLinks).where(eq(messageTrackingLinks.messageId, id));
		const limited = await click(row.trackingToken!, links[0].linkKey, '203.0.113.200'); assert.equal(limited.status, 429);
	});

	await t.test('bounce: a delivery report read from the mailbox is matched to the sent mail', async () => {
		const { id, row } = await send({ to: 'nobody@bounce.test' });
		const bounce = [
			'From: Mail Delivery System <MAILER-DAEMON@mx.example.test>', 'To: hello@example.test', 'Subject: Undelivered Mail Returned to Sender', 'Message-ID: <bounce-1@mx.example.test>',
			'MIME-Version: 1.0', 'Content-Type: multipart/report; report-type=delivery-status; boundary="BND"', '',
			'--BND', 'Content-Type: text/plain; charset=utf-8', '', 'This is the mail system. Your message could not be delivered.', '',
			'--BND', 'Content-Type: message/delivery-status', '', 'Reporting-MTA: dns; mx.example.test', '',
			'Final-Recipient: rfc822; nobody@bounce.test', 'Action: failed', 'Status: 5.1.1', 'Diagnostic-Code: smtp; 550 5.1.1 <nobody@bounce.test>: Recipient address rejected: User unknown', '',
			'--BND', 'Content-Type: text/rfc822-headers', '', `Message-ID: ${row.providerMessageId}`, 'From: hello@example.test', 'To: nobody@bounce.test', 'Subject: Tracked', '',
			'--BND--', '',
		].join('\r\n');
		await env.BUCKET.put('inbound/bounce-1.eml', new TextEncoder().encode(bounce), { httpMetadata: { contentType: 'message/rfc822' } });
		await processInboundMessage(env, { from: 'MAILER-DAEMON@mx.example.test', to: 'hello@example.test', rawR2Key: 'inbound/bounce-1.eml' });
		const c = await counters(id);
		assert.equal(c.deliveryStatus, 'bounced'); assert.ok(c.bouncedAt); assert.match(c.deliveryDetail ?? '', /5\.1\.1/); assert.match(c.deliveryDetail ?? '', /User unknown/);
		assert.equal((await db.select().from(messageTrackingEvents).where(and(eq(messageTrackingEvents.messageId, id), eq(messageTrackingEvents.type, 'bounced')))).length, 1);
	});

	await t.test('SMTP failure: the mail is marked failed and keeps the server response', async () => {
		await assert.rejects(sendEmail(env, { userId: user.id, mailboxId: mailbox.id, from: 'hello@example.test', to: 'reject@example.test', subject: 'Will fail', html: '<p><a href="https://example.org/x">x</a></p>' }));
		const [row] = (await db.select().from(messages).where(eq(messages.subject, 'Will fail')));
		assert.equal(row.status, 'failed'); assert.equal(row.deliveryStatus, 'failed'); assert.match(row.deliveryDetail ?? '', /550/);
	});

	await t.test('the tracking token never leaves the server in message detail data', async () => {
		const { id, row } = await send(); assert.ok(row.trackingToken);
		const data = (await getMessageWithBodyForUser(env, user, id))!;
		assert.ok(!('trackingToken' in data.message) && !('trackingToken' in data.body));
		assert.ok(!JSON.stringify(data).includes(row.trackingToken!));
	});

	await t.test('instrumentHtml is a pure function that never rewrites twice and caps links', () => {
		const once = instrumentHtml('<a href="https://a.test/x">x</a>', { baseUrl: BASE, token: 'T'.repeat(32) });
		const twice = instrumentHtml(once.html, { baseUrl: BASE, token: 'U'.repeat(32) });
		assert.equal(twice.links.length, 0);
		const many = instrumentHtml(Array.from({ length: 150 }, (_, i) => `<a href="https://a.test/${i}">l${i}</a>`).join(''), { baseUrl: BASE, token: 'V'.repeat(32) });
		assert.equal(many.links.length, 100);
	});

	await t.test('tracking turned off: mail goes out untouched and nothing is tracked', async () => {
		await setMailTrackingEnabled(env, false);
		const { row, wire } = await send();
		assert.equal(row.trackingToken, null); assert.ok(!wire.includes('/t/o/') && !wire.includes('/t/c/'));
		assert.ok(unq(wire).includes('https://example.org/docs'));
		assert.equal(row.deliveryStatus, 'sent', 'delivery status is still recorded');
		await setMailTrackingEnabled(env, true);
		const perMail = await send({ track: false }); assert.equal(perMail.row.trackingToken, null);
	});

	smtp.close();
});
