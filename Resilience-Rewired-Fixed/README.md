# Resilience Rewired

## Open the website

1. Extract the ZIP.
2. Open the `dist` folder.
3. Double click `index.html`.

You do not need Python, a server, or a build tool.

## Edit the website

* `dist/index.html`: page structure and wording
* `dist/tangerine.css`: current light Tangerine inspired visual design
* `dist/styles.css`: original shared styles
* `dist/app.js`: core functionality and official benchmark formulas
* `dist/extras.js`: new interactive features
* `dist/data/*.json`: original account data, summary and optional insights
* `scripts/`: data generation and test scripts
* `integrations/`: sample SQL for Tiger Data and Snowflake

Changes to the HTML, CSS and JavaScript files appear the next time you refresh the page.
If you change any JSON file, regenerate the local data script with:

```
python scripts/rebuild_embedded.py
```

The `data/embedded.js` file is what lets a browser open the page directly from disk without CORS or local server errors.

The Nunito Sans font loads from Google Fonts when you have internet. The website uses a system font when offline. All core functionality remains available.

The data is anonymized and historical. This is an educational concept, not a bank account service or financial advice.
