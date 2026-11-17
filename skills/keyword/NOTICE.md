# Notices

This skill's code is MIT-licensed, like the rest of the repository. It includes or adapts the following:

- `vendor/wordhoard/sources.js`: the suggestion engine of Wordhoard, a keyword browser extension by the same author, MIT.
  It adapts ideas and word lists from:
  - [pluralize](https://github.com/plurals/pluralize) (MIT): singular/plural rules.
  - [openkeyword](https://github.com/shahruk-maharuj/openkeyword) (MIT): intent word lists.
  - [python-for-seo](https://github.com/HasData/python-for-seo) (HasData): the idea behind the SERP page-type rules.
- `vendor/wordhoard/zipf-en.json`: English word frequencies (Zipf >= 3.0) bucketed from
  [wordfreq](https://github.com/rspeer/wordfreq) 3.x by Robyn Speer, whose data is licensed
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). This file is a derived work and stays under CC BY-SA 4.0,
  not MIT. It is optional: without it, the engine skips the word-frequency term in its popularity score.

Autocomplete endpoints (Google, YouTube, Bing, DuckDuckGo, Amazon, Google Shopping) are public suggestion services
queried at a polite rate. Their terms of service apply to how you use them.
