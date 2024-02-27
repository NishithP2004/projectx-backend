const { app } = require('@azure/functions');
const {
    MongoClient,
    ObjectId
} = require('mongodb');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai')
// const tokenizer = require('gpt-tokenizer')

require('dotenv').config({
    path: ".env"
});

const admin = require('firebase-admin');

// TODO: Port to text-bison-32k

async function formatDocument(document) {
    try {
        const model = new ChatGoogleGenerativeAI({
            apiKey: process.env.GOOGLE_PALM_API_KEY,
            temperature: 0.2,
            modelName: "gemini-pro"
        })

        const prompt = `
        SYSTEM: You are an intelligent text formatter.
                Given an unstructured text without any line breaks or new lines, 
                you can intelligently format it and return the output text with the necessary indentation added.
                Format the input as a document.
                IMPORTANT: If the input contains unsafe html like script tags which can cause XSS related attacks, escape them / include them in a code block to avoid execution.
                Heading levels begin from the second level (h2).
                Return the result as a rich markdown file with the headings formatted, enabling the result to be directly rendered by a markdown parser.
        INPUT: ${document}
        `
        let res = await model.invoke(prompt);
        console.log(res.content)
        
        return res.content;
    } catch(err) {
        if(err) {
            console.error(err);
            return null;
        }
    }
}

async function getDocumentContent(doc_id, user) {
    try {
        const client = new MongoClient(process.env.MONGO_CONNECTION_URL)
        const namespace = process.env.MONGO_NAMESPACE;
        const [dbName, ] = namespace.split(".");
        await client.connect();
        console.log("Connected successfully to Cosmos DB")
        const db = client.db(dbName)
        const collection = db.collection("documents-ocr");

        let doc = await collection.findOne({
            _id: new ObjectId(doc_id),
            user
        });
        
        console.log(doc)
        if(!doc.content) throw { message: "Requested document Not Found", status: 404 }

        return {
            content: doc.content,
            summary: doc.summary
        };

    } catch (err) {
        if (err) {
            console.error(err)
            throw err
        }
    }
}

app.http('courses-doc-content', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: "courses/documents/{id}",
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);
        // const MAX_TOKENS = parseInt(process.env.MAX_TOKENS) || 2048;

        let status = 200,
            res;
        let token = request.headers.get("Authorization");
        const doc_id = request.params.id || null;

        if (token && doc_id) {
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

                /* let content = await getDocumentContent(doc_id, user.uid);
                let formatted;
                const tokens = tokenizer.encode(content);
                console.log(tokenizer.isWithinTokenLimit(tokens, MAX_TOKENS))
                if(tokenizer.isWithinTokenLimit(tokens, MAX_TOKENS)) {
                    formatted = await formatDocument(content)
                } else {
                    formatted = content
                } */

                let doc = await getDocumentContent(doc_id, user.uid);

                res = {
                    success: true,
                    content: await formatDocument(doc.content),
                    summary: doc.summary
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
});

module.exports = getDocumentContent