/** Usage: npm run smpp:push -- <destination E.164> "<text>" [sender] */
async function main() {
  const [to, text, from] = process.argv.slice(2);
  if (!to || !text) {
    console.error('Usage: npm run smpp:push -- +14155550123 "Your code is 123456" [SENDER]');
    process.exit(1);
  }
  const port = process.env.SMPP_SIM_CONTROL_PORT ?? "2776";
  const res = await fetch(`http://127.0.0.1:${port}/deliver`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ to, text, from }),
  }).catch(() => null);
  if (!res) {
    console.error(`Could not reach the simulator control API on port ${port}. Is "npm run smpp:sim" running?`);
    process.exit(1);
  }
  console.log(res.status, await res.text());
}

void main();
