
onCrawlerMessage( message => {
  const c = document.getElementById("console");
  c.innerText += "\n" + message;
  c.scrollTop = c.scrollHeight;
});

document.getElementById('start').onclick = () => {
  pageEval("UI.start()");
};

document.getElementById('stop').onclick = () => {
  pageEval("UI.stop()");
};

document.getElementById('crawl-selected').onclick = () => {
  pageEval("UI.crawlElement()");
};

document.getElementById('click-to-navigate').onclick = () => {
  pageEval("UI.clickToNavigate()")
};

document.getElementById('login').onclick = () => {
  pageEval("UI.login()")
};

document.getElementById('clear-console').onclick = () => {
  document.getElementById('console').innerText = "";
};
