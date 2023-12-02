const {
    app
} = require('@azure/functions');
const puppeteer = require('puppeteer');
const {
    NodeHtmlMarkdown
} = require('node-html-markdown');
require('dotenv').config({
    path: ".env"
});

const {
    GoogleVertexAI
} = require('langchain/llms/googlevertexai')

async function cleanup(md) {
    try {
        const modelName = 'text-bison-32k'; // Change Me
        const model = new GoogleVertexAI({
            model: modelName,
            temperature: 0.2,
            maxOutputTokens: 8192
        })

        const prompt = `
    SYSTEM: You are an intelligent markdown parser. 
            When given the markdown representation of a website, you can intelligently identify the irrelevant parts of the page like headers, footers, navlinks, etc and filter them out to return the main content as a markdown file. 
            Make the content look neat and presentable.
            The main idea is to provide a clutter free representation of a website for educational purposes.
    INPUT: 
            ${md}
    `
        let aiResponse = await model.call(prompt);
        return aiResponse.trim().replace(/\`{3}/gi, "")
    } catch (err) {
        if (err) {
            console.error(err);
            return null;
        }
    }
}

async function getPageContent(url) {
    try {
        const browser = await puppeteer.launch({
            executablePath: "chrome-linux/chrome",
            args: ['--no-sandbox'],
            headless: true
        })
        const page = await browser.newPage();
        await page.goto(url, {
            waitUntil: "networkidle0"
        });
        const content = await page.evaluate(() => document.body.innerHTML);
        //  console.log(content);
        await browser.close();
        return content;
    } catch (err) {
        if (err) {
            console.error(err);
            return null
        }
    }
}

app.http('browser', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const url = request.query.get('url') || null;
        const aiEnhanced = (request.query.get('aiEnhanced'))? true: false;
        let msg, status;
        if (url) {
            const content = await getPageContent(url);
            const md = NodeHtmlMarkdown.translate(content);
            (aiEnhanced)? msg = await cleanup(md): msg = md;
            status = 200;
        } else {
            msg = "Bad Request"
            status = 400;
        }
        return {
            status,
            body: msg,
            headers: {
                "Content-Type": "text/plain"
            }
        };
    }
});