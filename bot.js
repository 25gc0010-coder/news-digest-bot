require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const fetch = require("node-fetch");
const Parser = require("rss-parser");
const parser = new Parser();

// ====== 必須ENV ======
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const POST_CHANNEL_ID = process.env.POST_CHANNEL_ID;
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// ====== RSS（日本語優先：4Gamer例） ======
const RSS_LIST = [
  "https://www.4gamer.net/rss/index.xml"
];

// ====== Redis REST helpers (Upstash) ======
async function redisGet(key) {
  const r = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  return r.json();
}
async function redisSet(key, value) {
  await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
}

// ====== 既出判定キー ======
function seenKey(url) {
  return `seen:${url}`;
}

// ====== 1件選ぶ（注目度は簡易：最新順） ======
async function pickOneNews() {
  for (const rss of RSS_LIST) {
    const feed = await parser.parseURL(rss);
    if (!feed.items?.length) continue;

    // 最新から探して「未投稿」を1件返す
    for (const item of feed.items) {
      const url = item.link;
      const title = item.title;
      if (!url || !title) continue;

      const saved = await redisGet(seenKey(url));
      if (saved.result) continue;

      return { title, url };
    }
  }
  return null;
}

// ====== 投稿処理 ======
async function postOnce(client) {
  const channel = await client.channels.fetch(POST_CHANNEL_ID);
  if (!channel) throw new Error("POST_CHANNEL_ID のチャンネルが見つかりません");

  const news = await pickOneNews();
  if (!news) {
    console.log("未投稿ニュースが見つからない（または取得失敗）");
    return;
  }

  await channel.send(`🆕 **新着情報（日本語）**\n${news.title}\n${news.url}`);
  await redisSet(seenKey(news.url), "1");
  console.log("投稿:", news.title);
}

// ====== スケジュール（1日2回：12時間おき） ======
function startSchedule(client) {
  // 起動時に1回
  postOnce(client).catch(e => console.error(e));

  // 12時間ごと
  setInterval(() => {
    postOnce(client).catch(e => console.error(e));
  }, 1000 * 60 * 60 * 12);
}

// ====== Discord login ======
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
  startSchedule(client);
});

client.login(DISCORD_TOKEN);
