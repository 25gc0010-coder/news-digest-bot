import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import Parser from 'rss-parser';
import fetch from 'node-fetch';

console.log('🔥 main.js start');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const parser = new Parser();

const CHANNEL_ID = (process.env.DISCORD_CHANNEL_ID || '').trim();
const REDIS_URL = (process.env.UPSTASH_REDIS_REST_URL || '').trim();
const REDIS_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
const DISCORD_TOKEN = (process.env.DISCORD_TOKEN || '').trim();

const FEED_URL = 'https://news.denfaminicogamer.jp/feed';

console.log('CHANNEL_ID exists:', !!CHANNEL_ID);
console.log('REDIS_URL:', REDIS_URL);
console.log('REDIS_TOKEN exists:', !!REDIS_TOKEN);
console.log('DISCORD_TOKEN exists:', !!DISCORD_TOKEN);

process.on('unhandledRejection', (err) => {
  console.error('❌ unhandledRejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ uncaughtException:', err);
});

async function redisGet(key) {
  console.log('➡ redisGet start:', key);

  const res = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
  });

  console.log('➡ redisGet status:', res.status);

  const data = await res.json();
  return data.result;
}

async function redisSet(key, value) {
  console.log('➡ redisSet start:', key);

  const res = await fetch(
    `${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
    }
  );

  console.log('➡ redisSet status:', res.status);

  const data = await res.json();
  return data.result;
}

async function postNews() {
  try {
    console.log('① RSS取得開始');
    const feed = await parser.parseURL(FEED_URL);
    console.log('② RSS取得成功:', feed.items?.length ?? 0);

    console.log('③ チャンネル取得開始');
    const channel = await client.channels.fetch(CHANNEL_ID);
    console.log('④ チャンネル取得成功:', channel?.id);

    for (const item of feed.items.slice(0, 5)) {
      console.log('⑤ 記事確認:', item.title, item.link);

      const key = `posted:${item.link}`;
      const already = await redisGet(key);
      console.log('⑥ Redis確認結果:', already);

      if (already) continue;

      console.log('⑦ Discord投稿開始');
      await channel.send(`🎮 **新着ゲームニュース**\n**${item.title}**\n${item.link}`);
      console.log('⑧ Discord投稿成功');

      await redisSet(key, '1');
      console.log('⑨ Redis保存成功');

      break;
    }

    console.log('✅ 正常終了');
    process.exit(0);
  } catch (e) {
    console.error('❌ postNews failed:', e);
    process.exit(1);
  }
}

client.once('clientReady', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await postNews();
});

console.log('🔐 login開始');
client.login(DISCORD_TOKEN);
