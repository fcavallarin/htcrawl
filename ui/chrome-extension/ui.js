let htcrawlPanel;
chrome.devtools.panels.create(
    "Htcrawl",
    "",
    "ui-panel.html",
    function(panel) {
        htcrawlPanel = panel;
    }
  );
  