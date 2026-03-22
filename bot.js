'use strict';

const { Telegraf } = require('telegraf');
const mongoose     = require('mongoose');
const http         = require('http');
require('dotenv').config();

// ══════════════════════════════════════════════════════════════
//  ENV VALIDATION
// ══════════════════════════════════════════════════════════════
const BOT_TOKEN  = process.env.BOT_TOKEN;
const OWNER_ID   = Number(process.env.OWNER_ID);
const MONGO_URL  = process.env.MONGO_URL;
const RENDER_URL = (process.env.RENDER_URL || '').replace(/\/$/, '');
const PORT       = Number(process.env.PORT) || 3000;

if (!BOT_TOKEN) { console.error('❌  BOT_TOKEN missing'); process.exit(1); }
if (!OWNER_ID)  { console.error('❌  OWNER_ID missing');  process.exit(1); }
if (!MONGO_URL) { console.error('❌  MONGO_URL missing'); process.exit(1); }

// ══════════════════════════════════════════════════════════════
//  MONGODB
// ══════════════════════════════════════════════════════════════
mongoose.set('strictQuery', true);

mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 10000 })
  .then(() => console.log('✅  MongoDB connected'))
  .catch(err => { console.error('❌  MongoDB:', err.message); process.exit(1); });

// ── Schemas ───────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  userId:    { type: Number, unique: true },
  username:  { type: String, default: '' },
  firstName: { type: String, default: '' },
  lastName:  { type: String, default: '' },
  startedAt: { type: Date,   default: Date.now },
});

const groupSchema = new mongoose.Schema({
  groupId:         { type: Number, unique: true },
  title:           { type: String, default: '' },
  addedBy:         Number,
  addedByUsername: { type: String, default: '' },
  active:          { type: Boolean, default: true },
  joinedAt:        { type: Date, default: Date.now },
});

const logSchema = new mongoose.Schema({
  type:       String,
  userId:     Number,
  username:   { type: String, default: '' },
  groupId:    Number,
  groupTitle: { type: String, default: '' },
  message:    { type: String, default: '' },
  timestamp:  { type: Date,   default: Date.now },
});

const User  = mongoose.model('User',  userSchema);
const Group = mongoose.model('Group', groupSchema);
const Log   = mongoose.model('Log',   logSchema);

// ══════════════════════════════════════════════════════════════
//  BOT
// ══════════════════════════════════════════════════════════════
const bot = new Telegraf(BOT_TOKEN);

// ── Helpers ───────────────────────────────────────────────────
const isOwner = (ctx) => ctx.from?.id === OWNER_ID;

async function addLog(data) {
  try { await Log.create(data); } catch (_) {}
}

async function ping(text) {
  try {
    await bot.telegram.sendMessage(OWNER_ID, text, { parse_mode: 'HTML' });
  } catch (_) {}
}

function fmtUser(u) {
  return (`${u.first_name || ''} ${u.last_name || ''}`).trim() || 'Unknown';
}

