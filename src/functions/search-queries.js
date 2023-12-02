const {
    app
} = require('@azure/functions');
require('dotenv').config({
    path: ".env"
});

const {
    GoogleVertexAI
} = require('langchain/llms/googlevertexai')

async function generateQueries(content) {
    try {
        const modelname = 'text-bison-32k';
        const model = new GoogleVertexAI({
            model: modelname,
            temperature: 0.2
        })

        const prompt =
            `
        SYSTEM: You are an inteligent document reader which can identify essential keywords and topics from a given document and generate search queries for the web which can be used to query additional information from engines like Google and YouTube.
                The same can be used for educational purposes to receive curated content on a said topic (Additional References).
                Return the result as follows (atmost 10 different search queries) as a *JSON object* in *plain text* format:
                {
                    queries: [
                        query1,
                        query2,
                        ...
                    ]
                }
        INPUT: 
                ${content}
        `

        const aiResponse = await model.call(prompt);
        return JSON.parse(aiResponse.replace(/\`{3}[json]*/gi, ""));
    } catch (err) {
        if (err) {
            console.error(err);
            return null;
        }
    }
}
app.http('search-queries', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);
        if (request.method == "GET") {
            return {
                body: JSON.stringify({
                    message: "Hello World"
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        } else {
            let content = (await request.json()).content;
            let status, res;

            if (content) {
                res = {
                    success: true,
                    queries: (await generateQueries(content)).queries
                }
                status = 200;
            } else {
                res = {
                    error: "Bad Request",
                    success: false
                }
                status = 400;
            }

            return {
                body: JSON.stringify(res),
                status,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
        }
    }
});