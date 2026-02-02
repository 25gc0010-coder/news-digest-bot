import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import Parser from 'rss-parser';
import fetch from 'node-fetch';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const parser = new Parser();

// ===== 設定 =====
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// 日本語ゲームニュース（電ファミニコゲーマー）
const FEED_URL = 'https://news.denfaminicogamer.jp/feed';

// ===== Redis helper =====
async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });
  const data = await res.json();
  return data.result;
}

async function redisSet(key, value) {
  const res = await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const data = await res.json();
  return data.result;
}


// ===== メイン処理 =====
async function postNews() {
  try {
    const feed = await parser.parseURL(FEED_URL);
    const channel = await client.channels.fetch(CHANNEL_ID);

    for (const item of feed.items.slice(0, 5)) {
      const key = `posted:${item.link}`;
      const already = await redisGet(key);
      if (already) continue;

      await channel.send(`👾 **新着ゲームニュース**\n**${item.title}**\n${item.link}`);
      await redisSet(key, "1");
      break; // 1回の実行で1件だけ
    }

    process.exit(0); // Cron用：1回実行して終了
  } catch (e) {
    console.error("postNews failed:", e);
    process.exit(1);
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await postNews();
});

client.login(process.env.DISCORD_TOKEN);