// ══════════════════════════════════════════════════════════════
//  /start
// ══════════════════════════════════════════════════════════════
bot.start(async (ctx) => {
  if (ctx.chat.type !== 'private') return;

  const { id, username, first_name, last_name } = ctx.from;

  try {
    const existing = await User.findOne({ userId: id });
    const isNew    = !existing;

    await User.findOneAndUpdate(
      { userId: id },
      { username: username || '', firstName: first_name || '', lastName: last_name || '' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (isNew) {
      await addLog({ type: 'start', userId: id, username: username || '', message: '/start' });
      await ping(
        `🟢 <b>New User Started</b>\n` +
        `👤 ${fmtUser(ctx.from)}\n` +
        `🆔 <code>${id}</code>\n` +
        `📛 @${username || 'N/A'}`
      );
    }

    const ownerExtra = isOwner(ctx)
      ? `\n\n👑 <b>Owner Panel:</b>\n` +
        `┣ /stats — Statistics\n` +
        `┣ /logs — Recent logs\n` +
        `┗ /broadcast &lt;text&gt; — Mass message`
      : '';

    await ctx.reply(
      `👋 <b>Hello${isNew ? '' : ' again'}, ${first_name || 'there'}!</b>\n\n` +
      `🤖 I'm <b>@HiddenEntryBot</b>\n` +
      `I automatically <b>hide</b> join &amp; leave messages in Telegram groups.\n\n` +
      `<b>How to use:</b>\n` +
      `1️⃣ Add me to your group\n` +
      `2️⃣ Make me <b>Admin</b>\n` +
      `3️⃣ Enable <b>Delete Messages</b> permission\n` +
      `4️⃣ Done ✅\n\n` +
      `<b>Commands:</b>\n` +
      `┣ /start — This message\n` +
      `┗ /help  — Usage guide` +
      ownerExtra,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('/start error:', err.message);
  }
});

// ══════════════════════════════════════════════════════════════
//  /help
// ══════════════════════════════════════════════════════════════
bot.help(async (ctx) => {
  await ctx.reply(
    `ℹ️ <b>@HiddenEntryBot — Help</b>\n\n` +
    `<b>What I do:</b>\n` +
    `Silently delete "joined the group" and "left the group" messages.\n\n` +
    `<b>Setup:</b>\n` +
    `1️⃣ Add @HiddenEntryBot to your group\n` +
    `2️⃣ Promote me as <b>Admin</b>\n` +
    `3️⃣ Enable <b>Delete Messages</b>\n` +
    `4️⃣ All join/leave messages are now hidden ✅\n\n` +
    `<b>Commands:</b>\n` +
    `┣ /start — Welcome message\n` +
    `┗ /help  — This message`,
    { parse_mode: 'HTML' }
  );
});

// ══════════════════════════════════════════════════════════════
//  BOT ADDED / REMOVED FROM GROUP
// ══════════════════════════════════════════════════════════════
bot.on('my_chat_member', async (ctx) => {
  try {
    const update    = ctx.myChatMember;
    const newStatus = update.new_chat_member.status;
    const chat      = ctx.chat;
    const by        = update.from;

    if (newStatus === 'member' || newStatus === 'administrator') {
      await Group.findOneAndUpdate(
        { groupId: chat.id },
        {
          groupId: chat.id, title: chat.title || '',
          addedBy: by.id,   addedByUsername: by.username || '',
          active: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      await addLog({
        type: 'group_add', userId: by.id, username: by.username || '',
        groupId: chat.id, groupTitle: chat.title || '',
      });
      await ping(
        `📢 <b>Added to Group</b>\n` +
        `🏠 <b>${chat.title || 'Unknown'}</b>\n` +
        `🆔 <code>${chat.id}</code>\n` +
        `👤 ${fmtUser(by)} (@${by.username || 'N/A'})\n` +
        `🆔 User: <code>${by.id}</code>`
      );
    }

    if (newStatus === 'kicked' || newStatus === 'left') {
      await Group.findOneAndUpdate({ groupId: chat.id }, { active: false });
      await addLog({
        type: 'group_remove', userId: by.id, username: by.username || '',
        groupId: chat.id, groupTitle: chat.title || '',
      });
      await ping(
        `🔴 <b>Removed from Group</b>\n` +
        `🏠 <b>${chat.title || 'Unknown'}</b>\n` +
        `🆔 <code>${chat.id}</code>\n` +
        `👤 ${fmtUser(by)} (@${by.username || 'N/A'})`
      );
    }
  } catch (err) {
    console.error('my_chat_member error:', err.message);
  }
});

// ══════════════════════════════════════════════════════════════
//  HIDE JOIN / LEFT MESSAGES
// ══════════════════════════════════════════════════════════════
bot.on('message', async (ctx, next) => {
  const msg = ctx.message;
  if (msg?.new_chat_members || msg?.left_chat_member) {
    try { await ctx.deleteMessage(); } catch (_) {}
    return;
  }
  return next();
});

// ══════════════════════════════════════════════════════════════
//  OWNER: /stats
// ══════════════════════════════════════════════════════════════
bot.command('stats', async (ctx) => {
  if (!isOwner(ctx)) return ctx.reply('⛔ Owner only.');
  try {
    const [users, groups, activeGroups, logs] = await Promise.all([
      User.countDocuments(),
      Group.countDocuments(),
      Group.countDocuments({ active: true }),
      Log.countDocuments(),
    ]);
    await ctx.reply(
      `📊 <b>@HiddenEntryBot — Stats</b>\n\n` +
      `👤 Total Users:       <b>${users}</b>\n` +
      `🏠 Total Groups:      <b>${groups}</b>\n` +
      `✅ Active Groups:     <b>${activeGroups}</b>\n` +
      `📋 Total Logs:        <b>${logs}</b>`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    ctx.reply('❌ Error: ' + err.message);
  }
});

// ══════════════════════════════════════════════════════════════
//  OWNER: /logs
// ══════════════════════════════════════════════════════════════
bot.command('logs', async (ctx) => {
  if (!isOwner(ctx)) return ctx.reply('⛔ Owner only.');
  try {
    const logs = await Log.find().sort({ timestamp: -1 }).limit(10);
    if (!logs.length) return ctx.reply('📭 No logs yet.');

    const lines = logs.map((l, i) =>
      `${i + 1}. <b>${l.type.toUpperCase()}</b>  ` +
      `${l.timestamp.toISOString().slice(0, 16).replace('T', ' ')} UTC\n` +
      `   👤 @${l.username || 'N/A'} (<code>${l.userId || '—'}</code>)\n` +
      (l.groupTitle ? `   🏠 ${l.groupTitle}\n` : '')
    ).join('\n');

    await ctx.reply(`📋 <b>Last 10 Logs</b>\n\n${lines}`, { parse_mode: 'HTML' });
  } catch (err) {
    ctx.reply('❌ Error: ' + err.message);
  }
});

// ══════════════════════════════════════════════════════════════
//  OWNER: /broadcast
// ══════════════════════════════════════════════════════════════
bot.command('broadcast', async (ctx) => {
  if (!isOwner(ctx)) return ctx.reply('⛔ Owner only.');

  const text = ctx.message.text.replace(/^\/broadcast\s*/i, '').trim();
  if (!text) {
    return ctx.reply(
      'Usage:\n<code>/broadcast your message here</code>',
      { parse_mode: 'HTML' }
    );
  }

  const statusMsg = await ctx.reply('📤 Broadcasting…');
  const users = await User.find({}, 'userId').lean();
  let sent = 0, failed = 0;

  for (const u of users) {
    try {
      await bot.telegram.sendMessage(
        u.userId,
        `📣 <b>Message from @HiddenEntryBot</b>\n\n${text}`,
        { parse_mode: 'HTML' }
      );
      sent++;
    } catch (_) { failed++; }
    await new Promise(r => setTimeout(r, 50));
  }

  await addLog({ type: 'broadcast', userId: OWNER_ID, message: text.slice(0, 300) });

  try {
    await bot.telegram.editMessageText(
      ctx.chat.id, statusMsg.message_id, undefined,
      `✅ <b>Broadcast Done</b>\n\n📤 Sent: <b>${sent}</b>\n❌ Failed: <b>${failed}</b>`,
      { parse_mode: 'HTML' }
    );
  } catch (_) {
    await ctx.reply(`✅ Done — Sent: ${sent} | Failed: ${failed}`);
  }
});

// ══════════════════════════════════════════════════════════════
//  LAUNCH  (webhook on Render · polling locally)
// ══════════════════════════════════════════════════════════════
async function launch() {
  try {
    // Step 1 — always wipe old webhook + queued updates
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('🧹  Cleared webhook & pending updates');

    if (RENDER_URL) {
      // ── WEBHOOK (Render) ───────────────────────────────────
      const path    = `/tg/${BOT_TOKEN}`;
      const fullUrl = `${RENDER_URL}${path}`;

      await bot.telegram.setWebhook(fullUrl, { max_connections: 40 });
      console.log(`🔗  Webhook → ${fullUrl}`);

      const handler = bot.webhookCallback(path);

      http.createServer((req, res) => {
        if (req.method === 'POST' && req.url === path) {
          handler(req, res);
        } else {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('🤖 @HiddenEntryBot is alive');
        }
      }).listen(PORT, () => console.log(`🚀  Listening on port ${PORT}`));

    } else {
      // ── POLLING (local) ────────────────────────────────────
      await bot.launch({ dropPendingUpdates: true });
      console.log('🚀  Polling mode (local dev)');
    }

    const me = await bot.telegram.getMe();
    console.log(`🤖  @${me.username}  ID: ${me.id}`);

  } catch (err) {
    console.error('❌  Launch failed:', err.message);
    process.exit(1);
  }
}

launch();

process.once('SIGINT',  () => { console.log('Stopping…'); bot.stop('SIGINT');  });
process.once('SIGTERM', () => { console.log('Stopping…'); bot.stop('SIGTERM'); });
