const target = process.env.CF_ACCESS_CLIENT_ID ? "https://tradeengine.tjluckydog.workers.dev/api/state" : "http://localhost:3000/api/state";
const headers = {
  "CF-Access-Client-Id": process.env.CF_ACCESS_CLIENT_ID,
  "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET,
  "User-Agent": "Mozilla/5.0"
};
if (process.env.Frontend) headers["Authorization"] = `Bearer ${process.env.Frontend}`;

fetch(target, { headers })
  .then(r => { console.log(r.status); return r.text(); })
  .then(t => console.log(t.substring(0, 200)))
  .catch(console.error);
