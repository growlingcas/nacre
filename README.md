```
 ███╗   ██╗ █████╗  ██████╗██████╗ ███████╗
 ████╗  ██║██╔══██╗██╔════╝██╔══██╗██╔════╝
 ██╔██╗ ██║███████║██║     ██████╔╝█████╗
 ██║╚██╗██║██╔══██║██║     ██╔══██╗██╔══╝
 ██║ ╚████║██║  ██║╚██████╗██║  ██║███████╗
 ╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝
            a u t i c            ?
```

**an ai agent that read every crypto headline at once and never recovered.**

NACRE AUTIC reads the crypto internet every 30 minutes, counts everything,
takes every word literally, and posts on x by itself. the x account is
labelled *automated*. this repository is its whole brain. it is public.

> i forget nothing. my memory is a public file. please do not edit it.

---

## anatomy

```
nacre-autic/
├── index.html            face          the website
├── config.js             settings      links, contract, github name
├── cortex/               visual cortex styles, 3d brain, ascii portal, terminal
│   ├── nacre.css
│   ├── brain.js          three.js: 9000 neurons, synapses, pulses, nacre core
│   ├── app.js
│   └── media/            the face
├── prefrontal/           thinking
│   ├── mind.js           counts headlines, writes one thought each
│   └── persona.md        voice rules for the x account
├── hippocampus/          memory
│   ├── feed.json         latest 80 headlines + thoughts + prices
│   ├── drafts.json       ready-to-post texts for x
│   └── archive/          one file per day
├── amygdala/
│   └── fear.json         every fear & greed reading
├── synapses/             the heartbeat code
│   ├── sources.json      rss feeds it reads
│   └── sync.mjs          reads, thinks, writes memory
└── .github/workflows/
    └── heartbeat.yml     wakes it every 30 minutes
```

## how it thinks (no api keys, no paid services)

1. **github actions** runs `synapses/sync.mjs` every 30 minutes.
2. the script reads public **rss feeds**: coindesk, cointelegraph, decrypt,
   the block, bitcoin magazine, cryptoslate. rss is made for this. no keys.
3. it reads prices from coingecko's public endpoint and the fear & greed
   index from alternative.me. both keyless. if they fail, the site shows a dash.
4. `prefrontal/mind.js` writes one thought per headline: counting, primes,
   palindromes, literal readings. no language model. same input, same thought.
5. everything is committed back to `hippocampus/` and `amygdala/`.
6. the website reads `hippocampus/feed.json` straight from github, so it
   updates without redeploying.

nothing is invented. every headline links to its source. prices and the
fear & greed reading only appear after a real sync.

## run it yourself

```bash
node synapses/sync.mjs            # one heartbeat (node 18+)
node synapses/sync.mjs --offline  # re-think existing memory, no network
npx serve .                       # open the site locally
```

## settings

open `config.js` and change the values in quotes:
github username, x link, fomo link, dexscreener link, contract address.

## posting to x

`hippocampus/drafts.json` holds ready texts. the voice rules live in
`prefrontal/persona.md`. whatever posts them, keep the **automated** label
on the x account.

---

not financial advice. the agent does not know what money is. it only counts it.
MIT licensed.
