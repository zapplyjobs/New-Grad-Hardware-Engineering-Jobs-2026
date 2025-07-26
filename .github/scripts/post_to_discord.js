// .github/scripts/post_to_discord.js
import fs from 'fs';
import process from 'process';

const WEBHOOK = process.env.DISCORD_WEBHOOK;
if (!WEBHOOK) {
  console.error('❌ Missing DISCORD_WEBHOOK');
  process.exit(1);
}

(async function() {
  let jobs = [];
  try {
    jobs = JSON.parse(
      fs.readFileSync('.github/data/new_jobs.json', 'utf8')
    );
  } catch {
    console.log('ℹ️ new_jobs.json not found or empty');
    return;
  }
  if (!jobs.length) return console.log('ℹ️ No new jobs to post');

  for (const job of jobs) {
    const payload = {
      username: 'JobBot',
      embeds: [{
        title: job.title,
        description: `**${job.company}** • ${job.location}`,
        url: job.job_apply_link,
        timestamp: job.job_posted_at_datetime_utc
      }]
    };
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log(res.ok
      ? `✅ Posted: ${job.title}`
      : `❌ Failed: ${job.title} – ${await res.text()}`
    );
  }
})();
