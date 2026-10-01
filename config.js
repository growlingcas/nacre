/* config.js — the only file you need to edit.
 * change the values in quotes, save, done.                       */
window.NACRE_CONFIG = {

  // your github username + repo name.
  // the site reads fresh memory straight from github, so it updates
  // every 30 minutes without redeploying netlify.
  github: { user: "YOUR_GITHUB_USERNAME", repo: "nacre-autic", branch: "main" },

  links: {
    x: "https://x.com/YOUR_HANDLE",   // the agent's X account
    fomo: "https://x.com/fomo",         // fomo link (put your fomo profile / referral here)
    dexscreener: "",                    // leave empty until the pair exists
    github: ""                          // link to this repository
  },

  token: {
    ticker: "$NACRE",
    contract: ""                        // empty = "not deployed yet"
  }
};
