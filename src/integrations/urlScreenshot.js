const puppeteer = require("puppeteer");

let browser;

async function initializeBrowser() {
  // browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
}

function getBrowser() {
  return browser;
}

module.exports = {
  initializeBrowser,
  getBrowser,
};
