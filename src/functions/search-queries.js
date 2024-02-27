const {
    app
} = require('@azure/functions');
require('dotenv').config({
    path: ".env"
});

const {
    GoogleVertexAI
} = require('langchain/llms/googlevertexai')

const getDocumentContent = require('./courses-doc-content');
const admin = require('firebase-admin');

async function generateQueries(content) {
    try {
        const modelname = 'text-bison-32k';
        const model = new GoogleVertexAI({
            model: modelname,
            temperature: 0.2
        })

        const prompt =
            `
        SYSTEM: You are an inteligent document reader which can identify essential keywords and topics from a given document summary and generate search queries for the web which can be used to query additional information from engines like Google and YouTube.
                The same can be used for educational purposes to receive curated content on a said topic (Additional References).
                Do not return a code block.
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
            let body = await request.json();
            let content = body.content;
            let doc_id = body.doc_id;
            let token = request.headers.get("Authorization");
            console.log(body)

            let status = 200,
                res;

            if ((token && doc_id) || (token && content)) {
                token = token.split(" ")[1].trim();
                try {
                    let user = await admin.auth().verifyIdToken(token)
                        .catch(err => {
                            if (err) {
                                status = 403;
                                res = {
                                    success: false,
                                    error: "Forbidden"
                                }

                                return {
                                    body: JSON.stringify(res),
                                    status,
                                    headers: {
                                        'Content-Type': 'application/json'
                                    }
                                };
                            }
                        })
                    console.log(user.uid)

                    let doc;
                    if (doc_id)
                        doc = await getDocumentContent(doc_id, user.uid);

                    res = {
                        success: true,
                        queries: (await generateQueries(content || doc.summary || doc.content)).queries
                    }
                } catch (err) {
                    if (err) {
                        res = {
                            success: false,
                            error: err.message
                        }
                        status = err.status || 500;
                    }
                }
            } else {
                res = {
                    success: false,
                    error: (!token) ? "Unauthorized" : "Bad Request"
                }
                status = (!token) ? 401 : 400;
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