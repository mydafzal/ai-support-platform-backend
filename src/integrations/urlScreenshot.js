const puppeteer = require("puppeteer");

let browser;

async function initializeBrowser() {
  browser = await puppeteer.launch({ headless: true });
}

function getBrowser() {
  return browser;
}

module.exports = {
  initializeBrowser,
  getBrowser,
};
