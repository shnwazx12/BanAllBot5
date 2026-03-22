# 🤖 @HiddenEntryBot

> Telegram bot that silently hides join & leave messages in groups.  
> Built with Node.js · Telegraf · MongoDB · Render.com ready.

---

## ✨ Features
- 🙈 Auto-deletes join/left messages in any group
- 📊 Logs every user who starts the bot
- 🏠 Logs every group the bot is added to
- 🔔 Notifies owner on new users & group adds
- 📣 Owner broadcast to all users
- 📋 Owner stats & activity logs
- 🚀 Webhook mode on Render · Polling mode locally

---

## 📁 Files
```
HiddenEntryBot/
├── bot.js          — All bot logic
├── package.json    — Dependencies
├── render.yaml     — Render deploy config
├── .env.example    — Copy → .env
├── .gitignore
└── README.md
```

---

## ⚙️ Setup

### 1. Create Bot
Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy **BOT_TOKEN**

### 2. Get Your Telegram ID
Message [@userinfobot](https://t.me/userinfobot) → copy your numeric **ID**

### 3. MongoDB Atlas (free)
1. [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas) → create free cluster
2. Database Access → Add user (save username & password)
3. Network Access → Add IP `0.0.0.0/0`
4. Connect → Drivers → copy connection string → replace `<password>`

### 4. Configure .env
```bash
cp .env.example .env
# Fill in BOT_TOKEN, OWNER_ID, MONGO_URL
# Leave RENDER_URL blank for local mode
```

### 5. Run Locally
```bash
npm install
npm start
# or: npm run dev   (auto-restart on file changes)
```

---

## 🚀 Deploy to Render

1. Push this folder to a **GitHub repo**
2. [render.com](https://render.com) → **New → Web Service** → connect repo
3. Settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Add these **Environment Variables**:

| Key | Value |
|-----|-------|
| `BOT_TOKEN` | From BotFather |
| `OWNER_ID` | Your numeric ID |
| `MONGO_URL` | Atlas URI |
| `RENDER_URL` | `https://your-service.onrender.com` |

5. Deploy → wait ~2 min → ✅

---

## 💬 Commands

| Command | Access | Description |
|---------|--------|-------------|
| `/start` | Everyone | Welcome message |
| `/help` | Everyone | Usage guide |
| `/stats` | Owner | Users · Groups · Logs count |
| `/logs` | Owner | Last 10 activity entries |
| `/broadcast <text>` | Owner | DM all users |

---

## 🛡️ Group Setup
1. Add **@HiddenEntryBot** to your group
2. Promote as **Admin**
3. Enable **Delete Messages** permission
4. ✅ All join/left notifications are now invisible!

---

## 🔔 Owner Alerts
You get a private message whenever:
- 🟢 New user starts the bot
- 📢 Bot is added to a group
- 🔴 Bot is removed from a group
